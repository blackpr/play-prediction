import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, markets, liquidityPools, UserRole, MarketStatus, Resolution } from '@/infrastructure/database/drizzle/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Setup DB connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

// Setup Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const createTestUser = async (email?: string) => {
  const testEmail = email || `test-${randomUUID()}@example.com`;
  const password = 'Password123!';

  // Create user in Supabase Auth
  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password,
    email_confirm: true,
  });

  if (error || !user) throw new Error(`Failed to create test user: ${error?.message}`);

  // User should be automatically created in public.users by trigger, but we might need to wait or verify
  // For integration tests, we can query the DB directly to check
  // Note: The trigger might not fire if we are using a direct DB connection that doesn't simulate the Supabase environment perfectly,
  // but if we use supabase.auth.admin.createUser it should trigger.
  // However, since we are in a test environment, we might need to manually insert if the trigger logic isn't perfect in local self-hosted without all extensions.

  // Let's verify if user exists in our table, if not, insert it (resilience)
  const existing = await db.select().from(users).where(eq(users.id, user.id));
  if (existing.length === 0) {
    await db.insert(users).values({
      id: user.id,
      email: testEmail,
      role: UserRole.USER,
      balance: 10_000_000n, // 10 points
      isActive: true
    });
  }

  return { user, email: testEmail, password };
};

export const createTestMarket = async (creatorId: string) => {
  const market = await db.insert(markets).values({
    title: `Test Market ${randomUUID()}`,
    description: 'This is a test market',
    status: MarketStatus.ACTIVE,
    createdBy: creatorId,
  }).returning();

  // Create liquidity pool
  await db.insert(liquidityPools).values({
    id: market[0].id,
    yesQty: 100_000_000n,
    noQty: 100_000_000n,
  });

  return market[0];
};

export const cleanupTestData = async (userIds: string[] = [], marketIds: string[] = []) => {
  if (marketIds.length > 0) {
    // Delete markets - cascading deletion should handle pools, portfolios etc. if configured
    // But schema says onDelete cascade for liquidityPools points to market, so deleting market deletes pool.
    // Portfolios also cascade.
    // TradeLedger DOES NOT have cascade for marketId in schema definition I saw.
    // Let's force delete related data if needed or just delete markets and hope checks pass.
    // Actually, schema.ts line 169: marketId: uuid('market_id').notNull().references(() => markets.id) -- NO CASCADE.
    // So we must delete trades first if they exist.
    // However, createTestMarket doesn't create trades.
    for (const id of marketIds) {
      // Delete liquidity pool explicitly if no cascade (schema says cascade)
      // Delete market
      await db.delete(markets).where(eq(markets.id, id));
    }
  }

  if (userIds.length > 0) {
    for (const id of userIds) {
      // Delete from Supabase Auth
      await supabase.auth.admin.deleteUser(id);

      // Delete from public.users (should be cascaded from auth.users if trigger set up, but safe to try)
      // If we manually inserted, we manually delete.
      await db.delete(users).where(eq(users.id, id));
    }
  }
};
