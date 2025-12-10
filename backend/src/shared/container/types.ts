/**
 * Dependency Injection Container Types
 * 
 * This file defines the TypeScript interfaces for the DI container.
 * All dependencies that can be resolved from the container should be
 * declared in the Cradle interface.
 * 
 * @see https://github.com/jeffijoe/awilix
 * @see https://github.com/fastify/fastify-awilix
 */

import type { DrizzleDB } from '../../infrastructure/database';
import type { CircuitBreakerService } from '../../application/ports/services/circuit-breaker.service';
import type { UserRepository } from '../../application/ports/repositories/user.repository';
import type { AuthService } from '../../application/ports/services/auth.service';
import type { LoginUseCase } from '../../application/use-cases/auth/login.use-case';
import type { LogoutUseCase } from '../../application/use-cases/auth/logout.use-case';

/**
 * Application-level dependencies (Singleton/Transient lifetime)
 * These are available throughout the application lifecycle.
 */
export interface AppCradle {
  // Infrastructure
  db: DrizzleDB;

  // Repositories
  userRepository: UserRepository;

  // Domain Services
  circuitBreakerService: CircuitBreakerService;

  // Application Services / Use Cases
  authService: AuthService;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
}

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request-scoped dependencies
 * These are created fresh for each HTTP request and can access
 * request-specific data like the current user.
 */
export interface AppRequestCradle extends AppCradle {
  // Request-specific dependencies
  request: FastifyRequest;
  reply: FastifyReply;
  // currentUser: User | null;
  // requestId: string;
}

/**
 * Module augmentation to extend @fastify/awilix types
 * This provides type-safe resolution throughout the application.
 */
declare module '@fastify/awilix' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Cradle extends AppCradle { }
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface RequestCradle extends AppRequestCradle { }
}
