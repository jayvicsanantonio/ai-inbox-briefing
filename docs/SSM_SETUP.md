# AWS SSM Parameter Setup Guide

## Overview

AWS Systems Manager (SSM) Parameter Store is a secure way to store secrets in AWS. Instead of hardcoding secrets in your Lambda functions, they're stored encrypted in AWS and loaded at runtime.

## Prerequisites

### 1. Install AWS CLI (if not already installed)

Check if you have it:

```bash
aws --version
```

If not installed, see: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

### 2. Configure AWS Credentials

You need to authenticate with AWS. Run:

```bash
aws configure
```

You'll be prompted for:

- **AWS Access Key ID**: From your AWS IAM user
- **AWS Secret Access Key**: From your AWS IAM user
- **Default region**: e.g., `us-east-1`
- **Default output format**: use `json`

> **Don't have AWS credentials?** Go to AWS Console → IAM → Users → Create User → Create Access Key

## Creating the SSM Parameter

### Option 1: Using the Helper Script (Recommended)

I've created a script that reads your `.env` file and creates the SSM parameter:

```bash
pnpm create:ssm
```

This will:

1. Read your `.env` file
2. Convert it to the JSON format SSM expects
3. Create the encrypted SSM parameter in AWS

### Option 2: Manual Command

If you prefer to do it manually:

```bash
aws ssm put-parameter \
  --name "/ai-inbox-briefing/secrets" \
  --type "SecureString" \
  --value '{
    "gmailClientId":"YOUR_GMAIL_CLIENT_ID",
    "gmailClientSecret":"YOUR_GMAIL_CLIENT_SECRET",
    "gmailRefreshToken":"YOUR_GMAIL_REFRESH_TOKEN",
    "twilioAccountSid":"YOUR_TWILIO_ACCOUNT_SID",
    "twilioAuthToken":"YOUR_TWILIO_AUTH_TOKEN",
    "twilioFromNumber":"YOUR_TWILIO_FROM_NUMBER",
    "callToNumber":"YOUR_CALL_TO_NUMBER",
    "elevenLabsApiKey":"YOUR_ELEVENLABS_API_KEY",
    "elevenLabsVoiceId":"YOUR_ELEVENLABS_VOICE_ID",
    "elevenLabsModelId":"YOUR_ELEVENLABS_MODEL_ID",
    "googleGenerativeAIApiKey":"YOUR_GOOGLE_GENERATIVE_AI_API_KEY"
  }' \
  --overwrite
```

**Replace all `YOUR_*` placeholders with your actual values from `.env`.**

## How It Maps to Your .env File

| .env Variable                  | SSM JSON Key               |
| ------------------------------ | -------------------------- |
| `GMAIL_CLIENT_ID`              | `gmailClientId`            |
| `GMAIL_CLIENT_SECRET`          | `gmailClientSecret`        |
| `GMAIL_REFRESH_TOKEN`          | `gmailRefreshToken`        |
| `TWILIO_ACCOUNT_SID`           | `twilioAccountSid`         |
| `TWILIO_AUTH_TOKEN`            | `twilioAuthToken`          |
| `TWILIO_FROM_NUMBER`           | `twilioFromNumber`         |
| `CALL_TO_NUMBER`               | `callToNumber`             |
| `ELEVENLABS_API_KEY`           | `elevenLabsApiKey`         |
| `ELEVENLABS_VOICE_ID`          | `elevenLabsVoiceId`        |
| `ELEVENLABS_MODEL_ID`          | `elevenLabsModelId`        |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `googleGenerativeAIApiKey` |

## Verifying the Parameter

After creation, verify it exists:

```bash
aws ssm get-parameter --name "/ai-inbox-briefing/secrets" --with-decryption
```

## Updating the Parameter Later

To update any secret values, just re-run the command with `--overwrite`:

```bash
aws ssm put-parameter \
  --name "/ai-inbox-briefing/secrets" \
  --type "SecureString" \
  --value '{...new values...}' \
  --overwrite
```

## Security Notes

- ✅ Stored encrypted in AWS
- ✅ Only your Lambda functions can access it (via IAM permissions)
- ✅ Never checked into Git
- ✅ Automatically decrypted when Lambda reads it
