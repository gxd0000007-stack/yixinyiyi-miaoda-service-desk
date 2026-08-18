import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { desc, eq, inArray } from 'drizzle-orm';

import {
  customerAsset,
  customerCoupon,
  customerImportAudit,
  customerTransaction,
  customerTransactionItem,
} from '@server/database/schema';
import type {
  CustomerCoupon,
  CustomerLedgerFilter,
  CustomerLedgerImportAudit,
  CustomerLedgerResponse,
  CustomerTransaction,
  CustomerTransactionItem,
} from '@shared/api.interface';

type CustomerAssetRow = typeof customerAsset.$inferSelect;
type CustomerCouponRow = typeof customerCoupon.$inferSelect;
type CustomerImportAuditRow = typeof customerImportAudit.$inferSelect;
type CustomerTransactionRow = typeof customerTransaction.$inferSelect;
type CustomerTransactionItemRow = typeof customerTransactionItem.$inferSelect;

function normalizeMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0.00';
  const normalized: string = String(value).replace(/,/gu, '').trim();
  const matched: RegExpMatchArray | null = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/u);
  if (!matched) return '0.00';
  const sign: string = matched[1] || '';
  const whole: string = matched[2];
  const fraction: string = `${matched[3] || ''}00`.slice(0, 2);
  return `${sign}${whole}.${fraction}`;
}

function moneyToCents(value: string | number | null | undefined): bigint {
  const normalized: string = normalizeMoney(value);
  const negative: boolean = normalized.startsWith('-');
  const unsigned: string = negative ? normalized.slice(1) : normalized;
  const [whole, fraction]: string[] = unsigned.split('.');
  const cents: bigint = BigInt(whole) * 100n + BigInt(fraction);
  return negative ? -cents : cents;
}

function centsToMoney(value: bigint): string {
  const negative: boolean = value < 0n;
  const absolute: bigint = negative ? -value : value;
  const whole: bigint = absolute / 100n;
  const fraction: string = String(absolute % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function sumMoney(values: Array<string | number | null | undefined>): string {
  return centsToMoney(
    values.reduce(
      (sum: bigint, value: string | number | null | undefined) =>
        sum + moneyToCents(value),
      0n,
    ),
  );
}

function normalizeDeductions(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]: [string, unknown]) => [
      key,
      normalizeMoney(typeof item === 'string' || typeof item === 'number' ? item : 0),
    ]),
  );
}

function matchesFilter(
  orderType: string | null,
  filter: CustomerLedgerFilter,
): boolean {
  const value: string = orderType || '';
  if (filter === 'all') return true;
  if (filter === 'service') return value.includes('品项');
  if (filter === 'card') return value.includes('售卡') || value.includes('升卡');
  if (filter === 'recharge') return value.includes('充值');
  return value.includes('网店');
}

function safeFilter(value: string): CustomerLedgerFilter {
  return ['all', 'service', 'card', 'recharge', 'online'].includes(value)
    ? (value as CustomerLedgerFilter)
    : 'all';
}

