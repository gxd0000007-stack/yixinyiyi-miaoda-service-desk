import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { desc } from 'drizzle-orm';

import {
  customerAsset,
  customerCardAccount,
  customerCardLedger,
  customerTransaction,
  inventoryMovement,
  inventoryProduct,
} from '@server/database/schema';
import type {
  MembershipCardCustomerStat,
  MembershipCardStat,
  OperatingAnalyticsDetail,
  OperatingAnalyticsRange,
  OperatingAnalyticsResponse,
} from '@shared/api.interface';

type AssetRow = typeof customerAsset.$inferSelect;
type AccountRow = typeof customerCardAccount.$inferSelect;
type LedgerRow = typeof customerCardLedger.$inferSelect;
type TransactionRow = typeof customerTransaction.$inferSelect;
type MovementRow = typeof inventoryMovement.$inferSelect;
type ProductRow = typeof inventoryProduct.$inferSelect;

function centsToMoney(cents: number): string {
  const sign: string = cents < 0 ? '-' : '';
  const absolute: number = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function moneyToCents(value: string | number | null): number {
  if (value === null || value === '') return 0;
  const amount: number = Number(String(value).replace(/,/gu, ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function numericToMilli(value: string | number): number {
  return Math.round(Number(value) * 1000) || 0;
}

function shanghaiDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function rangeStart(
  range: OperatingAnalyticsRange,
  now: Date,
): Date | undefined {
  if (range === 'all') return undefined;
  const parts: string[] = shanghaiDateKey(now).split('-');
  const year: number = Number(parts[0]);
  const month: number = Number(parts[1]);
  const day: number = Number(parts[2]);
  let startMonth: number = month;
  let startDay: number = day;
  if (range === 'month') startDay = 1;
  if (range === 'quarter') {
    startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    startDay = 1;
  }
  if (range === 'half_year') {
    startMonth = month <= 6 ? 1 : 7;
    startDay = 1;
  }
  if (range === 'year') {
    startMonth = 1;
    startDay = 1;
  }
  return new Date(
    `${year}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}T00:00:00+08:00`,
  );
}

function rangeLabel(range: OperatingAnalyticsRange): string {
  const labels: Record<OperatingAnalyticsRange, string> = {
    today: '今日',
    month: '本月',
    quarter: '本季度',
    half_year: '本半年',
    year: '本年度',
    all: '全部历史',
  };
  return labels[range];
}

function inRange(value: Date, start: Date | undefined, end: Date): boolean {
  return (!start || value >= start) && value <= end;
}

function isCancelled(status: string | null): boolean {
  return /退款|取消|关闭|作废/u.test(status || '');
}

function isCashPayment(paymentMethod: string | null): boolean {
  return !/卡金|余额|次卡|耗卡|项目核销|权益/u.test(paymentMethod || '');
}

@Injectable()
export class OperatingAnalyticsService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
  ) {}

  async dashboard(
    range: OperatingAnalyticsRange,
  ): Promise<OperatingAnalyticsResponse> {
    const now: Date = new Date();
    const start: Date | undefined = rangeStart(range, now);
    const [assets, accounts, ledgers, transactions, movements, products]: [
      AssetRow[],
      AccountRow[],
      LedgerRow[],
      TransactionRow[],
      MovementRow[],
      ProductRow[],
    ] = await Promise.all([
      this.database.select().from(customerAsset),
      this.database.select().from(customerCardAccount),
      this.database
        .select()
        .from(customerCardLedger)
        .orderBy(desc(customerCardLedger.occurredAt)),
      this.database
        .select()
        .from(customerTransaction)
        .orderBy(desc(customerTransaction.orderedAt)),
      this.database
        .select()
        .from(inventoryMovement)
        .orderBy(desc(inventoryMovement.occurredAt)),
      this.database.select().from(inventoryProduct),
    ]);

    const assetMap: Map<string, AssetRow> = new Map(
      assets.map((row: AssetRow) => [row.id, row]),
    );
    const accountMap: Map<string, AccountRow> = new Map(
      accounts.map((row: AccountRow) => [row.id, row]),
    );
    const productMap: Map<string, ProductRow> = new Map(
      products.map((row: ProductRow) => [row.id, row]),
    );
    const reversedLedgerIds: Set<string> = new Set(
      ledgers
        .map((row: LedgerRow) => row.reversalOf)
        .filter((id: string | null): id is string => Boolean(id)),
    );

    const cashTransactions: TransactionRow[] = transactions.filter(
      (row: TransactionRow) =>
        inRange(row.orderedAt, start, now) &&
        !isCancelled(row.status) &&
        isCashPayment(row.paymentMethod) &&
        moneyToCents(row.actualAmount) !== 0,
    );
    const appCashSales: MovementRow[] = movements.filter(
      (row: MovementRow) =>
        inRange(row.occurredAt, start, now) &&
        (row.movementType === 'customer_sale' ||
          row.movementType === 'customer_sale_reversal') &&
        row.actualAmountCents !== 0 &&
        !(row.note || '').startsWith('卡金购买整单:'),
    );
    const cashTransactionCents: number = cashTransactions.reduce(
      (sum: number, row: TransactionRow) =>
        sum + moneyToCents(row.actualAmount),
      0,
    );
    const appCashSaleCents: number = appCashSales.reduce(
      (sum: number, row: MovementRow) =>
        sum +
        (row.movementType === 'customer_sale_reversal'
          ? -Math.abs(row.actualAmountCents)
          : row.actualAmountCents),
      0,
    );
    const cashPerformanceCents: number =
      cashTransactionCents + appCashSaleCents;

    const consumptionLedgers: LedgerRow[] = ledgers.filter(
      (row: LedgerRow) =>
        row.transactionType === 'deduction' &&
        row.status === 'posted' &&
        !reversedLedgerIds.has(row.id) &&
        row.itemType === 'service' &&
        inRange(row.occurredAt, start, now),
    );
    const ledgerValue = (row: LedgerRow): number =>
      row.deductionMode === 'entitlement'
        ? Math.round(
            (Math.abs(row.quantity) *
              (row.unitPriceCents || 0) *
              (row.discountBasisPoints || 10000)) /
              10000,
          )
        : Math.abs(row.amountCents);
    const cardConsumptionCents: number = consumptionLedgers.reduce(
      (sum: number, row: LedgerRow) => sum + ledgerValue(row),
      0,
    );

    const productSalesRows: MovementRow[] = movements.filter(
      (row: MovementRow) =>
        inRange(row.occurredAt, start, now) &&
        (row.movementType === 'customer_sale' ||
          row.movementType === 'customer_sale_reversal'),
    );
    const productSalesCents: number = productSalesRows.reduce(
      (sum: number, row: MovementRow) =>
        sum +
        (row.movementType === 'customer_sale_reversal'
          ? -Math.abs(row.actualAmountCents)
          : row.actualAmountCents),
      0,
    );
    const movementCost = (row: MovementRow): number => {
      const product: ProductRow | undefined = productMap.get(row.productId);
      const unitCost: number =
        row.unitCostCents || product?.purchaseCostCents || 0;
      return Math.round(
        (Math.abs(numericToMilli(row.quantity)) * unitCost) / 1000,
      );
    };
    const productCostCents: number = productSalesRows.reduce(
      (sum: number, row: MovementRow) =>
        sum +
        (row.movementType === 'customer_sale_reversal'
          ? -movementCost(row)
          : movementCost(row)),
      0,
    );
    const internalUseRows: MovementRow[] = movements.filter(
      (row: MovementRow) =>
        row.movementType === 'internal_use' &&
        inRange(row.occurredAt, start, now),
    );
    const internalUseCostCents: number = internalUseRows.reduce(
      (sum: number, row: MovementRow) => sum + movementCost(row),
      0,
    );

    const ledgerByAccount: Map<string, LedgerRow[]> = new Map();
    ledgers.forEach((row: LedgerRow) => {
      const list: LedgerRow[] = ledgerByAccount.get(row.accountId) || [];
      list.push(row);
      ledgerByAccount.set(row.accountId, list);
    });
    const accountBalance = (
      account: AccountRow,
    ): { principal: number; gift: number } => {
      const rows: LedgerRow[] = ledgerByAccount.get(account.id) || [];
      return rows.reduce(
        (total: { principal: number; gift: number }, row: LedgerRow) => {
          if (row.deductionMode === 'principal')
            total.principal += row.deltaAmountCents;
          if (row.deductionMode === 'gift') total.gift += row.deltaAmountCents;
          return total;
        },
        {
          principal: account.principalOpeningCents,
          gift: account.giftOpeningCents,
        },
      );
    };
    const cardLiabilityCents: number = accounts.reduce(
      (sum: number, account: AccountRow) => {
        const balance = accountBalance(account);
        return sum + Math.max(0, balance.principal) + Math.max(0, balance.gift);
      },
      0,
    );

    const stockByProduct: Map<string, number> = new Map();
    movements.forEach((row: MovementRow) => {
      stockByProduct.set(
        row.productId,
        (stockByProduct.get(row.productId) || 0) +
          numericToMilli(row.deltaQuantity),
      );
    });
    const inventoryCostCents: number = products.reduce(
      (sum: number, row: ProductRow) =>
        sum +
        Math.round(
          (Math.max(0, stockByProduct.get(row.id) || 0) *
            row.purchaseCostCents) /
            1000,
        ),
      0,
    );
    const costProductCount: number = products.filter(
      (row: ProductRow) => row.status === 'active' && row.purchaseCostCents > 0,
    ).length;
    const activeProductCount: number = products.filter(
      (row: ProductRow) => row.status === 'active',
    ).length;
    const costCoverage: number = activeProductCount
      ? Math.round((costProductCount / activeProductCount) * 100)
      : 100;
    const totalOperatingRevenueCents: number =
      cashPerformanceCents + cardConsumptionCents;
    const grossProfitCents: number =
      totalOperatingRevenueCents - productCostCents - internalUseCostCents;
    const grossMargin: number = totalOperatingRevenueCents
      ? (grossProfitCents / totalOperatingRevenueCents) * 100
      : 0;

    const membershipCards: MembershipCardStat[] = this.buildMembershipStats(
      accounts,
      ledgers,
      assetMap,
      start,
      now,
      reversedLedgerIds,
      accountBalance,
      ledgerValue,
    );

    const recommendations: string[] = [];
    if (cardLiabilityCents > totalOperatingRevenueCents * 3) {
      recommendations.push(
        '卡金未消耗负债明显高于本期经营收入，建议按到期日和沉睡天数分层激活客户。',
      );
    }
    if (costCoverage < 100) {
      recommendations.push(
        `仍有 ${activeProductCount - costProductCount} 个在售产品未录入成本，毛利结果暂不完整。`,
      );
    }
    if (internalUseCostCents > productCostCents && internalUseCostCents > 0) {
      recommendations.push(
        '内部领用成本高于产品销售成本，建议核对领用用途、领用人和单次用量。',
      );
    }
    if (productSalesCents > 0 && productCostCents / productSalesCents > 0.65) {
      recommendations.push(
        '产品销售成本率超过 65%，建议复核进货成本、售价和会员折扣。',
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(
        '当前已录数据未发现高风险异常，建议持续补齐成本并按月复核现金、耗卡与负债结构。',
      );
    }

    return {
      range,
      rangeLabel: rangeLabel(range),
      from: start?.toISOString(),
      to: now.toISOString(),
      summary: {
        cashPerformanceExact: centsToMoney(cashPerformanceCents),
        cardConsumptionExact: centsToMoney(cardConsumptionCents),
        totalOperatingRevenueExact: centsToMoney(totalOperatingRevenueCents),
        cardLiabilityExact: centsToMoney(cardLiabilityCents),
        productSalesExact: centsToMoney(productSalesCents),
        productCostExact: centsToMoney(productCostCents),
        internalUseCostExact: centsToMoney(internalUseCostCents),
        grossProfitExact: centsToMoney(grossProfitCents),
        grossMarginPercentExact: grossMargin.toFixed(2),
        inventoryCostExact: centsToMoney(inventoryCostCents),
        productCostCoveragePercent: costCoverage,
        cashTransactionCount: cashTransactions.length + appCashSales.length,
        cardConsumptionCount: consumptionLedgers.length,
        productSaleCount: productSalesRows.filter(
          (row: MovementRow) => row.movementType === 'customer_sale',
        ).length,
      },
      cashDetails: [
        ...cashTransactions.map(
          (row: TransactionRow): OperatingAnalyticsDetail => ({
            id: row.id,
            title: row.customerName,
            subtitle: `${row.orderNo} · ${row.paymentMethod || '收款方式未标注'}`,
            amountExact: centsToMoney(moneyToCents(row.actualAmount)),
            occurredAt: row.orderedAt.toISOString(),
            customerName: row.customerName,
            source: '客户交易流水',
          }),
        ),
        ...appCashSales.map(
          (row: MovementRow): OperatingAnalyticsDetail => ({
            id: row.id,
            title: row.customerName || '产品客户销售',
            subtitle: `${productMap.get(row.productId)?.productName || '产品'} · ${row.movementNo}`,
            amountExact: centsToMoney(
              row.movementType === 'customer_sale_reversal'
                ? -Math.abs(row.actualAmountCents)
                : row.actualAmountCents,
            ),
            occurredAt: row.occurredAt.toISOString(),
            customerName: row.customerName || undefined,
            source: '独立开单结算',
          }),
        ),
      ],
      cardConsumptionDetails: consumptionLedgers.map(
        (row: LedgerRow): OperatingAnalyticsDetail => ({
          id: row.id,
          title: row.projectName,
          subtitle: `${accountMap.get(row.accountId)?.cardName || '客户卡'} · ${row.deductionMode}`,
          amountExact: centsToMoney(ledgerValue(row)),
          occurredAt: row.occurredAt.toISOString(),
          customerName: assetMap.get(row.customerAssetId)?.customerName,
          source: '扣卡结算流水',
        }),
      ),
      productSalesDetails: productSalesRows.map(
        (row: MovementRow): OperatingAnalyticsDetail => ({
          id: row.id,
          title: productMap.get(row.productId)?.productName || '未知产品',
          subtitle: `${row.customerName || '未关联客户'} · ${row.movementNo}`,
          amountExact: centsToMoney(
            row.movementType === 'customer_sale_reversal'
              ? -Math.abs(row.actualAmountCents)
              : row.actualAmountCents,
          ),
          occurredAt: row.occurredAt.toISOString(),
          customerName: row.customerName || undefined,
          source: '产品销售流水',
        }),
      ),
      productCostDetails: productSalesRows.map(
        (row: MovementRow): OperatingAnalyticsDetail => ({
          id: `cost-${row.id}`,
          title: productMap.get(row.productId)?.productName || '未知产品',
          subtitle: `${row.quantity} ${productMap.get(row.productId)?.unit || '件'} · 销售成本`,
          amountExact: centsToMoney(
            row.movementType === 'customer_sale_reversal'
              ? -movementCost(row)
              : movementCost(row),
          ),
          occurredAt: row.occurredAt.toISOString(),
          customerName: row.customerName || undefined,
          source: '产品成本台账',
        }),
      ),
      internalUseCostDetails: internalUseRows.map(
        (row: MovementRow): OperatingAnalyticsDetail => ({
          id: row.id,
          title: productMap.get(row.productId)?.productName || '未知产品',
          subtitle: `${row.recipientName || '未标注领用人'} · ${row.purpose || '内部领用'}`,
          amountExact: centsToMoney(movementCost(row)),
          occurredAt: row.occurredAt.toISOString(),
          source: '内部领用流水',
        }),
      ),
      membershipCards,
      recommendations,
      storage: 'miaoda_cloud_database',
      sourceNote:
        '实时汇总客户交易、扣卡结算、会员卡余额、产品销售、库存成本及内部领用；毛利为已录成本口径，不含尚未录入的人工、房租与耗材分摊。',
    };
  }

  private buildMembershipStats(
    accounts: AccountRow[],
    ledgers: LedgerRow[],
    assetMap: Map<string, AssetRow>,
    start: Date | undefined,
    end: Date,
    reversedLedgerIds: Set<string>,
    accountBalance: (account: AccountRow) => {
      principal: number;
      gift: number;
    },
    ledgerValue: (row: LedgerRow) => number,
  ): MembershipCardStat[] {
    const result: Map<
      string,
      {
        accounts: AccountRow[];
        principal: number;
        gift: number;
        consumption: number;
        recharge: number;
      }
    > = new Map();
    accounts.forEach((account: AccountRow) => {
      const key: string = [
        account.cardName,
        account.category || '未分类',
        account.cardType || '会员卡',
        account.status,
      ].join('|');
      const current = result.get(key) || {
        accounts: [],
        principal: 0,
        gift: 0,
        consumption: 0,
        recharge: 0,
      };
      const balance = accountBalance(account);
      current.accounts.push(account);
      current.principal += Math.max(0, balance.principal);
      current.gift += Math.max(0, balance.gift);
      const rows: LedgerRow[] = ledgers.filter(
        (row: LedgerRow) =>
          row.accountId === account.id && inRange(row.occurredAt, start, end),
      );
      current.consumption += rows
        .filter(
          (row: LedgerRow) =>
            row.transactionType === 'deduction' &&
            row.itemType === 'service' &&
            !reversedLedgerIds.has(row.id),
        )
        .reduce((sum: number, row: LedgerRow) => sum + ledgerValue(row), 0);
      current.recharge += rows
        .filter(
          (row: LedgerRow) =>
            row.transactionType === 'credit' &&
            (row.deductionMode === 'principal' || row.deductionMode === 'gift'),
        )
        .reduce(
          (sum: number, row: LedgerRow) => sum + Math.abs(row.deltaAmountCents),
          0,
        );
      result.set(key, current);
    });

    return Array.from(result.entries())
      .map(([key, group]): MembershipCardStat => {
        const first: AccountRow = group.accounts[0];
        const customerIds: string[] = Array.from(
          new Set(
            group.accounts.map(
              (account: AccountRow) => account.customerAssetId,
            ),
          ),
        );
        const customers: MembershipCardCustomerStat[] = customerIds.map(
          (customerId: string): MembershipCardCustomerStat => {
            const customerAccounts: AccountRow[] = group.accounts.filter(
              (account: AccountRow) => account.customerAssetId === customerId,
            );
            const customerAccountIds: Set<string> = new Set(
              customerAccounts.map((account: AccountRow) => account.id),
            );
            const customerRows: LedgerRow[] = ledgers.filter((row: LedgerRow) =>
              customerAccountIds.has(row.accountId),
            );
            const consumption: number = customerRows
              .filter(
                (row: LedgerRow) =>
                  row.transactionType === 'deduction' &&
                  row.itemType === 'service' &&
                  !reversedLedgerIds.has(row.id) &&
                  inRange(row.occurredAt, start, end),
              )
              .reduce(
                (sum: number, row: LedgerRow) => sum + ledgerValue(row),
                0,
              );
            const balance: number = customerAccounts.reduce(
              (sum: number, account: AccountRow) => {
                const current = accountBalance(account);
                return (
                  sum +
                  Math.max(0, current.principal) +
                  Math.max(0, current.gift)
                );
              },
              0,
            );
            const asset: AssetRow | undefined = assetMap.get(customerId);
            return {
              customerId,
              customerName: asset?.customerName || '未命名客户',
              mobile: asset?.mobile || undefined,
              memberLevel: asset?.memberLevel || undefined,
              accountCount: customerAccounts.length,
              totalBalanceExact: centsToMoney(balance),
              consumptionExact: centsToMoney(consumption),
              lastActivityAt: customerRows[0]?.occurredAt.toISOString(),
            };
          },
        );
        return {
          id: key,
          cardName: first.cardName,
          category: first.category || '未分类',
          cardType: first.cardType || '会员卡',
          status: first.status,
          accountCount: group.accounts.length,
          customerCount: customers.length,
          principalBalanceExact: centsToMoney(group.principal),
          giftBalanceExact: centsToMoney(group.gift),
          totalLiabilityExact: centsToMoney(group.principal + group.gift),
          consumptionExact: centsToMoney(group.consumption),
          rechargeExact: centsToMoney(group.recharge),
          customers,
        };
      })
      .sort(
        (left: MembershipCardStat, right: MembershipCardStat) =>
          Number(right.totalLiabilityExact) - Number(left.totalLiabilityExact),
      );
  }
}
