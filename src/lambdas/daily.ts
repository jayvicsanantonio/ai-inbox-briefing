import { fetchUnreadEmails } from '../lib/gmail';
import { summarizeEmails } from '../lib/summarize';
import { elevenLabsTtsMp3 } from '../lib/tts-elevenlabs';
import { newAudioKey, putMp3 } from '../lib/storage';
import { newSummaryId, putSummaryRecord } from '../lib/summary-store';
import { startCall } from '../lib/twilio';
import { loadSecrets } from '../lib/secrets';

const AUDIO_BUCKET = process.env.AUDIO_BUCKET!;
const SUMMARY_TABLE = process.env.SUMMARY_TABLE!;
const SECRETS_PARAM = process.env.SECRETS_PARAM!;
const API_BASE_URL = process.env.API_BASE_URL!;

export async function handler() {
  if (
    !AUDIO_BUCKET ||
    !SUMMARY_TABLE ||
    !SECRETS_PARAM ||
    !API_BASE_URL
  ) {
    throw new Error('Missing required env vars');
  }

  const secrets = await loadSecrets(SECRETS_PARAM);

  const emails = await fetchUnreadEmails({
    clientId: secrets.gmailClientId,
    clientSecret: secrets.gmailClientSecret,
    refreshToken: secrets.gmailRefreshToken,
    maxResults: 15,
    q: 'is:unread newer_than:2d',
  });

  const summary = await summarizeEmails({
    emails,
    googleGenerativeAIApiKey: secrets.googleGenerativeAIApiKey,
  });

  const mp3 = await elevenLabsTtsMp3({
    apiKey: secrets.elevenLabsApiKey,
    voiceId: secrets.elevenLabsVoiceId,
    text: summary.speakable,
    modelId: secrets.elevenLabsModelId,
  });

  const summaryId = newSummaryId();
  const key = newAudioKey();

  await putMp3({ bucket: AUDIO_BUCKET, key, bytes: mp3 });

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = 60 * 60 * 6;
  await putSummaryRecord({
    tableName: SUMMARY_TABLE,
    record: {
      summaryId,
      s3Key: key,
      createdAt: new Date().toISOString(),
      expiresAt: now + ttlSeconds,
    },
  });

  const twimlUrl = `${API_BASE_URL}twiml?summaryId=${encodeURIComponent(
    summaryId
  )}`;

  const call = await startCall({
    accountSid: secrets.twilioAccountSid,
    authToken: secrets.twilioAuthToken,
    to: secrets.callToNumber,
    from: secrets.twilioFromNumber,
    twimlUrl,
  });

  return {
    ok: true,
    unreadCount: summary.unreadCount,
    callSid: call.sid,
    summaryId,
  };
}
