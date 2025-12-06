import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

const s3 = new S3Client({});

export function newAudioKey() {
  return `summaries/${new Date()
    .toISOString()
    .slice(0, 10)}/${crypto.randomUUID()}.mp3`;
}

export async function putMp3(params: {
  bucket: string;
  key: string;
  bytes: Uint8Array;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      Body: params.bytes,
      ContentType: 'audio/mpeg',
      CacheControl: 'no-store',
    })
  );
}

export async function presignMp3Url(params: {
  bucket: string;
  key: string;
  expiresSeconds: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: params.expiresSeconds });
}
