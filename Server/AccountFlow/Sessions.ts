import { createHash } from 'crypto';
import { db } from '../../db';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
  await db.query(
    `
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, hashToken(token), expiresAt],
  );
}

export async function hasActiveSession(token: string): Promise<boolean> {
  const result = await db.query(
    `
      SELECT 1
      FROM sessions
      WHERE token_hash = $1
        AND expires_at > NOW()
      LIMIT 1
    `,
    [hashToken(token)],
  );

  return result.rows.length === 1;
}

export async function revokeSession(token: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function deleteExpiredSessions(): Promise<void> {
  await db.query('DELETE FROM sessions WHERE expires_at <= NOW()');
}
