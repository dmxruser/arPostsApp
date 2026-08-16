import { verifyToken } from './JWTGen';
import { isTokenRevoked } from '../Logout';

export async function checkToken(token: string): Promise<Record<string, unknown> | null> {
    if (isTokenRevoked(token)) {
        return null;
    }

    try {
        const decoded = await verifyToken(token);
        return typeof decoded === 'object' && decoded !== null ? decoded : null;
    } catch {
        return null;
    }
}
