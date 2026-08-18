import * as http from 'http';
import { type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import { createAccount } from './Server/AccountFlow/Signup';
import { loginAccount } from './Server/AccountFlow/Login';
import { logoutAccount } from './Server/AccountFlow/Logout';
import { checkToken } from './Server/AccountFlow/JWT/JWTCheck';
import { loadPosts } from './Server/PostFlow/LoadPosts';
import { makePost } from './Server/PostFlow/User/MakePost';
import { deletePost } from './Server/PostFlow/User/DeletePost';
import { likePost } from './Server/PostFlow/User/LikePost';
import { deletePosts } from './Server/Cron/DeletePosts';
import { idToName } from './Server/Converters/idToName';
import { closeDb } from './db';

const PORT = Number(process.env.PORT ?? '3000');
const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24; // once per day

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function notFound(res: ServerResponse): void {
  jsonResponse(res, 404, { error: 'Not found' });
}

function badRequest(res: ServerResponse, message: string): void {
  jsonResponse(res, 400, { error: message });
}

function unauthorized(res: ServerResponse): void {
  jsonResponse(res, 401, { error: 'Unauthorized' });
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

async function withAuth(req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | null> {
  const token = getBearerToken(req);
  if (!token) {
    unauthorized(res);
    return null;
  }

  const payload = await checkToken(token);
  if (!payload) {
    unauthorized(res);
    return null;
  }

  return payload;
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathnameRaw = url.pathname;
    const normalizedPath = pathnameRaw.startsWith('/api')
      ? pathnameRaw.slice('/api'.length) || '/'
      : pathnameRaw;
    const pathname = normalizedPath || '/';
    const method = req.method ?? 'GET';

    if (pathname === '/health' && method === 'GET') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    if (pathname === '/' && method === 'GET') {
      res.writeHead(302, { Location: '/Site/' });
      res.end();
      return;
    }

    if (pathname === '/signup' && method === 'POST') {
      const body = await parseJsonBody(req);
      const username = String(body.username ?? '');
      const password = String(body.password ?? '');

      if (!username || !password) {
        return badRequest(res, 'username and password are required');
      }

      await createAccount(username, password);
      return jsonResponse(res, 201, { message: 'Account created' });
    }

    if (pathname === '/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const username = String(body.username ?? '');
      const password = String(body.password ?? '');

      if (!username || !password) {
        return badRequest(res, 'username and password are required');
      }

      const token = await loginAccount(username, password);
      return jsonResponse(res, 200, { token });
    }

    if (pathname === '/logout' && method === 'POST') {
      const token = getBearerToken(req);
      await logoutAccount(token ?? undefined);
      return jsonResponse(res, 200, { message: 'Logged out' });
    }

    if (pathname === '/posts' && method === 'GET') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      const radius = Number(url.searchParams.get('radius'));

      if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
        return badRequest(res, 'lat, lng, and radius query parameters are required');
      }

      const posts = await loadPosts(lat, lng, radius);
      return jsonResponse(res, 200, { posts });
    }

    if (pathname === '/posts' && method === 'POST') {
      const body = await parseJsonBody(req);
      const auth = await withAuth(req, res);
      if (!auth) return;

      const userId = String((auth.userId ?? auth.username ?? '') as unknown);
      const contents = String(body.contents ?? '');
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const expiresAt = new Date(body.expiresAt);

      if (!userId || !contents || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(expiresAt.getTime())) {
        return badRequest(res, 'contents, lat, lng, and expiresAt are required');
      }

      await makePost(userId, contents, lat, lng, expiresAt);
      return jsonResponse(res, 201, { message: 'Post created' });
    }

    const postMatch = pathname.match(/^\/posts\/([^/]+)(?:\/([^/]+))?$/);
    if (postMatch) {
      const postId = postMatch[1]!;
      const action = postMatch[2];

      if (action === 'like' && method === 'POST') {
        await likePost(postId);
        return jsonResponse(res, 200, { message: 'Post liked' });
      }

      if (!action && method === 'DELETE') {
        const auth = await withAuth(req, res);
        if (!auth) return;

        const userId = String((auth.userId ?? auth.username ?? '') as unknown);
        await deletePost(userId, postId);
        return jsonResponse(res, 200, { message: 'Post deleted' });
      }
    }

    notFound(res);
  } catch {
    jsonResponse(res, 500, { error: 'Internal server error' });
  }
}

function startCleanup(): void {
  setInterval(async () => {
    try {
      await deletePosts();
    } catch {
      // ignore cleanup errors
    }
  }, CLEANUP_INTERVAL_MS);
}

// Converters / helper wrappers
export async function getAuthorName(userId: string): Promise<string | null> {
  return idToName(userId);
}

// In serverless environments (Vercel) we export `handleRequest` and
// provide lightweight API wrappers under `/api/` that call this function.
// Long-running timers or process signal handlers are not used here.
