/**
 * Get Presigned URL Lambda
 *
 * Instead of uploading files through your server (which costs you bandwidth
 * and Lambda execution time), the client uploads directly to S3.
 *
 * The flow:
 * 1. Frontend calls this Lambda: "I want to upload resume.pdf"
 * 2. This Lambda creates a "presigned URL" — a special S3 URL that includes
 *    a cryptographic signature allowing one specific upload operation
 * 3. Frontend uses that URL to PUT the file directly to S3
 * 4. S3 verifies the signature and accepts the upload
 *
 * The presigned URL:
 * - Is valid for a limited time (5 minutes here)
 * - Is locked to a specific S3 key (file path)
 * - Is locked to a specific HTTP method (PUT)
 * - Doesn't expose any AWS credentials to the client
 *
 * This Lambda also creates a DynamoDB record to track the document.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";

// SDK clients are created OUTSIDE the handler function.
// Lambda reuses the same execution environment for multiple invocations
// (called "warm starts"). By creating clients outside the handler, they're
// reused across invocations — saving the overhead of creating new connections.
const s3Client = new S3Client({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BUCKET_NAME = process.env.BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;

interface UploadRequest {
  fileName: string;
  fileType: string;
  userId: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body: UploadRequest = JSON.parse(event.body || "{}");
    const { fileName, fileType, userId } = body;

    if (!fileName || !fileType || !userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing fileName, fileType, or userId" }),
      };
    }

    const documentId = randomUUID();
    // The S3 "key" is the full path to the object in the bucket.
    // We prefix with "uploads/" so our S3 event notification (which
    // filters on prefix "uploads/") will trigger the processor.
    const s3Key = `uploads/${userId}/${documentId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    // Create the document record in DynamoDB BEFORE the upload.
    // Status starts as "pending" — the processDocument Lambda will
    // update it to "processing" then "complete" or "failed".
    const now = new Date().toISOString();
    await ddbClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`,
          GSI1PK: `USER#${userId}`,
          GSI1SK: `STATUS#pending#${now}`,
          documentId,
          userId,
          fileName,
          fileType,
          s3Key,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadUrl, documentId, s3Key }),
    };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to generate upload URL" }),
    };
  }
};
