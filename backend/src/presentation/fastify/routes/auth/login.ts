import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainError, AuthenticationError, AuthorizationError, NotFoundError } from '../../../../domain/errors/domain-error';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function loginRoute(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: body.error.flatten()
        },
      });
    }

    const { email, password } = body.data;

    try {
      const loginUseCase = request.diScope.resolve('loginUseCase');
      const result = await loginUseCase.execute({ email, password });

      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return reply.status(401).send({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          }
        });
      }

      if (error instanceof AuthorizationError) {
        return reply.status(403).send({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          }
        });
      }

      if (error instanceof NotFoundError) {
        // If user profile not found after successful auth, it's a 500 or 404.
        // Spec says nothing about this, but let's return 404 or 500.
        // Previous logic returned 500 USER_PROFILE_MISSING.
        // NotFoundError is 404.
        return reply.status(500).send({
          success: false,
          error: {
            code: 'USER_PROFILE_MISSING',
            message: error.message,
          }
        });
      }

      request.log.error(error, 'Login failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'Failed to login',
        }
      });
    }
  });
}
