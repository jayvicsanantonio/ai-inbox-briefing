# AI Inbox Briefing

An agentic AI system that autonomously monitors my Gmail inbox and delivers personalized voice briefings via phone call. Built with TypeScript, AWS CDK, and powered by Google Gemini AI (via Vercel AI SDK), ElevenLabs TTS, and Twilio Voice.

## Overview

Every day at 11:00 AM Pacific Time, this system:

1. Fetches my unread Gmail messages
2. Generates a concise spoken summary using Google Gemini AI
3. Converts the summary to natural speech using ElevenLabs
4. Calls my phone and plays the audio briefing

## Architecture

```
EventBridge Scheduler (11:00 AM PT)
         |
         v
   Daily Lambda
         |
         +---> Gmail API (fetch unread emails)
         |
         +---> Google Gemini (generate summary)
         |
         +---> ElevenLabs (text-to-speech)
         |
         +---> S3 (store audio)
         |
         +---> DynamoDB (store metadata)
         |
         +---> Twilio (initiate call)
                   |
                   v
            TwiML Lambda <--- Twilio Webhook
                   |
                   v
            Phone Call (plays audio)
```

## Technology Stack

### Core

- **Language**: TypeScript
- **Runtime**: Node.js 20.x
- **Infrastructure**: AWS CDK
- **Package Manager**: pnpm

### AWS Services

- Lambda (2 functions)
- S3 (audio storage)
- DynamoDB (metadata)
- API Gateway HTTP API
- EventBridge Scheduler
- SSM Parameter Store

### External APIs

- Gmail API (email fetching)
- Google Gemini AI (summarization)
- ElevenLabs (text-to-speech)
- Twilio Voice (phone calls)

## Prerequisites

- Node.js 20+
- pnpm
- AWS CLI configured with credentials
- Accounts for:
  - Google Cloud (Gmail API + Gemini)
  - ElevenLabs
  - Twilio

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-inbox-briefing.git
cd ai-inbox-briefing

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

## Configuration

### 1. Set Up Gmail OAuth

Create OAuth credentials in Google Cloud Console:

1. Enable the Gmail API
2. Create OAuth 2.0 credentials (Web application)
3. Add `http://localhost:4000/auth/callback` as a redirect URI
4. Run the auth script to get a refresh token:

```bash
pnpm auth:google
```

### 2. Configure Environment Variables

Edit `.env` with my credentials:

```bash
# Gmail OAuth
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key

# ElevenLabs
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
CALL_TO_NUMBER=+1xxxxxxxxxx
```

### 3. Create AWS SSM Parameter

Store secrets in AWS SSM Parameter Store:

```bash
pnpm create:ssm
```

See [docs/SSM_SETUP.md](docs/SSM_SETUP.md) for detailed instructions.

## Local Development

Test the daily job locally (writes MP3 to `./tmp/summary.mp3`):

```bash
pnpm dev:daily
```

## Deployment

Deploy to AWS using CDK:

```bash
# Preview changes
pnpm cdk:diff

# Deploy
pnpm cdk:deploy
```

The deployment creates:

- S3 bucket for audio files (auto-expires after 2 days)
- DynamoDB table for summary metadata (TTL enabled)
- Two Lambda functions (DailyFn, TwimlFn)
- HTTP API endpoint for Twilio webhook
- EventBridge schedule for daily triggering

## Project Structure

```
ai-inbox-briefing/
├── src/
│   ├── infra/           # CDK infrastructure
│   │   ├── app.ts
│   │   └── app-stack.ts
│   ├── lambdas/         # Lambda handlers
│   │   ├── daily.ts     # Main daily job
│   │   └── twiml.ts     # Twilio TwiML endpoint
│   ├── lib/             # Shared modules
│   │   ├── gmail.ts
│   │   ├── summarize.ts
│   │   ├── tts-elevenlabs.ts
│   │   ├── storage.ts
│   │   ├── summary-store.ts
│   │   ├── secrets.ts
│   │   └── twilio.ts
│   └── local/           # Local test harness
│       └── run-daily.ts
├── scripts/
│   ├── google-auth.ts
│   └── create-ssm-param.ts
├── docs/
│   ├── ARCHITECTURE.md
│   └── SSM_SETUP.md
├── package.json
├── tsconfig.json
└── cdk.json
```

## NPM Scripts

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `pnpm dev:daily`   | Run daily job locally              |
| `pnpm auth:google` | Start Gmail OAuth flow             |
| `pnpm create:ssm`  | Create SSM parameter from .env     |
| `pnpm cdk:synth`   | Synthesize CloudFormation template |
| `pnpm cdk:diff`    | Preview infrastructure changes     |
| `pnpm cdk:deploy`  | Deploy to AWS                      |

## Cost Estimate

Monthly cost for 1 run per day:

| Service                          | Cost             |
| -------------------------------- | ---------------- |
| AWS (Lambda, S3, DynamoDB, etc.) | ~$0.02           |
| Twilio (number + calls)          | ~$3-5            |
| ElevenLabs                       | ~$1-5            |
| Google Gemini                    | ~$0.50-1         |
| **Total**                        | **~$5-10/month** |

## Documentation

- [Architecture Details](docs/ARCHITECTURE.md) - Full technical documentation
- [SSM Setup Guide](docs/SSM_SETUP.md) - AWS secrets configuration
- [Original Spec](gmail-voice-summary-agent-guide.md) - Initial design guide

## How It Works

### Daily Job (DailyFn)

1. Loads secrets from SSM Parameter Store
2. Fetches unread emails from Gmail (last 2 days, max 15)
3. Generates structured summary using Gemini AI
4. Converts summary text to speech via ElevenLabs
5. Uploads MP3 to S3
6. Stores metadata in DynamoDB with 6-hour TTL
7. Initiates Twilio outbound call

### TwiML Endpoint (TwimlFn)

1. Receives request from Twilio with summaryId
2. Looks up summary record in DynamoDB
3. Generates presigned S3 URL for audio (30-min expiry)
4. Returns TwiML with greeting and audio playback

## Security

- All secrets stored encrypted in SSM Parameter Store
- S3 bucket blocks public access; audio served via presigned URLs
- DynamoDB records auto-expire after 6 hours
- Audio files auto-delete after 2 days

## License

ISC
