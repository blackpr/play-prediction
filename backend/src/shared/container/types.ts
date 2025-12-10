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

/**
 * Application-level dependencies (Singleton/Transient lifetime)
 * These are available throughout the application lifecycle.
 */
export interface AppCradle {
  // Infrastructure
  db: DrizzleDB;

  // Repositories
  // Add repository interfaces here as they're implemented:
  // userRepository: UserRepository;
  // marketRepository: MarketRepository;
  // portfolioRepository: PortfolioRepository;
  // tradeLedgerRepository: TradeLedgerRepository;

  // Domain Services
  // Add domain services here as they're implemented:
  // tradingService: TradingService;
  // pricingService: PricingService;

  // Application Services / Use Cases
  // Add use cases here as they're implemented:
  // createMarketUseCase: CreateMarketUseCase;
  // executeBuyUseCase: ExecuteBuyUseCase;
  // executeSellUseCase: ExecuteSellUseCase;
}

/**
 * Request-scoped dependencies
 * These are created fresh for each HTTP request and can access
 * request-specific data like the current user.
 */
export interface AppRequestCradle extends AppCradle {
  // Request-specific dependencies
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
