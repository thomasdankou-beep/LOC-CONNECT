-- DropForeignKey
ALTER TABLE "LenderReimbursement" DROP CONSTRAINT "LenderReimbursement_refundId_fkey";

-- AlterTable
ALTER TABLE "LenderReimbursement" ADD COLUMN     "modificationId" TEXT,
ALTER COLUMN "refundId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LenderReimbursement" ADD CONSTRAINT "LenderReimbursement_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
