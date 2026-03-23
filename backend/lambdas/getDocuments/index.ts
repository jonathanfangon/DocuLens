/**
 * Get Documents Lambda
 *
 * Fetches all documents for a given user from DynamoDB.
 *
 * DynamoDB Query vs Scan:
 * - Query: reads items with a specific partition key. Fast and efficient.
 *   You're reading from a single "partition" — like opening one folder.
 * - Scan: reads EVERY item in the entire table, then filters. Slow and
 *   expensive — like opening every folder to find something.
 *
 * We always use Query when possible. Here, we query by PK = "USER#{userId}"
 * and SK begins_with "DOC#" to get all documents for a user.
 *
 * The "begins_with" condition on the sort key is a powerful DynamoDB pattern.
 * Because items with the same PK are stored sorted by SK, "begins_with"
 * translates to an efficient range read — not a filter after the fact.
 *
 * "ScanIndexForward: false" means return items in DESCENDING sort key order,
 * so the newest documents come first.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing userId parameter" }),
      };
    }

    const result = await ddbClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": "DOC#",
        },
        ScanIndexForward: false, // newest first
      })
    );

    const documents = (result.Items || []).map((item) => ({
      documentId: item.documentId,
      fileName: item.fileName,
      fileType: item.fileType,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      completedAt: item.completedAt,
      analysis: item.analysis,
      errorMessage: item.errorMessage,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    };
  } catch (error) {
    console.error("Error fetching documents:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch documents" }),
    };
  }
};
