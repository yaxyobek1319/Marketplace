import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
// Embedded PostgreSQL engine in memory. Never reads DATABASE_URL or connects to user infrastructure.
test('migrations install; SQL enforces balanced append-only ledger and data bounds', async () => {
  const db = new PGlite();
  try {
    for (const migration of (await readdir('prisma/migrations'))
      .filter((v) => /^\d/.test(v))
      .sort())
      await db.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
    await db.exec(`INSERT INTO "LedgerGroup" (id) VALUES ('payment-1')`);
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO "LedgerEntry" (id,"groupId",account,direction,amount) VALUES ('cash','payment-1','PLATFORM_CASH','DEBIT',100)`,
      );
      await tx.query(
        `INSERT INTO "LedgerEntry" (id,"groupId",account,"ownerId",direction,amount) VALUES ('seller','payment-1','SELLER_FROZEN','seller-1','CREDIT',100)`,
      );
    });
    await assert.rejects(
      db.query(`UPDATE "LedgerEntry" SET amount=99 WHERE id='seller'`),
      /append-only/,
    );
    await assert.rejects(db.query(`DELETE FROM "LedgerEntry" WHERE id='seller'`), /append-only/);
    await assert.rejects(
      db.query(
        `INSERT INTO "LedgerEntry" (id,"groupId",account,direction,amount) VALUES ('bad','payment-1','PLATFORM_CASH','DEBIT',1)`,
      ),
      /Unbalanced/,
    );
    await assert.rejects(
      db.query(
        `INSERT INTO "LedgerEntry" (id,"groupId",account,direction,amount) VALUES ('bad2','payment-1','BUYER_CREDIT','CREDIT',1)`,
      ),
      /ledger_owner_required/,
    );
    const result = await db.query<{ balance: string }>(
      `SELECT SUM(CASE WHEN direction='DEBIT' THEN amount ELSE -amount END)::text AS balance FROM "LedgerEntry"`,
    );
    assert.equal(result.rows[0].balance, '0.00');
    await db.exec(
      `INSERT INTO "User" (id,phone) VALUES ('user-1','+998901234567'); INSERT INTO "Seller" (id,"userId","storeName") VALUES ('seller-1','user-1','Store'); INSERT INTO "Category" (id,"nameI18n") VALUES (1,'{"uz":"Telefon","ru":"Телефон"}'); INSERT INTO "Product" (id,"sellerId","categoryId","titleI18n","updatedAt") VALUES ('p','seller-1',1,'{}',NOW());`,
    );
    await assert.rejects(
      db.query(
        `INSERT INTO "ProductVariant" (id,"productId",attributes,sku,price,"stockQuantity") VALUES ('v','p','{}','SKU',100,-1)`,
      ),
      /variant_nonnegative/,
    );
    await assert.rejects(
      db.query(`UPDATE "Seller" SET "commissionRate"=99,"taxRate"=12 WHERE id='seller-1'`),
      /seller_balances_rates/,
    );
  } finally {
    await db.close();
  }
});
