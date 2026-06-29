import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword, signJWT } from './auth-utils';
import { authMiddleware, AuthVariables } from './middleware';

export const authRouter = new Hono<{ Variables: AuthVariables }>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid input parameters' }, 400);
    }

    const { email, password } = result.data;

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing) {
      return c.json({ error: 'User already exists' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
    }).returning();

    const token = await signJWT({ userId: newUser.id, email: newUser.email });
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return c.json({ user: { id: newUser.id, email: newUser.email } }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

authRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid input parameters' }, 400);
    }

    const { email, password } = result.data;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const token = await signJWT({ userId: user.id, email: user.email });
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return c.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

authRouter.post('/logout', (c) => {
  deleteCookie(c, 'auth_token', {
    path: '/',
  });
  return c.json({ success: true });
});

authRouter.get('/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({ user });
});
