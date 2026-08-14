import { Pool, type QueryResult } from 'pg';

// Initialize the pool with your database configurations. Use environment variables in production.
const pool = new Pool({
  user: process.env.DB_USER ?? 'dmxruser',
  host: process.env.DB_HOST ?? 'localhost',
  database: process.env.DB_NAME ?? 'arposts',
  password: process.env.DB_PASSWORD ?? 'password',
  port: Number(process.env.DB_PORT ?? '5432'),
});

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
    return pool.query(text, safeParams);
  },
};

export async function closeDb(): Promise<void> {
  await pool.end();
}
