-- AlterTable
ALTER TABLE "Place" ADD COLUMN "city" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "geocodedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Place_vendorId_country_idx" ON "Place"("vendorId", "country");
