import { generateText, hasToolCall, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { fetchUnreadEmails, type GmailMessage } from './gmail';

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

const MAX_ATTEMPTS = 2;
const MAX_STEPS_PER_ATTEMPT = 5;

export async function summarizeEmails(params: {
  googleGenerativeAIApiKey: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;
  maxResults?: number;
  q?: string;
}): Promise<CallSummary> {
  const google = createGoogleGenerativeAI({
    apiKey: params.googleGenerativeAIApiKey,
  });

  // Cache emails after first fetch to avoid redundant API calls on retry
  let cachedEmails: GmailMessage[] | null = null;

  // Tool to fetch unread emails
  const getUnreadEmails = tool({
    description:
      'Fetch unread Gmail messages (From, Subject, Date, snippet) for the last 24 hours. Call this first to get the emails to summarize.',
    inputSchema: z.object({}),
    execute: async (): Promise<{ emails: GmailMessage[] }> => {
      // Return cached emails if already fetched
      if (cachedEmails !== null) {
        console.log(
          '[summarize] getUnreadEmails: returning cached emails',
          {
            count: cachedEmails.length,
          }
        );
        return { emails: cachedEmails };
      }

      const maxResults = params.maxResults ?? 15;
      const q = params.q ?? 'is:unread newer_than:2d';
      const started = Date.now();
      console.log(
        '[summarize] getUnreadEmails: start',
        JSON.stringify({ maxResults, q })
      );
      const emails = await fetchUnreadEmails({
        clientId: params.gmailClientId,
        clientSecret: params.gmailClientSecret,
        refreshToken: params.gmailRefreshToken,
        maxResults,
        q,
      });
      console.log(
        '[summarize] getUnreadEmails: done',
        JSON.stringify({
          elapsedMs: Date.now() - started,
          count: emails.length,
        })
      );
      cachedEmails = emails;
      return { emails };
    },
  });

  // Final answer tool - the model calls this to submit the summary
  const submitSummary = tool({
    description:
      'Submit the final email summary. Call this AFTER you have fetched and analyzed the emails using getUnreadEmails. This is how you provide your final answer. YOU MUST CALL THIS TOOL.',
    inputSchema: SummarySchema,
    execute: async (
      summary: CallSummary
    ): Promise<{ success: true }> => {
      console.log('[summarize] submitSummary called');
      return { success: true };
    },
  });

  const system = `
You are a concise executive assistant producing a spoken voicemail-style summary of unread Gmail.

AVAILABLE TOOLS:
1. getUnreadEmails - Fetches unread Gmail messages (From, Subject, Date, snippet) for the last 24 hours
2. submitSummary - Submits your final email summary with structured data (unreadCount, headline, important, quickHits, speakable)

WORKFLOW:
1. Call getUnreadEmails to fetch the current unread emails
2. Analyze the results
3. Call submitSummary with your complete summary

CRITICAL: You MUST call submitSummary to complete the task. Do not just respond with text.

RULES:
- Base all outputs only on tool results and never invent content.
- "speakable" must be under 120 seconds; if unreadCount is 0, keep it under 10 seconds and upbeat.
- unreadCount must equal the number of emails returned by getUnreadEmails.
- Avoid reading long subject lines verbatim—summarize instead.
- Keep "important" to the most critical items (max 8) and "quickHits" as brief skimmable notes (max 12).
- If getUnreadEmails returns no emails, set unreadCount to 0 and keep speakable short.
- Do not invent senders or subjects not present in tool results.
`.trim();

  const tools = { getUnreadEmails, submitSummary };

  // Helper to extract summary from steps
  const extractSummaryFromSteps = (
    steps: Awaited<ReturnType<typeof generateText>>['steps']
  ): CallSummary | null => {
    for (const step of steps) {
      for (const toolCall of step.toolCalls) {
        if (toolCall.toolName === 'submitSummary') {
          return (toolCall as { input: CallSummary }).input;
        }
      }
    }
    return null;
  };

  // Attempt with retries
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[summarize] attempt ${attempt}/${MAX_ATTEMPTS}`);

    const isRetry = attempt > 1;

    // First attempt: Stop when submitSummary is called
    // Retry attempt: Force submitSummary and limit steps
    const { steps } = await generateText({
      model: google('gemini-2.0-flash'),
      tools,
      stopWhen: isRetry
        ? stepCountIs(MAX_STEPS_PER_ATTEMPT)
        : hasToolCall('submitSummary'),
      // On retry, force the model to call submitSummary
      ...(isRetry && {
        toolChoice: {
          type: 'tool' as const,
          toolName: 'submitSummary',
        },
      }),
      system,
      prompt: isRetry
        ? 'You already have the email data. Now call submitSummary with your complete summary. This is required.'
        : 'Summarize the current unread Gmail inbox',
    });

    // Log step details for debugging
    console.log(
      `[summarize] attempt ${attempt} completed`,
      JSON.stringify({
        stepCount: steps.length,
        toolCalls: steps.flatMap((s) =>
          s.toolCalls.map((tc) => tc.toolName)
        ),
      })
    );

    const summary = extractSummaryFromSteps(steps);
    if (summary) {
      console.log(
        '[summarize] summary generated',
        JSON.stringify({
          attempt,
          unreadCount: summary.unreadCount,
          important: summary.important.length,
          quickHits: summary.quickHits.length,
        })
      );
      return summary;
    }

    console.warn(
      `[summarize] attempt ${attempt} did not call submitSummary, steps:`,
      JSON.stringify(
        steps.map((s) => ({
          toolCalls: s.toolCalls.map((tc) => tc.toolName),
          text: s.text?.substring(0, 200),
        })),
        null,
        2
      )
    );
  }

  // All attempts failed
  throw new Error(
    `Model did not call submitSummary tool after ${MAX_ATTEMPTS} attempts`
  );
}
