-- Add per-instance refund toggle (default off)
ALTER TABLE "payment_provider_instances"
  ADD COLUMN IF NOT EXISTS "refund_enabled" BOOLEAN NOT NULL DEFAULT false;
