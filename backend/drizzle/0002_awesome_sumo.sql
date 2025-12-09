-- Migration: Add trade voiding support for post-event betting prevention
-- See EDGE_CASES.md Section 6.2.2 for design rationale
--
-- When resolving a market, admin specifies when the event actually ended.
-- Trades placed after that time are automatically voided and refunded.

-- Add event_ended_at to markets for tracking when event actually concluded
ALTER TABLE "markets" ADD COLUMN "event_ended_at" timestamp with time zone;--> statement-breakpoint

-- Add columns to trade_ledger for VOID action support
ALTER TABLE "trade_ledger" ADD COLUMN "original_trade_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_ledger" ADD COLUMN "void_reason" varchar(100);--> statement-breakpoint

-- Update action constraint to include VOID
ALTER TABLE "trade_ledger" DROP CONSTRAINT IF EXISTS "ledger_action_valid";--> statement-breakpoint
ALTER TABLE "trade_ledger" ADD CONSTRAINT "ledger_action_valid" CHECK (
  "action" IN ('BUY', 'SELL', 'MINT', 'MERGE', 'NET_SELL', 'GENESIS_MINT', 
               'RESOLUTION_PAYOUT', 'REFUND', 'DEPOSIT', 'WITHDRAW', 'VOID')
);--> statement-breakpoint

-- Constraint: void_reason and original_trade_id required only for VOID actions
ALTER TABLE "trade_ledger" ADD CONSTRAINT "ledger_void_reason_check" CHECK (
  ("action" = 'VOID' AND "void_reason" IS NOT NULL AND "original_trade_id" IS NOT NULL)
  OR ("action" != 'VOID' AND "void_reason" IS NULL AND "original_trade_id" IS NULL)
);--> statement-breakpoint

-- Self-referential FK for original_trade_id (links VOID entry to original trade)
ALTER TABLE "trade_ledger" ADD CONSTRAINT "trade_ledger_original_trade_id_fk" 
FOREIGN KEY ("original_trade_id") REFERENCES "trade_ledger"("id");