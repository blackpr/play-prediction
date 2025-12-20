import { FastifyRequest, FastifyReply } from 'fastify';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '../../../infrastructure/auth/supabase';

declare module 'fastify' {
  interface FastifyRequest {
    supabase: ReturnType<typeof createServerClient>;
    user: { id: string; email: string; role: string } | null;
  }
}

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  // 1. Initialize Supabase client
  const supabase = createClient(request, reply);
  request.supabase = supabase;

  // 2. Check auth status using getUser (validates JWT and auto-refreshes)
  // Wrap in timeout to prevent hanging
  let user = null;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getUser timeout')), 5000)
    );

    const getUserPromise = supabase.auth.getUser();

    const { data, error } = await Promise.race([getUserPromise, timeoutPromise]) as any;

    if (!error && data?.user) {
      user = data.user;
    }
  } catch (err) {
    request.log.warn(err, 'Auth middleware getUser failed or timed out');
  }

  if (!user) {
    request.user = null;
    return;
  }

  // fetch user role from db using repository
  try {
    const userRepository = request.diScope.resolve('userRepository');
    const dbUser = await userRepository.findById(user.id);

    request.user = {
      id: user.id,
      email: user.email!,
      role: dbUser?.role ?? 'user',
    };
  } catch (err) {
    request.log.error(err, 'Error fetching user from DB in auth middleware');
    request.user = {
      id: user.id,
      email: user.email!,
      role: 'user',
    };
  }
};

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);

  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await requireAuth(request, reply);

  // return if response already sent by requireAuth
  if (reply.sent) return;

  if (request.user && request.user.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
}
