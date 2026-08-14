import { db } from '../../db';
import * as argon2 from '@node-rs/argon2';
import { generateToken } from './JWT/JWTGen';

export async function loginAccount(username: string, password: string): Promise<string> {
    const existingUser = await db.query(
        'SELECT id, username, password_hash FROM users WHERE username = $1',
        [username]
    );

    if (!existingUser.rows.length) {
        throw new Error('Username does not exist');
    }

    const user = existingUser.rows[0];
    const isMatch = await argon2.verify(user.password_hash, password);

    if (!isMatch) {
        throw new Error('Invalid password');
    }

    return await generateToken({ username: user.username, userId: user.id });
}