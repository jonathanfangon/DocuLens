# DocuLens

Real-time AI-powered document analysis platform. Upload documents and get instant structured analysis — summaries, key findings, entities, sentiment, risk flags, and action items — powered by Claude AI and delivered in real-time via WebSocket.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
![AWS](https://img.shields.io/badge/AWS-232F3E?logo=amazonaws&logoColor=fff)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000)

## Architecture

```
Browser ──► API Gateway (HTTP) ──► Lambda (presigned URL) ──► S3
                                                               │
                                                          S3 Event
                                                               │
                                                               ▼
Browser ◄── API Gateway (WS) ◄── Lambda (processDocument) ◄── S3
                                       │          │
                                       ▼          ▼
                                   DynamoDB   Claude AI
```

**Event-driven pipeline:** Upload triggers S3 event notification → Lambda downloads the file, sends it to Claude for analysis → results are stored in DynamoDB and pushed to the browser via WebSocket in real-time.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Framer Motion |
| Auth | Amazon Cognito (SRP protocol, JWT tokens) |
| API | API Gateway (HTTP + WebSocket) |
| Compute | AWS Lambda (Node.js) |
| Storage | S3 (documents), DynamoDB (single-table design) |
| AI | Claude AI (Anthropic API) |
| IaC | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions |

## Project Structure

```
├── frontend/          React + Vite app
│   ├── src/
│   │   ├── components/   UI components (AuthScreen, DocumentCard, UploadZone, etc.)
│   │   └── hooks/        Custom hooks (useAuth, useDocuments, useWebSocket)
│   └── .env              Runtime config (API URLs, Cognito IDs)
│
├── backend/           Lambda function handlers
│   └── lambdas/
│       ├── getPresignedUrl/   Generates S3 presigned URLs for direct upload
│       ├── processDocument/   Downloads file, calls Claude AI, stores results
│       ├── getDocuments/      Queries user documents from DynamoDB
│       └── websocket/         Manages WebSocket connections ($connect/$disconnect)
│
├── infrastructure/    AWS CDK stack
│   ├── bin/app.ts         CDK entry point
│   └── lib/doculens-stack.ts  All AWS resources (44 resources)
│
└── .github/workflows/ CI/CD pipelines
    ├── ci.yml             Lint, type-check, build on every push/PR
    └── deploy.yml         CDK deploy to AWS on merge to main
```

## Getting Started

### Prerequisites

- Node.js 22+
- AWS CLI configured (`aws configure`)
- An [Anthropic API key](https://console.anthropic.com/)

### Deploy Infrastructure

```bash
# Install dependencies
cd infrastructure && npm install
cd ../backend && npm install
cd ..

# Set your Anthropic API key
echo "ANTHROPIC_API_KEY=your-key-here" > infrastructure/.env

# Deploy to AWS (first deploy takes ~5 minutes)
cd infrastructure && npx cdk deploy
```

CDK will output the API Gateway URLs and Cognito IDs. Copy them into the frontend config:

### Run Frontend

```bash
cd frontend && npm install

# Create .env with the values from CDK deploy output
cat > .env << EOF
VITE_API_URL=https://your-api-id.execute-api.us-west-1.amazonaws.com
VITE_WS_URL=wss://your-ws-api-id.execute-api.us-west-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-west-1_xxxxx
VITE_USER_POOL_CLIENT_ID=xxxxx
EOF

npm run dev
```

### CI/CD

The GitHub Actions pipeline runs automatically:

- **On every push/PR:** Lints, type-checks, and builds all packages
- **On merge to main:** Deploys infrastructure via `cdk deploy`

Required GitHub Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ANTHROPIC_API_KEY`

## DynamoDB Single-Table Design

All data lives in one table using composite keys:

| Entity | PK | SK |
|---|---|---|
| Document | `USER#{userId}` | `DOC#{timestamp}#{docId}` |
| WebSocket Connection | `USER#{userId}` | `CONN#{connectionId}` |

This allows efficient queries — fetch all documents for a user with a single `Query` on the partition key.
