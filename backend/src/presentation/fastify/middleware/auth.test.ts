import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware, requireAuth, requireAdmin } from './auth';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock dependencies
const mockGetUser = vi.fn();
const mockCreateClient = vi.fn((...args: any[]) => ({
  auth: {
    getUser: mockGetUser,
  },
}));

vi.mock('../../../infrastructure/auth/supabase', () => ({
  createClient: (req: any, reply: any) => mockCreateClient(req, reply),
}));

const mockDbFindFirst = vi.fn();
vi.mock('../../../infrastructure/database', () => ({
  createDatabase: () => ({
    query: {
      users: {
        findFirst: mockDbFindFirst,
      },
    },
  }),
}));

describe('Auth Middleware', () => {
  let req: Partial<FastifyRequest> & { user?: any };
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {},
    };
    reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      header: vi.fn(),
      sent: false,
    };
  });

  describe('authMiddleware', () => {
    it('should set request.user to null if no auth user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      await authMiddleware(req as FastifyRequest, reply as FastifyReply);

      expect(req.user).toBeNull();
    });

    it('should populate request.user if auth user exists', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: authUser }, error: null });
      mockDbFindFirst.mockResolvedValue({ role: 'admin' });

      await authMiddleware(req as FastifyRequest, reply as FastifyReply);

      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      });
    });

    it('should default role to "user" if not found in db', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: authUser }, error: null });
      mockDbFindFirst.mockResolvedValue(null);

      await authMiddleware(req as FastifyRequest, reply as FastifyReply);

      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });
  });

  describe('requireAuth', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      await requireAuth(req as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' })
      }));
    });

    it('should pass if authenticated', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: authUser }, error: null });
      mockDbFindFirst.mockResolvedValue({ role: 'user' });

      await requireAuth(req as FastifyRequest, reply as FastifyReply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });
  });

  describe('requireAdmin', () => {
    it('should return 403 if authenticated but not admin', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: authUser }, error: null });
      mockDbFindFirst.mockResolvedValue({ role: 'user' });

      await requireAdmin(req as FastifyRequest, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'FORBIDDEN' })
      }));
    });

    it('should pass if admin', async () => {
      const authUser = { id: 'admin-123', email: 'admin@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: authUser }, error: null });
      mockDbFindFirst.mockResolvedValue({ role: 'admin' });

      await requireAdmin(req as FastifyRequest, reply as FastifyReply);

      expect(reply.status).not.toHaveBeenCalled();
    });
  });
});
