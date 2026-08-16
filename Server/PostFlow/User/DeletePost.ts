import { db } from '../../../db';

export async function deletePost(userId: string, postId: string ): Promise<void> {
    await db.query(
        `
        DELETE FROM posts
        WHERE user_id = $1 AND id = $2
        `,
        [userId, postId]
    );
}