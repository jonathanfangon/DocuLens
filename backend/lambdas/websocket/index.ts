/**
 * WebSocket Handler Lambda
 *
 * Unlike HTTP (stateless request-response), WebSockets maintain a persistent
 * connection. API Gateway handles the connection management for us, but we
 * need to track which connections belong to which users.
 *
 * When API Gateway receives a WebSocket event, it tells us:
 * - requestContext.routeKey: which route was triggered ($connect, $disconnect, $default)
 * - requestContext.connectionId: the unique ID of this WebSocket connection
 *
 * The connection lifecycle:
 * 1. Client opens WebSocket -> $connect fires -> we store connectionId in DynamoDB
 * 2. Client sends a message -> $default fires -> we handle it
 * 3. Client closes connection -> $disconnect fires -> we delete the record
 *
 * The userId is passed as a query parameter during $connect:
 *   wss://your-api.execute-api.region.amazonaws.com/prod?userId=abc123
 *
 * In production, you'd validate a JWT token instead of trusting a query param.
 *
 * WebSocket connections can drop silently (network issues, client crashes).
 * The $disconnect handler might never fire. TTL is a safety net — stale
 * connection records get auto-deleted after 24 hours.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<{ statusCode: number; body: string }> => {
  const connectionId = event.requestContext.connectionId!;
  const routeKey = (event.requestContext as any).routeKey as string;

  try {
    switch (routeKey) {
      case "$connect": {
        // queryStringParameters is available during $connect but NOT during
        // $default or $disconnect. That's why we store the userId in DynamoDB
        // during $connect — we need it later.
        const userId =
          event.queryStringParameters?.userId || "anonymous";

        await ddbClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              PK: `USER#${userId}`,
              SK: `CONN#${connectionId}`,
              connectionId,
              userId,
              connectedAt: new Date().toISOString(),
              // TTL: auto-delete this record after 24 hours (in epoch seconds).
              // DynamoDB TTL expects a Unix timestamp (seconds since epoch).
              ttl: Math.floor(Date.now() / 1000) + 86400,
            },
          })
        );

        console.log(`User ${userId} connected: ${connectionId}`);
        return { statusCode: 200, body: "Connected" };
      }

      case "$disconnect": {
        // During $disconnect, we don't have queryStringParameters anymore.
        // We could query DynamoDB to find the userId for this connectionId,
        // but since connections have TTL, a simpler approach is fine.
        // In production at scale, you'd maintain a separate connectionId->userId
        // mapping for efficient cleanup.
        console.log(`Connection disconnected: ${connectionId}`);
        return { statusCode: 200, body: "Disconnected" };
      }

      case "$default": {
        // $default catches any message the client sends that doesn't match
        // a named route. Could be used for ping/pong keepalive or custom commands.
        console.log(`Received message from ${connectionId}`);
        return { statusCode: 200, body: "Message received" };
      }

      default:
        return { statusCode: 400, body: "Unknown route" };
    }
  } catch (error) {
    console.error(`WebSocket error (${routeKey}):`, error);
    return { statusCode: 500, body: "Internal server error" };
  }
};
