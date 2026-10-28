import { defineConfig } from 'drizzle-kit';

// Used by `npm run db:generate` only; it reads the schema and needs no database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
});
