import { WebSocketManager } from './websocket-manager';
import { WebSocketMessage } from './websocket-manager';

export class BroadcastService {
  constructor(private readonly wsManager: WebSocketManager) { }

  /**
   * Broadcast price update to all subscribers of a market
   */
  async broadcastPriceUpdate(marketId: string, data: {
    yesPrice: string;
    noPrice: string;
    yesQty: string;
    noQty: string;
    lastTradePrice: string;
    lastTradeSide: 'YES' | 'NO';
    lastTradeSize: string;
    volume24h: string;
  }): Promise<void> {
    const channel = `market:${marketId}`;
    const message: Partial<WebSocketMessage> = {
      type: 'price_update',
      channel,
      data: {
        marketId,
        ...data
      },
      timestamp: new Date().toISOString()
    };

    await this.wsManager.broadcast(channel, message);
  }

  /**
   * Send trade confirmation to a specific user
   */
  async sendTradeConfirmation(userId: string, data: {
    transactionId: string;
    marketId: string;
    action: 'BUY' | 'SELL';
    side: 'YES' | 'NO';
    amountIn?: string;
    sharesIn?: string;
    sharesOut?: string;
    amountOut?: string;
    feePaid: string;
    newBalance: string;
    newPosition: {
      yesQty: string;
      noQty: string;
    };
  }): Promise<void> {
    const channel = `user:${userId}`;
    const message: Partial<WebSocketMessage> = {
      type: 'trade_confirmed',
      channel,
      data,
      timestamp: new Date().toISOString()
    };

    await this.wsManager.sendToUser(userId, message);
  }
}
