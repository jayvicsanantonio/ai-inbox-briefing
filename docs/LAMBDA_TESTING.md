# Lambda Testing From Your Machine

How to exercise the deployed Lambdas directly via AWS CLI (no CDK deploy needed).

## Prerequisites
- AWS credentials configured (env vars or `~/.aws/credentials`), with access to invoke the functions.
- Region set (export `AWS_REGION=us-west-1` or pass `--region`).
- AWS CLI installed (`aws --version`).
- Be aware of live side effects: invoking `Daily` will hit Gmail, Gemini, ElevenLabs, Twilio and can place a call.

## Quick local smoke (no AWS)
If you just want to sanity check code locally with your `.env`:
```sh
pnpm dev:daily
```

## Deploy updated code before invoking
Invoking a Lambda runs whatever is currently deployed. To ensure your latest changes are live, deploy first:
```sh
pnpm cdk deploy                # standard deploy (add --profile/--region if needed)
# or, for faster dev-only code updates:
pnpm cdk deploy --hotswap      # skips full CFN update; use for code/config tweaks only
```
You can sanity check synthesis/diffs beforehand:
```sh
pnpm cdk synth
pnpm cdk diff
```

## Invoke the deployed Daily Lambda
Replace the function name if it differs in your account. The current stack created:
`AiInboxBriefingStack-DailyFn064080AD-IbYaCVg3Y5Gr`

```sh
aws lambda invoke \
  --function-name AiInboxBriefingStack-DailyFn064080AD-IbYaCVg3Y5Gr \
  --region us-west-1 \
  /tmp/response.json
```

Notes:
- This function expects no payload; it reads secrets from SSM and will run the full Gmail→Gemini→TTS→Twilio flow.
- Output is written to `/tmp/response.json`; inspect it with `cat /tmp/response.json`.
- To change region or profile: add `--profile <name>` and/or `--region <region>`.

## Check logs after invoke
```sh
aws logs tail /aws/lambda/AiInboxBriefingStack-DailyFn064080AD-IbYaCVg3Y5Gr --follow --region us-west-1
```

## Invoking other Lambdas
- Find function names: `aws lambda list-functions --region us-west-1 | rg AiInboxBriefingStack`.
- Invoke with payload: `aws lambda invoke --function-name <fn> --payload '{...}' out.json`.
- Always confirm the function’s side effects (e.g., calls, emails) before running against prod.**
