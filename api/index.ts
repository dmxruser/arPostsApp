import { handleRequest } from '../main';

export default async function handler(req: any, res: any) {
  // Basic request-level logging to help diagnose production failures.
  try {
    // Log early so Vercel logs show the incoming invocation even if the function fails.
    // eslint-disable-next-line no-console
    console.info('api request', { method: req?.method, url: req?.url, vercelId: req?.headers?.['x-vercel-id'] });

    await handleRequest(req, res);
  } catch (err) {
    // If something unexpected happens, return 500 and log the error with context.
    // eslint-disable-next-line no-console
    console.error('api/index error', { error: err instanceof Error ? err.stack || err.message : err, method: req?.method, url: req?.url });
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
