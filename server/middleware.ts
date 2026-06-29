import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from './auth-utils';

export type AuthVariables = {
  user: {
    userId: string;
    email: string;
  };
};

export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, 'auth_token');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const payload = await verifyJWT(token);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', payload);
  await next();
}
