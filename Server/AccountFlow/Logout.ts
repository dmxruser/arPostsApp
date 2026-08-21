import { revokeSession } from './Sessions';

export async function logoutAccount(token?: string): Promise<void> {
    if (token) {
        await revokeSession(token.trim());
    }
}
