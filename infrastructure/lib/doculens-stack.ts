import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import * as path from "path";

export class DocuLensStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─────────────────────────────────────────────────────────
    // COGNITO — Authentication
    // ─────────────────────────────────────────────────────────
    // A "User Pool" is like a database of users. Cognito handles
    // the entire auth lifecycle: sign-up, sign-in, email verification,
    // password reset, and token issuance.
    //
    // When a user signs in, Cognito returns 3 JWT tokens:
    //   - ID Token: contains user identity claims (email, name, etc.)
    //   - Access Token: used to authorize API calls
    //   - Refresh Token: used to get new ID/Access tokens when they expire
    //
    // "selfSignUpEnabled" lets users register themselves (vs. admin-only creation).
    // "autoVerify" means Cognito will automatically send a verification code to
    // the user's email when they sign up.
    const userPool = new cognito.UserPool(this, "DocuLensUserPool", {
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      // removalPolicy determines what happens when you delete the stack.
      // DESTROY = delete the user pool too. In production, you'd use RETAIN.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // A "User Pool Client" is an app that's allowed to interact with the User Pool.
    // Think of it like an OAuth client ID. Your React app will use this client ID
    // to authenticate users against the User Pool.
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "DocuLensUserPoolClient",
      {
        userPool,
        authFlows: {
          // SRP = Secure Remote Password. The password never crosses the wire —
          // instead, a cryptographic proof is exchanged. This is the recommended
          // auth flow for browser apps.
          userSrp: true,
        },
        // No client secret — frontend apps can't keep secrets (the code is
        // visible in the browser). This is normal and expected for SPAs.
        generateSecret: false,
      }
    );

    // ─────────────────────────────────────────────────────────
    // DYNAMODB — Database
    // ─────────────────────────────────────────────────────────
    // We're using "single-table design" — one table holds ALL entity types
    // (documents, connections, analysis results). This is a DynamoDB best
    // practice because:
    //   1. Fewer tables = fewer connections = lower latency
    //   2. You can fetch related items in a single query
    //   3. It forces you to think about access patterns upfront
    //
    // The "partition key" (PK) is like a folder — items with the same PK
    // are stored together physically. The "sort key" (SK) is like a filename
    // within that folder. Together, PK + SK uniquely identify an item.
    //
    // Example items in our table:
    //   PK: "USER#abc123"  SK: "DOC#doc456"      (a document)
    //   PK: "USER#abc123"  SK: "DOC#doc456#META"  (document metadata)
    //   PK: "CONN#xyz"     SK: "CONN#xyz"          (websocket connection)
    //
    // PAY_PER_REQUEST = you pay per read/write operation instead of provisioning
    // a fixed capacity. Perfect for variable workloads and development.
    const table = new dynamodb.Table(this, "DocuLensTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // TTL = Time To Live. Items with a `ttl` attribute will be automatically
      // deleted after that timestamp. Great for temporary data like WebSocket
      // connection records.
      timeToLiveAttribute: "ttl",
    });

    // A GSI (Global Secondary Index) is like a second "view" of the same data
    // with different keys. This lets us query by GSI1PK/GSI1SK when our
    // primary PK/SK access pattern doesn't fit.
    // Example: fetch all documents by status (processing, complete, failed).
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
    });

    // ─────────────────────────────────────────────────────────
    // S3 — File Storage
    // ─────────────────────────────────────────────────────────
    // This bucket stores uploaded documents. Key S3 concepts:
    //
    // CORS (Cross-Origin Resource Sharing): By default, browsers block
    // requests from your frontend (localhost:5173) to a different domain
    // (s3.amazonaws.com). CORS headers tell the browser "it's okay, this
    // origin is allowed." Without this, uploads from the browser would fail.
    //
    // Lifecycle rules: Automatically transition or delete objects after a
    // time period. Here we auto-delete after 30 days to save costs.
    //
    // "blockPublicAccess: BLOCK_ALL" means no one can make this bucket
    // or its objects public — even accidentally. Access is controlled
    // entirely through IAM policies and presigned URLs.
    const documentBucket = new s3.Bucket(this, "DocuLensDocumentBucket", {
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ["*"], // In production, restrict to your domain
          allowedHeaders: ["*"],
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    // ─────────────────────────────────────────────────────────
    // API GATEWAY — WebSocket API
    // ─────────────────────────────────────────────────────────
    // A WebSocket API maintains a persistent, bidirectional connection
    // between the client and server. Unlike REST (request → response),
    // WebSockets let the server push data to the client at any time.
    //
    // API Gateway manages the WebSocket connections for us:
    //   - $connect: fires when a client opens a connection
    //   - $disconnect: fires when a client closes the connection
    //   - $default: catches any message that doesn't match a custom route
    //
    // Each connected client gets a unique "connectionId" that we store
    // in DynamoDB. When a document finishes processing, we use that
    // connectionId to push the results back to the right user.
    const webSocketApi = new apigatewayv2.WebSocketApi(
      this,
      "DocuLensWebSocketApi",
      {
        apiName: "DocuLensWebSocket",
      }
    );

    // A "Stage" is a deployment of your API — like environments.
    // "prod" is the stage name that becomes part of the URL.
    // autoDeploy means changes to the API are immediately live.
    const webSocketStage = new apigatewayv2.WebSocketStage(
      this,
      "DocuLensWebSocketStage",
      {
        webSocketApi,
        stageName: "prod",
        autoDeploy: true,
      }
    );

    // ─────────────────────────────────────────────────────────
    // LAMBDA FUNCTIONS
    // ─────────────────────────────────────────────────────────
    // Each Lambda handles one responsibility. This is the "single
    // responsibility principle" applied to infrastructure.
    //
    // NodejsFunction is a CDK construct that:
    //   1. Bundles your TypeScript with esbuild (fast bundler)
    //   2. Tree-shakes unused code (smaller = faster cold starts)
    //   3. Creates the Lambda function with the bundled code
    //
    // "Environment variables" are how we pass config to Lambdas.
    // The Lambda code reads process.env.TABLE_NAME to know which
    // DynamoDB table to use. This keeps the code decoupled from
    // specific resource names.

    const backendPath = path.join(__dirname, "../../backend");

    // Generates a "presigned URL" — a temporary, signed URL that lets
    // the browser upload directly to S3 without our server being a
    // middleman. The URL is valid for a limited time and is locked
    // to a specific object key. This is the standard pattern for
    // file uploads in serverless architectures.
    const getPresignedUrlFn = new nodejs.NodejsFunction(
      this,
      "GetPresignedUrlFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(backendPath, "lambdas/getPresignedUrl/index.ts"),
        environment: {
          BUCKET_NAME: documentBucket.bucketName,
          TABLE_NAME: table.tableName,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        bundling: {
          minify: true,
          sourceMap: true,
          forceDockerBundling: false,
        },
      }
    );

    // Triggered when a file lands in S3. Downloads the file, sends it
    // to the Anthropic API for analysis, stores results in DynamoDB,
    // and notifies the user via WebSocket.
    //
    // Higher memory (1024MB) because document processing is CPU/memory
    // intensive. Longer timeout (5 min) because API calls can take
    // time, especially for large documents.
    const processDocumentFn = new nodejs.NodejsFunction(
      this,
      "ProcessDocumentFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(backendPath, "lambdas/processDocument/index.ts"),
        environment: {
          BUCKET_NAME: documentBucket.bucketName,
          TABLE_NAME: table.tableName,
          WEBSOCKET_ENDPOINT: `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        },
        timeout: cdk.Duration.minutes(5),
        memorySize: 1024,
        bundling: {
          minify: true,
          sourceMap: true,
          forceDockerBundling: false,
        },
      }
    );

    // Manages WebSocket lifecycle: $connect, $disconnect, and $default.
    // When a user connects, we store their connectionId + userId in DynamoDB.
    // When they disconnect, we remove it. This mapping is how we know
    // which WebSocket connection belongs to which user.
    const websocketFn = new nodejs.NodejsFunction(this, "WebSocketFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(backendPath, "lambdas/websocket/index.ts"),
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    // Fetches a user's documents and their analysis results from DynamoDB.
    // Called by the frontend when loading the dashboard.
    const getDocumentsFn = new nodejs.NodejsFunction(this, "GetDocumentsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(backendPath, "lambdas/getDocuments/index.ts"),
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    // ─────────────────────────────────────────────────────────
    // IAM PERMISSIONS
    // ─────────────────────────────────────────────────────────
    // IAM (Identity and Access Management) controls WHO can do WHAT
    // to WHICH resources. Every AWS service interaction requires
    // permission — nothing is allowed by default.
    //
    // "Least privilege" means each Lambda gets ONLY the permissions
    // it needs, nothing more. If the presigned URL Lambda only needs
    // to write to S3, it shouldn't be able to read DynamoDB.
    //
    // CDK provides helper methods like grantReadWrite() that generate
    // the right IAM policies automatically — you don't have to write
    // raw JSON policy documents.

    documentBucket.grantReadWrite(getPresignedUrlFn);
    table.grantReadWriteData(getPresignedUrlFn);

    documentBucket.grantRead(processDocumentFn);
    table.grantReadWriteData(processDocumentFn);
    processDocumentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${webSocketStage.stageName}/POST/@connections/*`,
        ],
      })
    );

    table.grantReadWriteData(websocketFn);
    table.grantReadData(getDocumentsFn);

    // ─────────────────────────────────────────────────────────
    // S3 EVENT NOTIFICATION
    // ─────────────────────────────────────────────────────────
    // When any object is created in the bucket under the "uploads/"
    // prefix, S3 automatically invokes our processDocument Lambda.
    // No polling, no cron jobs — it's instant and event-driven.
    //
    // The prefix filter means objects in other "folders" (like "processed/")
    // won't trigger the function.
    documentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processDocumentFn),
      { prefix: "uploads/" }
    );

    // ─────────────────────────────────────────────────────────
    // EVENTBRIDGE — Event Bus
    // ─────────────────────────────────────────────────────────
    // EventBridge is a serverless event bus. Instead of services calling
    // each other directly (tight coupling), they publish events to the bus
    // and rules route events to targets.
    //
    // Why this matters: if you later want to add email notifications when
    // a document is processed, you just add a new rule — you don't touch
    // the processDocument Lambda at all. This is the Open/Closed Principle
    // applied to infrastructure.
    const eventBus = new events.EventBus(this, "DocuLensEventBus", {
      eventBusName: "DocuLensEvents",
    });

    eventBus.grantPutEventsTo(processDocumentFn);
    processDocumentFn.addEnvironment("EVENT_BUS_NAME", eventBus.eventBusName);

    new events.Rule(this, "DocumentAnalyzedRule", {
      eventBus,
      eventPattern: {
        source: ["doculens.processor"],
        detailType: ["DocumentAnalyzed"],
      },
    });

    // ─────────────────────────────────────────────────────────
    // WEBSOCKET ROUTES
    // ─────────────────────────────────────────────────────────
    // Connect the WebSocket API routes to our Lambda function.
    // All three routes ($connect, $disconnect, $default) go to
    // the same Lambda — it uses the "routeKey" in the event to
    // determine which action to take.
    const wsIntegration =
      new apigatewayv2_integrations.WebSocketLambdaIntegration(
        "WebSocketIntegration",
        websocketFn
      );

    webSocketApi.addRoute("$connect", { integration: wsIntegration });
    webSocketApi.addRoute("$disconnect", { integration: wsIntegration });
    webSocketApi.addRoute("$default", { integration: wsIntegration });

    // ─────────────────────────────────────────────────────────
    // HTTP API — REST Endpoints
    // ─────────────────────────────────────────────────────────
    // HttpApi is the newer, cheaper, faster version of REST API in
    // API Gateway. It handles routing HTTP requests to Lambda functions.
    //
    // CORS is configured here too — same reason as S3. The browser
    // needs permission to call our API from a different origin.
    const httpApi = new apigatewayv2.HttpApi(this, "DocuLensHttpApi", {
      apiName: "DocuLensApi",
      corsPreflight: {
        allowOrigins: ["*"], // Restrict in production
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    httpApi.addRoutes({
      path: "/documents/upload",
      methods: [apigatewayv2.HttpMethod.POST],
      integration:
        new apigatewayv2_integrations.HttpLambdaIntegration(
          "GetPresignedUrlIntegration",
          getPresignedUrlFn
        ),
    });

    httpApi.addRoutes({
      path: "/documents",
      methods: [apigatewayv2.HttpMethod.GET],
      integration:
        new apigatewayv2_integrations.HttpLambdaIntegration(
          "GetDocumentsIntegration",
          getDocumentsFn
        ),
    });

    // ─────────────────────────────────────────────────────────
    // OUTPUTS
    // ─────────────────────────────────────────────────────────
    // CloudFormation Outputs are values printed after deployment.
    // These are the URLs and IDs your frontend needs to connect
    // to the backend. You'll put these in your frontend's .env file.
    new cdk.CfnOutput(this, "HttpApiUrl", {
      value: httpApi.url ?? "MISSING",
      description: "HTTP API Gateway URL",
    });

    new cdk.CfnOutput(this, "WebSocketUrl", {
      value: webSocketStage.url,
      description: "WebSocket API URL",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "DocumentBucketName", {
      value: documentBucket.bucketName,
      description: "S3 Document Bucket Name",
    });
  }
}
