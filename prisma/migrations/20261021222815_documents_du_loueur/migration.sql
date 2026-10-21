-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lender" ADD COLUMN     "postalAddress" TEXT,
ADD COLUMN     "shareCapital" INTEGER,
ADD COLUMN     "terms" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "eventName" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);
