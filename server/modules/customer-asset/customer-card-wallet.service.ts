import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';

import {
  customerAsset,
  customerCardAccount,
  customerCardEntitlement,
  customerCardLedger,
  customerCoupon,
} from '@server/database/schema';
import { InventoryService } from '@server/modules/inventory/inventory.service';
import type {
  CustomerCardDeductionMode,
  CustomerCardWalletAccount,
  CustomerCardWalletEntitlement,
  CustomerCardWalletLedgerEntry,
  CustomerCardWalletResponse,
  CustomerCashVoucher,
  CustomerCardItemType,
  CustomerCardOperationResponse,
  CustomerCardRechargeEntitlementRequest,
  CustomerCardSettlementLineRequest,
  CreateCustomerCardRequest,
  DeductCustomerCardRequest,
  DeductCustomerCardResponse,
  GrantCustomerCashVoucherRequest,
  BatchSettleCustomerCardRequest,
  PurchaseWithCustomerBalanceRequest,
  RechargeCustomerCardRequest,
  ReverseCustomerCardRequest,
  ReverseCustomerCardOperationRequest,
  ReverseCustomerCardResponse,
  ServiceActor,
} from '@shared/api.interface';
import {
  getCustomerMembershipPolicy,
  type CustomerMembershipPolicy,
} from '@shared/customer-membership-policy';

type CustomerAssetRow = typeof customerAsset.$inferSelect;
type CardAccountRow = typeof customerCardAccount.$inferSelect;
type CardEntitlementRow = typeof customerCardEntitlement.$inferSelect;
type CardLedgerRow = typeof customerCardLedger.$inferSelect;
type CustomerCouponRow = typeof customerCoupon.$inferSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized: string = value.trim();
  return normalized || undefined;
}

function optionalInteger(value: unknown): number | undefined {
  const numeric: number = Number(value);
  return Number.isInteger(numeric) ? numeric : undefined;
}

function centsToMoney(value: number): string {
  const negative: boolean = value < 0;
  const absolute: number = Math.abs(value);
  const whole: number = Math.floor(absolute / 100);
  const fraction: string = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function sourceMoneyToCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const normalized: string = String(value).replace(/,/gu, '').trim();
  const matched: RegExpMatchArray | null = normalized.match(
    /^(-?)(\d+)(?:\.(\d+))?$/u,
  );
  if (!matched) return 0;
  const fraction: string = `${matched[3] || ''}00`.slice(0, 2);
  const cents: number = Number(matched[2]) * 100 + Number(fraction);
  return matched[1] === '-' ? -cents : cents;
}

function requestMoneyToCents(value: string | undefined): number {
  const normalized: string = (value || '').replace(/,/gu, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) {
    throw new BadRequestException('扣卡金额必须是最多两位小数的正数');
  }
  const cents: number = sourceMoneyToCents(normalized);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new BadRequestException('扣卡金额不合法');
  }
  return cents;
}

function optionalMoneyToCents(value: string | undefined): number {
  if (!value?.trim()) return 0;
  return requestMoneyToCents(value);
}

function nonNegativeMoneyToCents(value: string | undefined): number {
  const normalized: string = (value || '').replace(/,/gu, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) {
    throw new BadRequestException('金额必须是最多两位小数的非负数');
  }
  const cents: number = sourceMoneyToCents(normalized);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new BadRequestException('金额不合法');
  }
  return cents;
}

function localDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function percentToBasisPoints(value: string | undefined): number {
  const normalized: string = (value || '100').trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/u.test(normalized)) {
    throw new BadRequestException('折扣必须是 0–100，最多两位小数');
  }
  const [whole = '0', fraction = ''] = normalized.split('.');
  const basisPoints: number =
    Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
  if (basisPoints <= 0 || basisPoints > 10000) {
    throw new BadRequestException('折扣必须大于 0 且不超过 100');
  }
  return basisPoints;
}

