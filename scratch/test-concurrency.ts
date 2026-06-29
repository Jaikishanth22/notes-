import { db, notes, shareLinks, users } from '../db';
import crypto from 'crypto';

async function run() {
  console.log('--- Starting Concurrency Test ---');

  // 1. Create a dummy user
  const email = `test-${Date.now()}@example.com`;
  const [user] = await db.insert(users).values({
    email,
    passwordHash: 'dummy_hash',
  }).returning();
  console.log(`Created test user: ${email}`);

  // 2. Create a dummy note
  const [note] = await db.insert(notes).values({
    userId: user.id,
    title: 'Top Secret Note',
    content: 'The quick brown fox jumps over the lazy dog.',
  }).returning();
  console.log(`Created test note: ${note.id}`);

  // 3. Create a ONE_TIME public share link
  const token = crypto.randomBytes(16).toString('hex');
  await db.insert(shareLinks).values({
    token,
    noteId: note.id,
    shareType: 'ONE_TIME',
    accessType: 'PUBLIC',
    viewCount: 0,
    version: 0,
  });
  console.log(`Created ONE_TIME public link with token: ${token}`);

  // 4. Send concurrent requests
  const url = `http://localhost:3000/api/share/${token}/unlock`;
  console.log(`Sending 5 concurrent requests to: ${url}...`);

  const requests = Array.from({ length: 5 }).map(async (_, idx) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      return { id: idx + 1, status: res.status, data };
    } catch (err: any) {
      return { id: idx + 1, status: 0, error: err.message };
    }
  });

  const results = await Promise.all(requests);

  console.log('Results:');
  let successCount = 0;
  let failureCount = 0;

  for (const r of results) {
    if (r.status === 200) {
      successCount++;
      console.log(`Request #${r.id} succeeded (200). Note Title: "${r.data.note?.title}"`);
    } else {
      failureCount++;
      console.log(`Request #${r.id} failed (${r.status}). Error: "${r.data?.error || r.error}"`);
    }
  }

  console.log('--- Summary ---');
  console.log(`Successes: ${successCount}`);
  console.log(`Failures:  ${failureCount}`);

  if (successCount === 1) {
    console.log('✅ TEST PASSED: Exactly 1 concurrent request succeeded!');
  } else {
    console.error(`❌ TEST FAILED: Expected exactly 1 success, got ${successCount}`);
  }

  // 5. Clean up
  console.log('Cleaning up test data...');
  await db.delete(users).where(eq(users.id, user.id));
  console.log('Cleanup complete.');
  process.exit(successCount === 1 ? 0 : 1);
}

// Helper to support eq in typescript file
import { eq } from 'drizzle-orm';
run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
