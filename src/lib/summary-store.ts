import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'node:crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type SummaryRecord = {
  summaryId: string;
  s3Key: string;
  createdAt: string;
  expiresAt: number; // epoch seconds for TTL
};

export function newSummaryId() {
  return crypto.randomUUID();
}

export async function putSummaryRecord(params: {
  tableName: string;
  record: SummaryRecord;
}) {
  if (params.tableName === 'LOCAL_DUMMY') {
    console.log(
      '[Local] Skipping DynamoDB write. Record:',
      params.record
    );
    return;
  }

  await ddb.send(
    new PutCommand({
      TableName: params.tableName,
      Item: params.record,
    })
  );
}

export async function getSummaryRecord(params: {
  tableName: string;
  summaryId: string;
}): Promise<SummaryRecord | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: params.tableName,
      Key: { summaryId: params.summaryId },
    })
  );

  return (res.Item as SummaryRecord) ?? null;
}
