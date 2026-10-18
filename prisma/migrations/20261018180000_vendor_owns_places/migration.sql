-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "whatsappNumber" TEXT;
ALTER TABLE "Place" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Capture" ADD COLUMN "vendorId" TEXT;

-- Existing rows predate ownership: give them to the earliest vendor. If no vendor exists
-- yet they stay unowned and the seed assigns them when it creates one.
UPDATE "Place" SET "vendorId" = (SELECT "id" FROM "Vendor" ORDER BY "createdAt" LIMIT 1) WHERE "vendorId" IS NULL;
UPDATE "Capture" SET "vendorId" = (SELECT "id" FROM "Vendor" ORDER BY "createdAt" LIMIT 1) WHERE "vendorId" IS NULL;

-- googlePlaceId is now unique per vendor, not globally.
DROP INDEX "Place_googlePlaceId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_whatsappNumber_key" ON "Vendor"("whatsappNumber");
CREATE UNIQUE INDEX "Place_vendorId_googlePlaceId_key" ON "Place"("vendorId", "googlePlaceId");
CREATE INDEX "Place_vendorId_idx" ON "Place"("vendorId");
CREATE INDEX "Capture_vendorId_idx" ON "Capture"("vendorId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
