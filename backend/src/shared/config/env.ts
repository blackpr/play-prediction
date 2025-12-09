import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load environment files with priority (later files override earlier ones):
 * 1. .env - Base defaults
 * 2. .env.{NODE_ENV} - Environment specific (.env.staging, .env.production)
 * 3. .env.local - Local overrides (gitignored, highest priority)
 *
 * @param baseDir - Directory containing .env files (project root)
 */
export function loadEnv(baseDir: string): void {
  const NODE_ENV = process.env.NODE_ENV || 'development';

  const envFiles = [
    '.env',
    `.env.${NODE_ENV}`,
    '.env.local',
  ];

  for (const file of envFiles) {
    const filePath = resolve(baseDir, file);
    if (existsSync(filePath)) {
      loadEnvFile(filePath);
    }
  }
}

/**
 * Helper to get directory path from import.meta.url (ESM equivalent of __dirname)
 */
export function getDirname(importMetaUrl: string): string {
  return resolve(fileURLToPath(importMetaUrl), '..');
}

/**
 * Get a required environment variable or throw
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default
 */
export function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}
