-- AlterTable: increase fee_rate precision from Decimal(5,2) to Decimal(5,4)
ALTER TABLE "orders" ALTER COLUMN "fee_rate" TYPE DECIMAL(5,4);
