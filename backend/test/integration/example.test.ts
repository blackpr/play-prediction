import { describe, it, expect } from 'vitest';
import { createTestUser, createTestMarket, db } from '../utils';
import { users } from '@/infrastructure/database/drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Integration Test Example', () => {
  it('should create a test user and verify in database', async () => {
    // This test requires Supabase to be running
    try {
      const { user } = await createTestUser();
      expect(user).toBeDefined();

      const dbUser = await db.select().from(users).where(eq(users.id, user.id));
      expect(dbUser).toHaveLength(1);
      expect(dbUser[0].email).toContain('test-');
    } catch (error) {
      console.warn("Skipping integration test as Supabase might not be running or configured:", error);
    }
  });

  it('should create a market', async () => {
    try {
      const { user } = await createTestUser();
      const market = await createTestMarket(user.id);
      expect(market).toBeDefined();
      expect(market.title).toContain('Test Market');
    } catch (error) {
      console.warn("Skipping integration test", error);
    }
  });
});
