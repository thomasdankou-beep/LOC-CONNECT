-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('RENTAL', 'DAMAGE', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "Lender" ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "vatRegistered" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "paymentId" TEXT,
    "creditedInvoiceId" TEXT,
    "vatRateBps" INTEGER NOT NULL DEFAULT 0,
    "totalHt" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "totalTtc" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "key" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sourceKey_key" ON "Invoice"("sourceKey");

-- CreateIndex
CREATE INDEX "Invoice_clientId_issuedAt_idx" ON "Invoice"("clientId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_lenderId_issuedAt_idx" ON "Invoice"("lenderId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_reservationId_idx" ON "Invoice"("reservationId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
