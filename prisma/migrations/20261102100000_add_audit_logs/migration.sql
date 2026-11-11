CREATE TYPE "AuditAction" AS ENUM (
    'ROOM_PRICE_CHANGED',
    'CONTRACT_CREATED',
    'CONTRACT_TERMINATED',
    'INVOICE_PAID'
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_landlordId_createdAt_idx"
    ON "AuditLog"("landlordId", "createdAt");

CREATE INDEX "AuditLog_entityType_entityId_idx"
    ON "AuditLog"("entityType", "entityId");

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_landlordId_fkey"
    FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
