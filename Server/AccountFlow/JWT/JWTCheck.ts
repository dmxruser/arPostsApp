import { verifyToken } from './JWTGen';
import { hasActiveSession } from '../Sessions';

export async function checkToken(token: string): Promise<Record<string, unknown> | null> {
    try {
        const decoded = await verifyToken(token);
        if (typeof decoded !== 'object' || decoded === null) {
            return null;
        }

        return await hasActiveSession(token) ? decoded : null;
    } catch {
        return null;
    }
}
