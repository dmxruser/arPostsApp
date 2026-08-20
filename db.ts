import { Pool, type QueryResult } from 'pg';

// Serverless-friendly cached pool: reuse across invocations when possible.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function makePool(): Pool {
  // Prefer DATABASE_URL when available, otherwise fall back to individual vars.
  if (process.env.DATABASE_URL) {
    // Sanitize values in case the env var was set in the form "KEY=value" by mistake.
    const rawDatabaseUrl = process.env.DATABASE_URL as string;
    const databaseUrl = rawDatabaseUrl.includes('=') && !rawDatabaseUrl.startsWith('postgres://')
      ? rawDatabaseUrl.slice(rawDatabaseUrl.indexOf('=') + 1)
      : rawDatabaseUrl;

    // Log the host we will attempt to connect to (helps debug ENOTFOUND from Vercel).
    try {
      const parsed = new URL(databaseUrl);
      // eslint-disable-next-line no-console
      console.info('db.makePool using DATABASE_URL host', parsed.hostname, 'port', parsed.port || '(default)', 'ssl', process.env.DB_SSL === 'true');
    } catch {
      // ignore parse errors — we'll let pg report them during connection attempts
    }

    // Build ssl config: allow specifying SNI via DB_SERVERNAME for Supavisor/pooler
    const useSsl = process.env.DB_SSL === 'true';
    const sslConfig: any = useSsl ? { rejectUnauthorized: true } : undefined;
    // sanitize DB_SERVERNAME if present (strip accidental KEY= prefix)
    if (useSsl && process.env.DB_SERVERNAME) {
      const raw = process.env.DB_SERVERNAME as string;
      const servername = raw.includes('=') ? raw.slice(raw.indexOf('=') + 1) : raw;
      sslConfig.servername = servername;
    }

    // eslint-disable-next-line no-console
    console.info('db.makePool using DATABASE_URL host', (() => { try { return new URL(databaseUrl as string).hostname; } catch { return '(unknown)'; } })(), 'ssl', useSsl, 'ssl.servername', sslConfig?.servername ?? '(none)');

    const pool = new Pool({ connectionString: databaseUrl, ssl: sslConfig });
    // surface unexpected client errors to logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool as any).on?.('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('db.pool error', { error: err instanceof Error ? err.stack || err.message : err });
    });
    return pool;
  }

  const useSsl = process.env.DB_SSL === 'true';
  const sslConfig: any = useSsl ? { rejectUnauthorized: true } : undefined;
  if (useSsl && process.env.DB_SERVERNAME) {
    sslConfig.servername = process.env.DB_SERVERNAME;
  }

  // eslint-disable-next-line no-console
  console.info('db.makePool using individual vars host', process.env.DB_HOST ?? 'localhost', 'port', process.env.DB_PORT ?? '5432', 'ssl', useSsl, 'ssl.servername', sslConfig?.servername ?? '(none)');

  return new Pool({
    user: process.env.DB_USER ?? 'dmxruser',
    host: process.env.DB_HOST ?? 'localhost',
    database: process.env.DB_NAME ?? 'arposts',
    password: process.env.DB_PASSWORD ?? 'password',
    port: Number(process.env.DB_PORT ?? '5432'),
    ssl: sslConfig,
  });
}

const pool: Pool = global.__pgPool ??= makePool();

function sanitizeValue(value: unknown): unknown {
  // Trim string parameters before sending to the database. Callers should
  // still use parameterized queries to avoid SQL injection.
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const obj: any = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = sanitizeValue(v);
    }
    return obj;
  }

  return value;
}

function containsUnparameterizedStringLiteral(sql: string): boolean {

  const re = /(=|IN\s*\(|LIKE)\s*'[^']+'/i;
  return re.test(sql);
}

function escapeSqlSingleQuotedLiterals(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    // Handle single-line comment -- ...\n
    if (ch === '-' && i + 1 < n && sql[i + 1] === '-') {
      out += sql[i];
      i++;
      out += sql[i];
      i++;
      while (i < n && sql[i] !== '\n') {
        out += sql[i];
        i++;
      }
      continue;
    }

    // Handle block comment /* ... */
    if (ch === '/' && i + 1 < n && sql[i + 1] === '*') {
      out += sql[i];
      i++;
      out += sql[i];
      i++;
      while (i + 1 < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        out += sql[i];
        i++;
      }
      if (i + 1 < n) {
        out += sql[i];
        i++;
        out += sql[i];
        i++;
      }
      continue;
    }

    // Handle dollar-quoted strings: $tag$...$tag$
    if (ch === '$') {
      // attempt to match $tag$
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        const tag = m[0];
        // copy tag
        out += tag;
        i += tag.length;
        // find closing tag
        const idx = sql.indexOf(tag, i);
        if (idx === -1) {
          // no closing tag; copy rest and break
          out += sql.slice(i);
          break;
        }
        out += sql.slice(i, idx + tag.length);
        i = idx + tag.length;
        continue;
      }
    }

    if (ch === "'") {
      // start of literal
      out += "'";
      i++;
      let content = '';
      while (i < n) {
        if (sql[i] === "'") {
          if (i + 1 < n && sql[i + 1] === "'") {
            // escaped quote inside literal -> append one quote to content
            content += "'";
            i += 2;
            continue;
          } else {
            // closing quote
            i++;
            break;
          }
        }
        content += sql[i];
        i++;
      }

      // Re-escape any single quotes in the content (double them)
      const escapedContent = content.replace(/'/g, "''");
      out += escapedContent + "'";
    } else {
      out += ch;
      i++;
    }
  }

  return out;
}

export const db = {
  query: (text: string, params?: any[]): Promise<QueryResult> => {
    if (containsUnparameterizedStringLiteral(text)) {
      // Log a warning so developers can fix code.
      console.warn('db.query: found un-parameterized string literal in SQL; auto-escaping literals. Prefer parameterized queries.');
      text = escapeSqlSingleQuotedLiterals(text);
    }

    const safeParams = params?.map(sanitizeValue);
    return pool.query(text, safeParams).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('db.query error', { text: text?.slice?.(0, 200), params: safeParams, error: err instanceof Error ? err.stack || err.message : err });
      throw err;
    });
  },
};

export async function closeDb(): Promise<void> {
  await pool.end();
}
