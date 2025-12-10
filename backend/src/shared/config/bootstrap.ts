import { resolve } from 'node:path';
import { loadEnv, getDirname } from './env';

// Determine backend root directory
// src/shared/config/bootstrap.ts -> src/shared/config -> src/shared -> src -> backend
const __dirname = getDirname(import.meta.url);
const backendRoot = resolve(__dirname, '../../..');

// Load environment variables immediately
loadEnv(backendRoot);
