CREATE TABLE "ProductConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "lenderId" TEXT NOT NULL REFERENCES "Lender"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ProductConversation_clientId_productId_lenderId_key" ON "ProductConversation"("clientId", "productId", "lenderId");
CREATE INDEX "ProductConversation_clientId_updatedAt_idx" ON "ProductConversation"("clientId", "updatedAt");
CREATE INDEX "ProductConversation_lenderId_updatedAt_idx" ON "ProductConversation"("lenderId", "updatedAt");

CREATE TABLE "ProductMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL REFERENCES "ProductConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "requestId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ProductMessage_conversationId_authorId_requestId_key" ON "ProductMessage"("conversationId", "authorId", "requestId");
CREATE INDEX "ProductMessage_conversationId_createdAt_id_idx" ON "ProductMessage"("conversationId", "createdAt", "id");

CREATE TABLE "ProductMessagePhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL REFERENCES "ProductMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "storageKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "ProductMessagePhoto_storageKey_key" ON "ProductMessagePhoto"("storageKey");
CREATE UNIQUE INDEX "ProductMessagePhoto_messageId_position_key" ON "ProductMessagePhoto"("messageId", "position");

INSERT INTO "Permission" ("id", "code", "label", "domain", "scope")
VALUES ('lc-product-messages', 'PRODUCT_MESSAGE_MANAGE', 'Lire les questions sur les articles et y répondre', 'Relation client', 'LENDER')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" = 'SYSTEM:ORDER_MANAGER' AND p."code" = 'PRODUCT_MESSAGE_MANAGE'
ON CONFLICT DO NOTHING;
