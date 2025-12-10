export interface CircuitBreakerService {
  /**
   * Check if the constant product invariant (k) is maintained.
   * Fails if newK < oldK.
   * 
   * @param kBefore The product of reserves before operation
   * @param kAfter The product of reserves after operation
   * @param marketId The market ID
   * @param operation Context of the operation (e.g., 'BUY', 'SELL')
   * @throws InvariantViolationError
   */
  checkKInvariant(kBefore: bigint, kAfter: bigint, marketId: string, operation: string): void;

  /**
   * Check if price movement is within safe limits.
   * Fails if movement > 30% in 5 minutes.
   * 
   * @param marketId The market ID
   * @param currentPrice The current probability/price (0.0 - 1.0)
   * @throws CircuitBreakerOpenError
   */
  checkPriceMovement(marketId: string, currentPrice: number): Promise<void>;

  /**
   * Check system health (DB, Error Rate).
   * Used by middleware to reject requests if system is unhealthy.
   * @throws CircuitBreakerOpenError
   */
  checkSystemHealth(): Promise<void>;

  /**
   * Record a request for rate monitoring.
   */
  recordRequest(): Promise<void>;

  /**
   * Record an error for rate monitoring.
   */
  recordError(): Promise<void>;
}
