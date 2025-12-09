import { db } from './index';
import { users, markets, liquidityPools, pointGrants, UserRole, MarketStatus } from './drizzle/schema';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Check connection
    console.log('Checking database connection...');
    const result = await db.execute(sql`SELECT NOW()`);
    console.log('Connection successful. Server time:', result[0]?.now);

    // 1. Create Treasury User
    console.log('Creating Treasury user...');
    const treasuryId = '00000000-0000-0000-0000-000000000001';
    
    // Check if exists
    const existingUser = await db.select().from(users).where(sql`${users.id} = ${treasuryId}`);
    
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: treasuryId,
        email: 'treasury@playprediction.com',
        role: UserRole.TREASURY,
        balance: 1_000_000_000_000n, // 1M Points
        isActive: true,
      });
      console.log('✅ Treasury user created');
    } else {
      console.log('ℹ️ Treasury user already exists');
    }

    // 2. Create Test Market
    console.log('Creating test market...');
    const [market] = await db.insert(markets).values({
      title: 'Will it rain tomorrow?',
      description: 'Binary prediction for rain in San Francisco.',
      status: MarketStatus.ACTIVE,
      createdBy: treasuryId,
      closesAt: new Date(Date.now() + 86400000), // 24h from now
    }).returning();
    
    // 3. Initialize Liquidity Pool
    await db.insert(liquidityPools).values({
      id: market.id,
      yesQty: 10_000_000n,
      noQty: 10_000_000n,
    });
    
    console.log(`✅ Market created: ${market.title} (${market.id})`);

    console.log('✅ Seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
