import { FastifyRequest, FastifyReply } from 'fastify';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '../../../infrastructure/auth/supabase';
import { createDatabase } from '../../../infrastructure/database';
import { users } from '../../../infrastructure/database/drizzle/schema';
import { eq } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    supabase: ReturnType<typeof createServerClient>;
    user: { id: string; email: string; role: string } | null;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const supabase = createClient(request, reply);

  request.supabase = supabase;

  // validation with getUser()
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    request.user = null;
    return;
  }

  // fetch user role from db
  const db = createDatabase();
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      role: true,
    }
  });

  request.user = {
    id: user.id,
    email: user.email!,
    role: dbUser?.role ?? 'user',
  };
}

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
