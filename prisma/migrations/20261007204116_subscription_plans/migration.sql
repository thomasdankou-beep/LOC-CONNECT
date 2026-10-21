-- AlterEnum
ALTER TYPE "BalanceEntryKind" ADD VALUE 'SUBSCRIPTION_FEE';

-- AlterEnum
ALTER TYPE "InvoiceKind" ADD VALUE 'SUBSCRIPTION';

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_reservationId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "reservationId" DROP NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Lender" ADD COLUMN     "nextPlan" "SubscriptionPlan",
ADD COLUMN     "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planRenewsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "periodFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rateBps" INTEGER;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
