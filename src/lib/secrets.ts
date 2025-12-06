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

  // optional: a guard token to protect /twiml
  twimlGuardToken?: string;
};

export async function loadSecrets(
  paramName: string
): Promise<AppSecrets> {
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
