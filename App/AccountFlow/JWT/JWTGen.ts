import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';
const secret = new TextEncoder().encode(JWT_SECRET);

export async function generateToken(payload: JWTPayload, expiresIn: string = '1h'): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, secret);
    return payload;
}
