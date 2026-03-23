// After running `cdk deploy`, replace these with the actual values
// from the CloudFormation outputs.
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3001",
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:3001",
  userPoolId: import.meta.env.VITE_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || "",
};
