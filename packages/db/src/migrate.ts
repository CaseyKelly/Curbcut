// `npm run db:migrate`: applies pending migrations in `drizzle/` to DATABASE_URL.
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './index';

const db = createDb();
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  console.log('Migrations applied');
} finally {
  await db.$client.end();
}
