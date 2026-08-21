import { handleRequest } from '../../../main';

// Vercel routes this file as POST /api/posts/:postId/like.
export default async function handler(req: any, res: any) {
  return handleRequest(req, res);
}
