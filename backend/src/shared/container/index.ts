/**
 * Dependency Injection Container Setup
 * 
 * Uses Awilix + @fastify/awilix for dependency injection.
 * 
 * Lifetimes:
 * - SINGLETON: One instance for the entire application
 * - SCOPED: One instance per request (useful for request-specific data)
 * - TRANSIENT: New instance every time it's resolved
 * 
 * @see https://github.com/jeffijoe/awilix
 * @see https://github.com/fastify/fastify-awilix
 */

import { asValue, asFunction, asClass, Lifetime } from 'awilix';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import type { FastifyInstance } from 'fastify';
import { createDatabase } from '../../infrastructure/database';
import { RedisCircuitBreakerService } from '../../infrastructure/circuit-breakers/circuit-breaker.service';
import { PostgresUserRepository } from '../../infrastructure/database/repositories/postgres-user.repository';
import { SupabaseAuthService } from '../../infrastructure/auth/supabase-auth.service';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/auth/logout.use-case';

// Import types for module augmentation
import './types';

/**
 * Register all application dependencies in the container.
 * This is the composition root where the entire object graph is configured.
 * 
 * Guidelines:
 * - Infrastructure (db, redis, etc.) should be SINGLETON
 * - Repositories should be SINGLETON (stateless, thread-safe)
 * - Domain services should be SINGLETON or SCOPED depending on state
 * - Use cases can be TRANSIENT or SCOPED
 * - Request-specific data (currentUser) should be SCOPED
 */
export function registerDependencies(): void {
  // ========================================
  // Infrastructure Dependencies
  // ========================================

  diContainer.register({
    // Database connection (singleton - one connection pool for the app)
    // Uses factory function to ensure env vars are loaded first
    db: asFunction(() => createDatabase()).singleton(),
  });

  // ========================================
  // Repositories
  // ========================================

  diContainer.register({
    userRepository: asClass(PostgresUserRepository).singleton(),
  });

  // ========================================
  // Domain Services
  // ========================================

  diContainer.register({
    circuitBreakerService: asClass(RedisCircuitBreakerService).singleton(),
  });

  // ========================================
  // Application Services / Use Cases
  // ========================================

  diContainer.register({
    // AuthService needs to be SCOPED because it depends on request/reply which are request-scoped
    // But we need to make sure Awilix injects them. 
    // Usually 'req' / 'reply' are available in the scope if using fastify-awilix.
    // We'll trust standard injection by name/type or rely on the class structure.
    // If SupabaseAuthService constructor asks for specific names, we must match.
    // SupabaseAuthService(request: FastifyRequest, reply: FastifyReply)
    // Awilix by default uses camelCase of type or name?
    // It's safer to use PROXY injection which injects everything from cradle.
    // But typically we rely on 'classic' or 'proxy'.
    // If we use CLASSIC, it injects by name.
    // Lets assume we need to manually pass them if they are named 'req' / 'reply' in the container.
    // fastify-awilix registers 'req' and 'res'? or 'request' and 'reply'?
    // We can use an arrow function to be explicit.
    authService: asFunction(({ request, reply }: any) => new SupabaseAuthService(request, reply)).scoped(),

    loginUseCase: asClass(LoginUseCase).scoped(),
    logoutUseCase: asClass(LogoutUseCase).scoped(),
  });
}

/**
 * Configure and register the Awilix plugin with Fastify.
 * 
 * Options:
 * - disposeOnClose: Clean up singletons when the app shuts down
 * - disposeOnResponse: Clean up scoped dependencies after each request
 * - strictBooleanEnforced: Throw errors on invalid boolean values
 */
export async function registerContainer(app: FastifyInstance): Promise<void> {
  // Register the Fastify Awilix plugin
  await app.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: true,
    strictBooleanEnforced: true,
  });

  // Register all application dependencies
  registerDependencies();

  // Register request and reply in the scope so they can be injected
  app.addHook('onRequest', (request, reply, done) => {
    request.diScope.register({
      request: asValue(request),
      reply: asValue(reply),
    });
    done();
  });
}

// Re-export commonly used items for convenience
export { diContainer, asValue, asFunction, asClass, Lifetime };
export type { AppCradle, AppRequestCradle } from './types';
