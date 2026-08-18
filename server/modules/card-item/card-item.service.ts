import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';

import {
  cardPackageTemplate,
  customerAsset,
  customerCardAccount,
  customerCardEntitlement,
  customerCardLedger,
  serviceConfig,
} from '@server/database/schema';
import type {
  CardPackageCatalogResponse,
  CardPackageComponent,
  CardPackageCustomerServiceUsage,
  CardPackageCustomerUsage,
  CardPackageMutationResponse,
  CardPackageTemplate,
  CreateCardPackageRequest,
  CreateServiceProjectRequest,
  ServiceProjectDefinition,
  ServiceProjectMutationResponse,
} from '@shared/api.interface';

const CUSTOM_PROJECTS_CONFIG_KEY = 'card_item_custom_projects_v1';

type PackageRow = typeof cardPackageTemplate.$inferSelect;
type CustomerRow = typeof customerAsset.$inferSelect;
type CardAccountRow = typeof customerCardAccount.$inferSelect;
type CardEntitlementRow = typeof customerCardEntitlement.$inferSelect;
type CardLedgerRow = typeof customerCardLedger.$inferSelect;

interface PackageSalesSnapshot {
  soldCount: number;
  soldCustomerCount: number;
  customerUsage: CardPackageCustomerUsage[];
}

function requiredText(value: string | undefined, label: string): string {
  const normalized = (value || '').trim();
  if (!normalized) throw new BadRequestException(`请填写${label}`);
  return normalized;
}

function moneyToCents(value: string | undefined, label: string): number {
  const normalized = (value || '').replace(/,/gu, '').trim();
  const matched = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/u);
  if (!matched) throw new BadRequestException(`${label}必须精确到最多两位小数`);
  const cents = Number(matched[1]) * 100 + Number(`${matched[2] || ''}00`.slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new BadRequestException(`${label}必须大于 0`);
  }
  return cents;
}

function centsToMoney(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function percentToBasisPoints(value: string | undefined): number {
  const normalized = (value || '100').trim();
  const matched = normalized.match(/^(\d{1,3})(?:\.(\d{1,2}))?$/u);
  if (!matched) throw new BadRequestException('折扣必须是 0–100，最多两位小数');
  const result = Number(matched[1]) * 100 + Number(`${matched[2] || ''}00`.slice(0, 2));
  if (result <= 0 || result > 10000) {
    throw new BadRequestException('折扣必须大于 0 且不超过 100');
  }
  return result;
}

function basisPointsToPercent(value: number): string {
  const whole = Math.floor(value / 100);
  const decimal = String(value % 100).padStart(2, '0').replace(/0+$/u, '');
  return decimal ? `${whole}.${decimal}` : String(whole);
}

function normalizedName(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .replace(/^购入\s*[：:]\s*/u, '')
    .replace(/\s+/gu, '')
    .toLocaleLowerCase('zh-CN');
}

function isVoidedStatus(value: string | null | undefined): boolean {
  return /撤销|冲正|作废|删除|cancel|revers|void/iu.test(value || '');
}

function latestIso(values: Array<Date | undefined>): string | undefined {
  const latest = values
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0];
  return latest?.toISOString();
}

