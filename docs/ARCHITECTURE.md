# AI Inbox Briefing Agent - Complete Technical Documentation

This comprehensive documentation covers every aspect of how the AI Inbox Briefing Agent is built and implemented, including the tools used, AWS services, estimated costs, and the reasoning behind each infrastructure and code decision.

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [AWS Services Deep Dive](#aws-services-deep-dive)
5. [External API Services](#external-api-services)
6. [Code Architecture](#code-architecture)
7. [Infrastructure as Code (CDK)](#infrastructure-as-code-cdk)
8. [Security Architecture](#security-architecture)
9. [Cost Estimation](#cost-estimation)
10. [Design Decisions & Rationale](#design-decisions--rationale)

---

## Executive Summary

The **AI Inbox Briefing Agent** is a serverless application that:

1. **Triggers daily at 11:00 AM Pacific Time** via AWS EventBridge Scheduler
2. **Summarizes unread Gmail using AI** via Google Gemini (gemini-2.0-flash) and a tool call that fetches Gmail via OAuth 2.0
3. **Converts summary to natural speech** using ElevenLabs TTS
4. **Converts summary to natural speech** using ElevenLabs TTS
5. **Uploads audio to S3** and stores metadata in DynamoDB
6. **Places an outbound phone call** via Twilio that plays the audio summary

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI Inbox Briefing Agent                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  EventBridge │───▶│   Daily      │───▶│   Gmail      │                   │
│  │  Scheduler   │    │   Lambda     │    │   API        │                   │
│  │  (11:00 AM)  │    └──────────────┘    └──────────────┘                   │
│  └──────────────┘           │                                                │
│                             ▼                                                │
│                    ┌──────────────┐                                          │
│                    │   Google     │                                          │
│                    │   Gemini AI  │                                          │
│                    └──────────────┘                                          │
│                             │                                                │
│                             ▼                                                │
│                    ┌──────────────┐                                          │
│                    │  ElevenLabs  │                                          │
│                    │     TTS      │                                          │
│                    └──────────────┘                                          │
│                             │                                                │
│              ┌──────────────┼──────────────┐                                 │
│              ▼              ▼              ▼                                 │
│     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                       │
│     │     S3       │ │   DynamoDB   │ │   Twilio     │                       │
│     │   (Audio)    │ │  (Metadata)  │ │   Call API   │                       │
│     └──────────────┘ └──────────────┘ └──────────────┘                       │
│              │              │              │                                 │
│              └──────────────┼──────────────┘                                 │
│                             ▼                                                │
│                    ┌──────────────┐    ┌──────────────┐                      │
│                    │   TwiML      │◀───│   Twilio     │                      │
│                    │   Lambda     │    │   Webhook    │                      │
│                    └──────────────┘    └──────────────┘                      │
│                             │                                                │
│                             ▼                                                │
│                    ┌──────────────┐                                          │
│                    │  📞 Phone    │                                          │
│                    │    Call      │                                          │
│                    └──────────────┘                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

### Data Flow

1. **EventBridge Scheduler** triggers `DailyFn` Lambda at 11:00 AM Pacific Time
2. **DailyFn Lambda**:
   - Loads secrets from AWS SSM Parameter Store
   - Uses Gemini tool-calling to fetch unread emails via Gmail API (OAuth) and generate structured summary
   - Converts summary to speech via ElevenLabs TTS
   - Uploads MP3 to S3
   - Stores metadata record in DynamoDB
   - Initiates outbound call via Twilio
3. **Twilio** calls your phone and requests TwiML from `/twiml` endpoint
4. **TwimlFn Lambda**:
   - Looks up summary record in DynamoDB
   - Generates presigned S3 URL for audio
   - Returns TwiML instructions to Twilio
5. **Twilio** plays the greeting and audio summary

### Directory Structure

```
ai-inbox-briefing/
├── src/
│   ├── infra/                 # CDK Infrastructure
│   │   ├── app.ts            # CDK app entry point
│   │   └── app-stack.ts      # Main stack definition
│   ├── lambdas/              # Lambda function handlers
│   │   ├── daily.ts          # Scheduled daily job
│   │   └── twiml.ts          # Twilio TwiML endpoint
│   ├── lib/                  # Shared library modules
│   │   ├── gmail.ts          # Gmail API client
│   │   ├── summarize.ts      # AI summarization logic
│   │   ├── tts-elevenlabs.ts # ElevenLabs TTS client
│   │   ├── storage.ts        # S3 operations
│   │   ├── summary-store.ts  # DynamoDB operations
│   │   ├── secrets.ts        # SSM secrets loader
│   │   └── twilio.ts         # Twilio call client
│   └── local/                # Local testing harness
│       └── run-daily.ts      # Local daily job runner
├── scripts/
│   ├── google-auth.ts        # OAuth flow for Gmail
│   └── create-ssm-param.ts   # SSM parameter creator
├── docs/
│   ├── ARCHITECTURE.md       # This file
│   └── SSM_SETUP.md          # Secrets setup guide
├── package.json
├── tsconfig.json
├── cdk.json
└── .env.example
```

---

## Technology Stack

### Core Technologies

| Category            | Technology | Version | Purpose                                 |
| ------------------- | ---------- | ------- | --------------------------------------- |
| **Language**        | TypeScript | ^5.9.3  | Type-safe development                   |
| **Runtime**         | Node.js    | 20.x    | Lambda runtime                          |
| **Package Manager** | pnpm       | 10.14.0 | Fast, disk-efficient package management |
| **Build Tool**      | esbuild    | ^0.27.1 | Fast bundling for Lambda                |
| **Dev Runner**      | tsx        | ^4.21.0 | TypeScript execution for local dev      |

### Production Dependencies

| Package                         | Version  | Purpose                           |
| ------------------------------- | -------- | --------------------------------- |
| `googleapis`                    | ^167.0.0 | Gmail API access                  |
| `ai`                            | ^5.0.107 | Vercel AI SDK core                |
| `@ai-sdk/google`                | ^2.0.44  | Google Gemini provider for AI SDK |
| `@elevenlabs/elevenlabs-js`     | ^2.26.0  | ElevenLabs TTS SDK                |
| `twilio`                        | ^5.10.7  | Twilio Voice API                  |
| `zod`                           | ^4.1.13  | Schema validation                 |
| `@aws-sdk/client-s3`            | ^3.946.0 | S3 operations                     |
| `@aws-sdk/s3-request-presigner` | ^3.946.0 | Presigned URL generation          |
| `@aws-sdk/client-dynamodb`      | ^3.946.0 | DynamoDB client                   |
| `@aws-sdk/lib-dynamodb`         | ^3.946.0 | DynamoDB document client          |
| `@aws-sdk/client-ssm`           | ^3.946.0 | SSM Parameter Store               |
| `express`                       | ^5.2.1   | OAuth callback server             |

### Development Dependencies

| Package          | Version   | Purpose                  |
| ---------------- | --------- | ------------------------ |
| `aws-cdk`        | ^2.1033.0 | CDK CLI                  |
| `aws-cdk-lib`    | ^2.232.1  | CDK constructs library   |
| `constructs`     | ^10.4.3   | CDK constructs base      |
| `typescript`     | ^5.9.3    | TypeScript compiler      |
| `@types/node`    | ^24.10.1  | Node.js type definitions |
| `@types/express` | ^5.0.6    | Express type definitions |
| `eslint`         | ^9.39.1   | Code linting             |

---

## AWS Services Deep Dive

### 1. AWS Lambda

**Two Lambda functions are deployed:**

#### DailyFn Lambda

- **Purpose**: Orchestrates the entire daily email summary pipeline
- **Trigger**: EventBridge Scheduler (cron)
- **Runtime**: Node.js 20.x
- **Memory**: 1024 MB (increased for AI/TTS processing)
- **Timeout**: 2 minutes
- **Entry Point**: `src/lambdas/daily.ts`

#### TwimlFn Lambda

- **Purpose**: Serves TwiML instructions to Twilio
- **Trigger**: API Gateway HTTP endpoint
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB
- **Timeout**: Default (3 seconds)
- **Entry Point**: `src/lambdas/twiml.ts`

---

### 2. Amazon S3

**AudioBucket** - Private bucket for MP3 audio files

| Setting              | Value      | Rationale                                    |
| -------------------- | ---------- | -------------------------------------------- |
| Block Public Access  | BLOCK_ALL  | Security - audio accessed via presigned URLs |
| Encryption           | S3_MANAGED | Encryption at rest                           |
| Lifecycle Expiration | 2 days     | Cost optimization - old audio auto-deleted   |
| Removal Policy       | DESTROY    | Clean teardown in dev/staging                |
| Auto Delete Objects  | true       | Cleanup on stack deletion                    |

**Key Pattern**: `summaries/YYYY-MM-DD/<uuid>.mp3`

---

### 3. Amazon DynamoDB

**Summaries Table** - Stores metadata linking summaryId to S3 audio files

| Attribute   | Type        | Description                  |
| ----------- | ----------- | ---------------------------- |
| `summaryId` | String (PK) | UUID identifying the summary |
| `s3Key`     | String      | S3 object key for the MP3    |
| `createdAt` | String      | ISO timestamp                |
| `expiresAt` | Number      | Unix epoch for TTL deletion  |

| Setting        | Value           | Rationale                                     |
| -------------- | --------------- | --------------------------------------------- |
| Billing Mode   | PAY_PER_REQUEST | Cost-effective for low, unpredictable traffic |
| TTL Attribute  | `expiresAt`     | Auto-delete records after 6 hours             |
| Removal Policy | DESTROY         | Clean teardown                                |

---

### 4. Amazon API Gateway (HTTP API)

**Endpoint**: `/twiml`

| Setting     | Value                          |
| ----------- | ------------------------------ |
| Type        | HTTP API (v2)                  |
| Methods     | GET, POST                      |
| Integration | Lambda (HttpLambdaIntegration) |

**Why HTTP API instead of REST API?**

- Lower latency
- Lower cost ($1.00/million vs $3.50/million)
- Simpler for this use case

---

### 5. Amazon EventBridge Scheduler

**Daily11am Schedule**

| Setting         | Value                 | Rationale              |
| --------------- | --------------------- | ---------------------- |
| Schedule        | `cron(0 11 * * ? *)`  | 11:00 AM every day     |
| Timezone        | `America/Los_Angeles` | Pacific Time awareness |
| Flexible Window | OFF                   | Exact execution time   |

**Why EventBridge Scheduler instead of CloudWatch Events?**

- Native timezone support (critical for this use case)
- Automatic DST handling

---

### 6. AWS Systems Manager Parameter Store

**Parameter**: `/ai-inbox-briefing/secrets`

| Setting    | Value                     |
| ---------- | ------------------------- |
| Type       | SecureString              |
| Encryption | AWS managed key (default) |

**Why SSM Parameter Store instead of Secrets Manager?**

- **Cost**: Standard parameters are free (vs $0.40/secret/month)
- **Simplicity**: Single JSON blob
- **Sufficient for use case**: No automatic rotation needed

---

### 7. AWS IAM

**Lambda Execution Roles** - CDK auto-generates with least-privilege:

| Lambda  | Permissions                                        |
| ------- | -------------------------------------------------- |
| DailyFn | S3 ReadWrite, DynamoDB ReadWrite, SSM GetParameter |
| TwimlFn | S3 Read, DynamoDB Read, SSM GetParameter           |

---

## External API Services

### 1. Gmail API (Google Cloud)

| Setting     | Value                        |
| ----------- | ---------------------------- |
| API         | Gmail API v1                 |
| Scopes      | `gmail.readonly`             |
| Auth        | OAuth 2.0 with refresh token |
| Query       | `is:unread newer_than:2d`    |
| Max Results | 15 emails                    |

### 2. Google Gemini AI

| Setting | Value                               |
| ------- | ----------------------------------- |
| Model   | `gemini-2.0-flash`                  |
| SDK     | Vercel AI SDK with `@ai-sdk/google` |
| Output  | Structured JSON via Zod schema      |

### 3. ElevenLabs TTS

| Setting        | Value                                |
| -------------- | ------------------------------------ |
| SDK            | `@elevenlabs/elevenlabs-js`          |
| Voice Settings | stability: 0.4, similarityBoost: 0.8 |
| Output Format  | MP3 (audio/mpeg)                     |

### 4. Twilio Voice

| Feature        | Implementation                      |
| -------------- | ----------------------------------- |
| Call Creation  | `client.calls.create()`             |
| TwiML Delivery | HTTP webhook to `/twiml` endpoint   |
| Audio Playback | `<Play>` verb with presigned S3 URL |

---

## Cost Estimation

### Monthly Cost Breakdown (1 run/day)

#### AWS Services

| Service                   | Usage                      | Monthly Cost           |
| ------------------------- | -------------------------- | ---------------------- |
| **Lambda**                | ~30 runs × 10s avg = 5 min | **~$0.01**             |
| **S3**                    | ~30 MP3s × 2MB = 60MB      | **~$0.01**             |
| **DynamoDB**              | ~30 puts + 30 gets         | **~$0.00** (free tier) |
| **API Gateway**           | ~30 requests               | **~$0.00**             |
| **EventBridge Scheduler** | 1 schedule                 | **Free**               |
| **SSM Parameter Store**   | Standard param             | **Free**               |

**AWS Subtotal**: **~$0.02/month**

#### External APIs

| Service           | Usage                             | Monthly Cost |
| ----------------- | --------------------------------- | ------------ |
| **Twilio**        | Phone number + 30 calls × 1.5 min | **~$3-5**    |
| **ElevenLabs**    | ~30 × 500 chars = 15,000 chars    | **~$1-5**    |
| **Google Gemini** | ~30 API calls                     | **~$0.50-1** |
| **Gmail API**     | Unlimited (within quota)          | **Free**     |

**External Subtotal**: **~$5-11/month**

### Total Estimated Cost

| Scenario                                    | Monthly Cost   |
| ------------------------------------------- | -------------- |
| Minimal usage (1 call/day, short summaries) | **~$5/month**  |
| Typical usage (1 call/day, 2 min audio)     | **~$8/month**  |
| Heavy usage (missed calls, retries)         | **~$15/month** |

---

## Design Decisions & Rationale

### 1. Why Serverless Architecture?

For a once-daily task, serverless is dramatically more cost-effective:

- Pay only for actual execution time
- No server maintenance
- Automatic scaling

### 2. Why EventBridge Scheduler over CloudWatch Events?

Key requirement: Run at 11:00 AM _Pacific Time_ regardless of DST.

- Native timezone support
- Automatic DST handling

### 3. Why SSM Parameter Store over Secrets Manager?

- **Cost**: Free vs $0.40/secret/month
- **Simplicity**: Single JSON blob
- No rotation needed for this use case

### 4. Why S3 + Presigned URLs for Audio?

- Scalable and secure
- Cost-effective storage
- Auto-cleanup via lifecycle policies

### 5. Why Vercel AI SDK?

- Type-safe structured output with Zod
- Easy provider switching
- Standardized error handling

### 6. Why Google Gemini over OpenAI?

- Lower cost
- Faster inference (flash model)
- Strong summarization performance

### 7. Why ElevenLabs over AWS Polly?

- Superior voice quality (most natural-sounding)
- Better for personal assistant use case

### 8. Why DynamoDB with TTL?

- Serverless-friendly
- Automatic cleanup via TTL
- Links summaryId to s3Key securely

---

## Quick Reference

### NPM Scripts

```bash
# Local development
pnpm dev:daily          # Run daily job locally
pnpm auth:google        # Start OAuth flow for Gmail

# AWS
pnpm create:ssm         # Create SSM secrets from .env
pnpm cdk:synth         # Synthesize CloudFormation
pnpm cdk:diff          # Show pending changes
pnpm cdk:deploy        # Deploy to AWS
```

### Environment Variables

```bash
# Gmail OAuth
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# AI
GOOGLE_GENERATIVE_AI_API_KEY=

# TTS
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
CALL_TO_NUMBER=
```

---

## Summary

The AI Inbox Briefing Agent is a well-architected serverless application that:

1. **Minimizes cost** through pay-per-use services (~$5-10/month)
2. **Maximizes reliability** through managed AWS services
3. **Ensures security** through encrypted secrets and presigned URLs
4. **Enables maintainability** through TypeScript, CDK, and modular code

| Metric                 | Value          |
| ---------------------- | -------------- |
| Total AWS resources    | 7              |
| External APIs          | 4              |
| Lines of TypeScript    | ~800           |
| Estimated monthly cost | ~$5-10         |
| Daily execution time   | ~15-30 seconds |
