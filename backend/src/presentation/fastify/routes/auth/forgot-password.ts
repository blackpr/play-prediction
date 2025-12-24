import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthenticationError } from '../../../../domain/errors/domain-error';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function forgotPasswordRoute(fastify: FastifyInstance) {
  fastify.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid email address',
          details: body.error.flatten()
        },
      });
    }

    const { email } = body.data;

    try {
      const forgotPasswordUseCase = request.diScope.resolve('forgotPasswordUseCase');
      await forgotPasswordUseCase.execute(email);

      // Always return success to prevent email enumeration
      return reply.status(200).send({
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      });
    } catch (error) {
      // If rate limited, we might want to tell the user. 
      // Auth service might throw AuthenticationError.
      if (error instanceof AuthenticationError) {
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          return reply.status(429).send({
            success: false,
            error: {
              code: error.code,
              message: error.message
            }
          });
        }
      }

      request.log.error(error, 'Forgot password processing failed');
      // Return generic success message even on error (except maybe rate limit)
      return reply.status(200).send({
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      });
    }
  });
}