@Injectable()
export class CustomerLedgerService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
  ) {}

  async findLedger(
    customerId: string,
    queryValue: string,
    filterValue: string,
    pageValue: number,
    pageSizeValue: number,
  ): Promise<CustomerLedgerResponse> {
    const [assetRows, transactionRows, couponRows, auditRows] =
      await Promise.all([
        this.database
          .select()
          .from(customerAsset)
          .where(eq(customerAsset.id, customerId))
          .limit(1),
        this.database
          .select()
          .from(customerTransaction)
          .where(eq(customerTransaction.customerAssetId, customerId))
          .orderBy(desc(customerTransaction.orderedAt))
          .limit(1000),
        this.database
          .select()
          .from(customerCoupon)
          .where(eq(customerCoupon.customerAssetId, customerId))
          .orderBy(desc(customerCoupon.validTo), customerCoupon.couponName)
          .limit(1000),
        this.database
          .select()
          .from(customerImportAudit)
          .orderBy(desc(customerImportAudit.importedAt))
          .limit(1),
      ]);
    const asset: CustomerAssetRow | undefined = assetRows[0];
    if (!asset) throw new NotFoundException('未找到该客户资产');

    const transactionIds: string[] = transactionRows.map(
      (row: CustomerTransactionRow) => row.id,
    );
    const itemRows: CustomerTransactionItemRow[] =
      transactionIds.length === 0
        ? []
        : await this.database
            .select()
            .from(customerTransactionItem)
            .where(inArray(customerTransactionItem.transactionId, transactionIds))
            .orderBy(customerTransactionItem.transactionId, customerTransactionItem.lineNo)
            .limit(1000);
    const itemsByTransaction = new Map<string, CustomerTransactionItem[]>();
    itemRows.forEach((row: CustomerTransactionItemRow) => {
      const item: CustomerTransactionItem = this.toItem(row);
      itemsByTransaction.set(row.transactionId, [
        ...(itemsByTransaction.get(row.transactionId) || []),
        item,
      ]);
    });

    const transactions: CustomerTransaction[] = transactionRows.map(
      (row: CustomerTransactionRow) => this.toTransaction(
        row,
        itemsByTransaction.get(row.id) || [],
      ),
    );
    const query: string = queryValue.trim().toLocaleLowerCase('zh-CN');
    const filter: CustomerLedgerFilter = safeFilter(filterValue);
    const filtered: CustomerTransaction[] = transactions.filter(
      (transaction: CustomerTransaction) => {
        if (!matchesFilter(transaction.orderType || null, filter)) return false;
        if (!query) return true;
        return [
          transaction.orderNo,
          transaction.orderType,
          transaction.paymentMethod,
          transaction.amountDetail,
          transaction.remark,
          transaction.store,
          transaction.status,
          ...transaction.items.flatMap((item: CustomerTransactionItem) => [
            item.itemName,
            item.itemCategory,
            item.artisan,
            item.salesperson,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('zh-CN')
          .includes(query);
      },
    );
    const page: number = Math.max(1, pageValue);
    const pageSize: number = Math.min(50, Math.max(1, pageSizeValue));
    const start: number = (page - 1) * pageSize;
    const coupons: CustomerCoupon[] = couponRows.map(
      (row: CustomerCouponRow) => this.toCoupon(row),
    );
    const deductionValues: string[] = transactionRows.flatMap(
      (row: CustomerTransactionRow) =>
        Object.values(normalizeDeductions(row.deductions)),
    );
    const orderTypeCounts: Record<string, number> = {};
    transactionRows.forEach((row: CustomerTransactionRow) => {
      const key: string = row.orderType || '未分类';
      orderTypeCounts[key] = (orderTypeCounts[key] || 0) + 1;
    });

    return {
      customerId: asset.id,
      customerName: asset.customerName,
      summary: {
        orderCount: transactionRows.length,
        itemCount: itemRows.length,
        couponCount: couponRows.length,
        currentBalanceExact: normalizeMoney(asset.currentBalance),
        totalSpendExact: normalizeMoney(asset.totalSpend),
        actualAmountTotalExact: sumMoney(
          transactionRows.map((row: CustomerTransactionRow) => row.actualAmount),
        ),
        benefitDeductionTotalExact: sumMoney(deductionValues),
        couponFaceValueTotalExact: sumMoney(
          couponRows.map((row: CustomerCouponRow) => row.faceValue),
        ),
        orderTypeCounts,
      },
      transactions: filtered.slice(start, start + pageSize),
      coupons,
      audit: auditRows[0] ? this.toAudit(auditRows[0]) : undefined,
      total: filtered.length,
      page,
      pageSize,
      filter,
      query: queryValue.trim(),
    };
  }

  private toTransaction(
    row: CustomerTransactionRow,
    items: CustomerTransactionItem[],
  ): CustomerTransaction {
    return {
      id: row.id,
      orderNo: row.orderNo,
      orderedAt: row.orderedAt.toISOString(),
      orderType: row.orderType || undefined,
      detailUrl: row.detailUrl || undefined,
      remark: row.remark || undefined,
      actualAmountExact:
        row.actualAmount === null ? undefined : normalizeMoney(row.actualAmount),
      amountDetail: row.amountDetail || undefined,
      paymentMethod: row.paymentMethod || undefined,
      deductions: normalizeDeductions(row.deductions),
      store: row.store || undefined,
      status: row.status || undefined,
      items,
    };
  }

  private toItem(row: CustomerTransactionItemRow): CustomerTransactionItem {
    return {
      id: row.id,
      lineNo: row.lineNo,
      itemName: row.itemName,
      itemCategory: row.itemCategory || undefined,
      productUrl: row.productUrl || undefined,
      unitPriceExact:
        row.unitPrice === null ? undefined : normalizeMoney(row.unitPrice),
      quantityExact: row.quantity === null ? undefined : String(row.quantity),
      artisan: row.artisan || undefined,
      salesperson: row.salesperson || undefined,
      actualAmountExact:
        row.actualAmount === null ? undefined : normalizeMoney(row.actualAmount),
      amountDetail: row.amountDetail || undefined,
      paymentMethod: row.paymentMethod || undefined,
      deductions: normalizeDeductions(row.deductions),
      store: row.store || undefined,
      status: row.status || undefined,
    };
  }

  private toCoupon(row: CustomerCouponRow): CustomerCoupon {
    return {
      id: row.id,
      couponName: row.couponName,
      faceValueExact:
        row.faceValue === null ? undefined : normalizeMoney(row.faceValue),
      threshold: row.threshold || undefined,
      validFrom: row.validFrom || undefined,
      validTo: row.validTo || undefined,
      status: row.status,
    };
  }

  private toAudit(row: CustomerImportAuditRow): CustomerLedgerImportAudit {
    return {
      batchKey: row.batchKey,
      sourceName: row.sourceName,
      status: row.status,
      customerCount: row.customerCount,
      transactionCount: row.transactionCount,
      itemCount: row.itemCount,
      couponCount: row.couponCount,
      balanceErrorCount: row.balanceErrorCount,
      identityErrorCount: row.identityErrorCount,
      duplicateOrderCount: row.duplicateOrderCount,
      precisionErrorCount: row.precisionErrorCount,
      importedAt: row.importedAt.toISOString(),
    };
  }
}
