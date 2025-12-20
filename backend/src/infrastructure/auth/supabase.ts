import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';
import { FastifyRequest, FastifyReply } from 'fastify';
import { requireEnv, getEnv } from '../../shared/config/env';

const isProduction = getEnv('NODE_ENV', 'development') === 'production';

/**
 * Creates a Supabase client for server-side operations.
 * Uses @supabase/ssr v0.8.0 with getAll/setAll API.
 */
export function createClient(request: FastifyRequest, reply: FastifyReply) {
  const parsed = parseCookieHeader(request.headers.cookie ?? '');
  // Supabase SSR expects the session as a JSON string
  // Ensure all cookies have a value (filter out undefined, default to empty string)
  const cookies = parsed
    .filter((c): c is { name: string; value: string } => c.value !== undefined)
    .map((c) => ({ name: c.name, value: c.value }));

  return createServerClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.cookie;
          if (!cookieHeader) return [];

          const cookies = cookieHeader.split(';').map((cookie) => {
            const [name, ...rest] = cookie.trim().split('=');
            return { name, value: rest.join('=') };
          });
          return cookies;
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const header = serializeCookieHeader(name, value, {
              ...options,
              path: options?.path ?? '/',
              httpOnly: options?.httpOnly ?? true,
              secure: isProduction,
              sameSite: 'lax',
            });
            reply.header('Set-Cookie', header);
          });
        },
      },
    }
  );
}
