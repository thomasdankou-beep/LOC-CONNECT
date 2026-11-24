CREATE TABLE "HandoverSignature" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "signer" TEXT NOT NULL,
    "strokes" JSONB NOT NULL,
    "recordedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HandoverSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HandoverSignature_reservationId_lenderId_fingerprint_key" ON "HandoverSignature"("reservationId", "lenderId", "fingerprint");
ALTER TABLE "HandoverSignature" ADD CONSTRAINT "HandoverSignature_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HandoverSignature" ADD CONSTRAINT "HandoverSignature_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
