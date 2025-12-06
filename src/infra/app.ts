#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AppStack } from './app-stack';

const app = new cdk.App();

new AppStack(app, 'AiInboxBriefingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
