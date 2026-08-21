import { db } from '../../db';
import * as argon2 from '@node-rs/argon2';

export async function deleteAccount(userId: string, password: string): Promise<void> {
    const account = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId],
    );

    if (account.rows.length === 0) {
        throw new Error('Invalid account deletion request');
    }

    const passwordMatches = await argon2.verify(
        account.rows[0].password_hash,
        password,
    );

    if (!passwordMatches) {
        throw new Error('Invalid password');
    }

    await db.query('DELETE FROM users WHERE id = $1', [userId]);
}
