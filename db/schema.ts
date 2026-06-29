import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shareLinks = pgTable('share_links', {
  token: text('token').primaryKey(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  shareType: text('share_type').$type<'ONE_TIME' | 'TIME_BASED'>().notNull(),
  accessType: text('access_type').$type<'PUBLIC' | 'PASSWORD'>().notNull(),
  passwordHash: text('password_hash'),
  expiresAt: timestamp('expires_at'),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  version: integer('version').default(0).notNull(),
});
