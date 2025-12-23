import { FastifyBaseLogger } from 'fastify';

/**
 * Business Logic Logger Utilities
 * 
 * Provides structured logging helpers for important business operations
 */

interface TradeLogData {
  userId: string;
  marketId: string;
  action: string;
  side?: string;
  amount: string;
  sharesOut?: string;
  feePaid?: string;
  executionPrice?: string;
  duration?: number;
}

interface AdminActionLogData {
  adminId: string;
  adminEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
}

interface MarketEventLogData {
  marketId: string;
  action: string;
  status?: string;
  resolution?: string;
  totalPayout?: string;
  affectedUsers?: number;
}

interface AuthEventLogData {
  userId?: string;
  email?: string;
  action: string;
  success: boolean;
  reason?: string;
}

export class BusinessLogger {
  /**
   * Log a trading operation
   */
  static logTrade(logger: FastifyBaseLogger, data: TradeLogData): void {
    logger.info({
      category: 'trade',
      ...data,
    }, `Trade executed: ${data.action} ${data.side || ''} on market ${data.marketId}`);
  }

  /**
   * Log an admin action
   */
  static logAdminAction(logger: FastifyBaseLogger, data: AdminActionLogData): void {
    logger.info({
      category: 'admin',
      ...data,
    }, `Admin action: ${data.action} by ${data.adminEmail || data.adminId}`);
  }

  /**
   * Log a market lifecycle event
   */
  static logMarketEvent(logger: FastifyBaseLogger, data: MarketEventLogData): void {
    logger.info({
      category: 'market',
      ...data,
    }, `Market event: ${data.action} for market ${data.marketId}`);
  }

  /**
   * Log an authentication event
   */
  static logAuthEvent(logger: FastifyBaseLogger, data: AuthEventLogData): void {
    const level = data.success ? 'info' : 'warn';
    logger[level]({
      category: 'auth',
      ...data,
    }, `Auth: ${data.action} - ${data.success ? 'success' : 'failed'}`);
  }

  /**
   * Log a performance metric
   */
  static logPerformance(
    logger: FastifyBaseLogger,
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = duration > 1000 ? 'warn' : 'debug';
    logger[level]({
      category: 'performance',
      operation,
      duration: `${duration}ms`,
      ...metadata,
    }, `${operation} took ${duration}ms`);
  }

  /**
   * Log a circuit breaker event
   */
  static logCircuitBreaker(
    logger: FastifyBaseLogger,
    event: 'open' | 'close' | 'half-open',
    service: string,
    reason?: string
  ): void {
    logger.warn({
      category: 'circuit_breaker',
      event,
      service,
      reason,
    }, `Circuit breaker ${event} for ${service}`);
  }

  /**
   * Log a WebSocket event
   */
  static logWebSocket(
    logger: FastifyBaseLogger,
    event: string,
    data: {
      userId?: string;
      sessionId?: string;
      channel?: string;
      error?: string;
    }
  ): void {
    const level = data.error ? 'error' : 'debug';
    logger[level]({
      category: 'websocket',
      event,
      ...data,
    }, `WebSocket ${event}`);
  }
}

