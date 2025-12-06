import twilio from 'twilio';

export async function startCall(params: {
  accountSid: string;
  authToken: string;
  to: string;
  from: string;
  twimlUrl: string;
}) {
  const client = twilio(params.accountSid, params.authToken);
  return client.calls.create({
    to: params.to,
    from: params.from,
    url: params.twimlUrl,
  });
}
