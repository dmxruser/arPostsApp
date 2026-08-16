import { db } from '../../db';


export async function loadPosts(lat: number, lng: number, radius: number): Promise<any[]> {
    const result = await db.query(
        `
        SELECT *
        FROM posts
        WHERE ST_DWithin(
            location,
            ST_MakePoint($1, $2)::geography,
            $3
        );`,
        [lng, lat, radius]
    );
    return result.rows;
}