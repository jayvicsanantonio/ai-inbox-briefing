import { generateObject } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { GmailMessage } from './gmail';

export const SummarySchema = z.object({
  unreadCount: z
    .number()
    .describe('Total number of unread emails analyzed'),
  headline: z
    .string()
    .describe(
      'A punchy 5-8 word headline summarizing the inbox state'
    ),
  important: z
    .array(
      z.object({
        from: z.string().describe('Sender name or email'),
        subject: z.string().describe('Email subject line'),
        whyImportant: z
          .string()
          .describe('Reason why this email is flagged as important'),
        suggestedAction: z
          .string()
          .describe('Recommended action for the user'),
      })
    )
    .max(8)
    .describe('List of critical emails requiring attention (max 8)'),
  quickHits: z
    .array(
      z.object({
        from: z.string().describe('Sender name or email'),
        subject: z.string().describe('Email subject line'),
        oneLine: z
          .string()
          .describe('One line summary of the email content'),
      })
    )
    .max(12)
    .describe('List of other relevant emails to skim (max 12)'),
  speakable: z
    .string()
    .describe(
      'A natural language script to be spoken by TTS (under 120 seconds)'
    ),
});

export type CallSummary = z.infer<typeof SummarySchema>;

export async function summarizeEmails(params: {
  emails: GmailMessage[];
  googleGenerativeAIApiKey: string;
}): Promise<CallSummary> {
  const google = createGoogleGenerativeAI({
    apiKey: params.googleGenerativeAIApiKey,
  });

  const prompt = `
You are a concise executive assistant producing a spoken voicemail-style summary.

Hard rules:
- "speakable" must be under 120 seconds when spoken.
- If unreadCount is 0, speakable should be 10 seconds max and cheerful.
- Avoid reading long subject lines verbatim. Summarize.

Unread emails:
${JSON.stringify(params.emails, null, 2)}
`.trim();

  const { object } = await generateObject({
    model: google('gemini-2.0-flash'),
    schema: SummarySchema,
    prompt,
  });

  return object;
}
