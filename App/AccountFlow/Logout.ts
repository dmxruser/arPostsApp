const revokedTokens = new Set<string>();

export async function logoutAccount(token?: string): Promise<void> {
    if (token) {
        revokedTokens.add(token.trim());
    }
}

export function isTokenRevoked(token: string): boolean {
    return revokedTokens.has(token.trim());
}
