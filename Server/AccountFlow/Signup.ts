import { db } from '../../db';
import * as argon2 from '@node-rs/argon2';

export async function createAccount(username: string, password: string): Promise<void> {
    const hashedPassword = await argon2.hash(password);
    await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        [username, hashedPassword]
    );
}
