import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createDatabase } from '../../../../infrastructure/database';
import { users, pointGrants, PointGrantType } from '../../../../infrastructure/database/drizzle/schema';
import { AppConfig } from '../../../../shared/config/app-config';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase').regex(/[a-z]/, 'Must contain lowercase').regex(/[0-9]/, 'Must contain number'),
});

export async function registerRoute(fastify: FastifyInstance) {
  const db = createDatabase();

  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);

    if (!body.success) {
      if (body.error.issues.some(i => i.path.includes('password'))) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 chars, contain uppercase, lowercase letter and number',
            details: body.error.flatten()
          }
        });
      }

      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
          details: body.error.flatten()
        },
      });
    }

    const { email, password } = body.data;

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await request.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'user' }
      }
    });

    if (authError) {
      // Map Supabase errors to our API errors
      if (authError.message.includes('already registered')) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email is already registered'
          }
        });
      }

      request.log.error(authError, 'Supabase signup failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SIGNUP_FAILED',
          message: 'Failed to create account',
        }
      });
    }

    if (!authData.user) {
      request.log.error('No user returned from Supabase signup');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SIGNUP_FAILED',
          message: 'Failed to create account',
        }
      });
    }

    try {
      // 2. Create user profile locally with welcome bonus
      const newUser = await db.transaction(async (tx: any) => {
        // Check if user already exists (idempotency for re-registration / races)
        // Note: In a real scenario, Supabase handles auth uniqueness, but the local DB insert might conflict if there's a race or partial failure retry.
        // We'll trust Supabase's unique email constraint for auth, but the user ID comes from Supabase.

        const [user] = await tx
          .insert(users)
          .values({
            id: authData.user!.id,
            email,
            balance: AppConfig.REGISTRATION_BONUS_AMOUNT,
            role: 'user',
          })
          .returning();

        // Log grant
        await tx.insert(pointGrants).values({
          userId: authData.user!.id,
          amount: AppConfig.REGISTRATION_BONUS_AMOUNT,
          balanceBefore: 0n,
          balanceAfter: AppConfig.REGISTRATION_BONUS_AMOUNT,
          grantType: PointGrantType.REGISTRATION_BONUS,
          reason: 'Welcome bonus',
        });

        return user;
      });

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            balance: newUser.balance.toString(),
            createdAt: newUser.createdAt.toISOString(),
          },
          message: 'Please check your email to confirm your account'
        }
      });

    } catch (dbError: any) {
      // If DB transaction fails, we have an orphaned Supabase user. 
      // In a perfect world, we'd roll back Supabase user deletion here, or have a reconciliation worker.
      // For now, we'll log fatal error.
      request.log.error(dbError, 'DB Transaction failed during registration');

      if (dbError.code === '23505') { // Unique violation
        return reply.status(409).send({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email is already registered'
          }
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to initialize user profile'
        }
      });
    }
  });
}
