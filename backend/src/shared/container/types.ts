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
import { PointGrantRepository } from '../../application/ports/repositories/point-grant.repository';
import { RegisterUseCase } from '../../application/use-cases/auth/register.use-case';
import { MeUseCase } from '../../application/use-cases/auth/me.use-case';
import { ForgotPasswordUseCase } from '../../application/use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/auth/reset-password.use-case';
import { GetPointsHistoryUseCase } from '../../application/use-cases/users/get-points-history.use-case';
import { MarketRepository } from '../../application/ports/repositories/market.repository';
import { GetMarketsUseCase } from '../../application/use-cases/markets/get-markets.use-case';
import { GetMarketUseCase } from '../../application/use-cases/markets/get-market.use-case';
import { GetMarketPriceHistoryUseCase } from '../../application/use-cases/markets/get-market-price-history.use-case';
import { GetMarketTradesUseCase } from '../../application/use-cases/get-market-trades.use-case';
import { PortfolioRepository } from '../../application/ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../application/ports/repositories/trade-ledger.repository';
import { BuySharesUseCase } from '../../application/use-cases/trading/buy-shares.use-case';
import { SellSharesUseCase } from '../../application/use-cases/trading/sell-shares.use-case';
import { GetQuoteUseCase } from '../../application/use-cases/trading/get-quote.use-case';
import { MintSharesUseCase } from '../../application/use-cases/trading/mint-shares.use-case';
import { MergeSharesUseCase } from '../../application/use-cases/trading/merge-shares.use-case';
import { GetPositionUseCase } from '../../application/use-cases/portfolio/get-position.use-case';
import { GetPortfolioUseCase } from '../../application/use-cases/portfolio/get-portfolio.use-case';
import { GetPortfolioHistoryUseCase } from '../../application/use-cases/portfolio/get-portfolio-history.use-case';
import { CreateMarketUseCase } from '../../application/use-cases/admin/create-market.use-case';
import { UpdateMarketUseCase } from '../../application/use-cases/admin/update-market.use-case';
import { ActivateMarketUseCase } from '../../application/use-cases/admin/activate-market.use-case';
import { PauseMarketUseCase } from '../../application/use-cases/admin/pause-market.use-case';
import { ResumeMarketUseCase } from '../../application/use-cases/admin/resume-market.use-case';
import { ExtendMarketCloseTimeUseCase } from '../../application/use-cases/admin/extend-market-close-time.use-case';
import { GetAdminStatsUseCase } from '../../application/use-cases/admin/get-admin-stats.use-case';
import { ResolveMarketUseCase } from '../../application/use-cases/admin/resolve-market.use-case';
import { CancelMarketUseCase } from '../../application/use-cases/admin/cancel-market.use-case';
import { GrantPointsUseCase } from '../../application/use-cases/admin/grant-points.use-case';
import { ListUsersUseCase } from '../../application/use-cases/admin/list-users.use-case';
import { GetUserDetailUseCase } from '../../application/use-cases/admin/get-user-detail.use-case';
import { GetAdminMarketsUseCase } from '../../application/use-cases/admin/get-admin-markets.use-case';
import { AuditLogRepository } from '@/application/ports/repositories/audit-log.repository';
import { GetAuditLogUseCase } from '@/application/use-cases/admin/get-audit-log.use-case';
import { CategoryRepository } from '../../application/ports/repositories/category.repository';
import { ListCategoriesUseCase } from '../../application/use-cases/admin/list-categories.use-case';
import { CreateCategoryUseCase } from '../../application/use-cases/admin/create-category.use-case';
import { UpdateCategoryUseCase } from '../../application/use-cases/admin/update-category.use-case';
import { DeleteCategoryUseCase } from '../../application/use-cases/admin/delete-category.use-case';
import { WebSocketManager } from '../../infrastructure/websocket/websocket-manager';
import { RedisPubSubService } from '../../infrastructure/websocket/redis-pubsub.service';


/**
 * Application-level dependencies (Singleton/Transient lifetime)
 * These are available throughout the application lifecycle.
 */
import { TransactionManager } from '../../application/ports/transaction-manager.port';

export interface AppCradle {
  // Infrastructure
  db: DrizzleDB;
  transactionManager: TransactionManager;

  // Repositories
  userRepository: UserRepository;
  pointGrantRepository: PointGrantRepository;
  marketRepository: MarketRepository;
  portfolioRepository: PortfolioRepository;
  tradeLedgerRepository: TradeLedgerRepository;

  // Domain Services
  circuitBreakerService: CircuitBreakerService;
  authService: AuthService;
  
  // WebSocket & Real-time
  redisPubSubService: RedisPubSubService;

  // Application Services / Use Cases
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  registerUseCase: RegisterUseCase;
  meUseCase: MeUseCase;
  forgotPasswordUseCase: ForgotPasswordUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  getPointsHistoryUseCase: GetPointsHistoryUseCase;
  getMarketsUseCase: GetMarketsUseCase;
  getMarketUseCase: GetMarketUseCase;
  getMarketPriceHistoryUseCase: GetMarketPriceHistoryUseCase;
  getMarketTradesUseCase: GetMarketTradesUseCase;
  buySharesUseCase: BuySharesUseCase;
  sellSharesUseCase: SellSharesUseCase;
  getQuoteUseCase: GetQuoteUseCase;
  mintSharesUseCase: MintSharesUseCase;
  mergeSharesUseCase: MergeSharesUseCase;
  getPositionUseCase: GetPositionUseCase;
  getPortfolioUseCase: GetPortfolioUseCase;
  getPortfolioHistoryUseCase: GetPortfolioHistoryUseCase;
  createMarketUseCase: CreateMarketUseCase;
  updateMarketUseCase: UpdateMarketUseCase;
  activateMarketUseCase: ActivateMarketUseCase;
  pauseMarketUseCase: PauseMarketUseCase;
  resumeMarketUseCase: ResumeMarketUseCase;
  extendMarketCloseTimeUseCase: ExtendMarketCloseTimeUseCase;
  resolveMarketUseCase: ResolveMarketUseCase;
  cancelMarketUseCase: CancelMarketUseCase;
  grantPointsUseCase: GrantPointsUseCase;
  listUsersUseCase: ListUsersUseCase;
  getUserDetailUseCase: GetUserDetailUseCase;
  getAdminStatsUseCase: GetAdminStatsUseCase;
  getAdminMarketsUseCase: GetAdminMarketsUseCase;

  auditLogRepository: AuditLogRepository;
  getAuditLogUseCase: GetAuditLogUseCase;

  // WebSocket
  webSocketManager: WebSocketManager;

  // Categories
  categoryRepository: CategoryRepository;
  listCategoriesUseCase: ListCategoriesUseCase;
  createCategoryUseCase: CreateCategoryUseCase;
  updateCategoryUseCase: UpdateCategoryUseCase;
  deleteCategoryUseCase: DeleteCategoryUseCase;
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
