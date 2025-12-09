import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './drizzle/schema';

// Use Supabase connection string
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// For query purposes (connection pooling via Supabase)
const client = postgres(connectionString, { 
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
