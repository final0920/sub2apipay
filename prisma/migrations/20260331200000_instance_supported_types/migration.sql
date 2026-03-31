-- 实例支持的支付渠道类型（逗号分隔）
ALTER TABLE "payment_provider_instances" ADD COLUMN "supported_types" TEXT NOT NULL DEFAULT '';
