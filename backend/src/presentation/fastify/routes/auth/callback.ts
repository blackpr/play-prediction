import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '../../../../infrastructure/auth/supabase';
import { getEnv } from '../../../../shared/config/env';

const callbackSchema = z.object({
  token_hash: z.string(),
  type: z.enum(['signup', 'invite', 'recovery', 'email_change', 'email']),
  next: z.string().optional(),
});

export async function callbackRoute(fastify: FastifyInstance) {
  fastify.get('/callback', async (request, reply) => {
    // 1. Validate query params
    const query = callbackSchema.safeParse(request.query);
    const clientUrl = getEnv('CLIENT_URL', 'http://localhost:5173');

    if (!query.success) {
      request.log.warn({ errors: query.error }, 'Invalid auth callback request');
      return reply.redirect(`${clientUrl}/login?error=invalid_callback`);
    }

    const { token_hash, type, next } = query.data;

    // 2. Create Supabase client with cookie handling
    const supabase = createClient(request, reply);

    // 3. Verify OTP
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash,
    });

    if (error) {
      request.log.error(error, 'Auth callback failed');
      return reply.redirect(
        `${clientUrl}/login?error=auth_callback_failed&message=${encodeURIComponent(error.message)}`
      );
    }

    // 4. Redirect to frontend
    // Use the 'next' param if valid, or default to home/login
    // Validate 'next' param to prevent open redirects
    let redirectPath = next;
    if (!redirectPath || !redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
      redirectPath = '/';
    }

    if (type === 'recovery') {
      redirectPath = '/reset-password';
    }

    return reply.redirect(`${clientUrl}${redirectPath}`);
  });
}