@Injectable()
export class CardItemService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
  ) {}

  async catalog(): Promise<CardPackageCatalogResponse> {
    const rows: PackageRow[] = await this.database
      .select()
      .from(cardPackageTemplate)
      .orderBy(desc(cardPackageTemplate.updatedAt));
    const [customers, accounts, entitlements, ledger, customProjects] = await Promise.all([
      this.database.select().from(customerAsset),
      this.database.select().from(customerCardAccount),
      this.database.select().from(customerCardEntitlement),
      this.database.select().from(customerCardLedger),
      this.loadCustomProjects(),
    ]);
    const packages = rows.map((row) =>
      this.toTemplate(
        row,
        this.packageSalesSnapshot(
          row,
          customers,
          accounts,
          entitlements,
          ledger,
        ),
      ),
    );
    const soldCustomers = new Set(
      packages.flatMap((item) => item.customerUsage.map((usage) => usage.customerId)),
    );
    return {
      packages,
      customProjects,
      packageCount: packages.length,
      activePackageCount: packages.filter((item) => item.status === 'active').length,
      totalPackageSoldCount: packages.reduce((sum, item) => sum + item.soldCount, 0),
      totalPackageCustomerCount: soldCustomers.size,
    };
  }

  async createProject(
    request: CreateServiceProjectRequest,
  ): Promise<ServiceProjectMutationResponse> {
    const name = requiredText(request.name, '项目名称');
    const category = requiredText(request.category, '项目分类');
    const managementType = requiredText(request.managementType, '管理类型');
    const durationMinutes = Number(request.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      throw new BadRequestException('服务时长必须是 1–1440 分钟的整数');
    }
    const project: ServiceProjectDefinition = {
      id: `manual_${randomUUID()}`,
      name,
      priceExact: centsToMoney(moneyToCents(request.priceExact, '项目售价')),
      category,
      managementType,
      durationMinutes,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };
    const current = await this.loadCustomProjects();
    if (current.some((item) => normalizedName(item.name) === normalizedName(name))) {
      throw new BadRequestException('已有同名项目，请先查看已有项目');
    }
    const next = [project, ...current];
    await this.database
      .insert(serviceConfig)
      .values({
        configKey: CUSTOM_PROJECTS_CONFIG_KEY,
        configValue: JSON.stringify(next),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: serviceConfig.configKey,
        set: { configValue: JSON.stringify(next), updatedAt: new Date() },
      });
    return { saved: true, project };
  }

  private async loadCustomProjects(): Promise<ServiceProjectDefinition[]> {
    const rows = await this.database
      .select({ configValue: serviceConfig.configValue })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, CUSTOM_PROJECTS_CONFIG_KEY))
      .limit(1);
    if (!rows[0]?.configValue) return [];
    try {
      const parsed = JSON.parse(rows[0].configValue) as unknown;
      return Array.isArray(parsed) ? parsed as ServiceProjectDefinition[] : [];
    } catch {
      return [];
    }
  }

  async createPackage(
    request: CreateCardPackageRequest,
  ): Promise<CardPackageMutationResponse> {
    const name = requiredText(request.name, '套餐卡名称');
    const retailPriceCents = moneyToCents(request.retailPriceExact, '套餐售价');
    const discountBasisPoints = percentToBasisPoints(request.discountPercentExact);
    const validDays = request.validDays === undefined ? null : Number(request.validDays);
    if (validDays !== null && (!Number.isInteger(validDays) || validDays <= 0)) {
      throw new BadRequestException('有效天数必须是正整数');
    }
    if (!Array.isArray(request.components) || request.components.length === 0) {
      throw new BadRequestException('套餐卡至少需要加入一个单次卡项');
    }
    if (request.components.length > 50) {
      throw new BadRequestException('一张套餐卡最多组合 50 个单次卡项');
    }
    const merged = new Map<string, CardPackageComponent>();
    for (const component of request.components) {
      const projectId = requiredText(component.projectId, '项目编号');
      const quantity = Number(component.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
        throw new BadRequestException('每个项目的次数必须是 1–999 的整数');
      }
      const unitPriceExact = centsToMoney(
        moneyToCents(component.unitPriceExact, `${component.projectName || '项目'}单价`),
      );
      const current = merged.get(projectId);
      if (current) {
        current.quantity += quantity;
      } else {
        merged.set(projectId, {
          projectId,
          projectName: requiredText(component.projectName, '项目名称'),
          category: (component.category || '未分类').trim() || '未分类',
          unitPriceExact,
          quantity,
        });
      }
    }
    const components = [...merged.values()];
    const [saved] = await this.database
      .insert(cardPackageTemplate)
      .values({
        packageNo: this.packageNo(),
        packageName: name,
        category: (request.category || '活动套餐').trim() || '活动套餐',
        retailPriceCents,
        discountBasisPoints,
        validDays,
        description: request.description?.trim() || null,
        components,
        status: 'active',
      })
      .returning();
    return {
      saved: true,
      package: this.toTemplate(saved, {
        soldCount: 0,
        soldCustomerCount: 0,
        customerUsage: [],
      }),
    };
  }

  private toTemplate(
    row: PackageRow,
    sales: PackageSalesSnapshot,
  ): CardPackageTemplate {
    const components = this.parseComponents(row.components);
    const originalValueCents = components.reduce(
      (total, component) =>
        total + Number(component.unitPriceExact) * 100 * component.quantity,
      0,
    );
    return {
      id: row.id,
      packageNo: row.packageNo,
      name: row.packageName,
      category: row.category,
      retailPriceExact: centsToMoney(row.retailPriceCents),
      discountPercentExact: basisPointsToPercent(row.discountBasisPoints),
      validDays: row.validDays || undefined,
      description: row.description || undefined,
      components,
      totalProjectCount: components.length,
      totalServiceCount: components.reduce((total, item) => total + item.quantity, 0),
      originalValueExact: centsToMoney(Math.round(originalValueCents)),
      soldCount: sales.soldCount,
      soldCustomerCount: sales.soldCustomerCount,
      customerUsage: sales.customerUsage,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private packageSalesSnapshot(
    packageRow: PackageRow,
    customers: CustomerRow[],
    accounts: CardAccountRow[],
    entitlements: CardEntitlementRow[],
    ledger: CardLedgerRow[],
  ): PackageSalesSnapshot {
    const packageKey = normalizedName(packageRow.packageName);
    const components = this.parseComponents(packageRow.components);
    const customerMap = new Map(customers.map((row) => [row.id, row]));
    const accountMap = new Map(accounts.map((row) => [row.id, row]));
    const reversedIds = new Set(
      ledger
        .map((row) => row.reversalOf)
        .filter((value): value is string => Boolean(value)),
    );
    const saleGroups = new Map<
      string,
      { customerId: string; accountId: string; soldCount: number; purchasedAt: Date }
    >();

    ledger
      .filter(
        (row) =>
          row.transactionType === 'credit' &&
          row.itemType === 'package' &&
          !reversedIds.has(row.id) &&
          normalizedName(row.projectName) === packageKey,
      )
      .forEach((row) => {
        const groupKey = `${row.customerAssetId}:${row.accountId}`;
        const current = saleGroups.get(groupKey);
        const quantity = Math.max(1, Number(row.quantity || 0));
        if (current) {
          current.soldCount += quantity;
          if (row.occurredAt < current.purchasedAt) current.purchasedAt = row.occurredAt;
        } else {
          saleGroups.set(groupKey, {
            customerId: row.customerAssetId,
            accountId: row.accountId,
            soldCount: quantity,
            purchasedAt: row.occurredAt,
          });
        }
      });

    accounts
      .filter(
        (account) =>
          normalizedName(account.cardName) === packageKey &&
          !isVoidedStatus(account.status),
      )
      .forEach((account) => {
        const groupKey = `${account.customerAssetId}:${account.id}`;
        if (!saleGroups.has(groupKey)) {
          saleGroups.set(groupKey, {
            customerId: account.customerAssetId,
            accountId: account.id,
            soldCount: 1,
            purchasedAt: account.createdAt,
          });
        }
      });

    const customerUsage = [...saleGroups.values()]
      .map<CardPackageCustomerUsage | undefined>((sale) => {
        const customer = customerMap.get(sale.customerId);
        const account = accountMap.get(sale.accountId);
        if (!customer || !account) return undefined;
        const accountEntitlements = entitlements.filter(
          (row) => row.accountId === account.id,
        );
        const accountLedger = ledger.filter((row) => row.accountId === account.id);
        const services = components.map((component) =>
          this.componentUsage(
            component,
            sale.soldCount,
            accountEntitlements,
            accountLedger,
            reversedIds,
          ),
        );
        const lastUsedAt = latestIso(
          services.map((service) =>
            service.lastUsedAt ? new Date(service.lastUsedAt) : undefined,
          ),
        );
        return {
          customerId: customer.id,
          customerName: customer.customerName,
          mobile: customer.mobile || undefined,
          memberLevel: customer.memberLevel || undefined,
          accountId: account.id,
          accountName: account.cardName,
          accountStatus: account.status,
          soldCount: sale.soldCount,
          purchasedAt: sale.purchasedAt.toISOString(),
          lastUsedAt,
          totalServiceCount: services.reduce((sum, item) => sum + item.totalCount, 0),
          usedServiceCount: services.reduce((sum, item) => sum + item.usedCount, 0),
          remainingServiceCount: services.reduce(
            (sum, item) => sum + item.remainingCount,
            0,
          ),
          services,
        } satisfies CardPackageCustomerUsage;
      })
      .filter((value): value is CardPackageCustomerUsage => Boolean(value))
      .sort(
        (left, right) =>
          new Date(right.purchasedAt).getTime() - new Date(left.purchasedAt).getTime(),
      );

    return {
      soldCount: customerUsage.reduce((sum, item) => sum + item.soldCount, 0),
      soldCustomerCount: new Set(customerUsage.map((item) => item.customerId)).size,
      customerUsage,
    };
  }

  private componentUsage(
    component: CardPackageComponent,
    packageCount: number,
    entitlements: CardEntitlementRow[],
    ledger: CardLedgerRow[],
    reversedIds: Set<string>,
  ): CardPackageCustomerServiceUsage {
    const componentKey = normalizedName(component.projectName);
    const matchingEntitlements = entitlements.filter(
      (row) => normalizedName(row.rightName) === componentKey,
    );
    const entitlementIds = new Set(matchingEntitlements.map((row) => row.id));
    const matchingLedger = ledger.filter(
      (row) =>
        entitlementIds.has(row.entitlementId || '') ||
        normalizedName(row.projectName) === componentKey,
    );
    const activeLedger = matchingLedger.filter(
      (row) => row.transactionType !== 'reversal' && !reversedIds.has(row.id),
    );
    const openingTotal = matchingEntitlements.reduce(
      (sum, row) =>
        sum +
        Number(
          row.openingTotalCount ??
            (row.openingUsedCount || 0) + (row.openingRemainingCount || 0),
        ),
      0,
    );
    const credited = activeLedger
      .filter((row) => row.transactionType === 'credit')
      .reduce((sum, row) => sum + Math.max(0, Number(row.quantity || 0)), 0);
    const used = activeLedger
      .filter((row) => row.transactionType === 'deduction')
      .reduce((sum, row) => sum + Math.max(0, Number(row.quantity || 0)), 0);
    const plannedTotal = component.quantity * packageCount;
    const totalCount = Math.max(plannedTotal, openingTotal + credited, used);
    const remainingFromRights = matchingEntitlements.reduce(
      (sum, row) => sum + Number(row.openingRemainingCount || 0),
      0,
    );
    const entitlementDelta = matchingLedger.reduce(
      (sum, row) => sum + Number(row.deltaQuantity || 0),
      0,
    );
    const remainingCount = matchingEntitlements.length
      ? Math.max(0, Math.min(totalCount, remainingFromRights + entitlementDelta))
      : Math.max(0, totalCount - used);
    const usedCount = Math.max(used, totalCount - remainingCount);
    const lastUsedAt = latestIso(
      activeLedger
        .filter((row) => row.transactionType === 'deduction')
        .map((row) => row.occurredAt),
    );
    return {
      projectName: component.projectName,
      category: component.category,
      totalCount,
      usedCount: Math.min(totalCount, usedCount),
      remainingCount,
      lastUsedAt,
    };
  }

  private parseComponents(value: unknown): CardPackageComponent[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Partial<CardPackageComponent>;
      if (!row.projectId || !row.projectName || !row.unitPriceExact) return [];
      return [{
        projectId: String(row.projectId),
        projectName: String(row.projectName),
        category: String(row.category || '未分类'),
        unitPriceExact: String(row.unitPriceExact),
        quantity: Number(row.quantity || 0),
      }];
    }).filter((item) => item.quantity > 0);
  }

  private packageNo(): string {
    const stamp = new Date().toISOString().replace(/\D/gu, '').slice(0, 14);
    return `TC${stamp}${randomUUID().replace(/-/gu, '').slice(0, 8)}`;
  }
}
