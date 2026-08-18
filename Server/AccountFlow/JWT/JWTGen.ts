import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';

export type JWTPayload = jwt.JwtPayload;

export async function generateToken(payload: jwt.JwtPayload | string | object, expiresIn: string = '1h'): Promise<string> {
    return jwt.sign(payload as object, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] } as jwt.SignOptions);
}

export async function verifyToken(token: string): Promise<jwt.JwtPayload> {
    return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}
