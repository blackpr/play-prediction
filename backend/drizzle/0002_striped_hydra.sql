DO $$
BEGIN
    ALTER TABLE "markets" ADD COLUMN "activates_at" timestamp with time zone;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;