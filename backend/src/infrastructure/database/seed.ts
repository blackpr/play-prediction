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
  CloseBehavior,
  categories
} from './drizzle/schema';
import { sql, eq, and, inArray } from 'drizzle-orm';
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

    // SYSTEM User (for automated jobs and background processes)
    const systemEmail = 'system@internal';
    const systemId = '00000000-0000-0000-0000-000000000000'; // Fixed UUID for SYSTEM user

    const existingSystem = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, systemEmail)
    });

    if (existingSystem) {
      await db.update(users)
        .set({
          balance: 0n,
          role: UserRole.ADMIN,
          isActive: true,
          displayName: 'System'
        })
        .where(sql`${users.id} = ${systemId}`);
      console.log(`✅ SYSTEM user updated (${systemId})`);
    } else {
      await db.insert(users).values({
        id: systemId,
        email: systemEmail,
        displayName: 'System',
        role: UserRole.ADMIN,
        balance: 0n,
        isActive: true,
      }).onConflictDoUpdate({
        target: users.id,
        set: { balance: 0n }
      });
      console.log('✅ SYSTEM user created');
    }

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
        .set({
          balance: 1_000_000_000_000n,
          role: UserRole.TREASURY,
          isActive: true,
          displayName: 'Treasury System'
        })
        .where(sql`${users.id} = ${treasuryId}`);
      console.log(`✅ Treasury user updated (${treasuryId})`);
    } else {
      await db.insert(users).values({
        id: treasuryId,
        email: treasuryEmail,
        displayName: 'Treasury System',
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
        .set({
          balance: 10_000_000_000n,
          role: UserRole.USER,
          isActive: true,
          displayName: 'Test User'
        })
        .where(sql`${users.id} = ${testUserId}`);
      console.log(`✅ Test user updated (${testUserId})`);
    } else {
      await db.insert(users).values({
        id: testUserId,
        email: testUserEmail,
        displayName: 'Test User',
        role: UserRole.USER,
        balance: 10_000_000_000n,
        isActive: true,
      }).onConflictDoUpdate({
        target: users.id,
        set: { balance: 10_000_000_000n }
      });
      console.log('✅ Test user created');
    }

    // Admin User
    const adminEmail = 'admin@playprediction.com';
    let adminId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

    const existingAdmin = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, adminEmail)
    });

    if (existingAdmin) {
      adminId = existingAdmin.id;
      await db.update(users)
        .set({
          balance: 50_000_000_000n,
          role: UserRole.ADMIN,
          isActive: true,
          displayName: 'Admin'
        })
        .where(sql`${users.id} = ${adminId}`);
      console.log(`✅ Admin user updated (${adminId})`);
    } else {
      await db.insert(users).values({
        id: adminId,
        email: adminEmail,
        displayName: 'Admin',
        role: UserRole.ADMIN,
        balance: 50_000_000_000n,
        isActive: true,
      }).onConflictDoUpdate({
        target: users.id,
        set: { balance: 50_000_000_000n }
      });
      console.log('✅ Admin user created');
    }

    // Regular User 2 (for variety)
    const user2Email = 'alice@example.com';
    let user2Id = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

    const existingUser2 = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, user2Email)
    });

    if (existingUser2) {
      user2Id = existingUser2.id;
      await db.update(users)
        .set({
          balance: 5_000_000_000n,
          role: UserRole.USER,
          isActive: true,
          displayName: 'Alice Chen'
        })
        .where(sql`${users.id} = ${user2Id}`);
      console.log(`✅ User 2 updated (${user2Id})`);
    } else {
      await db.insert(users).values({
        id: user2Id,
        email: user2Email,
        displayName: 'Alice Chen',
        role: UserRole.USER,
        balance: 5_000_000_000n,
        isActive: true,
      }).onConflictDoUpdate({
        target: users.id,
        set: { balance: 5_000_000_000n }
      });
      console.log('✅ User 2 created');
    }

    // ========================================================================
    // 2. CATEGORIES
    // ========================================================================
    console.log('Creating categories...');

    const CATEGORY_DEFAULTS: Record<string, { closeBehavior: string; bufferMinutes: number | null }> = {
      'Sports - Soccer': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
      'Sports - Basketball': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 30 },
      'Sports - Football': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 45 },
      'Sports - Other': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 15 },
      'Crypto': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
      'Weather': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
      'Politics': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
      'Entertainment': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
      'Technology': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
      'Other': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
      'Test': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
    };

    const slugify = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');

    const categoryMap: Record<string, string> = {};

    for (const [name, defaults] of Object.entries(CATEGORY_DEFAULTS)) {
      const slug = slugify(name);
      const [category] = await db.insert(categories).values({
        name,
        slug,
        defaultCloseBehavior: defaults.closeBehavior as any,
        defaultBufferMinutes: defaults.bufferMinutes,
      }).onConflictDoUpdate({
        target: categories.slug,
        set: {
          name,
          defaultCloseBehavior: defaults.closeBehavior as any,
          defaultBufferMinutes: defaults.bufferMinutes,
          updatedAt: new Date(),
        }
      }).returning();

      categoryMap[name] = category.id;
    }
    console.log('✅ Categories created');

    // ========================================================================
    // 3. MARKETS & POOLS
    // ========================================================================
    console.log('Creating markets and pools...');

    // Helper to create market with price history
    const createMarket = async (
      title: string,
      category: string,
      status: string,
      closesInHours: number,
      targetVolume: bigint = 0n,
      probability = 0.5,
      creatorId: string = treasuryId
    ) => {
      const closesAt = new Date(Date.now() + (closesInHours * 60 * 60 * 1000));
      // Market created 7 days ago to allow for price history
      const createdAt = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

      const [market] = await db.insert(markets).values({
        title,
        description: `Prediction market for: ${title}`,
        status: status as any,
        category,
        categoryId: categoryMap[category],
        createdBy: creatorId,
        closesAt,
        createdAt,
        closeBehavior: CATEGORY_DEFAULTS[category]?.closeBehavior as any || CloseBehavior.AUTO,
        bufferMinutes: CATEGORY_DEFAULTS[category]?.bufferMinutes,
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
        // Increase number of trades to 200 for better chart resolution
        const numTrades = 200;
        const avgTradeSize = Number(targetVolume) / numTrades;

        // Ensure we cover the last 24 hours well for the default chart view
        const startTime = createdAt.getTime();
        const endTime = Date.now();
        const duration = endTime - startTime;

        let currentYesQty = yesQty;
        let currentNoQty = noQty;
        const tradeInserts = [];

        for (let i = 0; i < numTrades; i++) {
          // Time distribution: 80% of trades in last 24h, 20% spread over previous 6 days
          // This ensures the default 24h view shows data
          const t = i / numTrades;
          let timeOffset;

          if (t < 0.8) {
            // First 80% of trades (160 trades) in last 24 hours
            const last24h = 24 * 60 * 60 * 1000;
            timeOffset = duration - last24h + (last24h * (t / 0.8));
          } else {
            // Last 20% of trades (40 trades) spread over previous 6 days
            const previous6days = duration - (24 * 60 * 60 * 1000);
            timeOffset = previous6days * ((t - 0.8) / 0.2);
          }

          const tradeTime = new Date(startTime + timeOffset);

          // Current Price (based on NO/Total)
          const currentTotal = Number(currentYesQty + currentNoQty);
          // Safety check for div by zero although unlikely with bigints
          const currentPrice = currentTotal > 0 ? Number(currentNoQty) / currentTotal : 0.5;

          // Random Walk Target (drifts by +/- 5%)
          let targetPrice = currentPrice + (Math.random() - 0.5) * 0.1;
          targetPrice = Math.max(0.1, Math.min(0.9, targetPrice));

          // Determine ACTION to reach target price
          // Simplified action logic:
          // If we want Price YES to go UP (Target > Current), we need to DECREASE YES Qty relative to NO.
          // (As per P_YES = NO / (YES + NO)).

          const isBuyYes = targetPrice > currentPrice;

          // Execute drift
          const k_invariant = currentYesQty + currentNoQty;
          const numericTotal = Number(k_invariant);

          let newNoQty, newYesQty;

          // Force quantities to match target price while keeping Sum constant-ish (simplified seeding)
          // Target = newNo / Total. => newNo = Total * Target.
          newNoQty = BigInt(Math.floor(numericTotal * targetPrice));
          newYesQty = k_invariant - newNoQty;

          // Record 'Trade'
          // Vary volume simply
          const tradeAmount = BigInt(Math.floor(avgTradeSize * (0.5 + Math.random())));

          tradeInserts.push({
            userId: treasuryId,
            marketId: market.id,
            action: TradeAction.BUY,
            side: isBuyYes ? Side.YES : Side.NO,
            amountIn: tradeAmount,
            amountOut: tradeAmount,
            feePaid: 0n,
            feeLp: 0n,
            feeVault: 0n,
            poolYesAfter: newYesQty,
            poolNoAfter: newNoQty,
            // Store micro-points price (0.50 => 500000)
            priceAtExecution: BigInt(Math.floor(targetPrice * 1_000_000)),
            createdAt: tradeTime
          });

          // Update state for next iteration
          currentYesQty = newYesQty;
          currentNoQty = newNoQty;
        }

        // Insert trades in chunks
        if (tradeInserts.length > 0) {
          try {
            const chunkSize = 50;
            for (let i = 0; i < tradeInserts.length; i += chunkSize) {
              await db.insert(tradeLedger).values(tradeInserts.slice(i, i + chunkSize));
            }
          } catch (e) {
            console.error('Error inserting trades:', e);
          }
        }

        // Update final pool state
        await db.update(liquidityPools)
          .set({ yesQty: currentYesQty, noQty: currentNoQty })
          .where(eq(liquidityPools.id, market.id));
      }

      return market;
    };

    // ACTIVE MARKETS - Mix of creators with future close dates
    await createMarket('Will Bitcoin hit $100k in 2025?', 'Crypto', MarketStatus.ACTIVE, 24 * 30, 5_000_000_000n, 0.6, treasuryId);
    await createMarket('Will SpaceX launch Starship in March?', 'Space', MarketStatus.ACTIVE, 24 * 15, 2_000_000_000n, 0.8, adminId);
    await createMarket('Who will win the Super Bowl?', 'Sports', MarketStatus.ACTIVE, 24 * 7, 10_000_000_000n, 0.5, user2Id);
    await createMarket('Will GPT-5 be released this year?', 'AI', MarketStatus.ACTIVE, 24 * 180, 1_000_000_000n, 0.3, treasuryId);
    await createMarket('Will ETH flip BTC market cap?', 'Crypto', MarketStatus.ACTIVE, 24 * 365, 500_000_000n, 0.1, adminId);
    await createMarket('Will it rain in London tomorrow?', 'Weather', MarketStatus.ACTIVE, 48, 100_000_000n, 0.7, user2Id);

    // RESOLVED
    const [resolvedMkt] = await db.insert(markets).values({
      title: 'Did Python release version 3.12?',
      description: 'Resolved yes',
      status: MarketStatus.RESOLVED,
      resolution: 'YES',
      category: 'Technology',
      categoryId: categoryMap['Technology'],
      createdBy: treasuryId,
      closesAt: new Date(Date.now() - 86400000),
      resolvedAt: new Date(Date.now() - 43200000),
      closeBehavior: CloseBehavior.AUTO,
    }).returning();
    await db.insert(liquidityPools).values({ id: resolvedMkt.id, yesQty: 10_000_000n, noQty: 10_000_000n });

    await db.insert(markets).values({
      title: 'Did Taylor Swift win Album of the Year?',
      description: 'Resolved no',
      status: MarketStatus.RESOLVED,
      resolution: 'NO',
      category: 'Entertainment',
      categoryId: categoryMap['Entertainment'],
      createdBy: treasuryId,
      closesAt: new Date(Date.now() - 86400000 * 2),
      resolvedAt: new Date(Date.now() - 86400000),
      closeBehavior: CloseBehavior.MANUAL,
    });

    // CANCELLED
    await db.insert(markets).values({
      title: 'Cancelled Event Example',
      description: 'This event was cancelled',
      status: MarketStatus.CANCELLED,
      resolution: 'CANCELLED',
      category: 'Other',
      categoryId: categoryMap['Other'],
      createdBy: treasuryId,
      closesAt: new Date(Date.now() + 86400000),
      closeBehavior: CloseBehavior.AUTO,
    });

    // PAUSED MARKET WITH POST-EVENT TRADES (for testing trade voiding preview)
    // Keep this seed idempotent: always move timestamps relative to "now" so the UI preview remains meaningful.
    const pausedMarketTitle = 'Will it snow on Christmas?';
    const eventEndTime = new Date(Date.now() - 60 * 60 * 1000); // Event ended 1 hour ago
    const closesAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // Closed 2 hours ago

    const existingPausedMarket = await db.query.markets.findFirst({
      where: (m, { eq }) => eq(m.title, pausedMarketTitle),
    });

    const [pausedMarket] = existingPausedMarket
      ? await db
        .update(markets)
        .set({
          description: 'Market for testing post-event trade voiding',
          status: MarketStatus.PAUSED,
          category: 'Weather',
          createdBy: treasuryId,
          closesAt,
          eventEndedAt: eventEndTime,
          closeBehavior: CloseBehavior.MANUAL,
        })
        .where(eq(markets.id, existingPausedMarket.id))
        .returning()
      : await db
        .insert(markets)
        .values({
          title: pausedMarketTitle,
          description: 'Market for testing post-event trade voiding',
          status: MarketStatus.PAUSED,
          category: 'Weather',
          categoryId: categoryMap['Weather'],
          createdBy: treasuryId,
          closesAt,
          eventEndedAt: eventEndTime, // Used by RESOLVE-1b UI defaults
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Created 7 days ago
          closeBehavior: CloseBehavior.MANUAL,
        })
        .returning();

    await db
      .insert(liquidityPools)
      .values({
        id: pausedMarket.id,
        yesQty: 8_000_000_000n,
        noQty: 12_000_000_000n,
      })
      .onConflictDoUpdate({
        target: liquidityPools.id,
        set: {
          yesQty: 8_000_000_000n,
          noQty: 12_000_000_000n,
          updatedAt: new Date(),
        },
      });

    // Ensure the preview shows the same 5 deterministic trades each seed run.
    await db
      .delete(tradeLedger)
      .where(
        and(
          eq(tradeLedger.marketId, pausedMarket.id),
          inArray(tradeLedger.action, [TradeAction.BUY, TradeAction.SELL]),
        ),
      );

    // Create trades: some before event ended, some after (to be voided)
    await db.insert(tradeLedger).values([
      // BEFORE event ended (valid trades)
      {
        userId: testUserId,
        marketId: pausedMarket.id,
        action: TradeAction.BUY,
        side: Side.YES,
        amountIn: 300_000_000n,
        amountOut: 600_000_000n,
        priceAtExecution: 500000n,
        createdAt: new Date(eventEndTime.getTime() - 30 * 60 * 1000), // 30 min before event ended
      },
      {
        userId: user2Id,
        marketId: pausedMarket.id,
        action: TradeAction.BUY,
        side: Side.NO,
        amountIn: 200_000_000n,
        amountOut: 400_000_000n,
        priceAtExecution: 500000n,
        createdAt: new Date(eventEndTime.getTime() - 15 * 60 * 1000), // 15 min before event ended
      },
      // AFTER event ended (should be voided)
      {
        userId: testUserId,
        marketId: pausedMarket.id,
        action: TradeAction.BUY,
        side: Side.YES,
        amountIn: 500_000_000n, // 0.5 Points
        amountOut: 1_000_000_000n,
        priceAtExecution: 500000n,
        createdAt: new Date(eventEndTime.getTime() + 5 * 60 * 1000), // 5 min AFTER event ended
      },
      {
        userId: user2Id,
        marketId: pausedMarket.id,
        action: TradeAction.BUY,
        side: Side.YES,
        amountIn: 200_000_000n, // 0.2 Points
        amountOut: 400_000_000n,
        priceAtExecution: 500000n,
        createdAt: new Date(eventEndTime.getTime() + 10 * 60 * 1000), // 10 min AFTER event ended
      },
      {
        userId: adminId,
        marketId: pausedMarket.id,
        action: TradeAction.BUY,
        side: Side.NO,
        amountIn: 100_000_000n, // 0.1 Points
        amountOut: 200_000_000n,
        priceAtExecution: 500000n,
        createdAt: new Date(eventEndTime.getTime() + 20 * 60 * 1000), // 20 min AFTER event ended
      },
    ]);

    console.log(
      `✅ PAUSED market ready for RESOLVE-1b preview (event ended at ${eventEndTime.toISOString()})`,
    );

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
