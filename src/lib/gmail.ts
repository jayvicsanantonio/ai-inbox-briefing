import { google } from 'googleapis';

export type GmailMessage = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

function header(
  headers:
    | { name?: string | null; value?: string | null }[]
    | undefined,
  name: string
) {
  const h = headers?.find(
    (x) => (x.name ?? '').toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? '';
}

export async function fetchUnreadEmails(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  maxResults?: number;
  q?: string;
}): Promise<GmailMessage[]> {
  const oauth2 = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret
  );
  oauth2.setCredentials({ refresh_token: params.refreshToken });

  // The googleapis library handles token refreshment automatically.
  // We can listen for the 'tokens' event to see if a refresh occurred.
  oauth2.on('tokens', (tokens) => {
    if (tokens.access_token) {
      console.log('[gmail] Access token refreshed');
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults: params.maxResults ?? 15,
    q: params.q ?? 'is:unread newer_than:2d',
  });

  const ids = (list.data.messages ?? [])
    .map((m) => m.id)
    .filter((x): x is string => Boolean(x));

  if (ids.length === 0) return [];

  const out: GmailMessage[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = msg.data.payload?.headers;

    out.push({
      id,
      from: header(headers, 'From'),
      subject: header(headers, 'Subject'),
      date: header(headers, 'Date'),
      snippet: msg.data.snippet ?? '',
    });
  }

  return out;
}
