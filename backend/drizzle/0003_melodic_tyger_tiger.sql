-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_title_trgm" ON "markets" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_markets_description_trgm" ON "markets" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email_search" ON "users" USING gin ("email" gin_trgm_ops);