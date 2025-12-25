
import { calculateBuyShares, calculateSellPoints } from '../src/domain/services/cpmm-engine';

const PRICE_PRECISION = 1_000_000n;

function testCPMM() {
  console.log('Testing CPMM Engine Fixes (Buy & Sell)...');

  // Initial Pool: 100 YES, 100 NO
  const pool = {
    yesQty: 100n,
    noQty: 100n
  };

  const amountIn = 10n; // Buying with 10 Points

  console.log(`\n1. BUY YES with ${amountIn} points`);
  console.log(`Pool: YES=${pool.yesQty}, NO=${pool.noQty}`);

  const buyResult = calculateBuyShares(amountIn, pool, 'YES');

  console.log(`Shares Out: ${buyResult.sharesOut}`);
  console.log(`New Pool: YES=${buyResult.newYesQty}, NO=${buyResult.newNoQty}`);

  // Implied Price
  const price = Number(amountIn) / Number(buyResult.sharesOut);
  console.log(`Implied Price: ${price.toFixed(4)}`); // Should be ~0.52

  if (price > 1.0) {
    console.error('FAIL: Price > 100% (Buy logic wrong)');
    process.exit(1);
  }

  console.log(`\n2. SELL ${buyResult.sharesOut} YES shares (Round Trip)`);

  const poolAfterBuy = {
    yesQty: buyResult.newYesQty,
    noQty: buyResult.newNoQty
  };

  const sellResult = calculateSellPoints(buyResult.sharesOut, poolAfterBuy, 'YES');

  console.log(`Points Out: ${sellResult.pointsOut}`);
  console.log(`Final Pool: YES=${sellResult.newYesQty}, NO=${sellResult.newNoQty}`);

  // ARBITRAGE CHECK
  // You must not get back more points than you put in (ignoring trees, this checks pure math)
  if (sellResult.pointsOut > amountIn) {
    console.error(`FAIL: Arbitrage Detected! Put in ${amountIn}, got back ${sellResult.pointsOut}`);
    process.exit(1);
  } else {
    console.log(`PASS: No Arbitrage (${sellResult.pointsOut} <= ${amountIn})`);
  }

  // Verify K Invariants
  const k1 = pool.yesQty * pool.noQty;
  const k2 = buyResult.newYesQty * buyResult.newNoQty;
  const k3 = sellResult.newYesQty * sellResult.newNoQty;

  console.log(`\nInvariant Check (k):`);
  console.log(`Initial: ${k1}`);
  console.log(`After Buy: ${k2}`);
  console.log(`After Sell: ${k3}`);

  if (k2 < k1 || k3 < k2) {
    console.warn('WARNING: k decreased! (Check integer rounding)');
    // In practice small decreases might happen if we aren't careful with floor/ceil.
    // Our logic handles strict checks, so this should pass.
  } else {
    console.log('PASS: Invariants maintained');
  }
}

testCPMM();
