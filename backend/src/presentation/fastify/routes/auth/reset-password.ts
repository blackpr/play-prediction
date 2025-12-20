import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthenticationError } from '../../../../domain/errors/domain-error';
import { requireAuth } from '../../middleware/auth';

const resetPasswordSchema = z.object({
  password: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase').regex(/[a-z]/, 'Must contain lowercase').regex(/[0-9]/, 'Must contain number'),
});

export async function resetPasswordRoute(fastify: FastifyInstance) {
  fastify.post('/reset-password', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const body = resetPasswordSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 chars, contain uppercase, lowercase letter and number',
          details: body.error.flatten()
        }
      });
    }

    const { password } = body.data;

    try {
      const resetPasswordUseCase = request.diScope.resolve('resetPasswordUseCase');
      await resetPasswordUseCase.execute(password);

      return reply.status(200).send({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PASSWORD_RESET_FAILED',
            message: error.message
          }
        });
      }

      request.log.error(error, 'Password reset failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset password'
        }
      });
    }
  });
}
