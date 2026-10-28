// Drizzle schema and the database client. Migrations live in `drizzle/`.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export { schema };

/** Connects to `url` (defaults to `DATABASE_URL`). Call `db.$client.end()` to close it. */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  return drizzle(postgres(url), { schema });
}

export type Db = ReturnType<typeof createDb>;
