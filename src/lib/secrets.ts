import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

export type AppSecrets = {
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;

  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  callToNumber: string;

  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;

  googleGenerativeAIApiKey: string;
};

export async function loadSecrets(
  paramName: string
): Promise<AppSecrets> {
  if (paramName === 'LOCAL_DUMMY') {
    return {
      gmailClientId: process.env.GMAIL_CLIENT_ID!,
      gmailClientSecret: process.env.GMAIL_CLIENT_SECRET!,
      gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN!,

      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID!,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN!,
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER!,
      callToNumber: process.env.CALL_TO_NUMBER!,

      elevenLabsApiKey: process.env.ELEVEN_LABS_API_KEY!,
      elevenLabsVoiceId: process.env.ELEVEN_LABS_VOICE_ID!,
      elevenLabsModelId: process.env.ELEVEN_LABS_MODEL_ID!,

      googleGenerativeAIApiKey:
        process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    };
  }

  const res = await ssm.send(
    new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,
    })
  );

  if (!res.Parameter?.Value)
    throw new Error('Missing SSM parameter value');
  return JSON.parse(res.Parameter.Value) as AppSecrets;
}
