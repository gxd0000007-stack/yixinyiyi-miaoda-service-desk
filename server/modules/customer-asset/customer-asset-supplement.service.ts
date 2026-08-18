import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, like } from 'drizzle-orm';

import { serviceConfig } from '@server/database/schema';
import type {
  CustomerAssetSupplement,
  ServiceActor,
  UpdateCustomerAssetSupplementRequest,
} from '@shared/api.interface';

const CUSTOMER_SUPPLEMENT_PREFIX = 'customer_sup_';

interface SupplementConfigRow {
  configKey: string;
  configValue: string;
}

@Injectable()
export class CustomerAssetSupplementService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
  ) {}

  async findOne(assetId: string): Promise<CustomerAssetSupplement> {
    const rows: SupplementConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
      })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, this.configKey(assetId)))
      .limit(1);
    return this.parse(rows[0]?.configValue);
  }

  async findAll(): Promise<Map<string, CustomerAssetSupplement>> {
    const rows: SupplementConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
      })
      .from(serviceConfig)
      .where(like(serviceConfig.configKey, `${CUSTOMER_SUPPLEMENT_PREFIX}%`));
    return new Map(
      rows.map((row: SupplementConfigRow) => [
        row.configKey.slice(CUSTOMER_SUPPLEMENT_PREFIX.length),
        this.parse(row.configValue),
      ]),
    );
  }

  async save(
    assetId: string,
    request: UpdateCustomerAssetSupplementRequest,
    actor: ServiceActor,
  ): Promise<CustomerAssetSupplement> {
    const updatedAt: Date = new Date();
    const supplement: CustomerAssetSupplement = {
      avatarPreset: this.normalizeText(request.avatarPreset, 40),
      avatarUrl: this.normalizeText(request.avatarUrl, 2000),
      avatarBucketId: this.normalizeText(request.avatarBucketId, 255),
      avatarFilePath: this.normalizeText(request.avatarFilePath, 1000),
      mobile: this.normalizeText(request.mobile, 30),
      memberLevel: this.normalizeText(request.memberLevel, 100),
      initialSource: this.normalizeText(request.initialSource, 300),
      totalSpend: this.normalizeNumber(request.totalSpend),
      currentBalance: this.normalizeNumber(request.currentBalance),
      serviceStaff: this.normalizeList(request.serviceStaff),
      primarySkinConcerns: this.normalizeList(request.primarySkinConcerns),
      projectPreferences: this.normalizeList(request.projectPreferences),
      serviceRisks: this.normalizeList(request.serviceRisks),
      servicePreferences: this.normalizeList(request.servicePreferences),
      specialHealthStatus: this.normalizeText(
        request.specialHealthStatus,
        300,
      ),
      painTolerance: this.normalizeText(request.painTolerance, 100),
      healthNotes: this.normalizeText(request.healthNotes, 1000),
      consumptionNotes: this.normalizeText(request.consumptionNotes, 1000),
      communicationNotes: this.normalizeText(request.communicationNotes, 1000),
      updatedAt: updatedAt.toISOString(),
      updatedBy: actor.displayName,
    };
    const configKey: string = this.configKey(assetId);
    const configValue: string = JSON.stringify(supplement);
    await this.database
      .insert(serviceConfig)
      .values({ configKey, configValue, updatedAt })
      .onConflictDoUpdate({
        target: serviceConfig.configKey,
        set: { configValue, updatedAt },
      });
    return supplement;
  }

  private parse(value?: string): CustomerAssetSupplement {
    if (!value) return this.empty();
    try {
      const parsed = JSON.parse(value) as Partial<CustomerAssetSupplement>;
      return {
        avatarPreset: this.normalizeText(parsed.avatarPreset, 40),
        avatarUrl: this.normalizeText(parsed.avatarUrl, 2000),
        avatarBucketId: this.normalizeText(parsed.avatarBucketId, 255),
        avatarFilePath: this.normalizeText(parsed.avatarFilePath, 1000),
        mobile: this.normalizeText(parsed.mobile, 30),
        memberLevel: this.normalizeText(parsed.memberLevel, 100),
        initialSource: this.normalizeText(parsed.initialSource, 300),
        totalSpend: this.normalizeNumber(parsed.totalSpend),
        currentBalance: this.normalizeNumber(parsed.currentBalance),
        serviceStaff: this.normalizeList(parsed.serviceStaff),
        primarySkinConcerns: this.normalizeList(parsed.primarySkinConcerns),
        projectPreferences: this.normalizeList(parsed.projectPreferences),
        serviceRisks: this.normalizeList(parsed.serviceRisks),
        servicePreferences: this.normalizeList(parsed.servicePreferences),
        specialHealthStatus: this.normalizeText(
          parsed.specialHealthStatus,
          300,
        ),
        painTolerance: this.normalizeText(parsed.painTolerance, 100),
        healthNotes: this.normalizeText(parsed.healthNotes, 1000),
        consumptionNotes: this.normalizeText(parsed.consumptionNotes, 1000),
        communicationNotes: this.normalizeText(parsed.communicationNotes, 1000),
        updatedAt: this.normalizeText(parsed.updatedAt, 50),
        updatedBy: this.normalizeText(parsed.updatedBy, 255),
      };
    } catch {
      return this.empty();
    }
  }

  private empty(): CustomerAssetSupplement {
    return {
      serviceStaff: [],
      primarySkinConcerns: [],
      projectPreferences: [],
      serviceRisks: [],
      servicePreferences: [],
    };
  }

  private configKey(assetId: string): string {
    return `${CUSTOMER_SUPPLEMENT_PREFIX}${assetId}`;
  }

  private normalizeList(values?: string[]): string[] {
    if (!Array.isArray(values)) return [];
    return Array.from(
      new Set(
        values
          .map((value: string) => this.normalizeText(value, 200))
          .filter(Boolean),
      ),
    ).slice(0, 20);
  }

  private normalizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized: string = value.trim().slice(0, maxLength);
    return normalized || undefined;
  }

  private normalizeNumber(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return Math.min(value, 999999999);
  }
}
