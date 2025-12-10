import { createServerClient } from '@supabase/ssr';
import { FastifyRequest, FastifyReply } from 'fastify';
import { requireEnv } from '../../shared/config/env';

export function createClient(request: FastifyRequest, reply: FastifyReply) {
  return createServerClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.cookie;
          if (!cookieHeader) return [];

          return cookieHeader.split(';').map((cookie) => {
            const [name, ...rest] = cookie.trim().split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            reply.setCookie(name, value, options);
          });
        },
      },
    }
  );
}
