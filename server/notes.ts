import { Hono } from 'hono';
import { z } from 'zod';
import { db, notes, shareLinks } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, AuthVariables } from './middleware';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const notesRouter = new Hono<{ Variables: AuthVariables }>();

notesRouter.use('*', authMiddleware);

const createNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  shareType: z.enum(['ONE_TIME', 'TIME_BASED']),
  accessType: z.enum(['PUBLIC', 'PASSWORD']),
  expiresAt: z.string().optional().nullable(),
});

notesRouter.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const result = createNoteSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid input parameters' }, 400);
    }

    const { title, content, shareType, accessType, expiresAt } = result.data;

    let plaintextKey: string | null = null;
    let passwordHash: string | null = null;

    if (accessType === 'PASSWORD') {
      plaintextKey = crypto.randomBytes(4).toString('hex'); // 8 characters hex
      passwordHash = await bcrypt.hash(plaintextKey, 10);
    }

    // Generate unique secure token for sharing
    const token = crypto.randomBytes(16).toString('hex'); // secure 32-char token

    // Parse expiration date
    let expirationDate: Date | null = null;
    if (shareType === 'TIME_BASED' && expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return c.json({ error: 'Invalid expiration date' }, 400);
      }
    }

    // Insert Note & Share Link in transaction
    const response = await db.transaction(async (tx) => {
      const [newNote] = await tx.insert(notes).values({
        userId: user.userId,
        title,
        content,
      }).returning();

      await tx.insert(shareLinks).values({
        token,
        noteId: newNote.id,
        shareType,
        accessType,
        passwordHash,
        expiresAt: expirationDate,
        isRevoked: false,
        viewCount: 0,
        version: 0,
      });

      return { newNote, token };
    });

    return c.json({
      note: response.newNote,
      token: response.token,
      plaintextKey, // Return ONLY ONCE here
    }, 201);
  } catch (error) {
    console.error('Create note error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

notesRouter.get('/', async (c) => {
  try {
    const user = c.get('user');
    const userNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, user.userId))
      .orderBy(desc(notes.createdAt));
    return c.json({ notes: userNotes });
  } catch (error) {
    console.error('Fetch notes error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

notesRouter.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const noteId = c.req.param('id');
    if (!noteId) return c.json({ error: 'Invalid note id' }, 400);

    const [userNote] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, user.userId)));

    if (!userNote) {
      return c.json({ error: 'Note not found' }, 404);
    }

    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.noteId, userNote.id));

    return c.json({
      note: userNote,
      shareLink: link ? {
        token: link.token,
        shareType: link.shareType,
        accessType: link.accessType,
        expiresAt: link.expiresAt,
        isRevoked: link.isRevoked,
        viewCount: link.viewCount,
      } : null,
    });
  } catch (error) {
    console.error('Get note details error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});
