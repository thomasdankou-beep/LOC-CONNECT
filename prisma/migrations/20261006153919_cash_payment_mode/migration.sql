-- CreateEnum
CREATE TYPE "LenderPaymentMode" AS ENUM ('ONLINE_FULL', 'DEPOSIT_CASH');

-- CreateEnum
CREATE TYPE "CashSettlementStatus" AS ENUM ('PENDING', 'PAID', 'UNPAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Lender" ADD COLUMN     "cashModeAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMode" "LenderPaymentMode" NOT NULL DEFAULT 'ONLINE_FULL';

-- AlterTable
ALTER TABLE "ModificationLine" ADD COLUMN     "cashAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMode" "LenderPaymentMode" NOT NULL DEFAULT 'ONLINE_FULL';

-- AlterTable
ALTER TABLE "ModificationRequest" ADD COLUMN     "cashAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cashBefore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PaymentAllocation" ADD COLUMN     "cashAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cashTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReservationItem" ADD COLUMN     "cashDue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMode" "LenderPaymentMode" NOT NULL DEFAULT 'ONLINE_FULL';

-- CreateTable
CREATE TABLE "CashSettlement" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "deliveryDue" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "status" "CashSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "reportedAt" TIMESTAMP(3),
    "reportedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSettlement_lenderId_status_idx" ON "CashSettlement"("lenderId", "status");

-- CreateIndex
CREATE INDEX "CashSettlement_status_createdAt_idx" ON "CashSettlement"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashSettlement_reservationId_lenderId_key" ON "CashSettlement"("reservationId", "lenderId");

-- AddForeignKey
ALTER TABLE "CashSettlement" ADD CONSTRAINT "CashSettlement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSettlement" ADD CONSTRAINT "CashSettlement_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
