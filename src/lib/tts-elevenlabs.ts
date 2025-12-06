import { ElevenLabsClient } from 'elevenlabs';

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
      model_id: params.modelId,
      voice_settings: { stability: 0.4, similarity_boost: 0.8 },
    }
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
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
