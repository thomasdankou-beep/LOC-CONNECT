-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "returnDate" DATE,
ADD COLUMN     "returnSlotEnd" TEXT,
ADD COLUMN     "returnSlotStart" TEXT;

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "deliverySlot" TEXT,
ADD COLUMN     "quoteId" TEXT,
ADD COLUMN     "returnSlot" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "deliverySlot" TEXT,
ADD COLUMN     "quoteId" TEXT,
ADD COLUMN     "returnSlot" TEXT;

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'PICKUP',
    "deliveryAddress" TEXT,
    "deliveryCityId" TEXT,
    "deliveryZone" TEXT,
    "contactPhone" TEXT,
    "deliverySlot" TEXT,
    "returnSlot" TEXT,
    "total" INTEGER NOT NULL,
    "netToPay" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateIndex
CREATE INDEX "Quote_clientId_createdAt_idx" ON "Quote"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
