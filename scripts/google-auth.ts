import express, { Request, Response } from 'express';
import { google } from 'googleapis';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const REDIRECT_URI =
  process.env.GMAIL_REDIRECT_URI ||
  'http://localhost:4000/auth/callback';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const app = express();

const oAuthClient = new google.auth.OAuth2({
  client_id: GMAIL_CLIENT_ID,
  client_secret: GMAIL_CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

app.get('/auth/google', async (req: Request, res: Response) => {
  const url = await oAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  res.redirect(url);
});

app.get('/auth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).send('No code query param found.');
    return;
  }

  try {
    const { tokens } = await oAuthClient.getToken(code);

    if (tokens.refresh_token) {
      console.log('\n✅ SUCCESS! Your permanent REFRESH TOKEN:');
      console.log('-------------------------------------------');
      console.log(tokens.refresh_token);
      console.log('-------------------------------------------');
      console.log('\nNext Steps:');
      console.log('1. Copy this token.');
      console.log(
        '2. Replace the value of GMAIL_REFRESH_TOKEN in your .env file.'
      );
      console.log(
        '3. Since your app is now in "Production" mode (see GCP console), this token will NOT expire until you manually revoke access.'
      );
    } else {
      console.log(
        '\n⚠️ No refresh_token returned. This usually happens if you were already logged in.'
      );
      console.log(
        'Try again after revoking access here: https://myaccount.google.com/permissions'
      );
    }

    res.send(
      'Auth complete. Check your terminal for tokens. You can close this tab.'
    );
  } catch (error) {
    console.error('Error while exchanging code for tokens', error);
    res
      .status(500)
      .send('Error during token exchange. Check server logs.');
  }
});

console.log('Google Auth Script Started');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    `Visit http://localhost:${PORT}/auth/google to start authentication`
  );
});
