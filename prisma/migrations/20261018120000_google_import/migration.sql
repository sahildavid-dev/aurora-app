-- CreateEnum
CREATE TYPE "ImportState" AS ENUM ('PENDING', 'IMPORTING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "GoogleImport" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "state" "ImportState" NOT NULL DEFAULT 'PENDING',
    "archiveJobId" TEXT,
    "accessTokenEnc" TEXT,
    "placeCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GoogleImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleImport_vendorId_createdAt_idx" ON "GoogleImport"("vendorId", "createdAt");

-- AddForeignKey
ALTER TABLE "GoogleImport" ADD CONSTRAINT "GoogleImport_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
