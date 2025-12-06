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
      console.log('\nYour REFRESH TOKEN (save this somewhere safe):');
      console.log(tokens.refresh_token);
    } else {
      console.log(
        '\nNo refresh_token returned. Try again with prompt=consent and access_type=offline.'
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
