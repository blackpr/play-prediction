import { NotFoundError } from '../../../domain/errors/domain-error';
import { calculateBuyShares, calculateSellPoints, getPrices } from '../../../domain/services/cpmm-engine';
import { calculateNetAfterFee, calculateNetPayout } from '../../../domain/services/fee-calculator';
import { PRICE_PRECISION, type Side } from '../../../domain/services/constants';
import { MarketRepository } from '../../ports/repositories/market.repository';

export type QuoteAction = 'BUY' | 'SELL';

export interface GetQuoteRequest {
  marketId: string;
  side: Side;
  action: QuoteAction;
  amount: bigint;
}

export interface GetQuoteResponse {
  side: Side;
  action: QuoteAction;
  amountIn: string;
  estimatedSharesOut?: string;
  estimatedAmountOut?: string;
  estimatedFee: string;
  priceImpact: string;
  spotPrice: string;
  avgExecutionPrice: string;
  minimumRecommended: string;
  expiresAt: string;
}

export class GetQuoteUseCase {
  private readonly marketRepository: MarketRepository;

  constructor({ marketRepository }: { marketRepository: MarketRepository }) {
    this.marketRepository = marketRepository;
  }

  async execute(request: GetQuoteRequest): Promise<GetQuoteResponse> {
    const { marketId, side, action, amount } = request;

    // Fetch market and pool state (read-only, no transaction needed)
    const market = await this.marketRepository.findByIdWithPool(marketId);
    if (!market) {
      throw new NotFoundError('Market', marketId);
    }

    const pool = market.pool;

    // Calculate spot price
    const prices = getPrices({ yesQty: pool.yesQty, noQty: pool.noQty });
    const spotPrice = side === 'YES' ? prices.yesPrice : prices.noPrice;
    const spotPriceDecimal = (Number(spotPrice) / Number(PRICE_PRECISION)).toFixed(6);

    // Set quote expiry to 30 seconds from now
    const expiresAt = new Date(Date.now() + 30_000).toISOString();

    if (action === 'BUY') {
      // Calculate fee from input
      const { netAmount, fee } = calculateNetAfterFee(amount);

      // Calculate shares out using CPMM engine
      const buyResult = calculateBuyShares(netAmount, {
        yesQty: pool.yesQty,
        noQty: pool.noQty,
      }, side);

      // Calculate average execution price: amountIn / sharesOut (in MicroPoints per share)
      // Then convert to decimal price (divide by PRICE_PRECISION)
      const avgPriceInMicroPoints = (amount * PRICE_PRECISION) / buyResult.sharesOut;
      const avgExecutionPrice = (Number(avgPriceInMicroPoints) / Number(PRICE_PRECISION)).toFixed(6);

      // Calculate price impact (already in PRICE_PRECISION units)
      const priceImpactDecimal = (Number(buyResult.priceImpact) / Number(PRICE_PRECISION)).toFixed(6);

      // Calculate recommended minimum with 5% slippage
      const minimumRecommended = (buyResult.sharesOut * 95n) / 100n;

      return {
        side,
        action,
        amountIn: amount.toString(),
        estimatedSharesOut: buyResult.sharesOut.toString(),
        estimatedFee: fee.toString(),
        priceImpact: priceImpactDecimal,
        spotPrice: spotPriceDecimal,
        avgExecutionPrice,
        minimumRecommended: minimumRecommended.toString(),
        expiresAt,
      };
    } else {
      // action === 'SELL'
      // Calculate gross payout using CPMM engine
      const sellResult = calculateSellPoints(amount, {
        yesQty: pool.yesQty,
        noQty: pool.noQty,
      }, side);

      // Calculate fee from output
      const { netPayout, fee } = calculateNetPayout(sellResult.pointsOut);

      // Calculate average execution price: netPayout / sharesIn (in MicroPoints per share)
      // Then convert to decimal price (divide by PRICE_PRECISION)
      const avgPriceInMicroPoints = (netPayout * PRICE_PRECISION) / amount;
      const avgExecutionPrice = (Number(avgPriceInMicroPoints) / Number(PRICE_PRECISION)).toFixed(6);

      // Calculate price impact: (spotPrice - avgPrice) / spotPrice
      // avgPrice in PRICE_PRECISION units
      const avgPrice = (netPayout * PRICE_PRECISION) / amount;
      const priceImpact = spotPrice > avgPrice
        ? ((spotPrice - avgPrice) * PRICE_PRECISION) / spotPrice
        : 0n;
      const priceImpactDecimal = (Number(priceImpact) / Number(PRICE_PRECISION)).toFixed(6);

      // Calculate recommended minimum with 5% slippage
      const minimumRecommended = (netPayout * 95n) / 100n;

      return {
        side,
        action,
        amountIn: amount.toString(),
        estimatedAmountOut: netPayout.toString(),
        estimatedFee: fee.toString(),
        priceImpact: priceImpactDecimal,
        spotPrice: spotPriceDecimal,
        avgExecutionPrice,
        minimumRecommended: minimumRecommended.toString(),
        expiresAt,
      };
    }
  }
}
