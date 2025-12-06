import { twiml as TwilioTwiML } from 'twilio';
import { getSummaryRecord } from '../lib/summary-store';
import { presignMp3Url } from '../lib/storage';
import { loadSecrets } from '../lib/secrets';

const AUDIO_BUCKET = process.env.AUDIO_BUCKET!;
const SUMMARY_TABLE = process.env.SUMMARY_TABLE!;
const SECRETS_PARAM = process.env.SECRETS_PARAM!;

type ApiGwEvent = {
  rawPath?: string;
  rawQueryString?: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
};

function xmlResponse(xml: string, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: xml,
  };
}

export async function handler(event: ApiGwEvent) {
  const qs = event.queryStringParameters ?? {};
  const summaryId = qs.summaryId;

  const secrets = await loadSecrets(SECRETS_PARAM);

  if (!summaryId) {
    const vr = new TwilioTwiML.VoiceResponse();
    vr.say('Missing summary id.');
    vr.hangup();
    return xmlResponse(vr.toString(), 400);
  }

  const rec = await getSummaryRecord({
    tableName: SUMMARY_TABLE,
    summaryId,
  });
  const vr = new TwilioTwiML.VoiceResponse();

  if (!rec) {
    vr.say(
      'Sorry, I could not find your summary. It may have expired.'
    );
    vr.hangup();
    return xmlResponse(vr.toString(), 404);
  }

  const audioUrl = await presignMp3Url({
    bucket: AUDIO_BUCKET,
    key: rec.s3Key,
    expiresSeconds: 60 * 10, // 10 minutes
  });

  vr.say('Good morning. Here is your unread email summary.');
  vr.play(audioUrl);
  vr.hangup();

  return xmlResponse(vr.toString());
}
