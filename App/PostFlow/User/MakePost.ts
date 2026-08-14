import { db } from '../../../db';

export async function makePost(
    userId: string,
    contents: string,
    lat: number,
    lng: number,
    expiresAt: Date,
): Promise<void> {
    await db.query(
        `
        INSERT INTO posts (user_id, contents, location, expires_at)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5);
        `,
        [userId, contents, lng, lat, expiresAt]
    );
}