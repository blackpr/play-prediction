import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local if present, or .env.example
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Ensure we are using the local Supabase instance
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55326/postgres';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}
