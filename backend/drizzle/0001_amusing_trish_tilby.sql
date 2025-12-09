-- Migration: Add close behavior configuration to markets
-- See ADR_001_MARKET_CLOSE_BEHAVIOR.md for design rationale
-- 
-- close_behavior options:
--   'auto' - Auto-close when closes_at passes (default, for crypto/weather)
--   'manual' - Admin must close manually (for sports with added time like soccer)
--   'auto_with_buffer' - Auto-close after closes_at + buffer_minutes (for basketball/football OT)

ALTER TABLE "markets" ADD COLUMN "close_behavior" varchar(20) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "buffer_minutes" integer;--> statement-breakpoint

-- Constraint: close_behavior must be one of the valid options
ALTER TABLE "markets" ADD CONSTRAINT "markets_close_behavior_valid" 
CHECK ("close_behavior" IN ('auto', 'manual', 'auto_with_buffer'));--> statement-breakpoint

-- Constraint: buffer_minutes is required for auto_with_buffer, forbidden otherwise
ALTER TABLE "markets" ADD CONSTRAINT "markets_buffer_valid" 
CHECK (
  ("close_behavior" = 'auto_with_buffer' AND "buffer_minutes" IS NOT NULL AND "buffer_minutes" > 0)
  OR ("close_behavior" != 'auto_with_buffer' AND "buffer_minutes" IS NULL)
);--> statement-breakpoint

-- Index for scheduler jobs to efficiently query markets by close behavior
CREATE INDEX IF NOT EXISTS "idx_markets_close_behavior" ON "markets" USING btree ("close_behavior","status","closes_at") WHERE status = 'ACTIVE';