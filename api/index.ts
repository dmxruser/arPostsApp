import { handleRequest } from '../main';

export default async function handler(req: any, res: any) {
  // Vercel provides `req` and `res` compatible with Node's http.IncomingMessage/ServerResponse
  try {
    await handleRequest(req, res);
  } catch (err) {
    // If something unexpected happens, return 500
    // eslint-disable-next-line no-console
    console.error('api/index error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
