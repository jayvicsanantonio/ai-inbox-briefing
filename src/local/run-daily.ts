// Env vars are loaded via `tsx --env-file=.env` or similar mechanism
// when running this script.

export {};

process.env.AUDIO_BUCKET = 'LOCAL_DUMMY';
process.env.SUMMARY_TABLE = 'LOCAL_DUMMY';
process.env.SECRETS_PARAM = 'LOCAL_DUMMY';
process.env.API_BASE_URL = 'http://localhost:9999/'; // not used locally

console.log('--- Starting Local Daily Job Harness ---');

// Dynamic import to ensure env vars are set before module load
const { handler } = await import('../lambdas/daily');

// For local tests, bypass AWS services by swapping implementations or using mocks.
// The goal is to validate the Gmail -> summarize -> ElevenLabs chain first.
handler()
  .then((res) => {
    console.log('--- Daily Job Completed Successfully ---');
    console.log(JSON.stringify(res, null, 2));
  })
  .catch((err) => {
    console.error('--- Daily Job Failed ---');
    console.error(err);
  });
