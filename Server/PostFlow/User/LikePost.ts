import { db } from '../../../db';

export async function likePost(postId: string): Promise<void> {
    await db.query(
        `
        UPDATE posts
        SET likes = likes + 1
        WHERE id = $1;
        `,
        [postId]
    );
}