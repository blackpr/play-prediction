import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthenticationError } from '../../../../domain/errors/domain-error';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase').regex(/[a-z]/, 'Must contain lowercase').regex(/[0-9]/, 'Must contain number'),
});

export async function registerRoute(fastify: FastifyInstance) {


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

    try {
      const registerUseCase = request.diScope.resolve('registerUseCase');
      const result = await registerUseCase.execute({ email, password });

      return reply.status(201).send({
        success: true,
        data: result
      });
    } catch (error: any) {
      if (error instanceof AuthenticationError) {
        // e.g. Email already exists (mapped by AuthService)
        if (error.code === 'EMAIL_ALREADY_EXISTS') {
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
            code: 'SIGNUP_FAILED',
            message: 'Failed to create account',
          }
        });
      }

      // Conflict from DB
      if (error.code === 'CONFLICT' || error.message.includes('already registered')) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email is already registered'
          }
        });
      }

      request.log.error(error, 'Registration failed');
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
