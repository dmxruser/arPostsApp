import * as http from 'http';
import { type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import dns from 'dns/promises';
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

function serviceUnavailable(res: ServerResponse, message: string): void {
  // eslint-disable-next-line no-console
  console.error('serviceUnavailable', { message });
  jsonResponse(res, 503, { error: 'Service unavailable', message });
}

function ensureDbConfigured(): void {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasLegacyDbConfig = Boolean(process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD);

  if (!hasDatabaseUrl && !hasLegacyDbConfig) {
    throw new Error('Missing DATABASE_URL or DB_* environment variables in Vercel. Set them in Project Settings > Environment Variables.');
  }
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
    // request-level tracing
    // eslint-disable-next-line no-console
    console.info('handleRequest start', { method: req.method, url: req.url });
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathnameRaw = url.pathname || '/';
    const normalizedPath = pathnameRaw === '/api' || pathnameRaw === '/api/'
      ? '/'
      : pathnameRaw.startsWith('/api/')
        ? pathnameRaw.slice('/api'.length)
        : pathnameRaw;
    const pathname = normalizedPath || '/';
    const method = req.method ?? 'GET';

    if (pathname === '/health' && method === 'GET') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    if (pathname === '/debug/dns' && method === 'GET') {
      try {
        const hosts: string[] = [];
        if (process.env.DATABASE_URL) {
          try {
            const rawDb = process.env.DATABASE_URL as string;
            const databaseUrl = rawDb.includes('=') && !rawDb.startsWith('postgres://') ? rawDb.slice(rawDb.indexOf('=') + 1) : rawDb;
            hosts.push(new URL(databaseUrl).hostname);
          } catch {
            // ignore
          }
        }
        if (process.env.DB_SERVERNAME) {
          const raw = process.env.DB_SERVERNAME as string;
          hosts.push(raw.includes('=') ? raw.slice(raw.indexOf('=') + 1) : raw);
        }
        if (process.env.DB_HOST) hosts.push(process.env.DB_HOST);
        if (process.env.SUPABASE_URL) {
          try {
            const u = new URL(process.env.SUPABASE_URL);
            hosts.push(u.hostname);
          } catch {
            hosts.push(process.env.SUPABASE_URL);
          }
        }

        const unique = Array.from(new Set(hosts.filter(Boolean)));
        const results: Record<string, unknown> = {};
        for (const h of unique) {
          results[h] = { ipv4: null, ipv6: null };
          try {
            // resolve4/6 may throw if no records
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (results as any)[h].ipv4 = await dns.resolve4(h).catch((e) => ({ error: String(e) }));
          } catch (e) {
            (results as any)[h].ipv4 = { error: String(e) };
          }
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (results as any)[h].ipv6 = await dns.resolve6(h).catch((e) => ({ error: String(e) }));
          } catch (e) {
            (results as any)[h].ipv6 = { error: String(e) };
          }
        }

        return jsonResponse(res, 200, { hosts: unique, results });
      } catch (err) {
        return serviceUnavailable(res, err instanceof Error ? err.message : String(err));
      }
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

      try {
        ensureDbConfigured();
        await createAccount(username, password);
        return jsonResponse(res, 201, { message: 'Account created' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Database configuration error';
        return serviceUnavailable(res, message);
      }
    }

    if (pathname === '/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const username = String(body.username ?? '');
      const password = String(body.password ?? '');

      if (!username || !password) {
        return badRequest(res, 'username and password are required');
      }

      try {
        ensureDbConfigured();
        const token = await loginAccount(username, password);
        return jsonResponse(res, 200, { token });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Database configuration error';
        return serviceUnavailable(res, message);
      }
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

      try {
        ensureDbConfigured();
        const posts = await loadPosts(lat, lng, radius);
        return jsonResponse(res, 200, { posts });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Database configuration error';
        return serviceUnavailable(res, message);
      }
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('handleRequest error', { error: err instanceof Error ? err.stack || err.message : err, url: req?.url });
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
