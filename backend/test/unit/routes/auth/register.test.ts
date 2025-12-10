import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { registerRoute } from '../../../../src/presentation/fastify/routes/auth/register';

// Mock database chain
const mockBuilder = {
  values: vi.fn(),
  returning: vi.fn().mockReturnValue([{
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
    balance: 10000000n,
    createdAt: new Date(),
  }]),
  // Make it thenable for await usages without .returning()
  then: (resolve: any) => resolve([{}]),
};
mockBuilder.values.mockReturnValue(mockBuilder);

const mockInsert = vi.fn().mockReturnValue(mockBuilder);

// Mock Transaction
const mockTransaction = vi.fn((callback) => {
  const tx = {
    insert: mockInsert,
  };
  return callback(tx);
});

// Mock createDatabase
vi.mock('../../../../src/infrastructure/database', () => ({
  createDatabase: () => ({
    transaction: mockTransaction,
  }),
}));

// Mock AppConfig
vi.mock('../../../../src/shared/config/app-config', () => ({
  AppConfig: {
    REGISTRATION_BONUS_AMOUNT: 10000000n,
  },
}));

describe('Register Route', () => {
  let fastify: FastifyInstance;
  let mockSupabaseSignUp: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseSignUp = vi.fn();

    fastify = {
      post: vi.fn(),
    } as any;
  });

  it('should register a new user successfully', async () => {
    // Setup route
    await registerRoute(fastify);

    const routeHandler = (fastify.post as any).mock.calls[0][1];

    // Mock Request/Reply
    const request = {
      body: {
        email: 'test@example.com',
        password: 'Password123!',
      },
      supabase: {
        auth: {
          signUp: mockSupabaseSignUp,
        }
      },
      log: {
        error: vi.fn(),
      }
    };

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    // Mock Supabase success
    mockSupabaseSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Execute
    await routeHandler(request, reply);

    // Verify Supabase called
    expect(mockSupabaseSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123!',
      options: { data: { role: 'user' } },
    });

    // Verify DB Transaction called
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(2); // Users + PointGrants

    // Verify Response
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        user: expect.objectContaining({
          email: 'test@example.com'
        })
      })
    }));
  });

  it('should return 400 for weak password', async () => {
    await registerRoute(fastify);
    const routeHandler = (fastify.post as any).mock.calls[0][1];

    const request = {
      body: {
        email: 'test@example.com',
        password: 'weak',
      }
    };
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await routeHandler(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'WEAK_PASSWORD'
      })
    }));
  });
});
