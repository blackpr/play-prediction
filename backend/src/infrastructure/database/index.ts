import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './drizzle/schema';
import { requireEnv } from '../../shared/config/env';

// Lazy singleton - created on first call to createDatabase()
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Create or return the singleton database connection.
 * This is lazy to ensure environment variables are loaded first.
 */
export function createDatabase(): PostgresJsDatabase<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = requireEnv('DATABASE_URL');

  // For query purposes (connection pooling via Supabase)
  const client = postgres(connectionString, {
    prepare: false,
    max: 10,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

// Re-export types for convenience
export type { PostgresJsDatabase };
export type DrizzleDB = PostgresJsDatabase<typeof schema>;
