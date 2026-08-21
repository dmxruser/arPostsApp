import { handleRequest } from '../main';

// Vercel routes this file as DELETE /api/account.
export default async function handler(req: any, res: any) {
  return handleRequest(req, res);
}
