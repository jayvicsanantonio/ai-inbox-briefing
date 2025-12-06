import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Helper script to create AWS SSM parameter from .env file
 *
 * This reads your .env file and creates an encrypted SSM parameter
 * in AWS with all your secrets.
 */

interface SecretsConfig {
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
}

const PARAMETER_NAME = '/ai-inbox-briefing/secrets';

function loadEnvFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.error(
      'Please create a .env file with your secrets first.'
    );
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars: Record<string, string> = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }

  return envVars;
}

function createSecretsConfig(
  envVars: Record<string, string>
): SecretsConfig {
  const config: SecretsConfig = {
    gmailClientId: envVars.GMAIL_CLIENT_ID || '',
    gmailClientSecret: envVars.GMAIL_CLIENT_SECRET || '',
    gmailRefreshToken: envVars.GMAIL_REFRESH_TOKEN || '',
    twilioAccountSid: envVars.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: envVars.TWILIO_AUTH_TOKEN || '',
    twilioFromNumber: envVars.TWILIO_FROM_NUMBER || '',
    callToNumber: envVars.CALL_TO_NUMBER || '',
    elevenLabsApiKey: envVars.ELEVENLABS_API_KEY || '',
    elevenLabsVoiceId: envVars.ELEVENLABS_VOICE_ID || '',
    elevenLabsModelId:
      envVars.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    googleGenerativeAIApiKey:
      envVars.GOOGLE_GENERATIVE_AI_API_KEY || '',
  };

  // Validate required fields
  const missingFields: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (!value) {
      missingFields.push(key);
    }
  }

  if (missingFields.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingFields.forEach((field) => console.error(`   - ${field}`));
    console.error('\nPlease add these to your .env file.');
    process.exit(1);
  }

  return config;
}

function createSsmParameter(config: SecretsConfig): void {
  const jsonValue = JSON.stringify(config);

  console.log('🔐 Creating SSM parameter...');
  console.log(`   Parameter: ${PARAMETER_NAME}`);
  console.log(`   Type: SecureString (encrypted)\n`);

  try {
    // Check if AWS CLI is available
    execSync('aws --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ AWS CLI is not installed or not in PATH');
    console.error(
      '   Install from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html'
    );
    process.exit(1);
  }

  try {
    const command = [
      'aws ssm put-parameter',
      `--name "${PARAMETER_NAME}"`,
      '--type "SecureString"',
      `--value '${jsonValue}'`,
      '--overwrite',
    ].join(' ');

    execSync(command, { stdio: 'inherit' });

    console.log('\n✅ SSM parameter created successfully!');
    console.log('\nVerify with:');
    console.log(
      `   aws ssm get-parameter --name "${PARAMETER_NAME}" --with-decryption`
    );
  } catch (error) {
    console.error('\n❌ Failed to create SSM parameter');
    console.error(
      '   Make sure you have AWS credentials configured:'
    );
    console.error('   Run: aws configure');
    process.exit(1);
  }
}

function main() {
  console.log('📋 AWS SSM Parameter Setup\n');
  console.log('This script will:');
  console.log('  1. Read your .env file');
  console.log('  2. Create an encrypted SSM parameter in AWS');
  console.log('  3. Store all secrets securely\n');

  const envVars = loadEnvFile();
  console.log('✅ Loaded .env file\n');

  const config = createSecretsConfig(envVars);
  console.log('✅ Validated secrets\n');

  createSsmParameter(config);
}

main();
