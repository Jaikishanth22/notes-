# Secure Note Sharing Application

A highly secure, premium Next.js application designed to share notes with temporary link access, self-destructing one-time links, password protection, and brute-force protection.

---

## Tech Stack Used

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **API Engine**: [Hono](https://hono.dev/) (Routed dynamically via Next.js catch-all routes)
- **Database**: PostgreSQL (Hosted on [Neon Serverless](https://neon.tech/))
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database Driver**: `pg` (node-postgres pool)
- **Authentication**: JWT-based session cookies with RS256 equivalent signature
- **Cryptography**: Node.js `crypto` for high-entropy tokens and keys, and `bcryptjs` for secure password hashing and verification
- **Styling**: Modern, premium CSS styling with dark mode aesthetics (glassmorphism, subtle gradients, and micro-interactions)

---

## Setup Instructions

### 1. Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: A running instance (e.g. Neon, local postgres)

### 2. Environment Variables
Create a `.env` file in the root directory (or use the configured one):
```env
DATABASE_URL="your-postgresql-connection-string"
JWT_SECRET="your-secure-jwt-signing-secret"
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Database Migrations
Generate and run migrations to build the tables:
```bash
# Generate the SQL migration files
npm run db:generate

# Apply migrations to the database
npm run db:migrate
```

### 5. Running the Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Schema

The database is structured into three tables defined in `db/schema.ts`:

### 1. `users` Table
Stores registered users.
- `id`: `uuid` (PRIMARY KEY, Default: random)
- `email`: `text` (UNIQUE, NOT NULL)
- `passwordHash`: `text` (NOT NULL)
- `createdAt`: `timestamp` (NOT NULL, Default: NOW)

### 2. `notes` Table
Stores note content created by authenticated users.
- `id`: `uuid` (PRIMARY KEY, Default: random)
- `userId`: `uuid` (FOREIGN KEY referencing `users.id`, ON DELETE cascade, NOT NULL)
- `title`: `text` (NOT NULL)
- `content`: `text` (NOT NULL)
- `createdAt`: `timestamp` (NOT NULL, Default: NOW)

### 3. `share_links` Table
Stores share configuration, tokens, view metrics, and lockout states for sharing links.
- `token`: `text` (PRIMARY KEY) - A secure high-entropy token representing the share URL
- `noteId`: `uuid` (FOREIGN KEY referencing `notes.id`, ON DELETE cascade, NOT NULL)
- `shareType`: `text` (Constraint: `'ONE_TIME'` or `'TIME_BASED'`, NOT NULL)
- `accessType`: `text` (Constraint: `'PUBLIC'` or `'PASSWORD'`, NOT NULL)
- `passwordHash`: `text` (Nullable) - Bcrypt hash of the decryption key
- `expiresAt`: `timestamp` (Nullable) - Optional link expiry time
- `isRevoked`: `boolean` (Default: `false`, NOT NULL) - Flag for explicit revocation
- `viewCount`: `integer` (Default: `0`, NOT NULL) - Number of successful unlocks
- `version`: `integer` (Default: `0`, NOT NULL) - Used for optimistic concurrency control
- `failedAttempts`: `integer` (Default: `0`, NOT NULL) - Consecutive failed password attempts
- `lockedUntil`: `timestamp` (Nullable) - Lockout window until which the link rejects entries

---

## Core Logic & Mechanisms

### 1. Share Link Flow
1. **Creation**: An authenticated user creates a note, selecting link constraints:
   - **Share Type**: `ONE_TIME` (self-destructs after one view) or `TIME_BASED` (accessible multiple times until expired).
   - **Access Type**: `PUBLIC` (anyone with link can access) or `PASSWORD` (requires a secure decryption key).
2. **Password & Token Generation**: The server generates:
   - A unique 32-character secure random sharing token (`crypto.randomBytes(16).toString('hex')`).
   - If password lock is selected, a random 8-character plaintext key is generated (`crypto.randomBytes(4).toString('hex')`) and hashed using `bcrypt` (work factor 10) before inserting. The plaintext password is shown **only once** to the creator.
3. **Metadata Load**: When a recipient visits `/share/[token]`, the landing page fetches metadata via `GET /api/share/:token` (determining whether it is active, expired, revoked, or password locked).
4. **Decryption**: If the link is `PASSWORD`-protected, a password form is presented. A `POST /api/share/:token/unlock` endpoint verifies credentials, handles locks/concurrency, and returns the decrypted note content.

### 2. Expiry Logic
- For `TIME_BASED` links, the creator specifies an expiration timestamp (`expiresAt`).
- Before serving metadata or unlocking a note, the server compares the current system timestamp with `expiresAt`. If `new Date() > expiresAt`, the server rejects access, returning a `410 Gone` error.

### 3. Invalidate / Revoke Logic
- **Manual Revocation**: The creator can explicitly revoke access from the note details page. A call to `/api/share/:token/revoke` updates `isRevoked` to `true` in the database, instantly blocking subsequent fetches.
- **One-Time Consumption (Self-Destruct)**: When a `ONE_TIME` link is successfully unlocked, `isRevoked` is set to `true` and `viewCount` is incremented. This is processed inside an atomic database transaction.

### 4. View Count Logic
- Every successful note unlock increments `viewCount` atomically via Drizzle's `sql`${shareLinks.viewCount} + 1`` operator. This guarantees that multiple concurrent requests increments the views accurately instead of reading and overwriting stale data.

### 5. Race-Condition Handling
To prevent multiple users from opening a one-time link concurrently and viewing the note content:
- **Pessimistic Locking**: When `/api/share/:token/unlock` is called, a transaction is opened and reads the row using `SELECT ... FOR UPDATE`. This locks the row in PostgreSQL, forcing concurrent requests for the same token to wait.
- **Optimistic Locking Check**: Upon update, we include `WHERE token = :token AND version = :version` and increment `version = version + 1`. If the row version has changed, the transaction fails and rolls back, preventing double-view exploits.

---

## Design Questions & Answers

### 1. How do you prevent two users from using a one-time link at the same time?
We use a database transaction combined with **Pessimistic Locking (`SELECT FOR UPDATE`)**.
- When User A calls `/unlock`, the transaction executes `SELECT * FROM share_links WHERE token = :token FOR UPDATE`. This locks the row in PostgreSQL.
- If User B concurrently calls `/unlock`, their transaction will block at the query layer, waiting for User A's transaction to finish.
- User A's transaction verifies that the link is not revoked and that `viewCount` is `0`. It then updates `viewCount` to `1`, sets `isRevoked = true` (since it is a one-time link), and commits.
- Once User A commits, the lock is released. User B's transaction unblocks, executes, reads the updated row state, sees `viewCount = 1` and `isRevoked = true`, and is rejected with a `410 Gone` error before it can retrieve the note content.

### 2. How do you update view count safely?
The view count is updated using **Atomic Database Expressions** inside our pessimistic locking transaction. Instead of reading the view count into application memory, adding 1, and writing it back (which is prone to race conditions), we execute:
```sql
UPDATE share_links SET view_count = view_count + 1, version = version + 1 WHERE token = :token AND version = :current_version;
```
This ensures the increment happens atomically on the database server. If another thread managed to update the row in the split-second between our read and write, the optimistic `version` check would fail, forcing a rollback and preventing view count inaccuracies.

### 3. How would this work if 1 million people opened the link?
Under extreme load, executing direct database locks on every request will lead to database connection exhaustion, lock contention, and server crashes. To scale to 1 million concurrent users:
1. **Metadata Caching**: Cache all share link metadata (e.g., expiry, revocation status, hashed password) in a distributed, high-performance in-memory cache like **Redis**. If a link is expired, revoked, or locked, the request is rejected immediately at the cache layer without touching the database.
2. **Atomic In-Memory Consumption**: For one-time links, we can use Redis atomic commands like `INCR` or Lua scripts to evaluate and consume the link in memory (e.g., check if the token key is present, if yes delete/consume it and grant access, otherwise reject).
3. **Queueing writes**: Successful read and increment actions can be logged to a message broker (e.g., Kafka or RabbitMQ) and batched/written back to the main PostgreSQL database asynchronously, removing db write bottlenecks from the critical path.
4. **Connection Pooling**: Deploy a high-throughput connection pooler like **pgBouncer** to multiplex database connections.

### 4. How would you prevent brute-force attempts on password-protected links?
We employ three primary defensive layers:
1. **Account/Link Lockout (Implemented)**: The database tracks `failedAttempts` and `lockedUntil`. If a recipient enters a wrong password 5 consecutive times, `lockedUntil` is set to `now() + 15 minutes`. During this window, all unlock requests are rejected immediately without checking the bcrypt hash.
2. **Rate Limiting**: Implement IP-based rate limiting on the `/api/share/:token/unlock` endpoint using a cache layer (e.g., max 5 attempts per token per IP in a 10-minute window).
3. **Deliberate Backoff**: We introduce a short artificial delay (e.g. 500ms) on password verification failures. Because bcrypt is computationally heavy, and when combined with a lockout penalty and network delays, brute-forcing becomes practically impossible.
