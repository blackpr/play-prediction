import { createDatabase } from './index';
import {
  users,
  markets,
  liquidityPools,
  pointGrants,
  tradeLedger,
  portfolios,
  UserRole,
  MarketStatus,
  PointGrantType,
  TradeAction,
  Side,
  CloseBehavior
} from './drizzle/schema';
import { sql, eq } from 'drizzle-orm';
import { loadEnv } from '../../shared/config/env';

// Load environment variables
loadEnv(process.cwd());

async function seed() {
  console.log('🌱 Seeding database...');

  const db = createDatabase();

  try {
    // Check connection
    console.log('Checking database connection...');
    const result = await db.execute(sql`SELECT NOW()`);
    console.log('Connection successful. Server time:', result[0]?.now);

    // ========================================================================
    // 1. USERS
    // ========================================================================
    console.log('Creating users...');

    // Treasury User
    const treasuryEmail = 'treasury@playprediction.com';
    let treasuryId = '00000000-0000-0000-0000-000000000001';

    // Find first to avoid unique constraint if ID differs
    const existingTreasury = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, treasuryEmail)
    });

    if (existingTreasury) {
      treasuryId = existingTreasury.id;
      await db.update(users)
        .set({ balance: 1_000_000_000_000n, role: UserRole.TREASURY, isActive: true })
        .where(sql`${users.id} = ${treasuryId}`);
      console.log(`✅ Treasury user updated (${treasuryId})`);
    } else {
      await db.insert(users).values({
        id: treasuryId,
        email: treasuryEmail,
        role: UserRole.TREASURY,
        balance: 1_000_000_000_000n,
        isActive: true,
      }).onConflictDoUpdate({
        target: users.id,
        set: { balance: 1_000_000_000_000n } // Fallback if ID matches
      });
      console.log('✅ Treasury user created');
    }

    // Test User
    const testUserEmail = 'user@example.com';
    let testUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const existingTestUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, testUserEmail)
    });

    if (existingTestUser) {
      testUserId = existingTestUser.id;
      await db.update(users)
        .set({ balance: 10_000_000_000n, role: UserRole.USER, isActive: true })
        .where(sql`${users.id} = ${testUserId}`);
      console.log(`✅ Test user updated (${testUserId})`);
    } else {
      await db.insert(users).values({
        id: testUserId,
        email: testUserEmail,
        role: UserRole.USER,
        balance: 10_000_000_000n,
        isActive: true,
      }).onConflictDoUpdate({
        target: users.id,
        set: { balance: 10_000_000_000n }
      });
      console.log('✅ Test user created');
    }

    // ========================================================================
    // 2. MARKETS & POOLS
    // ========================================================================
    console.log('Creating markets and pools...');

    // Helper to create market with price history
    const createMarket = async (
      title: string,
      category: string,
      status: string,
      closesInHours: number,
      targetVolume: bigint = 0n,
      probability = 0.5
    ) => {
      const closesAt = new Date(Date.now() + (closesInHours * 60 * 60 * 1000));
      // Market created 7 days ago to allow for price history
      const createdAt = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

      const [market] = await db.insert(markets).values({
        title,
        description: `Prediction market for: ${title}`,
        status: status as any,
        category,
        createdBy: treasuryId,
        closesAt,
        createdAt,
        closeBehavior: CloseBehavior.AUTO,
        imageUrl: `https://picsum.photos/seed/${title.replace(/\s/g, '')}/400/300`
      }).returning();

      // Initial Pool Setup
      let yesQty = 10_000_000_000n;
      let noQty = 10_000_000_000n;

      // Adjust initial pool for improved probability if needed (e.g. 0.6)
      // This sets the "start price"
      if (probability !== 0.5) {
        const ratio = probability / (1 - probability);
        noQty = BigInt(Math.floor(Number(yesQty) * ratio));
      }

      await db.insert(liquidityPools).values({
        id: market.id,
        yesQty,
        noQty,
      });

      // Generate Random Trades for Price History
      if (targetVolume > 0n) {
        const numTrades = 50;
        const avgTradeSize = Number(targetVolume) / numTrades;
        const startTime = createdAt.getTime();
        const endTime = Date.now();
        const duration = endTime - startTime;

        let currentYesQty = yesQty;
        let currentNoQty = noQty;
        const tradeInserts = [];

        for (let i = 0; i < numTrades; i++) {
          // Distribute trades randomly over the last 7 days
          const tradeTime = new Date(startTime + (duration * (i / numTrades)));

          // Randomly BUY YES or BUY NO to fluctuate price
          const isBuyYes = Math.random() > 0.5;
          const side = isBuyYes ? Side.YES : Side.NO;

          // Random trade amount (+/- 50% of avg)
          const amountIn = BigInt(Math.floor(avgTradeSize * (0.5 + Math.random())));

          // SIMPLIFIED PRICE IMPACT CALCULATION FOR SEEDING
          // In a real AMM (CPMM), k = x * y.
          // When buying YES:
          // 1. Fee is taken (ignoring for seed simplicity)
          // 2. new_pool_no = k / (pool_yes + amount_in)  <-- Simplified, actually amount goes into pool_yes

          // For seeding, we will just update the pool quantities to simulate price movement
          // without doing the perfect CPMM math, as long as the ratio changes, price changes.
          // P_YES = NO_QTY / (YES_QTY + NO_QTY)

          if (isBuyYes) {
            // Buying YES increases YES Qty in pool (user puts money in), 
            // but actually in CPMM "Buying YES" means you put in Collateral and take out YES shares?
            // Wait, in our system (conditional tokens / CPMM):
            // To Buy YES: You put in Collateral (USD/Points). 
            // The pool gives you YES tokens.
            // The pool's YES reserves go DOWN? No, CPMM is different.

            // Let's stick to the simplest interpretation of the DB schema:
            // pool_yes_after and pool_no_after are recorded.
            // If many people buy YES, the price of YES goes UP.
            // Price YES = NO_QTY / (YES + NO).
            // To increase Price YES, NO_QTY must increase relative to YES_QTY? 
            // Or YES_QTY must Decrease?

            // Actually in CPMM for prediction markets (Gnosis):
            // You trade Collateral for Outcome Tokens.
            // If you buy YES:
            // You send Collateral.
            // Pool keeps Collateral.
            // Pool sends you YES tokens.
            // Pool's YES balance DECREASES.
            // Pool's NO balance stays same (conceptually, if using shares).

            // However, our schema tracks `yesQty` and `noQty`.
            // If we assume `k = yesQty * noQty`:
            // Buying YES -> Remove YES from pool -> yesQty decreases -> Price of YES (in terms of NO) increases?

            // Let's simulate simplified drift:
            // If Buy YES: decrease yesQty slightly, increase noQty slightly (arbitrary drift)?
            // Or just modify the ratio directly to ensure "Price History" exists.

            // SIMULATION: Update quantities to shift price
            const impact = BigInt(Math.floor(Number(currentYesQty) * 0.01)); // 1% impact
            currentYesQty -= impact;
            // To keep k roughly similar or just allow it to drift, let's just shift ratio
          } else {
            // Buy NO -> Price NO goes up (YES goes down)
            const impact = BigInt(Math.floor(Number(currentNoQty) * 0.01));
            currentNoQty -= impact;
          }

          tradeInserts.push({
            userId: treasuryId,
            marketId: market.id,
            action: TradeAction.BUY,
            side: side,
            amountIn: amountIn,
            amountOut: amountIn, // 1:1 for simplicity in seed
            feePaid: 0n,
            feeLp: 0n,
            feeVault: 0n,
            poolYesAfter: currentYesQty,
            poolNoAfter: currentNoQty,
            priceAtExecution: 500000n, // Dummy
            createdAt: tradeTime
          });
        }

        // Insert all trades
        if (tradeInserts.length > 0) {
          await db.insert(tradeLedger).values(tradeInserts);
        }

        // Update final pool state
        await db.update(liquidityPools)
          .set({ yesQty: currentYesQty, noQty: currentNoQty })
          .where(eq(liquidityPools.id, market.id));
      }

      return market;
    };

    // ACTIVE MARKETS
    await createMarket('Will Bitcoin hit $100k in 2025?', 'Crypto', MarketStatus.ACTIVE, 24 * 30, 5_000_000_000n, 0.6);
    await createMarket('Will SpaceX launch Starship in March?', 'Space', MarketStatus.ACTIVE, 24 * 5, 2_000_000_000n, 0.8);
    await createMarket('Who will win the Super Bowl?', 'Sports', MarketStatus.ACTIVE, 24 * 2, 10_000_000_000n, 0.5);
    await createMarket('Will GPT-5 be released this year?', 'AI', MarketStatus.ACTIVE, 24 * 180, 1_000_000_000n, 0.3);
    await createMarket('Will ETH flip BTC market cap?', 'Crypto', MarketStatus.ACTIVE, 24 * 365, 500_000_000n, 0.1);
    await createMarket('Will it rain in London tomorrow?', 'Weather', MarketStatus.ACTIVE, 20, 100_000_000n, 0.7);

    // RESOLVED
    const [resolvedMkt] = await db.insert(markets).values({
      title: 'Did Python release version 3.12?',
      description: 'Resolved yes',
      status: MarketStatus.RESOLVED,
      resolution: 'YES',
      category: 'Technology',
      createdBy: treasuryId,
      closesAt: new Date(Date.now() - 86400000),
      resolvedAt: new Date(Date.now() - 43200000),
    }).returning();
    await db.insert(liquidityPools).values({ id: resolvedMkt.id, yesQty: 10_000_000n, noQty: 10_000_000n });

    await db.insert(markets).values({
      title: 'Did Taylor Swift win Album of the Year?',
      description: 'Resolved no',
      status: MarketStatus.RESOLVED,
      resolution: 'NO',
      category: 'Entertainment',
      createdBy: treasuryId,
      closesAt: new Date(Date.now() - 86400000 * 2),
      resolvedAt: new Date(Date.now() - 86400000),
    });

    // CANCELLED
    await db.insert(markets).values({
      title: 'Cancelled Event Example',
      description: 'This event was cancelled',
      status: MarketStatus.CANCELLED,
      resolution: 'CANCELLED',
      category: 'Other',
      createdBy: treasuryId,
      closesAt: new Date(Date.now() + 86400000),
    });

    console.log('✅ Markets created');

    // ========================================================================
    // 3. PORTFOLIOS & LEDGER
    // ========================================================================
    console.log('Creating portfolios...');

    const btcMarket = await db.query.markets.findFirst({
      where: (m, { ilike }) => ilike(m.title, '%Bitcoin%')
    });

    if (btcMarket) {
      await db.insert(portfolios).values({
        userId: testUserId,
        marketId: btcMarket.id,
        yesQty: 500_000_000n,
        yesCostBasis: 250_000_000n,
      }).onConflictDoNothing();

      await db.insert(tradeLedger).values({
        userId: testUserId,
        marketId: btcMarket.id,
        action: TradeAction.BUY,
        side: Side.YES,
        amountIn: 250_000_000n,
        amountOut: 500_000_000n,
        priceAtExecution: 500000n,
      });
      console.log('✅ Portfolio & Trade created for Bitcoin market');
    }

    // ========================================================================
    // 4. POINT GRANTS (History)
    // ========================================================================
    console.log('Creating point grants...');

    const existingGrants = await db.select().from(pointGrants).where(sql`${pointGrants.userId} = ${testUserId}`);

    if (existingGrants.length === 0) {
      await db.insert(pointGrants).values([
        {
          userId: testUserId,
          amount: 100_000_000n,
          balanceBefore: 0n,
          balanceAfter: 100_000_000n,
          grantType: PointGrantType.REGISTRATION_BONUS,
          reason: 'Welcome bonus',
        },
        {
          userId: testUserId,
          amount: 50_000_000n,
          balanceBefore: 100_000_000n,
          balanceAfter: 150_000_000n,
          grantType: PointGrantType.ADMIN_GRANT,
          reason: 'Bug bounty reward',
          grantedBy: treasuryId,
        }
      ]);
      console.log('✅ Point grants created');
    } else {
      console.log('ℹ️ Point grants already exist');
    }

    console.log('✅ Seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
