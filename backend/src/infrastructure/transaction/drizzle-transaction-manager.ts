import { TransactionManager, Transaction } from '../../application/ports/transaction-manager.port';
import { DrizzleDB } from '../database/index';

export class DrizzleTransactionManager implements TransactionManager {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async run<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx: any) => {
      // Pass the Drizzle transaction object (tx) as our abstract Transaction
      return callback(tx as unknown as Transaction);
    });
  }
}
