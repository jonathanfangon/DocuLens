#!/usr/bin/env node

/**
 * CDK Entry Point
 *
 * This is where CDK starts. Think of it like index.tsx for your React app,
 * but instead of rendering UI components, it "renders" AWS infrastructure.
 *
 * The `App` is the root — it contains one or more "Stacks."
 * A Stack is a deployable unit of AWS resources (like a Docker Compose file
 * but for cloud infrastructure).
 */

import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { DocuLensStack } from "../lib/doculens-stack";

const app = new cdk.App();

new DocuLensStack(app, "DocuLensStack", {
  env: {
    // These pull from your AWS CLI config (aws configure)
    // so CDK knows which AWS account and region to deploy to
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
