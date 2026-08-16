import { db } from '../../db';

export async function idToName(userId: string): Promise<string | null> {
    const result = await db.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].username;
}