CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "liquidity_pools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"yes_qty" bigint NOT NULL,
	"no_qty" bigint NOT NULL,
	"version_id" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"resolution" varchar(10),
	"image_url" varchar(2048),
	"category" varchar(100),
	"closes_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"event_ended_at" timestamp with time zone,
	"close_behavior" varchar(20) DEFAULT 'auto' NOT NULL,
	"buffer_minutes" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "point_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"grant_type" varchar(30) NOT NULL,
	"reason" varchar(500),
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolios" (
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"yes_qty" bigint DEFAULT 0 NOT NULL,
	"no_qty" bigint DEFAULT 0 NOT NULL,
	"yes_cost_basis" bigint DEFAULT 0 NOT NULL,
	"no_cost_basis" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_user_id_market_id_pk" PRIMARY KEY("user_id","market_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"side" varchar(3),
	"amount_in" bigint NOT NULL,
	"amount_out" bigint NOT NULL,
	"shares_before" bigint,
	"shares_after" bigint,
	"fee_paid" bigint DEFAULT 0 NOT NULL,
	"fee_vault" bigint DEFAULT 0 NOT NULL,
	"fee_lp" bigint DEFAULT 0 NOT NULL,
	"pool_yes_before" bigint,
	"pool_no_before" bigint,
	"pool_yes_after" bigint,
	"pool_no_after" bigint,
	"price_at_execution" bigint,
	"idempotency_key" varchar(255),
	"original_trade_id" uuid,
	"void_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(100),
	"balance" bigint DEFAULT 0 NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_id_markets_id_fk" FOREIGN KEY ("id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "markets" ADD CONSTRAINT "markets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "point_grants" ADD CONSTRAINT "point_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "point_grants" ADD CONSTRAINT "point_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_ledger" ADD CONSTRAINT "trade_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_ledger" ADD CONSTRAINT "trade_ledger_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_admin" ON "audit_logs" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_status" ON "markets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_status_closes" ON "markets" USING btree ("status","closes_at") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_category" ON "markets" USING btree ("category") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_created_by" ON "markets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_close_behavior" ON "markets" USING btree ("close_behavior","status","closes_at") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_point_grants_user" ON "point_grants" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_point_grants_type" ON "point_grants" USING btree ("grant_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolios_user" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolios_market" ON "portfolios" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolios_holdings" ON "portfolios" USING btree ("user_id","market_id") WHERE "portfolios"."yes_qty" > 0 OR "portfolios"."no_qty" > 0;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ledger_user" ON "trade_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ledger_market" ON "trade_ledger" USING btree ("market_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ledger_idempotency" ON "trade_ledger" USING btree ("idempotency_key") WHERE "trade_ledger"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ledger_action" ON "trade_ledger" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" USING btree ("role") WHERE is_active = true;