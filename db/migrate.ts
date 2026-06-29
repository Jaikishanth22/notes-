import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './db/migrations' });
  console.log('Migrations applied successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
