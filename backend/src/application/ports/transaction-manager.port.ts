
export interface Transaction {
  // Marker interface for the underlying transaction object.
  // In Drizzle, this is the transaction object passed to the callback.
}

export interface TransactionManager {
  /**
   * Execute a callback within a transaction.
   * @param callback Function to execute. Receives a transaction object.
   */
  run<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T>;
}
