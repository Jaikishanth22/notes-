# aass notes

## Project Overview
aass notes is a secure, premium note-sharing application built using **Next.js, Hono, PostgreSQL (Neon), and Drizzle ORM**. It enables authenticated users to create notes and share them securely using configurable share links with expiry, one-time access, mandatory password protection, revocation, view tracking, and brute-force lockout.

---

# Features

- JWT Authentication
- Secure Note Management
- One-Time Share Links (self-destruct after one view)
- Time-Based Share Links
- Public & Password-Protected Links
- Mandatory password entry for password-protected links
- Brute-force protection (lockout after 5 failed attempts)
- Share Revocation (instantly invalidates links)
- View Count Tracking
- PostgreSQL + Drizzle ORM
- Deployed on Vercel

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js 16 + React + TypeScript + Tailwind CSS |
| Backend | Hono |
| Database | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM |
| Authentication | JWT + bcrypt |
| Cryptography | `crypto` (UUID and tokens) + `bcryptjs` |
| Deployment | Vercel |

---

# Setup

```bash
git clone <repository-url>
cd task
npm install
```

Create `.env`

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_secret
```

Run migrations

```bash
npm run db:migrate
```

Run locally

```bash
npm run dev
```

---

# Database Schema

## users
- `id` (uuid, PRIMARY KEY)
- `email` (text, UNIQUE, NOT NULL)
- `passwordHash` (text, NOT NULL)
- `createdAt` (timestamp, DEFAULT NOW)

## notes
- `id` (uuid, PRIMARY KEY)
- `userId` (uuid, FOREIGN KEY referencing users.id)
- `title` (text, NOT NULL)
- `content` (text, NOT NULL)
- `createdAt` (timestamp, DEFAULT NOW)

## share_links
- `token` (text, PRIMARY KEY) - Secure high-entropy token representing the share URL
- `noteId` (uuid, FOREIGN KEY referencing notes.id)
- `shareType` (text: 'ONE_TIME' | 'TIME_BASED', NOT NULL)
- `accessType` (text: 'PUBLIC' | 'PASSWORD', NOT NULL)
- `passwordHash` (text, Nullable) - Bcrypt hash of the decryption password
- `expiresAt` (timestamp, Nullable) - Expiration date & time
- `isRevoked` (boolean, DEFAULT false)
- `viewCount` (integer, DEFAULT 0)
- `version` (integer, DEFAULT 0) - Optimistic locking version
- `failedAttempts` (integer, DEFAULT 0) - Tracks consecutive failed password tries
- `lockedUntil` (timestamp, Nullable) - Lockout window until which the link rejects entries

---

# Share Link Flow

## 1. Creation

An authenticated user creates a note, selecting link constraints.

### Share Type

- ONE_TIME
- TIME_BASED

### Access Type

- PUBLIC
- PASSWORD (requires entering a custom password)

---

## 2. Password & Token Generation

The server generates:

- Secure 32-character sharing token:
```ts
crypto.randomBytes(16).toString("hex")
```

If password protection is enabled:
- The user provides their own dynamic decryption password in the UI (which is mandatory).
- The password is encrypted on the server using **bcrypt (cost factor 10)** before storage.
- The password is never stored in plaintext.

---

## 3. Metadata Load

Recipient visits:
```
/share/[token]
```

Frontend requests:
```
GET /api/share/:token
```

The API validates and returns:
- Token existence (404 if not found)
- Expiry status (compared against `expiresAt`)
- Revocation status (`isRevoked` flag)
- One-time usage status (`shareType === 'ONE_TIME'` and `viewCount >= 1`)
- Brute-force lockout status (`lockedUntil` check)

If any check fails, the frontend displays a specific descriptive error card (e.g. "Link Expired", "Link Revoked", "Link Already Used", or "Link Temporarily Locked").

---

## 4. Unlock

Password-protected links submit:
```
POST /api/share/:token/unlock
```

The backend:
1. Validates that the link is not currently locked out (via `lockedUntil` check).
2. Verifies the password using `bcrypt.compare`.
3. If password check fails:
   - Increments `failedAttempts` by 1.
   - If attempts reach 5, sets `lockedUntil` to 15 minutes in the future.
   - Returns a `401 Unauthorized` response with the remaining attempts or lockout details.
4. If password check succeeds (or if the link is public):
   - Resets `failedAttempts` to 0 and `lockedUntil` to `null`.
   - Increments `viewCount` and marks `isRevoked = true` (if `ONE_TIME`).
   - Returns note content.

---

# Password / Key Generation Logic

- Cryptographically secure random token generation for the sharing path.
- Bcrypt password hashing is performed with a work factor of 10.
- Plaintext password is never stored in the database.

---

# Expiry Logic

Every request compares the current timestamp with `expiresAt`. Expired links immediately return a `410 Gone` error, and the UI displays a clean "Link Expired" warning.

---

# Invalidate / Revoke Logic

- **Manual**: Note creators can revoke the share link from their dashboard. The server sets `isRevoked = true`, instantly invalidating any subsequent requests.
- **One-time self-destruct**: For ONE_TIME shares, the link is updated to `isRevoked = true` and `viewCount = 1` immediately upon the first successful decryption, destroying access.

---

# View Count Logic

- Successful accesses increment `viewCount`.
- To prevent dirty writes and race conditions, the update occurs atomically inside a database transaction:
```sql
UPDATE share_links SET view_count = view_count + 1, version = version + 1 WHERE token = :token;
```

---

# Race Condition Handling

One-time links are secured inside an atomic database transaction using row-level locking (**Pessimistic Locking**: `SELECT ... FOR UPDATE`).
Concurrent requests block and queue up at the database layer. The first client to execute increments the view count and sets `isRevoked = true`, causing subsequent queued transactions to see the updated used state and fail, preventing duplicate access.

---

# Required Edge Cases Handled

- **Invalid share link**: Correctly returns a 404 error with a custom error card.
- **Public share link**: Auto-unlocks and serves content instantly without password prompt.
- **Password-protected link**: Directs the user to a secure entry prompt.
- **Wrong password**: Returns the number of attempts remaining before lockout.
- **Expired link**: Blocks access with a descriptive "Link Expired" card.
- **One-time link already used**: Blocks subsequent opens with a "Link Already Used" message.
- **Revoked link**: Blocks access with a "Link Revoked" message.
- **Concurrent access**: Prevents race conditions via database-level pessimistic locking (`SELECT FOR UPDATE`).
- **Accurate view counts**: View counts are updated atomically on the DB server.

---

# Security

- JWT Authentication for session management.
- Bcrypt password hashing.
- High-entropy secure random sharing tokens.
- Brute-force lockout (5 failed attempts = 15-minute lock).
- Server-side validation of inputs.
- Safe cookie configuration (HttpOnly, Secure in prod, Lax SameSite).

---

# Deployment

1. Push to GitHub
2. Create Neon database
3. Configure `DATABASE_URL`
4. Configure `JWT_SECRET`
5. Deploy on Vercel (migrations run automatically on build step).

---

# Interview Questions

### How do you prevent two users from using a one-time link simultaneously?

We use a database transaction combined with **Pessimistic Locking (`SELECT FOR UPDATE`)**.
- When User A hits the `/unlock` endpoint, it locks the `share_links` row in PostgreSQL.
- If User B concurrent requests `/unlock`, they will block and wait for User A's transaction to commit.
- User A's transaction verifies `viewCount` is `0`, increments it to `1`, sets `isRevoked = true`, and commits.
- Once User A commits, the lock is released. User B's transaction unblocks, reads the updated row, sees `viewCount = 1`, and returns a `410 Gone` error immediately.

### How do you update view count safely?

Perform an atomic SQL increment inside the transaction rather than a read-modify-write in application memory:
```sql
UPDATE share_links SET view_count = view_count + 1, version = version + 1 WHERE token = :token AND version = :current_version;
```
This guarantees thread-safe, concurrent updates on the database engine.

### How would this scale to 1 million users?

1. **Metadata Caching**: Cache link statuses, expiration timestamps, and revocation flags in **Redis**. Expired, revoked, or locked link requests can be rejected instantly at the cache layer, keeping 99% of requests off the PostgreSQL database.
2. **In-Memory Consumption**: Use Redis atomic operations (`DECR` or Lua scripts) to instantly consume and validate one-time links in memory.
3. **Queueing writes**: Send view-count and usage updates to a message broker (e.g. Kafka/RabbitMQ) to update PostgreSQL asynchronously in batches.
4. **Connection Pooling**: Deploy **pgBouncer** to multiplex database connections.

### How do you prevent brute-force attacks?

- **Lockout (Implemented)**: We track consecutive failures in the database. 5 failed attempts sets a 15-minute lockout timer on the link, instantly rejecting requests.
- **Rate Limiting**: Add IP-based rate limiting on the `/api/share/:token/unlock` route (e.g. max 5 hits/minute).
- **Backoff Delay**: Introduce a slight delay (e.g. 500ms) on password verification failures, increasing computational and network costs for attackers.

---

# Author

**Jai Kishanth**