function basisPointsToPercent(value: number): string {
  const whole: number = Math.floor(value / 100);
  const fraction: string = String(value % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function safeItemType(value: string): CustomerCardItemType {
  if (
    value === 'service' ||
    value === 'package' ||
    value === 'product' ||
    value === 'card' ||
    value === 'recharge'
  ) {
    return value;
  }
  throw new BadRequestException('不支持的项目类型');
}

function safeDeductionMode(value: string): CustomerCardDeductionMode {
  if (value === 'principal' || value === 'gift' || value === 'entitlement') {
    return value;
  }
  throw new BadRequestException('不支持的扣卡方式');
}

function databaseErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class CustomerCardWalletService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
    private readonly inventoryService: InventoryService,
  ) {}

  async findWallet(customerId: string): Promise<CustomerCardWalletResponse> {
    const asset: CustomerAssetRow = await this.findAsset(customerId);
    await this.ensureAccounts(asset);

    const accountRows: CardAccountRow[] = await this.database
      .select()
      .from(customerCardAccount)
      .where(eq(customerCardAccount.customerAssetId, customerId))
      .orderBy(customerCardAccount.cardName);
    const entitlementRows: CardEntitlementRow[] = await this.database
      .select()
      .from(customerCardEntitlement)
      .orderBy(customerCardEntitlement.rightName);
    const ledgerRows: CardLedgerRow[] = await this.database
      .select()
      .from(customerCardLedger)
      .where(eq(customerCardLedger.customerAssetId, customerId))
      .orderBy(desc(customerCardLedger.occurredAt));
    const couponRows: CustomerCouponRow[] = await this.database
      .select()
      .from(customerCoupon)
      .where(eq(customerCoupon.customerAssetId, customerId))
      .orderBy(desc(customerCoupon.createdAt));

    const accountIds: Set<string> = new Set(
      accountRows.map((row: CardAccountRow) => row.id),
    );
    const customerEntitlements: CardEntitlementRow[] = entitlementRows.filter(
      (row: CardEntitlementRow) => accountIds.has(row.accountId),
    );
    const accountMap: Map<string, CardAccountRow> = new Map(
      accountRows.map((row: CardAccountRow) => [row.id, row]),
    );
    const entitlementMap: Map<string, CardEntitlementRow> = new Map(
      customerEntitlements.map((row: CardEntitlementRow) => [row.id, row]),
    );
    const reversedIds: Set<string> = new Set(
      ledgerRows
        .map((row: CardLedgerRow) => row.reversalOf)
        .filter((value: string | null): value is string => Boolean(value)),
    );

    const accounts: CustomerCardWalletAccount[] = accountRows.map(
      (row: CardAccountRow) =>
        this.toAccount(row, customerEntitlements, ledgerRows),
    );
    const totalBalanceCents: number = accounts.reduce(
      (sum: number, account: CustomerCardWalletAccount) =>
        sum +
        sourceMoneyToCents(account.principalBalanceExact) +
        sourceMoneyToCents(account.giftBalanceExact),
      0,
    );
    const policy: CustomerMembershipPolicy = getCustomerMembershipPolicy(
      asset.memberLevel || undefined,
      accountRows.map((row: CardAccountRow) => row.cardName),
    );
    const cashVouchers: CustomerCashVoucher[] = couponRows
      .filter((row: CustomerCouponRow) => row.couponType === 'cash_voucher')
      .map((row: CustomerCouponRow) => this.toCashVoucher(row));
    const usableVouchers: CustomerCashVoucher[] = cashVouchers.filter(
      (voucher: CustomerCashVoucher) => voucher.isUsable,
    );

    return {
      customerId: asset.id,
      customerName: asset.customerName,
      totalBalanceExact: centsToMoney(totalBalanceCents),
      membershipLabel: policy.label,
      membershipTier: policy.tier,
      productDiscountPercentExact: policy.productDiscountPercent.toFixed(2),
      productDiscountLabel: policy.productDiscountLabel,
      servicePricingLabel: policy.servicePricingLabel,
      annualCashVoucherCount: policy.annualCashVoucherCount,
      cashVouchers,
      availableCashVoucherCount: usableVouchers.length,
      availableCashVoucherValueExact: centsToMoney(
        usableVouchers.reduce(
          (sum: number, voucher: CustomerCashVoucher) =>
            sum + sourceMoneyToCents(voucher.faceValueExact),
          0,
        ),
      ),
      accounts,
      ledger: ledgerRows.map((row: CardLedgerRow) =>
        this.toLedgerEntry(
          row,
          accountMap,
          entitlementMap,
          reversedIds,
        ),
      ),
      storage: 'miaoda_cloud_database',
      sourceMode: 'independent_internal_wallet',
    };
  }

  async grantCashVoucher(
    customerId: string,
    request: GrantCustomerCashVoucherRequest,
    actor: ServiceActor,
  ): Promise<CustomerCardWalletResponse> {
    this.validateOperationKey(request.idempotencyKey);
    const asset: CustomerAssetRow = await this.findAsset(customerId);
    const name: string = request.name?.trim() || '单项目现金抵用券';
    const faceValueCents: number = requestMoneyToCents(request.faceValueExact);
    const quantity: number = Number(request.quantity);
    const validDays: number = Number(request.validDays);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new BadRequestException('赠送数量必须是 1–100 的整数');
    }
    if (!Number.isInteger(validDays) || validDays < 1 || validDays > 3650) {
      throw new BadRequestException('有效天数必须是 1–3650 天');
    }
    const policy: CustomerMembershipPolicy = await this.findMembershipPolicy(asset);
    const start: Date = new Date();
    const end: Date = new Date(start);
    end.setDate(end.getDate() + validDays - 1);
    for (let index = 0; index < quantity; index += 1) {
      await this.database.insert(customerCoupon).values({
        customerAssetId: customerId,
        sourceCouponKey: `manual-cash:${customerId}:${request.idempotencyKey}:${index + 1}`,
        customerYzUid: asset.sourceRecordId,
        customerName: asset.customerName,
        customerMobile: asset.mobile,
        couponName: name,
        faceValue: centsToMoney(faceValueCents),
        threshold: '仅限抵扣一个服务项目；每个项目最多使用一张',
        validFrom: localDate(start),
        validTo: localDate(end),
        status: '可用',
        couponType: 'cash_voucher',
        scope: 'single_service',
        membershipTier: policy.tier || null,
        grantSource: request.reason?.trim() || `门店赠送 · ${actor.displayName}`,
        sourcePayload: { actorName: actor.displayName, validDays },
      }).onConflictDoNothing();
    }
    return this.findWallet(customerId);
  }

  async deduct(
    customerId: string,
    request: DeductCustomerCardRequest,
    actor: ServiceActor,
  ): Promise<DeductCustomerCardResponse> {
    this.validateCommonRequest(request.projectName, request.idempotencyKey);
    const existing: CardLedgerRow | undefined = await this.findByIdempotency(
      request.idempotencyKey,
    );
    if (existing) return this.toDeductionResponse(customerId, existing);

    const mode: CustomerCardDeductionMode = safeDeductionMode(
      request.deductionMode,
    );
    const amountCents: number =
      mode === 'entitlement' ? 0 : requestMoneyToCents(request.amountExact);
    const quantity: number =
      mode === 'entitlement' ? Number(request.quantity || 0) : 0;
    if (mode === 'entitlement' && (!Number.isInteger(quantity) || quantity <= 0)) {
      throw new BadRequestException('项目次数必须是正整数');
    }
    if (mode === 'entitlement' && !request.entitlementId) {
      throw new BadRequestException('请选择需要核销的项目权益');
    }

    await this.findAsset(customerId);
    const account: CardAccountRow = await this.findAccount(request.accountId);
    if (account.customerAssetId !== customerId) {
      throw new BadRequestException('所选卡账户不属于当前客户');
    }

    try {
      const insertedRows: CardLedgerRow[] = await this.database
        .insert(customerCardLedger)
        .values({
          transactionNo: this.createTransactionNo('KC'),
          operationNo: this.createTransactionNo('OP'),
          lineNo: 1,
          idempotencyKey: request.idempotencyKey,
          customerAssetId: customerId,
          accountId: request.accountId,
          entitlementId: request.entitlementId || null,
          appointmentId: request.appointmentId || null,
          transactionType: 'deduction',
          deductionMode: mode,
          itemType: 'service',
          projectName: request.projectName.trim(),
          amountCents,
          unitPriceCents: amountCents,
          discountBasisPoints: 10000,
          quantity,
          reason: request.reason?.trim() || null,
          operatorUserId: actor.userId || null,
          operatorName: actor.displayName,
        })
        .returning();
      const inserted: CardLedgerRow | undefined = insertedRows[0];
      if (!inserted) throw new ConflictException('扣卡流水未生成');
      return this.toDeductionResponse(customerId, inserted);
    } catch (error: unknown) {
      const raced: CardLedgerRow | undefined = await this.findByIdempotency(
        request.idempotencyKey,
      );
      if (raced) return this.toDeductionResponse(customerId, raced);
      throw new ConflictException(this.friendlyDatabaseError(error));
    }
  }

  async settleBatch(
    customerId: string,
    request: BatchSettleCustomerCardRequest,
    actor: ServiceActor,
  ): Promise<CustomerCardOperationResponse> {
    this.validateBatchRequest(request.lines, request.idempotencyKey);
    const existing: CardLedgerRow | undefined = await this.findByIdempotency(
      `${request.idempotencyKey}:1`,
    );
    if (existing?.operationNo) {
      return this.toOperationResponse(customerId, existing.operationNo);
    }

    await this.findAsset(customerId);
    const preparedLines: CustomerCardSettlementLineRequest[] =
      await this.prepareSettlementLines(customerId, request.lines);
    await this.validateSettlementCapacity(customerId, preparedLines);
    const operationNo: string = this.createTransactionNo('XS');
    const inserted: CardLedgerRow[] = [];
    try {
      for (const [index, line] of preparedLines.entries()) {
        const row: CardLedgerRow = await this.insertSettlementLine(
            customerId,
            operationNo,
            index + 1,
            `${request.idempotencyKey}:${index + 1}`,
            line,
            request.reason,
            actor,
            'deduction',
          );
        inserted.push(row);
        await this.claimCashVoucher(customerId, line, row, operationNo);
      }
      return this.toOperationResponse(customerId, operationNo);
    } catch (error: unknown) {
      await this.compensateRows(customerId, inserted, actor, '批量结算失败自动恢复');
      throw new ConflictException(this.friendlyDatabaseError(error));
    }
  }

  async createCard(
    customerId: string,
    request: CreateCustomerCardRequest,
    actor: ServiceActor,
  ): Promise<CustomerCardOperationResponse> {
    const cardName: string = request.cardName?.trim();
    if (!cardName) throw new BadRequestException('请填写新卡名称');
    this.validateOperationKey(request.idempotencyKey);
    await this.findAsset(customerId);

    const sourceKey: string = `manual-card:${customerId}:${request.idempotencyKey}`;
    await this.database
      .insert(customerCardAccount)
      .values({
        customerAssetId: customerId,
        sourceKey,
        cardName,
        category: request.category?.trim() || null,
        cardType: request.cardType?.trim() || null,
        status: 'active',
        validity: request.validity?.trim() || '永久有效',
        cardNumber: request.cardNumber?.trim() || null,
        accountNumber: request.accountNumber?.trim() || null,
        principalOpeningCents: 0,
        giftOpeningCents: 0,
        sessionValueOpeningCents: 0,
        sourceSnapshot: { source: 'manual_card_creation' },
      })
      .onConflictDoNothing();
    const accountRows: CardAccountRow[] = await this.database
      .select()
      .from(customerCardAccount)
      .where(eq(customerCardAccount.sourceKey, sourceKey))
      .limit(1);
    const account: CardAccountRow | undefined = accountRows[0];
    if (!account) throw new ConflictException('新卡账户创建失败');

    return this.creditAccount(
      customerId,
      account,
      request.principalAmountExact,
      request.giftAmountExact,
      request.entitlements,
      request.reason || '新建客户卡项',
      request.idempotencyKey,
      actor,
    );
  }

  async recharge(
    customerId: string,
    request: RechargeCustomerCardRequest,
    actor: ServiceActor,
  ): Promise<CustomerCardOperationResponse> {
    this.validateOperationKey(request.idempotencyKey);
    await this.findAsset(customerId);
    const account: CardAccountRow = await this.findAccount(request.accountId);
    if (account.customerAssetId !== customerId) {
      throw new BadRequestException('充值卡账户不属于当前客户');
    }
    return this.creditAccount(
      customerId,
      account,
      request.principalAmountExact,
      request.giftAmountExact,
      request.entitlements,
      request.reason || '客户充值/加项',
      request.idempotencyKey,
      actor,
    );
  }

  async purchaseWithBalance(
    customerId: string,
    request: PurchaseWithCustomerBalanceRequest,
    actor: ServiceActor,
  ): Promise<CustomerCardOperationResponse> {
    this.validateOperationKey(request.idempotencyKey);
    if (!Array.isArray(request.items) || request.items.length === 0) {
      throw new BadRequestException('请至少选择一项购买内容');
    }
    if (request.items.length > 30) {
      throw new BadRequestException('单次最多购买 30 项');
    }
    const asset: CustomerAssetRow = await this.findAsset(customerId);
    const policy: CustomerMembershipPolicy = await this.findMembershipPolicy(asset);
    const paymentAccount: CardAccountRow = await this.findAccount(
      request.paymentAccountId,
    );
    if (paymentAccount.customerAssetId !== customerId) {
      throw new BadRequestException('付款卡账户不属于当前客户');
    }
    const purchaseLines: CustomerCardSettlementLineRequest[] = request.items.map(
      (item) => {
        const quantity: number = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException('购买数量必须是正整数');
        }
        const unitPriceCents: number = requestMoneyToCents(item.unitPriceExact);
        const itemType = safeItemType(item.itemType) as Exclude<
          CustomerCardItemType,
          'recharge'
        >;
        const discountBasisPoints: number =
          itemType === 'product'
            ? policy.productDiscountPercent * 100
            : itemType === 'service'
              ? 10000
              : percentToBasisPoints(item.discountPercentExact);
        const totalCents: number = Math.round(
          (unitPriceCents * quantity * discountBasisPoints) / 10000,
        );
        return {
          accountId: paymentAccount.id,
          deductionMode: request.paymentMode,
          itemType,
          itemName: item.itemName,
          amountExact: centsToMoney(totalCents),
          unitPriceExact: centsToMoney(unitPriceCents),
          discountPercentExact: basisPointsToPercent(discountBasisPoints),
        };
      },
    );
    const consumptionLines: CustomerCardSettlementLineRequest[] = Array.isArray(
      request.consumptionLines,
    )
      ? request.consumptionLines
      : [];
    const allDeductions: CustomerCardSettlementLineRequest[] = [
      ...consumptionLines,
      ...purchaseLines,
    ];
    this.validateBatchRequest(allDeductions, request.idempotencyKey);
    const preparedDeductions: CustomerCardSettlementLineRequest[] =
      await this.prepareSettlementLines(customerId, allDeductions);
    await this.validateSettlementCapacity(customerId, preparedDeductions);

    const existing: CardLedgerRow | undefined = await this.findByIdempotency(
      `${request.idempotencyKey}:1`,
    );
    if (existing?.operationNo) {
      return this.toOperationResponse(customerId, existing.operationNo);
    }

    const operationNo: string = this.createTransactionNo('GM');
    const inserted: CardLedgerRow[] = [];
    try {
      let lineNo = 1;
      for (const line of preparedDeductions) {
        const row: CardLedgerRow = await this.insertSettlementLine(
            customerId,
            operationNo,
            lineNo,
            `${request.idempotencyKey}:${lineNo}`,
            line,
            request.reason || '余额购买并联合结算',
            actor,
            'deduction',
          );
        inserted.push(row);
        await this.claimCashVoucher(customerId, line, row, operationNo);
        lineNo += 1;
      }

      for (const item of request.items) {
        if (item.itemType === 'product') continue;
        const targetAccount: CardAccountRow = item.targetAccountId
          ? await this.findAccount(item.targetAccountId)
          : paymentAccount;
        if (targetAccount.customerAssetId !== customerId) {
          throw new BadRequestException('购入项目的目标卡账户不属于当前客户');
        }
        const entitlement: CardEntitlementRow = await this.ensureEntitlement(
          targetAccount,
          {
            entitlementId: item.targetEntitlementId,
            name: item.itemName,
            quantity: item.grantCount || item.quantity,
            type: item.itemType,
          },
          request.idempotencyKey,
          lineNo,
        );
        inserted.push(
          await this.insertSettlementLine(
            customerId,
            operationNo,
            lineNo,
            `${request.idempotencyKey}:${lineNo}`,
            {
              accountId: targetAccount.id,
              entitlementId: entitlement.id,
              deductionMode: 'entitlement',
              itemType: item.itemType,
              itemName: `购入：${item.itemName}`,
              quantity: item.grantCount || item.quantity,
            },
            request.reason || '余额购买项目入卡',
            actor,
            'credit',
          ),
        );
        lineNo += 1;
      }
      for (const [itemIndex, item] of request.items.entries()) {
        if (item.itemType !== 'product' || !item.inventoryProductId) continue;
        await this.inventoryService.customerSale(
          {
            productId: item.inventoryProductId,
            quantityExact: String(item.quantity),
            customerAssetId: customerId,
            customerName: asset.customerName,
            discountPercentExact:
              purchaseLines[itemIndex]?.discountPercentExact || '100',
            actualAmountExact: purchaseLines[itemIndex]?.amountExact,
            note: `卡金购买整单:${operationNo}`,
            idempotencyKey: `card-product-sale:${operationNo}:${itemIndex + 1}`,
          },
          actor,
        );
      }
      return this.toOperationResponse(customerId, operationNo);
    } catch (error: unknown) {
      await this.inventoryService.reverseCustomerSalesForOperation(
        operationNo,
        actor,
      );
      await this.compensateRows(customerId, inserted, actor, '购买失败自动恢复');
      throw new ConflictException(this.friendlyDatabaseError(error));
    }
  }

  async reverseOperation(
    customerId: string,
    operationNo: string,
    request: ReverseCustomerCardOperationRequest,
    actor: ServiceActor,
  ): Promise<CustomerCardOperationResponse> {
    this.validateCommonRequest(request.reason, request.idempotencyKey);
    const duplicate: CardLedgerRow | undefined = await this.findByIdempotency(
      `${request.idempotencyKey}:1`,
    );
    if (duplicate?.operationNo) {
      return this.toOperationResponse(customerId, duplicate.operationNo);
    }
    const rows: CardLedgerRow[] = await this.findOperationRows(
      customerId,
      operationNo,
    );
    if (rows.length === 0) throw new NotFoundException('未找到该笔整单');
    const customerLedger: CardLedgerRow[] = await this.database
      .select()
      .from(customerCardLedger)
      .where(eq(customerCardLedger.customerAssetId, customerId));
    const reversedIds: Set<string> = new Set(
      customerLedger
        .map((row: CardLedgerRow) => row.reversalOf)
        .filter((value: string | null): value is string => Boolean(value)),
    );
    const reversibleRows: CardLedgerRow[] = rows
      .filter(
        (row: CardLedgerRow) =>
          row.transactionType !== 'reversal' && !reversedIds.has(row.id),
      )
      .sort((left: CardLedgerRow, right: CardLedgerRow) => right.lineNo - left.lineNo);
    if (reversibleRows.length === 0) {
      throw new ConflictException('该整单已经全部撤回，不能重复操作');
    }
    const reversalOperationNo: string = this.createTransactionNo('CX');
    for (const [index, row] of reversibleRows.entries()) {
      await this.insertReversal(
        customerId,
        row,
        reversalOperationNo,
        index + 1,
        `${request.idempotencyKey}:${index + 1}`,
        request.reason,
        actor,
      );
      await this.releaseCashVoucher(row);
    }
    await this.inventoryService.reverseCustomerSalesForOperation(
      operationNo,
      actor,
    );
    return this.toOperationResponse(customerId, reversalOperationNo);
  }

  async reverse(
    customerId: string,
    transactionId: string,
    request: ReverseCustomerCardRequest,
    actor: ServiceActor,
  ): Promise<ReverseCustomerCardResponse> {
    this.validateCommonRequest(request.reason, request.idempotencyKey);
    const existing: CardLedgerRow | undefined = await this.findByIdempotency(
      request.idempotencyKey,
    );
    if (existing) return this.toReverseResponse(customerId, existing);

    const originalRows: CardLedgerRow[] = await this.database
      .select()
      .from(customerCardLedger)
      .where(eq(customerCardLedger.id, transactionId))
      .limit(1);
    const original: CardLedgerRow | undefined = originalRows[0];
    if (!original || original.customerAssetId !== customerId) {
      throw new NotFoundException('未找到原扣卡流水');
    }
    if (original.transactionType !== 'deduction' && original.transactionType !== 'credit') {
      throw new BadRequestException('只有消费或充值流水可以撤销');
    }

    try {
      const inserted: CardLedgerRow = await this.insertReversal(
        customerId,
        original,
        this.createTransactionNo('CX'),
        1,
        request.idempotencyKey,
        request.reason,
        actor,
      );
      await this.releaseCashVoucher(original);
      return this.toReverseResponse(customerId, inserted);
    } catch (error: unknown) {
      const raced: CardLedgerRow | undefined = await this.findByIdempotency(
        request.idempotencyKey,
      );
      if (raced) return this.toReverseResponse(customerId, raced);
      throw new ConflictException(this.friendlyDatabaseError(error));
    }
  }

  private async creditAccount(
    customerId: string,
    account: CardAccountRow,
    principalAmountExact: string | undefined,
    giftAmountExact: string | undefined,
    entitlements: CustomerCardRechargeEntitlementRequest[],
    reason: string,
    idempotencyKey: string,
    actor: ServiceActor,
  ): Promise<CustomerCardOperationResponse> {
    const principalCents: number = optionalMoneyToCents(principalAmountExact);
    const giftCents: number = optionalMoneyToCents(giftAmountExact);
    const entitlementInputs: CustomerCardRechargeEntitlementRequest[] =
      Array.isArray(entitlements) ? entitlements : [];
    if (principalCents <= 0 && giftCents <= 0 && entitlementInputs.length === 0) {
      throw new BadRequestException('请至少填写一项充值金额或项目次数');
    }
    if (entitlementInputs.length > 30) {
      throw new BadRequestException('单次最多新增或充值 30 个项目');
    }
    const existing: CardLedgerRow | undefined = await this.findByIdempotency(
      `${idempotencyKey}:1`,
    );
    if (existing?.operationNo) {
      return this.toOperationResponse(customerId, existing.operationNo);
    }

    const operationNo: string = this.createTransactionNo('CZ');
    const inserted: CardLedgerRow[] = [];
    let lineNo = 1;
    try {
      if (principalCents > 0) {
        inserted.push(
          await this.insertSettlementLine(
            customerId,
            operationNo,
            lineNo,
            `${idempotencyKey}:${lineNo}`,
            {
              accountId: account.id,
              deductionMode: 'principal',
              itemType: 'card',
              itemName: '本金充值',
              amountExact: centsToMoney(principalCents),
            },
            reason,
            actor,
            'credit',
          ),
        );
        lineNo += 1;
      }
      if (giftCents > 0) {
        inserted.push(
          await this.insertSettlementLine(
            customerId,
            operationNo,
            lineNo,
            `${idempotencyKey}:${lineNo}`,
            {
              accountId: account.id,
              deductionMode: 'gift',
              itemType: 'card',
              itemName: '赠送金充值',
              amountExact: centsToMoney(giftCents),
            },
            reason,
            actor,
            'credit',
          ),
        );
        lineNo += 1;
      }
      for (const input of entitlementInputs) {
        const quantity: number = Number(input.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException('充值项目次数必须是正整数');
        }
        const entitlement: CardEntitlementRow = await this.ensureEntitlement(
          account,
          input,
          idempotencyKey,
          lineNo,
        );
        inserted.push(
          await this.insertSettlementLine(
            customerId,
            operationNo,
            lineNo,
            `${idempotencyKey}:${lineNo}`,
            {
              accountId: account.id,
              entitlementId: entitlement.id,
              deductionMode: 'entitlement',
              itemType: 'recharge',
              itemName: input.name?.trim() || entitlement.rightName,
              quantity,
            },
            reason,
            actor,
            'credit',
          ),
        );
        lineNo += 1;
      }
      return this.toOperationResponse(customerId, operationNo);
    } catch (error: unknown) {
      await this.compensateRows(customerId, inserted, actor, '充值失败自动恢复');
      throw new ConflictException(this.friendlyDatabaseError(error));
    }
  }

  private validateBatchRequest(
    lines: CustomerCardSettlementLineRequest[],
    idempotencyKey: string,
  ): void {
    this.validateOperationKey(idempotencyKey);
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('请至少选择一项消费项目');
    }
    if (lines.length > 30) {
      throw new BadRequestException('单次最多同时结算 30 项');
    }
  }

  private validateOperationKey(idempotencyKey: string): void {
    if (!idempotencyKey?.trim() || idempotencyKey.length > 150) {
      throw new BadRequestException('操作流水标识不合法');
    }
  }

  private async prepareSettlementLines(
    customerId: string,
    lines: CustomerCardSettlementLineRequest[],
  ): Promise<CustomerCardSettlementLineRequest[]> {
    const voucherIds: string[] = lines
      .map((line: CustomerCardSettlementLineRequest) => line.cashVoucherId)
      .filter((value: string | undefined): value is string => Boolean(value));
    if (new Set(voucherIds).size !== voucherIds.length) {
      throw new BadRequestException('同一张现金券不能同时抵扣多个项目');
    }

    const prepared: CustomerCardSettlementLineRequest[] = [];
    for (const line of lines) {
      if (!line.cashVoucherId) {
        prepared.push({ ...line, cashVoucherDiscountExact: '0.00' });
        continue;
      }
      const mode: CustomerCardDeductionMode = safeDeductionMode(
        line.deductionMode,
      );
      if (safeItemType(line.itemType) !== 'service' || mode === 'entitlement') {
        throw new BadRequestException(
          '现金券只能抵扣一个按金额结算的服务项目，不能抵扣产品、套餐或项目余次',
        );
      }
      const voucher: CustomerCouponRow = await this.findUsableCashVoucher(
        customerId,
        line.cashVoucherId,
      );
      const grossCents: number = requestMoneyToCents(line.amountExact);
      const discountCents: number = Math.min(
        grossCents,
        sourceMoneyToCents(voucher.faceValue),
      );
      prepared.push({
        ...line,
        amountExact: centsToMoney(grossCents - discountCents),
        cashVoucherDiscountExact: centsToMoney(discountCents),
      });
    }
    return prepared;
  }

  private async findMembershipPolicy(
    asset: CustomerAssetRow,
  ): Promise<CustomerMembershipPolicy> {
    const accounts: Array<{ cardName: string }> = await this.database
      .select({ cardName: customerCardAccount.cardName })
      .from(customerCardAccount)
      .where(eq(customerCardAccount.customerAssetId, asset.id));
    return getCustomerMembershipPolicy(
      asset.memberLevel || undefined,
      accounts.map((account: { cardName: string }) => account.cardName),
    );
  }

  private async findUsableCashVoucher(
    customerId: string,
    voucherId: string,
  ): Promise<CustomerCouponRow> {
    const rows: CustomerCouponRow[] = await this.database
      .select()
      .from(customerCoupon)
      .where(
        and(
          eq(customerCoupon.id, voucherId),
          eq(customerCoupon.customerAssetId, customerId),
        ),
      )
      .limit(1);
    const voucher: CustomerCouponRow | undefined = rows[0];
    if (!voucher || voucher.couponType !== 'cash_voucher') {
      throw new BadRequestException('未找到该客户的现金券');
    }
    const today: string = localDate();
    if (
      voucher.status !== '可用' ||
      voucher.usedAt ||
      (voucher.validFrom && String(voucher.validFrom) > today) ||
      (voucher.validTo && String(voucher.validTo) < today)
    ) {
      throw new BadRequestException('所选现金券尚未生效、已使用或已过期');
    }
    if (sourceMoneyToCents(voucher.faceValue) <= 0) {
      throw new BadRequestException('现金券面值不合法');
    }
    return voucher;
  }

  private async claimCashVoucher(
    customerId: string,
    line: CustomerCardSettlementLineRequest,
    ledger: CardLedgerRow,
    operationNo: string,
  ): Promise<void> {
    if (!line.cashVoucherId) return;
    const updated: CustomerCouponRow[] = await this.database
      .update(customerCoupon)
      .set({
        status: '已使用',
        usedAt: new Date(),
        usedOperationNo: operationNo,
        usedLedgerId: ledger.id,
        usedProjectName: line.itemName.trim(),
      })
      .where(
        and(
          eq(customerCoupon.id, line.cashVoucherId),
          eq(customerCoupon.customerAssetId, customerId),
          eq(customerCoupon.status, '可用'),
        ),
      )
      .returning();
    if (!updated[0]) {
      throw new ConflictException('现金券已被其他结算使用，请刷新后重试');
    }
  }

  private async releaseCashVoucher(row: CardLedgerRow): Promise<void> {
    if (!row.cashVoucherId) return;
    await this.database
      .update(customerCoupon)
      .set({
        status: '可用',
        usedAt: null,
        usedOperationNo: null,
        usedLedgerId: null,
        usedProjectName: null,
      })
      .where(
        and(
          eq(customerCoupon.id, row.cashVoucherId),
          eq(customerCoupon.usedLedgerId, row.id),
        ),
      );
  }

  private async validateSettlementCapacity(
    customerId: string,
    lines: CustomerCardSettlementLineRequest[],
  ): Promise<void> {
    const wallet: CustomerCardWalletResponse = await this.findWallet(customerId);
    const accounts: Map<string, CustomerCardWalletAccount> = new Map(
      wallet.accounts.map((account: CustomerCardWalletAccount) => [account.id, account]),
    );
    const moneyTotals: Map<string, number> = new Map();
    const entitlementTotals: Map<string, number> = new Map();

    for (const line of lines) {
      const account: CustomerCardWalletAccount | undefined = accounts.get(line.accountId);
      if (!account) throw new BadRequestException('存在不属于当前客户的卡账户');
      const mode: CustomerCardDeductionMode = safeDeductionMode(line.deductionMode);
      if (!line.itemName?.trim()) throw new BadRequestException('请填写消费项目名称');
      if (mode === 'entitlement') {
        const quantity: number = Number(line.quantity || 0);
        if (!line.entitlementId || !Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException('请选择项目权益并填写正确次数');
        }
        const entitlement: CustomerCardWalletEntitlement | undefined =
          account.entitlements.find(
            (item: CustomerCardWalletEntitlement) => item.id === line.entitlementId,
          );
        if (!entitlement) throw new BadRequestException('所选项目不属于该卡');
        entitlementTotals.set(
          entitlement.id,
          (entitlementTotals.get(entitlement.id) || 0) + quantity,
        );
      } else {
        const amountCents: number = line.cashVoucherId
          ? nonNegativeMoneyToCents(line.amountExact)
          : requestMoneyToCents(line.amountExact);
        const key: string = `${account.id}:${mode}`;
        moneyTotals.set(key, (moneyTotals.get(key) || 0) + amountCents);
      }
    }

    for (const [key, total] of moneyTotals.entries()) {
      const [accountId = '', mode = 'principal'] = key.split(':');
      const account: CustomerCardWalletAccount | undefined = accounts.get(accountId);
      const available: number = sourceMoneyToCents(
        mode === 'gift'
          ? account?.giftBalanceExact
          : account?.principalBalanceExact,
      );
      if (total > available) throw new BadRequestException('所选卡金合计余额不足');
    }
    for (const [entitlementId, total] of entitlementTotals.entries()) {
      const entitlement: CustomerCardWalletEntitlement | undefined = wallet.accounts
        .flatMap((account: CustomerCardWalletAccount) => account.entitlements)
        .find((item: CustomerCardWalletEntitlement) => item.id === entitlementId);
      if (!entitlement || total > entitlement.remainingCount) {
        throw new BadRequestException('所选项目合计余次不足');
      }
    }
  }

  private async insertSettlementLine(
    customerId: string,
    operationNo: string,
    lineNo: number,
    idempotencyKey: string,
    line: CustomerCardSettlementLineRequest,
    reason: string | undefined,
    actor: ServiceActor,
    transactionType: 'deduction' | 'credit',
  ): Promise<CardLedgerRow> {
    const mode: CustomerCardDeductionMode = safeDeductionMode(line.deductionMode);
    const amountCents: number =
      mode === 'entitlement'
        ? 0
        : line.cashVoucherId
          ? nonNegativeMoneyToCents(line.amountExact)
          : requestMoneyToCents(line.amountExact);
    const quantity: number =
      mode === 'entitlement' ? Number(line.quantity || 0) : 0;
    if (mode === 'entitlement' && (!Number.isInteger(quantity) || quantity <= 0)) {
      throw new BadRequestException('项目次数必须是正整数');
    }
    const unitPriceCents: number = line.unitPriceExact
      ? requestMoneyToCents(line.unitPriceExact)
      : amountCents;
    const cashVoucherDiscountCents: number = line.cashVoucherId
      ? nonNegativeMoneyToCents(line.cashVoucherDiscountExact)
      : 0;
    const rows: CardLedgerRow[] = await this.database
      .insert(customerCardLedger)
      .values({
        transactionNo: this.createTransactionNo(
          transactionType === 'credit' ? 'RZ' : 'KC',
        ),
        operationNo,
        lineNo,
        idempotencyKey,
        customerAssetId: customerId,
        accountId: line.accountId,
        entitlementId: line.entitlementId || null,
        appointmentId: line.appointmentId || null,
        transactionType,
        deductionMode: mode,
        itemType: safeItemType(line.itemType),
        projectName: line.itemName.trim(),
        amountCents,
        quantity,
        unitPriceCents,
        discountBasisPoints: percentToBasisPoints(line.discountPercentExact),
        cashVoucherId: line.cashVoucherId || null,
        cashVoucherDiscountCents,
        reason: reason?.trim() || null,
        operatorUserId: actor.userId || null,
        operatorName: actor.displayName,
      })
      .returning();
    const row: CardLedgerRow | undefined = rows[0];
    if (!row) throw new ConflictException('卡账流水未生成');
    return row;
  }

  private async ensureEntitlement(
    account: CardAccountRow,
    input: CustomerCardRechargeEntitlementRequest,
    idempotencyKey: string,
    lineNo: number,
  ): Promise<CardEntitlementRow> {
    if (input.entitlementId) {
      const rows: CardEntitlementRow[] = await this.database
        .select()
        .from(customerCardEntitlement)
        .where(eq(customerCardEntitlement.id, input.entitlementId))
        .limit(1);
      const existing: CardEntitlementRow | undefined = rows[0];
      if (!existing || existing.accountId !== account.id) {
        throw new BadRequestException('充值项目不属于所选卡账户');
      }
      return existing;
    }
    const name: string = input.name?.trim() || '';
    if (!name) throw new BadRequestException('请填写新增项目名称');
    const sourceRightKey: string = `manual-right:${account.id}:${idempotencyKey}:${lineNo}`;
    await this.database
      .insert(customerCardEntitlement)
      .values({
        accountId: account.id,
        sourceRightKey,
        rightName: name,
        rightType: input.type?.trim() || null,
        isGift: Boolean(input.isGift),
        discountRule: input.discountRule?.trim() || null,
        openingTotalCount: 0,
        openingUsedCount: 0,
        openingRemainingCount: 0,
      })
      .onConflictDoNothing();
    const rows: CardEntitlementRow[] = await this.database
      .select()
      .from(customerCardEntitlement)
      .where(eq(customerCardEntitlement.sourceRightKey, sourceRightKey))
      .limit(1);
    const created: CardEntitlementRow | undefined = rows[0];
    if (!created) throw new ConflictException('新增项目失败');
    return created;
  }

  private async findOperationRows(
    customerId: string,
    operationNo: string,
  ): Promise<CardLedgerRow[]> {
    const rows: CardLedgerRow[] = await this.database
      .select()
      .from(customerCardLedger)
      .where(eq(customerCardLedger.operationNo, operationNo))
      .orderBy(customerCardLedger.lineNo);
    return rows.filter((row: CardLedgerRow) => row.customerAssetId === customerId);
  }

  private async toOperationResponse(
    customerId: string,
    operationNo: string,
  ): Promise<CustomerCardOperationResponse> {
    const wallet: CustomerCardWalletResponse = await this.findWallet(customerId);
    const transactions: CustomerCardWalletLedgerEntry[] = wallet.ledger
      .filter((entry: CustomerCardWalletLedgerEntry) => entry.operationNo === operationNo)
      .sort(
        (left: CustomerCardWalletLedgerEntry, right: CustomerCardWalletLedgerEntry) =>
          left.lineNo - right.lineNo,
      );
    if (transactions.length === 0) throw new NotFoundException('未找到整单流水');
    return { saved: true, operationNo, transactions, wallet };
  }

  private async insertReversal(
    customerId: string,
    original: CardLedgerRow,
    operationNo: string,
    lineNo: number,
    idempotencyKey: string,
    reason: string,
    actor: ServiceActor,
  ): Promise<CardLedgerRow> {
    const existing: CardLedgerRow | undefined = await this.findByIdempotency(
      idempotencyKey,
    );
    if (existing) return existing;
    const rows: CardLedgerRow[] = await this.database
      .insert(customerCardLedger)
      .values({
        transactionNo: this.createTransactionNo('CX'),
        operationNo,
        lineNo,
        idempotencyKey,
        customerAssetId: customerId,
        accountId: original.accountId,
        entitlementId: original.entitlementId,
        appointmentId: original.appointmentId,
        transactionType: 'reversal',
        deductionMode: original.deductionMode,
        itemType: original.itemType,
        projectName: original.projectName,
        amountCents: 0,
        quantity: 0,
        reason: reason.trim(),
        operatorUserId: actor.userId || null,
        operatorName: actor.displayName,
        reversalOf: original.id,
        cashVoucherId: original.cashVoucherId,
        cashVoucherDiscountCents: original.cashVoucherDiscountCents,
      })
      .returning();
    const row: CardLedgerRow | undefined = rows[0];
    if (!row) throw new ConflictException('撤销流水未生成');
    return row;
  }

  private async compensateRows(
    customerId: string,
    rows: CardLedgerRow[],
    actor: ServiceActor,
    reason: string,
  ): Promise<void> {
    const operationNo: string = this.createTransactionNo('HF');
    for (const [index, row] of [...rows].reverse().entries()) {
      try {
        await this.insertReversal(
          customerId,
          row,
          operationNo,
          index + 1,
          `compensate:${row.id}`,
          reason,
          actor,
        );
        await this.releaseCashVoucher(row);
      } catch {
        // The database trigger and idempotency keys keep already-restored rows safe.
      }
    }
  }

  private async findAsset(customerId: string): Promise<CustomerAssetRow> {
    const rows: CustomerAssetRow[] = await this.database
      .select()
      .from(customerAsset)
      .where(eq(customerAsset.id, customerId))
      .limit(1);
    const asset: CustomerAssetRow | undefined = rows[0];
    if (!asset) throw new NotFoundException('未找到该客户资产');
    return asset;
  }

  private async findAccount(accountId: string): Promise<CardAccountRow> {
    const rows: CardAccountRow[] = await this.database
      .select()
      .from(customerCardAccount)
      .where(eq(customerCardAccount.id, accountId))
      .limit(1);
    const account: CardAccountRow | undefined = rows[0];
    if (!account) throw new NotFoundException('未找到卡账户');
    return account;
  }

  private async ensureAccounts(asset: CustomerAssetRow): Promise<void> {
    const existing: CardAccountRow[] = await this.database
      .select()
      .from(customerCardAccount)
      .where(eq(customerCardAccount.customerAssetId, asset.id))
      .limit(1);
    if (existing.length > 0) return;

    const profile: Record<string, unknown> = isRecord(asset.rawProfile)
      ? asset.rawProfile
      : {};
    const rawCards: unknown[] = Array.isArray(profile['有赞卡项'])
      ? profile['有赞卡项']
      : [];
    const cards: Record<string, unknown>[] = rawCards.filter(isRecord);

    if (cards.length === 0) {
      await this.database
        .insert(customerCardAccount)
        .values({
          customerAssetId: asset.id,
          sourceKey: `internal-opening:${asset.id}`,
          cardName: '门店储值账户',
          cardType: '储值账户',
          status: 'active',
          validity: '永久有效',
          principalOpeningCents: sourceMoneyToCents(asset.currentBalance),
          sourceSnapshot: {},
        })
        .onConflictDoNothing();
      return;
    }

    for (const card of cards) {
      const sourceKey: string =
        optionalString(card.sourceKey) ||
        `internal-card:${asset.id}:${randomUUID()}`;
      await this.database
        .insert(customerCardAccount)
        .values({
          customerAssetId: asset.id,
          sourceKey,
          cardName: optionalString(card.cardName) || '未命名卡账户',
          category: optionalString(card.category) || null,
          cardType: optionalString(card.cardType) || null,
          status: optionalString(card.status) || '状态待确认',
          validity: optionalString(card.validity) || null,
          cardNumber: optionalString(card.cardNumber) || null,
          accountNumber: optionalString(card.accountNumber) || null,
          principalOpeningCents: sourceMoneyToCents(card.principalBalance),
          giftOpeningCents: sourceMoneyToCents(card.giftBalance),
          sessionValueOpeningCents: sourceMoneyToCents(card.sessionBalance),
          sourceSnapshot: card,
        })
        .onConflictDoNothing();
    }

    const accountRows: CardAccountRow[] = await this.database
      .select()
      .from(customerCardAccount)
      .where(eq(customerCardAccount.customerAssetId, asset.id));
    const accountBySource: Map<string, CardAccountRow> = new Map(
      accountRows.map((row: CardAccountRow) => [row.sourceKey, row]),
    );
    for (const card of cards) {
      const sourceKey: string | undefined = optionalString(card.sourceKey);
      const account: CardAccountRow | undefined = sourceKey
        ? accountBySource.get(sourceKey)
        : undefined;
      const rights: unknown[] = Array.isArray(card.rights) ? card.rights : [];
      if (!account) continue;
      for (const [index, value] of rights.entries()) {
        if (!isRecord(value)) continue;
        const name: string | undefined = optionalString(value.name);
        if (!name) continue;
        await this.database
          .insert(customerCardEntitlement)
          .values({
            accountId: account.id,
            sourceRightKey: `${account.sourceKey}:${index}:${name}`,
            rightName: name,
            rightType: optionalString(value.type) || null,
            isGift: optionalString(value.gift) === '是',
            discountRule: optionalString(value.discountRule) || null,
            openingTotalCount: optionalInteger(value.total) ?? null,
            openingUsedCount: optionalInteger(value.used) ?? null,
            openingRemainingCount: optionalInteger(value.remaining) ?? null,
          })
          .onConflictDoNothing();
      }
    }
  }

  private toAccount(
    row: CardAccountRow,
    entitlementRows: CardEntitlementRow[],
    ledgerRows: CardLedgerRow[],
  ): CustomerCardWalletAccount {
    const accountLedger: CardLedgerRow[] = ledgerRows.filter(
      (entry: CardLedgerRow) => entry.accountId === row.id,
    );
    const principalDelta: number = accountLedger
      .filter((entry: CardLedgerRow) => entry.deductionMode === 'principal')
      .reduce(
        (sum: number, entry: CardLedgerRow) => sum + entry.deltaAmountCents,
        0,
      );
    const giftDelta: number = accountLedger
      .filter((entry: CardLedgerRow) => entry.deductionMode === 'gift')
      .reduce(
        (sum: number, entry: CardLedgerRow) => sum + entry.deltaAmountCents,
        0,
      );
    return {
      id: row.id,
      cardName: row.cardName,
      category: row.category || undefined,
      cardType: row.cardType || undefined,
      status: row.status,
      validity: row.validity || undefined,
      cardNumber: row.cardNumber || undefined,
      accountNumber: row.accountNumber || undefined,
      principalBalanceExact: centsToMoney(
        row.principalOpeningCents + principalDelta,
      ),
      giftBalanceExact: centsToMoney(row.giftOpeningCents + giftDelta),
      sessionValueExact: centsToMoney(row.sessionValueOpeningCents),
      entitlements: entitlementRows
        .filter((item: CardEntitlementRow) => item.accountId === row.id)
        .map((item: CardEntitlementRow) =>
          this.toEntitlement(item, accountLedger),
        ),
    };
  }

  private toEntitlement(
    row: CardEntitlementRow,
    ledgerRows: CardLedgerRow[],
  ): CustomerCardWalletEntitlement {
    const delta: number = ledgerRows
      .filter((entry: CardLedgerRow) => entry.entitlementId === row.id)
      .reduce(
        (sum: number, entry: CardLedgerRow) => sum + entry.deltaQuantity,
        0,
      );
    return {
      id: row.id,
      name: row.rightName,
      type: row.rightType || undefined,
      isGift: row.isGift,
      discountRule: row.discountRule || undefined,
      totalCount: row.openingTotalCount ?? undefined,
      usedCount: row.openingUsedCount ?? undefined,
      remainingCount: Math.max(0, (row.openingRemainingCount || 0) + delta),
    };
  }

  private toCashVoucher(row: CustomerCouponRow): CustomerCashVoucher {
    const today: string = localDate();
    const validFrom: string | undefined = row.validFrom
      ? String(row.validFrom)
      : undefined;
    const validTo: string | undefined = row.validTo
      ? String(row.validTo)
      : undefined;
    const expired: boolean = Boolean(validTo && validTo < today);
    const notStarted: boolean = Boolean(validFrom && validFrom > today);
    const used: boolean = Boolean(row.usedAt || row.status === '已使用');
    const status: CustomerCashVoucher['status'] = used
      ? '已使用'
      : expired
        ? '已过期'
        : '可用';
    return {
      id: row.id,
      name: row.couponName || '单项目现金抵用券',
      faceValueExact: centsToMoney(sourceMoneyToCents(row.faceValue)),
      validFrom,
      validTo,
      status,
      scope: 'single_service',
      membershipTier: row.membershipTier || undefined,
      usedAt: row.usedAt?.toISOString(),
      usedOperationNo: row.usedOperationNo || undefined,
      usedProjectName: row.usedProjectName || undefined,
      isUsable: status === '可用' && !notStarted,
    };
  }

  private toLedgerEntry(
    row: CardLedgerRow,
    accountMap: Map<string, CardAccountRow>,
    entitlementMap: Map<string, CardEntitlementRow>,
    reversedIds: Set<string>,
  ): CustomerCardWalletLedgerEntry {
    const mode: CustomerCardDeductionMode = safeDeductionMode(
      row.deductionMode,
    );
    const account: CardAccountRow | undefined = accountMap.get(row.accountId);
    const entitlement: CardEntitlementRow | undefined = row.entitlementId
      ? entitlementMap.get(row.entitlementId)
      : undefined;
    return {
      id: row.id,
      transactionNo: row.transactionNo,
      operationNo: row.operationNo || undefined,
      lineNo: row.lineNo,
      transactionType:
        row.transactionType === 'reversal'
          ? 'reversal'
          : row.transactionType === 'credit'
            ? 'credit'
            : 'deduction',
      deductionMode: mode,
      itemType: safeItemType(row.itemType),
      cardName: account?.cardName || '未知卡账户',
      entitlementName: entitlement?.rightName,
      appointmentId: row.appointmentId || undefined,
      projectName: row.projectName,
      amountExact: centsToMoney(row.amountCents),
      unitPriceExact: centsToMoney(row.unitPriceCents),
      discountPercentExact: basisPointsToPercent(row.discountBasisPoints),
      cashVoucherId: row.cashVoucherId || undefined,
      cashVoucherDiscountExact: centsToMoney(
        row.cashVoucherDiscountCents,
      ),
      quantity: row.quantity,
      beforeAmountExact:
        row.beforeAmountCents === null
          ? undefined
          : centsToMoney(row.beforeAmountCents),
      afterAmountExact:
        row.afterAmountCents === null
          ? undefined
          : centsToMoney(row.afterAmountCents),
      beforeQuantity: row.beforeQuantity ?? undefined,
      afterQuantity: row.afterQuantity ?? undefined,
      reason: row.reason || undefined,
      operatorName: row.operatorName,
      occurredAt: row.occurredAt.toISOString(),
      reversed: reversedIds.has(row.id),
    };
  }

  private async findByIdempotency(
    idempotencyKey: string,
  ): Promise<CardLedgerRow | undefined> {
    const rows: CardLedgerRow[] = await this.database
      .select()
      .from(customerCardLedger)
      .where(eq(customerCardLedger.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0];
  }

  private async toDeductionResponse(
    customerId: string,
    row: CardLedgerRow,
  ): Promise<DeductCustomerCardResponse> {
    const wallet: CustomerCardWalletResponse = await this.findWallet(customerId);
    const transaction: CustomerCardWalletLedgerEntry | undefined =
      wallet.ledger.find(
        (entry: CustomerCardWalletLedgerEntry) => entry.id === row.id,
      );
    if (!transaction) throw new NotFoundException('未找到扣卡流水');
    return { saved: true, transaction, wallet };
  }

  private async toReverseResponse(
    customerId: string,
    row: CardLedgerRow,
  ): Promise<ReverseCustomerCardResponse> {
    const wallet: CustomerCardWalletResponse = await this.findWallet(customerId);
    const transaction: CustomerCardWalletLedgerEntry | undefined =
      wallet.ledger.find(
        (entry: CustomerCardWalletLedgerEntry) => entry.id === row.id,
      );
    if (!transaction) throw new NotFoundException('未找到撤销流水');
    return { saved: true, transaction, wallet };
  }

  private validateCommonRequest(value: string, idempotencyKey: string): void {
    if (!value?.trim()) throw new BadRequestException('请填写项目或操作原因');
    if (!idempotencyKey?.trim() || idempotencyKey.length > 180) {
      throw new BadRequestException('操作流水标识不合法');
    }
  }

  private createTransactionNo(prefix: string): string {
    const timestamp: string = new Date()
      .toISOString()
      .replace(/[-:.TZ]/gu, '')
      .slice(0, 14);
    return `${prefix}${timestamp}${randomUUID().replace(/-/gu, '').slice(0, 10)}`;
  }

  private friendlyDatabaseError(error: unknown): string {
    const message: string = databaseErrorMessage(error);
    if (message.includes('卡内余额不足')) return '卡内余额不足，未发生扣款';
    if (message.includes('项目剩余次数不足')) {
      return '项目剩余次数不足，未发生核销';
    }
    if (message.includes('该卡当前不可扣减')) return '该卡当前不可扣减';
    if (message.includes('该卡当前不可操作')) return '该卡当前不可充值或扣减';
    if (message.includes('充值金额已被使用')) {
      return '该笔充值余额已经发生后续消费，不能直接撤回，请先核对后续流水';
    }
    if (message.includes('充值项目已被消费')) {
      return '该笔充值项目已经发生后续消费，不能直接撤回，请先核对后续流水';
    }
    if (message.includes('uk_customer_card_ledger_reversal')) {
      return '该笔扣卡已经撤销，不能重复操作';
    }
    return '卡账操作失败，余额未发生变化';
  }
}
