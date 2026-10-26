-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminActionType" ADD VALUE 'SELLER_REJECTED';
ALTER TYPE "AdminActionType" ADD VALUE 'DEPOSIT_CHANGED';
ALTER TYPE "AdminActionType" ADD VALUE 'RETURN_RESOLVED';
ALTER TYPE "AdminActionType" ADD VALUE 'KEYWORD_CHANGED';
ALTER TYPE "AdminActionType" ADD VALUE 'TEMPLATE_CHANGED';
ALTER TYPE "AdminActionType" ADD VALUE 'STAFF_CHANGED';

-- DropIndex
DROP INDEX "PaymentWebhookEvent_providerEventId_key";

-- DropIndex
DROP INDEX "DeliveryWebhookEvent_providerEventId_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutKey" TEXT NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "commissionAmount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "commissionRateAtPurchase" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "creditApplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "platformDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sellerId" TEXT NOT NULL,
ADD COLUMN     "settledAmount" DECIMAL(12,2),
ADD COLUMN     "settledSubsidyAmount" DECIMAL(12,2),
ADD COLUMN     "titleAtPurchase" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "firstPurchaseOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" TEXT,
ADD COLUMN     "sellerEvidence" JSONB;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "bankFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "destinationToken" TEXT NOT NULL,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'uz',
ADD COLUMN     "marketingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StaffAccount" ADD COLUMN     "lastTotpStep" BIGINT,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorSecretEncrypted" TEXT;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "accessTokenHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "pickupAddress" TEXT NOT NULL,
ADD COLUMN     "region" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "eventKey" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "sellerId" TEXT,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerRef_key" ON "Payment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_createdAt_idx" ON "OutboxEvent"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_key_createdAt_idx" ON "AuthAttempt"("key", "createdAt");

-- CreateIndex
CREATE INDEX "Product_sellerId_status_idx" ON "Product"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

-- CreateIndex
CREATE INDEX "Order_buyerId_createdAt_idx" ON "Order"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_sellerId_status_idx" ON "OrderItem"("sellerId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_status_confirmDeadline_idx" ON "OrderItem"("status", "confirmDeadline");

-- CreateIndex
CREATE INDEX "OrderItem_status_autoConfirmAt_idx" ON "OrderItem"("status", "autoConfirmAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_couponCode_key" ON "Promotion"("couponCode");

-- CreateIndex
CREATE INDEX "Promotion_sellerId_isActive_idx" ON "Promotion"("sellerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DepositTier_minProductCount_key" ON "DepositTier"("minProductCount");

-- CreateIndex
CREATE INDEX "LedgerEntry_account_ownerId_idx" ON "LedgerEntry"("account", "ownerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_groupId_idx" ON "LedgerEntry"("groupId");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderItemId_idx" ON "LedgerEntry"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payout_payeeType_payeeId_status_idx" ON "Payout"("payeeType", "payeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_accessTokenHash_key" ON "RefreshToken"("accessTokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_subjectType_subjectId_idx" ON "RefreshToken"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryWebhookEvent_provider_providerEventId_key" ON "DeliveryWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventKey_userId_channel_key" ON "Notification"("eventKey", "userId", "channel");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Database invariants for all writers, including direct SQL/imports.
ALTER TABLE "ProductVariant" ADD CONSTRAINT "variant_nonnegative" CHECK ("price" > 0 AND "stockQuantity" >= 0 AND "salesCount" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "cart_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "item_amounts" CHECK ("quantity" > 0 AND "priceAtPurchase" > 0 AND "discountAmount" >= 0 AND "discountAmount" <= "quantity" * "priceAtPurchase" AND "platformDiscountAmount" >= 0 AND "platformDiscountAmount" <= "quantity" * "priceAtPurchase" - "discountAmount" AND "deliveryAmount" >= 0 AND "taxAmount" >= 0 AND "commissionAmount" >= 0);
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Seller" ADD CONSTRAINT "seller_balances_rates" CHECK ("depositBalance" >= 0 AND "depositHeldAmount" >= 0 AND "depositHeldAmount" <= "depositBalance" AND "rating" BETWEEN 0 AND 5 AND "commissionRate" >= 0 AND "taxRate" >= 0 AND "commissionRate" + "taxRate" <= 100);
ALTER TABLE "DepositTier" ADD CONSTRAINT "deposit_tier_positive" CHECK ("minProductCount" >= 0 AND "depositAmount" > 0);
ALTER TABLE "Payout" ADD CONSTRAINT "payout_positive" CHECK ("amount" > 0 AND "bankFeeAmount" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "payment_positive" CHECK ("amount" > 0);
ALTER TABLE "Promotion" ADD CONSTRAINT "promotion_rules" CHECK (("scope" = 'SELLER' AND "sellerId" IS NOT NULL OR "scope" = 'PLATFORM' AND "sellerId" IS NULL) AND (("discountPercent" IS NOT NULL AND "fixedAmount" IS NULL AND "discountPercent" > 0 AND "discountPercent" <= 100) OR ("fixedAmount" IS NOT NULL AND "discountPercent" IS NULL AND "fixedAmount" > 0)) AND ("startAt" IS NULL OR "endAt" IS NULL OR "startAt" < "endAt"));
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "ledger_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "ledger_owner_required" CHECK ("account" NOT IN ('SELLER_FROZEN','SELLER_AVAILABLE','SELLER_DEPOSIT','BUYER_CREDIT') OR "ownerId" IS NOT NULL);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "ledger_group_fk" FOREIGN KEY ("groupId") REFERENCES "LedgerGroup"("id");
CREATE FUNCTION prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ledger entries are append-only; use reversing entries'; END;
$$;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE FUNCTION check_ledger_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE balance numeric;
BEGIN
 SELECT COALESCE(SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount" ELSE -"amount" END),0) INTO balance FROM "LedgerEntry" WHERE "groupId" = NEW."groupId";
 IF balance <> 0 THEN RAISE EXCEPTION 'Unbalanced ledger group'; END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_ledger_balance();

ALTER TABLE "Product" ADD COLUMN "moderationRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment" ADD COLUMN "checkoutUrl" TEXT;
