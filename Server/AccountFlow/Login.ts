import { db } from '../../db';
import * as argon2 from '@node-rs/argon2';
import { generateToken, JWT_EXPIRES_IN_MS } from './JWT/JWTGen';
import { createSession } from './Sessions';

export class InvalidCredentialsError extends Error {
    constructor() {
        super('Invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}

export async function loginAccount(username: string, password: string): Promise<string> {
    const existingUser = await db.query(
        'SELECT id, username, password_hash FROM users WHERE username = $1',
        [username]
    );

    if (!existingUser.rows.length) {
        throw new InvalidCredentialsError();
    }

    const user = existingUser.rows[0];
    const isMatch = await argon2.verify(user.password_hash, password);

    if (!isMatch) {
        throw new InvalidCredentialsError();
    }

    const token = await generateToken({ username: user.username, userId: user.id });
    await createSession(user.id, token, new Date(Date.now() + JWT_EXPIRES_IN_MS));
    return token;
}
