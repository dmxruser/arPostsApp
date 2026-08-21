import { db } from '../../db';
import { deleteExpiredSessions } from '../AccountFlow/Sessions';

export async function deletePosts(): Promise<void> {
    await db.query(`
        DELETE FROM posts
        WHERE expires_at <= NOW();`
    );

    await deleteExpiredSessions();
}
