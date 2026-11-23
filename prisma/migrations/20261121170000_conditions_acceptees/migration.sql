-- Ne pas reconstituer rétroactivement un consentement pour les commandes existantes.
ALTER TABLE "Hold" ADD COLUMN "termsSnapshot" JSONB;
ALTER TABLE "Reservation" ADD COLUMN "termsSnapshot" JSONB;
