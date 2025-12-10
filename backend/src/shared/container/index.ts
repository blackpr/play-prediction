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

  // Register repositories as they're implemented:
  // diContainer.register({
  //   userRepository: asClass(PostgresUserRepository).singleton(),
  //   marketRepository: asClass(PostgresMarketRepository).singleton(),
  //   portfolioRepository: asClass(PostgresPortfolioRepository).singleton(),
  //   tradeLedgerRepository: asClass(PostgresTradeLedgerRepository).singleton(),
  // });

  // ========================================
  // Domain Services
  // ========================================

  // Register domain services as they're implemented:
  // diContainer.register({
  //   pricingService: asClass(CPMMPricingService).singleton(),
  //   tradingService: asClass(TradingService).singleton(),
  // });

  // ========================================
  // Application Services / Use Cases
  // ========================================

  // Register use cases as they're implemented:
  // diContainer.register({
  //   createMarketUseCase: asClass(CreateMarketUseCase).scoped(),
  //   executeBuyUseCase: asClass(ExecuteBuyUseCase).scoped(),
  //   executeSellUseCase: asClass(ExecuteSellUseCase).scoped(),
  // });
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
}

// Re-export commonly used items for convenience
export { diContainer, asValue, asFunction, asClass, Lifetime };
export type { AppCradle, AppRequestCradle } from './types';
