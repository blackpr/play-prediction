import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthUser {
  id: string;
  email: string;
  // Add other auth-provider specific fields if needed
}

export interface AuthService {
  /**
   * Login with email and password.
   * Note: This usually handles setting cookies on the response object directly via the underlying client
   * or returns session data. With Supabase SSR, we pass request/reply to the client factory,
   * but for a service interface, we might need to abstract that.
   * 
   * However, since `createClient` requires req/res, our valid implementation needs access to them.
   * We can either pass them to the method, or scope the service to the request.
   * Given the DI setup (scoped), we can inject the request context or pass it.
   */
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
}
