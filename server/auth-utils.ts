import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-note-sharing-jwt-token-key-change-me';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signJWT(payload: { userId: string; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey);
}

export async function verifyJWT(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as { userId: string; email: string };
  } catch (err) {
    return null;
  }
}
