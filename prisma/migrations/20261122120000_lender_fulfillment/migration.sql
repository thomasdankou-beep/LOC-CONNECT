ALTER TABLE "Hold" ADD COLUMN "lenderFulfillment" JSONB;
ALTER TABLE "Reservation" ADD COLUMN "lenderFulfillment" JSONB;
ALTER TABLE "Quote" ADD COLUMN "lenderFulfillment" JSONB;
