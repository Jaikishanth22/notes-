import { Hono } from 'hono';
import { z } from 'zod';
import { db, shareLinks, notes } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware, AuthVariables } from './middleware';
import bcrypt from 'bcryptjs';

export const shareRouter = new Hono<{ Variables: AuthVariables }>();

// 1. GET /api/share/:token - Validate status, return metadata without note content
shareRouter.get('/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'Invalid token' }, 400);

  try {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token));

    if (!link) {
      return c.json({ error: 'Share link not found' }, 404);
    }

    const isExpired = link.expiresAt ? new Date() > link.expiresAt : false;
    const isOneTimeUsed = link.shareType === 'ONE_TIME' && (link.isRevoked || link.viewCount >= 1);
    const isValid = !link.isRevoked && !isExpired && !isOneTimeUsed;

    return c.json({
      accessType: link.accessType,
      shareType: link.shareType,
      expiresAt: link.expiresAt,
      isRevoked: link.isRevoked,
      viewCount: link.viewCount,
      isValid,
    });
  } catch (error) {
    console.error('Fetch share metadata error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// 2. POST /api/share/:token/unlock - Validate and get note content (with Concurrency Control)
const unlockSchema = z.object({
  password: z.string().optional(),
});

shareRouter.post('/:token/unlock', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'Invalid token' }, 400);

  try {
    const body = await c.req.json().catch(() => ({}));
    const parseResult = unlockSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'Invalid input parameters' }, 400);
    }

    const { password } = parseResult.data;

    // Use a transaction for pessimistic locking (SELECT FOR UPDATE) + optimistic locking (version check)
    const unlockResult = await db.transaction(async (tx) => {
      // Fetch share link with SELECT FOR UPDATE (pessimistic lock)
      const links = await tx
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.token, token))
        .for('update');

      if (links.length === 0) {
        return { error: 'Share link not found', status: 404 };
      }

      const link = links[0];

      // Validation Sequence (strict order per spec):
      // 1. Is Revoked?
      if (link.isRevoked) {
        return { error: 'This link has been revoked.', status: 410 };
      }

      // 2. Is Time Expired?
      if (link.expiresAt && new Date() > link.expiresAt) {
        return { error: 'This link has expired.', status: 410 };
      }

      // 3. Is One-Time already used?
      if (link.shareType === 'ONE_TIME' && link.viewCount >= 1) {
        return { error: 'This one-time link has already been used.', status: 410 };
      }

      // 4. Password valid?
      if (link.accessType === 'PASSWORD') {
        if (!password) {
          return { error: 'Password required', status: 401, requiresPassword: true as const };
        }
        const isPasswordValid = await bcrypt.compare(password, link.passwordHash || '');
        if (!isPasswordValid) {
          return { error: 'Invalid password', status: 401 };
        }
      }

      // If ONE_TIME, mark it as revoked instantly in the SAME transaction (atomic)
      const updatedIsRevoked = link.shareType === 'ONE_TIME' ? true : link.isRevoked;

      // Update with optimistic locking: WHERE version = current_version ensures only ONE wins concurrently
      const updated = await tx
        .update(shareLinks)
        .set({
          viewCount: sql`${shareLinks.viewCount} + 1`,
          version: sql`${shareLinks.version} + 1`,
          isRevoked: updatedIsRevoked,
        })
        .where(and(
          eq(shareLinks.token, token),
          eq(shareLinks.version, link.version)
        ))
        .returning();

      if (updated.length === 0) {
        throw new Error('Concurrency conflict detected');
      }

      // Retrieve Note
      const [note] = await tx
        .select()
        .from(notes)
        .where(eq(notes.id, link.noteId));

      if (!note) {
        return { error: 'Note not found', status: 404 };
      }

      return { note, status: 200 };
    });

    if ('error' in unlockResult) {
      return c.json(
        { error: unlockResult.error, requiresPassword: 'requiresPassword' in unlockResult ? unlockResult.requiresPassword : undefined },
        unlockResult.status as 401 | 404 | 410
      );
    }

    return c.json({ note: unlockResult.note });
  } catch (error: unknown) {
    console.error('Unlock note error:', error);
    if (error instanceof Error && error.message === 'Concurrency conflict detected') {
      return c.json({ error: 'Too many concurrent requests. Please try again.' }, 409);
    }
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// 3. POST /api/share/:token/revoke - Note creator revokes the link instantly
shareRouter.post('/:token/revoke', authMiddleware, async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'Invalid token' }, 400);

  const user = c.get('user');

  try {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token));

    if (!link) {
      return c.json({ error: 'Share link not found' }, 404);
    }

    // Verify user owns the note
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, link.noteId), eq(notes.userId, user.userId)));

    if (!note) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await db
      .update(shareLinks)
      .set({ isRevoked: true })
      .where(eq(shareLinks.token, token));

    return c.json({ success: true, message: 'Link successfully revoked' });
  } catch (error) {
    console.error('Revoke link error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});
