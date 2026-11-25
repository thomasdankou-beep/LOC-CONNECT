ALTER TABLE "Product" ADD COLUMN "importReference" TEXT;
CREATE UNIQUE INDEX "Product_lenderId_importReference_key" ON "Product"("lenderId", "importReference");
