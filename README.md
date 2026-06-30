# VaultShare

## Project Overview
VaultShare is a secure note-sharing application built using **Next.js, Hono, PostgreSQL (Neon), and Drizzle ORM**. It enables authenticated users to create notes and share them securely using configurable share links with expiry, one-time access, optional password protection, revocation, and view tracking.

---

# Features

- JWT Authentication
- Secure Note Management
- One-Time Share Links
- Time-Based Share Links
- Public & Password-Protected Links
- Share Revocation
- View Count Tracking
- PostgreSQL + Drizzle ORM
- Deployed on Vercel

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js 16 + React + TypeScript |
| Backend | Hono |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| Authentication | JWT + bcrypt |
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
- id
- username/email
- password_hash
- created_at

## notes
- id
- owner_id
- title
- content
- created_at

## shares
- id
- note_id
- token
- password_hash
- expires_at
- one_time
- revoked
- used
- view_count
- created_at

---

# Share Link Flow

## 1. Creation

An authenticated user creates a note, selecting link constraints.

### Share Type

- ONE_TIME
- TIME_BASED

### Access Type

- PUBLIC
- PASSWORD

---

## 2. Password & Token Generation

The server generates:

- Secure 32-character sharing token

```ts
crypto.randomBytes(16).toString("hex")
```

If password protection is enabled:

```ts
crypto.randomBytes(4).toString("hex")
```

The password is hashed using **bcrypt (cost factor 10)** before storage.

The plaintext password is displayed **only once** to the creator.

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

The API validates:

- Token exists
- Not expired
- Not revoked
- Password requirement
- One-time usage status

---

## 4. Unlock

Password-protected links submit:

```
POST /api/share/:token/unlock
```

The backend:

1. Validates password using bcrypt
2. Checks expiry
3. Checks revocation
4. Handles one-time access safely
5. Returns note content

---

# Password / Key Generation Logic

- Cryptographically secure random token generation
- bcrypt password hashing
- Plaintext password is never stored

---

# Expiry Logic

Every request compares the current timestamp with `expires_at`.

Expired links immediately return an error.

---

# Invalidate / Revoke Logic

Revoked links are marked in the database.

Every access validates the revoked flag before serving data.

---

# View Count Logic

Only successful accesses increment `view_count`.

The update should occur atomically inside the database.

---

# Race Condition Handling

One-time links should be processed inside a database transaction using row-level locking (`SELECT ... FOR UPDATE`) or optimistic locking so only one concurrent request can consume the link.

---

# Required Edge Cases

- Invalid share link
- Public share link
- Password-protected link
- Wrong password
- Expired link
- One-time link already used
- Revoked link
- Concurrent access to one-time links
- Accurate view count updates

---

# Security

- JWT Authentication
- bcrypt password hashing
- Secure random tokens
- Server-side validation
- Environment variables for secrets

---

# Deployment

1. Push to GitHub
2. Create Neon database
3. Configure DATABASE_URL
4. Configure JWT_SECRET
5. Deploy on Vercel

---

# Interview Questions

### How do you prevent two users from using a one-time link simultaneously?

Use a transaction with row-level locking (`SELECT ... FOR UPDATE`) or optimistic locking so only one transaction succeeds.

### How do you update view count safely?

Perform an atomic SQL increment (`view_count = view_count + 1`) inside the database.

### How would this scale to 1 million users?

- Horizontal application scaling
- PostgreSQL connection pooling
- Proper indexing
- Caching
- CDN
- Load balancer

### How do you prevent brute-force attacks?

- Rate limiting
- CAPTCHA
- Temporary lockouts
- bcrypt hashing
- Logging and monitoring

---

# Future Improvements

- Email sharing
- Audit logs
- Redis caching
- File attachments
- Notifications

---

**SCREENSHOTS**
LOGIN

<img width="1012" height="678" alt="image" src="https://github.com/user-attachments/assets/c68188a0-f73a-40dc-9135-00d7823953c7" />

SIGN UP

<img width="702" height="593" alt="image" src="https://github.com/user-attachments/assets/abdc6058-bbd6-45a1-9fbc-da7505b9eae5" />

CREATE NOTES

<img width="728" height="752" alt="image" src="https://github.com/user-attachments/assets/11d507cc-629a-4bd2-991f-3578c5d004e3" />

LINK AND PASWWORD 

<img width="473" height="437" alt="image" src="https://github.com/user-attachments/assets/74d9d83b-1c74-401f-b788-e935adec1a42" />

NOTES VIEW 

<img width="767" height="342" alt="image" src="https://github.com/user-attachments/assets/dbd386db-b643-4da7-afc1-c77d7a522ab6" />


**DEMO VEDIO**


https://drive.google.com/file/d/1g_pb8S1KBcbJi9P69ecZSsK8syYW6442/view?usp=sharing




**LINK**

[notes-ten-rose-51.vercel.app](https://notes-ten-rose-51.vercel.app/login)


















# Author

**Jai Kishanth**
