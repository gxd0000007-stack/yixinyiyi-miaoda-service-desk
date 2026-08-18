import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import {
  customerCardLedger,
  customerCoupon,
} from '../../server/database/schema';

function hasBalancedSingleQuotesOutsideDollarBlocks(sql: string): boolean {
  let inSingleQuote = false;
  let dollarTag: string | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const remainder = sql.slice(index);

    if (!inSingleQuote) {
      const dollarMatch = remainder.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        if (dollarTag === null) dollarTag = tag;
        else if (dollarTag === tag) dollarTag = null;
        index += tag.length - 1;
        continue;
      }
    }

    if (dollarTag !== null) continue;
    if (sql[index] !== "'") continue;

    if (inSingleQuote && sql[index + 1] === "'") {
      index += 1;
      continue;
    }
    inSingleQuote = !inSingleQuote;
  }

  return !inSingleQuote && dollarTag === null;
}

describe('database migration contract', () => {
  it('keeps the generated schema aligned with membership cash-voucher migration', () => {
    const couponColumns = getTableColumns(customerCoupon);
    const ledgerColumns = getTableColumns(customerCardLedger);

    expect(Object.keys(couponColumns)).toEqual(
      expect.arrayContaining([
        'couponType',
        'scope',
        'membershipTier',
        'grantSource',
        'usedAt',
        'usedOperationNo',
        'usedLedgerId',
        'usedProjectName',
      ]),
    );
    expect(Object.keys(ledgerColumns)).toEqual(
      expect.arrayContaining([
        'cashVoucherId',
        'cashVoucherDiscountCents',
      ]),
    );
  });

  it('keeps migration 009 as one balanced transaction with no trailing SQL', () => {
    const migrationPath = resolve(
      process.cwd(),
      'server/database/migrations/009_membership_discount_cash_voucher.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect((sql.match(/^BEGIN;$/gim) || []).length).toBe(1);
    expect((sql.match(/^COMMIT;$/gim) || []).length).toBe(1);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(hasBalancedSingleQuotesOutsideDollarBlocks(sql)).toBe(true);
  });
});
