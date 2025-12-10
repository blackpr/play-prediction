import { FastifyInstance } from 'fastify';

export async function logoutRoute(fastify: FastifyInstance) {
  fastify.post('/logout', async (request, reply) => {
    try {
      const logoutUseCase = request.diScope.resolve('logoutUseCase');
      await logoutUseCase.execute();

      return reply.status(200).send({
        success: true,
        data: {
          message: 'Successfully logged out'
        }
      });
    } catch (error) {
      request.log.error(error, 'Logout failed');
      // Even if logout fails, we usually want to return 200 to client to clear state,
      // or at least not block them. But adhering to strict error handling:
      return reply.status(500).send({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Failed to logout',
        }
      });
    }
  });
}
