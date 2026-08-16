import { db } from '../../db';

export async function deletePosts(): Promise<void> {
    await db.query(`
        DELETE FROM posts
        WHERE expires_at <= NOW();`
    );
}
