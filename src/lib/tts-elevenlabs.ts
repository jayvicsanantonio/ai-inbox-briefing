import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export async function elevenLabsTtsMp3(params: {
  apiKey: string;
  voiceId: string;
  modelId: string;
  text: string;
}): Promise<Uint8Array> {
  const client = new ElevenLabsClient({ apiKey: params.apiKey });

  const audioStream = await client.textToSpeech.convert(
    params.voiceId,
    {
      text: params.text,
      modelId: params.modelId,
      voiceSettings: { stability: 0.4, similarityBoost: 0.8 },
    }
  );

  const chunks: Uint8Array[] = [];
  const reader = audioStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce(
    (acc, chunk) => acc + chunk.length,
    0
  );
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
