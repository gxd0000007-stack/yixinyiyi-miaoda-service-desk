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
import { desc, eq } from 'drizzle-orm';

import {
  customerAsset,
  inventoryMovement,
  inventoryProduct,
} from '@server/database/schema';
import type {
  CreateInventoryProductRequest,
  InventoryCustomerSaleRequest,
  InventoryDashboardResponse,
  InventoryInboundRequest,
  InventoryInternalUseRequest,
  InventoryMovement,
  InventoryMovementType,
  InventoryMutationResponse,
  InventoryProduct,
  ServiceActor,
  UpdateInventoryProductCostRequest,
} from '@shared/api.interface';
import { STORE_OWNER_ROLE } from '../../../shared/role.constants';

type ProductRow = typeof inventoryProduct.$inferSelect;
type MovementRow = typeof inventoryMovement.$inferSelect;

function trimRequired(value: string | undefined, label: string): string {
  const normalized: string = (value || '').trim();
  if (!normalized) throw new BadRequestException(`请填写${label}`);
  return normalized;
}

function optionalText(value: string | undefined): string | null {
  const normalized: string = (value || '').trim();
  return normalized || null;
}

function moneyToCents(value: string | undefined, label: string): number {
  const normalized: string = (value || '').replace(/,/gu, '').trim();
  const matched: RegExpMatchArray | null = normalized.match(
    /^(\d+)(?:\.(\d{1,2}))?$/u,
  );
  if (!matched) throw new BadRequestException(`${label}必须精确到最多两位小数`);
  const cents: number =
    Number(matched[1]) * 100 + Number(`${matched[2] || ''}00`.slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new BadRequestException(`${label}不合法`);
  }
  return cents;
}

