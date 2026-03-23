/**
 * Process Document Lambda
 *
 * Core of the pipeline. Triggered automatically by S3 when a file is
 * uploaded to the "uploads/" prefix.
 *
 * When S3 fires a notification, it sends an "S3Event" to this Lambda.
 * The event contains details about what happened: which bucket, which key,
 * how big the file is, etc. A single event can contain multiple records
 * (if multiple files were uploaded simultaneously), so we loop through them.
 *
 * Pipeline:
 * 1. Parse the S3 event to get the bucket/key
 * 2. Extract the userId and documentId from the key path
 * 3. Update DynamoDB status to "processing"
 * 4. Download the file from S3
 * 5. Send to Anthropic API for analysis
 * 6. Store results in DynamoDB, status to "complete"
 * 7. Notify the user via WebSocket
 * 8. Publish an event to EventBridge
 *
 * If anything fails, we catch the error, update status to "failed",
 * and still notify the user.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import Anthropic from "@anthropic-ai/sdk";
import { S3Event } from "aws-lambda";

const s3Client = new S3Client({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

// The ApiGatewayManagementApi client lets us push data to connected
// WebSocket clients. The endpoint is the WebSocket API URL.
const wsClient = new ApiGatewayManagementApiClient({
  endpoint: WEBSOCKET_ENDPOINT,
});

const anthropic = new Anthropic();

/**
 * Convert an S3 object body (a ReadableStream) to a string.
 * S3 returns file contents as a stream for memory efficiency —
 * you don't want to load a 1GB file into memory all at once.
 * For our document sizes, converting to string is fine.
 */
async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Notify user via WebSocket.
 * Looks up all active connections for the user and sends the message
 * to each one (a user might have multiple tabs open).
 */
async function notifyUser(userId: string, message: object): Promise<void> {
  const connections = await ddbClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "CONN#",
      },
    })
  );

  if (!connections.Items?.length) return;

  const notifications = connections.Items.map(async (conn) => {
    try {
      await wsClient.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(JSON.stringify(message)),
        })
      );
    } catch (err: any) {
      // 410 Gone = the client disconnected but we haven't cleaned up yet.
      // This is normal in WebSocket APIs — connections can drop at any time.
      if (err.statusCode === 410) {
        await ddbClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: `CONN#${conn.connectionId}` },
            UpdateExpression: "SET #s = :s",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":s": "disconnected" },
          })
        );
      }
    }
  });

  await Promise.all(notifications);
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // S3 URL-encodes the key in the event (spaces become "+", etc.)
    // We need to decode it to get the actual key.
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Extract userId and documentId from the key path:
    // "uploads/{userId}/{documentId}/{fileName}"
    const parts = key.split("/");
    const userId = parts[1];
    const documentId = parts[2];
    const fileName = parts.slice(3).join("/");

    const now = new Date().toISOString();

    try {
      // Mark as processing
      await ddbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: `DOC#${documentId}` },
          UpdateExpression:
            "SET #s = :s, GSI1SK = :gsi1sk, updatedAt = :now",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":s": "processing",
            ":gsi1sk": `STATUS#processing#${now}`,
            ":now": now,
          },
        })
      );

      await notifyUser(userId, {
        type: "status",
        documentId,
        status: "processing",
        fileName,
      });

      // Download file from S3
      const s3Response = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const fileContent = await streamToString(s3Response.Body);

      // Send to Anthropic API for structured analysis
      const analysis = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Analyze this document thoroughly. Provide your analysis in the following JSON format:
{
  "summary": "A concise 2-3 sentence summary of the document",
  "documentType": "The type of document (e.g., contract, resume, report, article, code, etc.)",
  "keyFindings": ["Array of key findings or important points"],
  "entities": ["Array of important entities mentioned (people, organizations, dates, amounts)"],
  "sentiment": "Overall sentiment (positive, negative, neutral, mixed)",
  "topics": ["Array of main topics covered"],
  "actionItems": ["Array of any action items or recommendations"],
  "riskFlags": ["Array of any potential issues, risks, or concerns"],
  "confidenceScore": 0.95
}

IMPORTANT: Return ONLY valid JSON, no markdown or extra text.

Document filename: ${fileName}
Document content:
${fileContent.substring(0, 100000)}`,
          },
        ],
      });

      let analysisText =
        analysis.content[0].type === "text" ? analysis.content[0].text : "";

      // Strip markdown code fences if present
      analysisText = analysisText
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();

      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(analysisText);
      } catch {
        parsedAnalysis = {
          summary: analysisText.substring(0, 500),
          documentType: "unknown",
          keyFindings: [],
          entities: [],
          sentiment: "neutral",
          topics: [],
          actionItems: [],
          riskFlags: [],
          confidenceScore: 0,
        };
      }

      const completedAt = new Date().toISOString();

      // Store results in DynamoDB
      await ddbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: `DOC#${documentId}` },
          UpdateExpression:
            "SET #s = :s, analysis = :a, GSI1SK = :gsi1sk, updatedAt = :now, completedAt = :ca",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":s": "complete",
            ":a": parsedAnalysis,
            ":gsi1sk": `STATUS#complete#${completedAt}`,
            ":now": completedAt,
            ":ca": completedAt,
          },
        })
      );

      // Push results to user via WebSocket
      await notifyUser(userId, {
        type: "complete",
        documentId,
        fileName,
        status: "complete",
        analysis: parsedAnalysis,
        completedAt,
      });

      // Publish event to EventBridge for downstream consumers
      await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: "doculens.processor",
              DetailType: "DocumentAnalyzed",
              EventBusName: EVENT_BUS_NAME,
              Detail: JSON.stringify({
                documentId,
                userId,
                fileName,
                status: "complete",
                documentType: parsedAnalysis.documentType,
                completedAt,
              }),
            },
          ],
        })
      );

      console.log(`Processed document ${documentId}`);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);

      const failedAt = new Date().toISOString();

      await ddbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: `DOC#${documentId}` },
          UpdateExpression:
            "SET #s = :s, GSI1SK = :gsi1sk, updatedAt = :now, errorMessage = :err",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":s": "failed",
            ":gsi1sk": `STATUS#failed#${failedAt}`,
            ":now": failedAt,
            ":err":
              error instanceof Error ? error.message : "Unknown error",
          },
        })
      );

      await notifyUser(userId, {
        type: "error",
        documentId,
        fileName,
        status: "failed",
        error: "Document processing failed. Please try again.",
      });
    }
  }
};