function centsToMoney(cents: number): string {
  const sign: string = cents < 0 ? '-' : '';
  const absolute: number = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function quantityToMilli(value: string | undefined, label: string): number {
  const normalized: string = (value || '').replace(/,/gu, '').trim();
  const matched: RegExpMatchArray | null = normalized.match(
    /^(\d+)(?:\.(\d{1,3}))?$/u,
  );
  if (!matched)
    throw new BadRequestException(`${label}必须是最多三位小数的正数`);
  const milli: number =
    Number(matched[1]) * 1000 + Number(`${matched[2] || ''}000`.slice(0, 3));
  if (!Number.isSafeInteger(milli) || milli <= 0) {
    throw new BadRequestException(`${label}必须大于 0`);
  }
  return milli;
}

function nonnegativeQuantityToMilli(
  value: string | undefined,
  label: string,
): number {
  const normalized: string = (value || '0').replace(/,/gu, '').trim();
  if (!/^(\d+)(?:\.(\d{1,3}))?$/u.test(normalized)) {
    throw new BadRequestException(`${label}必须是最多三位小数的非负数`);
  }
  if (Number(normalized) === 0) return 0;
  return quantityToMilli(normalized, label);
}

function numericToMilli(value: string | number): number {
  const normalized: string = String(value);
  const negative: boolean = normalized.startsWith('-');
  const unsigned: string = negative ? normalized.slice(1) : normalized;
  const [whole = '0', decimal = ''] = unsigned.split('.');
  const result: number =
    Number(whole) * 1000 + Number(`${decimal}000`.slice(0, 3));
  return negative ? -result : result;
}

function milliToQuantity(milli: number): string {
  const sign: string = milli < 0 ? '-' : '';
  const absolute: number = Math.abs(milli);
  const decimal: string = String(absolute % 1000)
    .padStart(3, '0')
    .replace(/0+$/u, '');
  return decimal
    ? `${sign}${Math.floor(absolute / 1000)}.${decimal}`
    : `${sign}${Math.floor(absolute / 1000)}`;
}

function percentToBasisPoints(value: string | undefined): number {
  const normalized: string = (value || '').trim();
  const matched: RegExpMatchArray | null = normalized.match(
    /^(\d{1,3})(?:\.(\d{1,2}))?$/u,
  );
  if (!matched)
    throw new BadRequestException('折扣百分比必须是 0–100，最多两位小数');
  const basisPoints: number =
    Number(matched[1]) * 100 + Number(`${matched[2] || ''}00`.slice(0, 2));
  if (basisPoints < 0 || basisPoints > 10000) {
    throw new BadRequestException('折扣百分比必须在 0–100 之间');
  }
  return basisPoints;
}

function basisPointsToPercent(value: number): string {
  const whole: number = Math.floor(value / 100);
  const decimal: string = String(value % 100)
    .padStart(2, '0')
    .replace(/0+$/u, '');
  return decimal ? `${whole}.${decimal}` : String(whole);
}

function chinaDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
  ) {}

  async dashboard(): Promise<InventoryDashboardResponse> {
    const [products, movements]: [ProductRow[], MovementRow[]] =
      await Promise.all([
        this.database
          .select()
          .from(inventoryProduct)
          .orderBy(inventoryProduct.productName),
        this.database
          .select()
          .from(inventoryMovement)
          .orderBy(desc(inventoryMovement.occurredAt)),
      ]);
    const stockByProduct: Map<string, number> = this.stockMap(movements);
    const productMap: Map<string, ProductRow> = new Map(
      products.map((product: ProductRow) => [product.id, product]),
    );
    const today: string = chinaDateKey(new Date());
    const todayRows: MovementRow[] = movements.filter(
      (row: MovementRow) => chinaDateKey(row.occurredAt) === today,
    );
    const activeProducts: ProductRow[] = products.filter(
      (product: ProductRow) => product.status === 'active',
    );
    const stockCostValueCents: number = activeProducts.reduce(
      (sum: number, product: ProductRow) =>
        sum +
        Math.round(
          ((stockByProduct.get(product.id) || 0) * product.purchaseCostCents) /
            1000,
        ),
      0,
    );

    return {
      summary: {
        productCount: activeProducts.length,
        totalStockExact: milliToQuantity(
          activeProducts.reduce(
            (sum: number, product: ProductRow) =>
              sum + (stockByProduct.get(product.id) || 0),
            0,
          ),
        ),
        stockCostValueExact: centsToMoney(stockCostValueCents),
        lowStockCount: activeProducts.filter(
          (product: ProductRow) =>
            (stockByProduct.get(product.id) || 0) <=
            numericToMilli(product.safetyStock),
        ).length,
        todayInboundExact: this.sumQuantity(todayRows, 'inbound'),
        todayInternalUseExact: this.sumQuantity(todayRows, 'internal_use'),
        todayCustomerSaleExact: milliToQuantity(
          Math.max(
            0,
            -todayRows
              .filter(
                (row: MovementRow) =>
                  row.movementType === 'customer_sale' ||
                  row.movementType === 'customer_sale_reversal',
              )
              .reduce(
                (sum: number, row: MovementRow) =>
                  sum + numericToMilli(row.deltaQuantity),
                0,
              ),
          ),
        ),
        todaySalesAmountExact: centsToMoney(
          todayRows
            .filter(
              (row: MovementRow) =>
                row.movementType === 'customer_sale' ||
                row.movementType === 'customer_sale_reversal',
            )
            .reduce(
              (sum: number, row: MovementRow) =>
                sum +
                (row.movementType === 'customer_sale_reversal'
                  ? -Math.abs(row.actualAmountCents)
                  : row.actualAmountCents),
              0,
            ),
        ),
      },
      products: products.map((row: ProductRow) =>
        this.toProduct(row, stockByProduct.get(row.id) || 0),
      ),
      movements: movements
        .slice(0, 200)
        .map((row: MovementRow) =>
          this.toMovement(row, productMap.get(row.productId)),
        ),
      storage: 'miaoda_cloud_database',
      inventoryMode: 'immutable_movement_ledger',
    };
  }

  async createProduct(
    request: CreateInventoryProductRequest,
    actor?: ServiceActor,
  ): Promise<InventoryMutationResponse> {
    const enteredBarcode: string = (request.barcode || '').trim();
    const barcode: string =
      enteredBarcode || `MANUAL-${Date.now()}-${randomUUID().slice(0, 8)}`;
    try {
      const row: ProductRow = (
        await this.database
          .insert(inventoryProduct)
          .values({
            barcode,
            sku: optionalText(request.sku),
            productName: trimRequired(request.name, '产品名称'),
            category: trimRequired(request.category, '产品分类'),
            unit: trimRequired(request.unit, '计量单位'),
            purchaseCostCents: actor?.roles?.includes(STORE_OWNER_ROLE)
              ? moneyToCents(request.purchaseCostExact, '进货成本')
              : 0,
            retailPriceCents: moneyToCents(
              request.retailPriceExact,
              '产品零售价',
            ),
            defaultDiscountBasisPoints: percentToBasisPoints(
              request.defaultDiscountPercentExact,
            ),
            safetyStock: milliToQuantity(
              nonnegativeQuantityToMilli(request.safetyStockExact, '安全库存'),
            ),
            supplier: optionalText(request.supplier),
            note: optionalText(request.note),
          })
          .returning()
      )[0];
      if (!row) throw new ConflictException('产品档案保存失败');
      return { saved: true, product: this.toProduct(row, 0) };
    } catch (error) {
      if (errorMessage(error).toLowerCase().includes('unique')) {
        throw new ConflictException(
          '该产品条码或 SKU 已存在，请直接选择已有产品入库',
        );
      }
      throw error;
    }
  }

  async updateProductCost(
    productId: string,
    request: UpdateInventoryProductCostRequest,
  ): Promise<InventoryMutationResponse> {
    const product: ProductRow = await this.findProduct(productId);
    const rows: ProductRow[] = await this.database
      .update(inventoryProduct)
      .set({
        purchaseCostCents: moneyToCents(request.purchaseCostExact, '进货成本'),
        retailPriceCents: moneyToCents(request.retailPriceExact, '产品零售价'),
        defaultDiscountBasisPoints: percentToBasisPoints(
          request.defaultDiscountPercentExact,
        ),
        supplier: optionalText(request.supplier),
        note: optionalText(request.note) || product.note,
        updatedAt: new Date(),
      })
      .where(eq(inventoryProduct.id, product.id))
      .returning();
    const updated: ProductRow | undefined = rows[0];
    if (!updated) throw new ConflictException('产品成本保存失败');
    const movements: MovementRow[] = await this.database
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, product.id));
    const stockMilli: number = movements.reduce(
      (sum: number, row: MovementRow) =>
        sum + numericToMilli(row.deltaQuantity),
      0,
    );
    return { saved: true, product: this.toProduct(updated, stockMilli) };
  }

  async inbound(
    request: InventoryInboundRequest,
    actor: ServiceActor,
  ): Promise<InventoryMutationResponse> {
    const duplicate: MovementRow | undefined = await this.findDuplicate(
      request.idempotencyKey,
    );
    if (duplicate) return this.duplicateResponse(duplicate);
    const product: ProductRow = await this.findProduct(request.productId);
    const quantityMilli: number = quantityToMilli(
      request.quantityExact,
      '入库数量',
    );
    const ownerCanEditCost: boolean = Boolean(
      actor.roles?.includes(STORE_OWNER_ROLE),
    );
    const unitCostCents: number = ownerCanEditCost
      ? moneyToCents(request.unitCostExact, '本次进货单价')
      : product.purchaseCostCents;
    const movement: MovementRow = await this.insertMovement({
      product,
      type: 'inbound',
      quantityMilli,
      unitCostCents,
      supplier: optionalText(request.supplier) || product.supplier,
      batchNo: optionalText(request.batchNo),
      expiresOn: optionalText(request.expiresOn),
      note: optionalText(request.note),
      idempotencyKey: request.idempotencyKey,
      actor,
    });
    await this.database
      .update(inventoryProduct)
      .set({
        ...(ownerCanEditCost ? { purchaseCostCents: unitCostCents } : {}),
        supplier: optionalText(request.supplier) || product.supplier,
        updatedAt: new Date(),
      })
      .where(eq(inventoryProduct.id, product.id));
    return this.mutationResponse(product.id, movement);
  }

  async internalUse(
    request: InventoryInternalUseRequest,
    actor: ServiceActor,
  ): Promise<InventoryMutationResponse> {
    const duplicate: MovementRow | undefined = await this.findDuplicate(
      request.idempotencyKey,
    );
    if (duplicate) return this.duplicateResponse(duplicate);
    const product: ProductRow = await this.findProduct(request.productId);
    const quantityMilli: number = quantityToMilli(
      request.quantityExact,
      '领用数量',
    );
    await this.ensureEnoughStock(product, quantityMilli);
    const movement: MovementRow = await this.insertMovement({
      product,
      type: 'internal_use',
      quantityMilli,
      unitCostCents: product.purchaseCostCents,
      recipientName: trimRequired(request.recipientName, '领用人'),
      purpose: trimRequired(request.purpose, '领用用途'),
      note: optionalText(request.note),
      idempotencyKey: request.idempotencyKey,
      actor,
    });
    return this.mutationResponse(product.id, movement);
  }

  async customerSale(
    request: InventoryCustomerSaleRequest,
    actor: ServiceActor,
  ): Promise<InventoryMutationResponse> {
    const duplicate: MovementRow | undefined = await this.findDuplicate(
      request.idempotencyKey,
    );
    if (duplicate) return this.duplicateResponse(duplicate);
    const product: ProductRow = await this.findProduct(request.productId);
    const quantityMilli: number = quantityToMilli(
      request.quantityExact,
      '销售数量',
    );
    await this.ensureEnoughStock(product, quantityMilli);
    const discountBasisPoints: number = percentToBasisPoints(
      request.discountPercentExact,
    );
    const expectedAmountCents: number = Math.round(
      (product.retailPriceCents * quantityMilli * discountBasisPoints) /
        1000 /
        10000,
    );
    if (request.actualAmountExact?.trim()) {
      const requestedAmountCents: number = moneyToCents(
        request.actualAmountExact,
        '客户实收金额',
      );
      if (requestedAmountCents !== expectedAmountCents) {
        throw new BadRequestException(
          `实收金额应为 ¥${centsToMoney(expectedAmountCents)}，请核对零售价、数量与折扣`,
        );
      }
    }
    const customerName: string = trimRequired(request.customerName, '客户姓名');
    if (request.customerAssetId) {
      const assetRows = await this.database
        .select({ id: customerAsset.id })
        .from(customerAsset)
        .where(eq(customerAsset.id, request.customerAssetId))
        .limit(1);
      if (!assetRows[0]) throw new NotFoundException('未找到所选客户档案');
    }
    const movement: MovementRow = await this.insertMovement({
      product,
      type: 'customer_sale',
      quantityMilli,
      unitCostCents: product.purchaseCostCents,
      discountBasisPoints,
      actualAmountCents: expectedAmountCents,
      customerAssetId: request.customerAssetId || null,
      customerName,
      note: optionalText(request.note),
      idempotencyKey: request.idempotencyKey,
      actor,
    });
    return this.mutationResponse(product.id, movement);
  }

  async reverseCustomerSalesForOperation(
    operationNo: string,
    actor: ServiceActor,
  ): Promise<void> {
    const note: string = `卡金购买整单:${operationNo}`;
    const rows: MovementRow[] = await this.database
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.note, note));
    const sales: MovementRow[] = rows.filter(
      (row: MovementRow) => row.movementType === 'customer_sale',
    );
    for (const sale of sales) {
      const duplicate: MovementRow | undefined = await this.findDuplicate(
        `inventory-reverse:${sale.id}`,
      );
      if (duplicate) continue;
      const product: ProductRow = await this.findProduct(sale.productId);
      await this.insertMovement({
        product,
        type: 'customer_sale_reversal',
        quantityMilli: numericToMilli(sale.quantity),
        unitCostCents: sale.unitCostCents || product.purchaseCostCents,
        discountBasisPoints: sale.discountBasisPoints,
        actualAmountCents: sale.actualAmountCents,
        customerAssetId: sale.customerAssetId,
        customerName: sale.customerName || undefined,
        note,
        idempotencyKey: `inventory-reverse:${sale.id}`,
        actor,
      });
    }
  }

  private async insertMovement(input: {
    product: ProductRow;
    type: InventoryMovementType;
    quantityMilli: number;
    idempotencyKey: string;
    actor: ServiceActor;
    unitCostCents?: number;
    discountBasisPoints?: number;
    actualAmountCents?: number;
    customerAssetId?: string | null;
    customerName?: string;
    recipientName?: string;
    purpose?: string;
    supplier?: string | null;
    batchNo?: string | null;
    expiresOn?: string | null;
    note?: string | null;
  }): Promise<MovementRow> {
    const idempotencyKey: string = trimRequired(
      input.idempotencyKey,
      '防重复流水标识',
    );
    try {
      const rows: MovementRow[] = await this.database
        .insert(inventoryMovement)
        .values({
          movementNo: this.createMovementNo(input.type),
          idempotencyKey,
          productId: input.product.id,
          movementType: input.type,
          quantity: milliToQuantity(input.quantityMilli),
          deltaQuantity: milliToQuantity(
            input.type === 'inbound' || input.type === 'customer_sale_reversal'
              ? input.quantityMilli
              : -input.quantityMilli,
          ),
          unitCostCents: input.unitCostCents || 0,
          listPriceCents:
            input.type === 'customer_sale' ||
            input.type === 'customer_sale_reversal'
              ? input.product.retailPriceCents
              : 0,
          discountBasisPoints: input.discountBasisPoints ?? 10000,
          actualAmountCents: input.actualAmountCents || 0,
          customerAssetId: input.customerAssetId || null,
          customerName: input.customerName || null,
          recipientName: input.recipientName || null,
          purpose: input.purpose || null,
          supplier: input.supplier || null,
          batchNo: input.batchNo || null,
          expiresOn: input.expiresOn || null,
          note: input.note || null,
          operatorUserId: input.actor.userId || null,
          operatorName: input.actor.displayName,
        })
        .returning();
      const row: MovementRow | undefined = rows[0];
      if (!row) throw new ConflictException('库存流水保存失败');
      return row;
    } catch (error) {
      if (errorMessage(error).toLowerCase().includes('unique')) {
        const duplicate: MovementRow | undefined =
          await this.findDuplicate(idempotencyKey);
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  private async ensureEnoughStock(
    product: ProductRow,
    requestedMilli: number,
  ): Promise<void> {
    const rows: Array<{ deltaQuantity: string }> = await this.database
      .select({ deltaQuantity: inventoryMovement.deltaQuantity })
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, product.id));
    const currentMilli: number = rows.reduce(
      (sum: number, row: { deltaQuantity: string }) =>
        sum + numericToMilli(row.deltaQuantity),
      0,
    );
    if (currentMilli < requestedMilli) {
      throw new BadRequestException(
        `${product.productName} 当前库存 ${milliToQuantity(currentMilli)} ${product.unit}，不足以出库 ${milliToQuantity(requestedMilli)} ${product.unit}`,
      );
    }
  }

  private async findProduct(productId: string): Promise<ProductRow> {
    const id: string = trimRequired(productId, '产品');
    const rows: ProductRow[] = await this.database
      .select()
      .from(inventoryProduct)
      .where(eq(inventoryProduct.id, id))
      .limit(1);
    const row: ProductRow | undefined = rows[0];
    if (!row || row.status !== 'active')
      throw new NotFoundException('未找到可用产品档案');
    return row;
  }

  private async findDuplicate(
    idempotencyKey: string | undefined,
  ): Promise<MovementRow | undefined> {
    const key: string = trimRequired(idempotencyKey, '防重复流水标识');
    const rows: MovementRow[] = await this.database
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.idempotencyKey, key))
      .limit(1);
    return rows[0];
  }

  private async duplicateResponse(
    movement: MovementRow,
  ): Promise<InventoryMutationResponse> {
    const response: InventoryMutationResponse = await this.mutationResponse(
      movement.productId,
      movement,
    );
    return { ...response, duplicate: true };
  }

  private async mutationResponse(
    productId: string,
    movement: MovementRow,
  ): Promise<InventoryMutationResponse> {
    const product: ProductRow = await this.findProduct(productId);
    const rows: MovementRow[] = await this.database
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, productId));
    const stockMilli: number = rows.reduce(
      (sum: number, row: MovementRow) =>
        sum + numericToMilli(row.deltaQuantity),
      0,
    );
    return {
      saved: true,
      product: this.toProduct(product, stockMilli),
      movement: this.toMovement(movement, product),
    };
  }

  private stockMap(rows: MovementRow[]): Map<string, number> {
    const result: Map<string, number> = new Map();
    rows.forEach((row: MovementRow) => {
      result.set(
        row.productId,
        (result.get(row.productId) || 0) + numericToMilli(row.deltaQuantity),
      );
    });
    return result;
  }

  private sumQuantity(
    rows: MovementRow[],
    type: InventoryMovementType,
  ): string {
    return milliToQuantity(
      rows
        .filter((row: MovementRow) => row.movementType === type)
        .reduce(
          (sum: number, row: MovementRow) =>
            sum + Math.abs(numericToMilli(row.deltaQuantity)),
          0,
        ),
    );
  }

  private toProduct(
    row: ProductRow,
    currentStockMilli: number,
  ): InventoryProduct {
    const safetyStockMilli: number = numericToMilli(row.safetyStock);
    return {
      id: row.id,
      barcode: row.barcode,
      sku: row.sku || undefined,
      name: row.productName,
      category: row.category,
      unit: row.unit,
      purchaseCostExact: centsToMoney(row.purchaseCostCents),
      retailPriceExact: centsToMoney(row.retailPriceCents),
      defaultDiscountPercentExact: basisPointsToPercent(
        row.defaultDiscountBasisPoints,
      ),
      safetyStockExact: milliToQuantity(safetyStockMilli),
      currentStockExact: milliToQuantity(currentStockMilli),
      supplier: row.supplier || undefined,
      note: row.note || undefined,
      status: row.status === 'inactive' ? 'inactive' : 'active',
      lowStock: currentStockMilli <= safetyStockMilli,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMovement(
    row: MovementRow,
    product?: ProductRow,
  ): InventoryMovement {
    return {
      id: row.id,
      movementNo: row.movementNo,
      productId: row.productId,
      productName: product?.productName || '未知产品',
      productBarcode: product?.barcode || '',
      movementType: row.movementType as InventoryMovementType,
      quantityExact: milliToQuantity(numericToMilli(row.quantity)),
      deltaQuantityExact: milliToQuantity(numericToMilli(row.deltaQuantity)),
      unitCostExact: centsToMoney(row.unitCostCents),
      listPriceExact: centsToMoney(row.listPriceCents),
      discountPercentExact: basisPointsToPercent(row.discountBasisPoints),
      actualAmountExact: centsToMoney(row.actualAmountCents),
      customerAssetId: row.customerAssetId || undefined,
      customerName: row.customerName || undefined,
      recipientName: row.recipientName || undefined,
      purpose: row.purpose || undefined,
      supplier: row.supplier || undefined,
      batchNo: row.batchNo || undefined,
      expiresOn: row.expiresOn || undefined,
      note: row.note || undefined,
      operatorName: row.operatorName,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  private createMovementNo(type: InventoryMovementType): string {
    const prefix: Record<InventoryMovementType, string> = {
      inbound: 'RK',
      internal_use: 'LY',
      customer_sale: 'XS',
      customer_sale_reversal: 'TH',
    };
    const stamp: string = new Date()
      .toISOString()
      .replace(/\D/gu, '')
      .slice(0, 14);
    return `${prefix[type]}${stamp}${randomUUID().replace(/-/gu, '').slice(0, 8)}`;
  }
}
