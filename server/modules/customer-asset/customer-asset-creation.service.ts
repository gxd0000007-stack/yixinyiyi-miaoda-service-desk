import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';

import { customerAsset } from '@server/database/schema';
import type {
  CreateCustomerAssetRequest,
  ServiceActor,
} from '@shared/api.interface';

interface CreatedCustomerAsset {
  id: string;
}

@Injectable()
export class CustomerAssetCreationService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
  ) {}

  async create(
    request: CreateCustomerAssetRequest,
    actor: ServiceActor,
  ): Promise<CreatedCustomerAsset> {
    const name: string | undefined = this.normalizeText(request.name, 255);
    if (!name) throw new BadRequestException('请填写客户姓名');
    const mobile: string | undefined = this.normalizeText(request.mobile, 30);
    if (mobile) {
      const duplicateRows: Array<{ id: string }> = await this.database
        .select({ id: customerAsset.id })
        .from(customerAsset)
        .where(eq(customerAsset.mobile, mobile))
        .limit(1);
      if (duplicateRows.length > 0) {
        throw new ConflictException('该手机号已存在，请直接补充原客户档案');
      }
    }

    const nickname: string | undefined = this.normalizeText(
      request.nickname,
      255,
    );
    const memberLevel: string | undefined = this.normalizeText(
      request.memberLevel,
      255,
    );
    const initialSource: string | undefined = this.normalizeText(
      request.initialSource,
      500,
    );
    const totalSpend: number | undefined = this.normalizeNumber(
      request.totalSpend,
    );
    const currentBalance: number | undefined = this.normalizeNumber(
      request.currentBalance,
    );
    const serviceStaff: string[] = this.normalizeList(request.serviceStaff);
    const rawProfile: Record<string, unknown> = {
      姓名: name,
      昵称: nickname,
      手机号: mobile,
      会员档位: memberLevel,
      初始来源: initialSource,
      累计消费金额: totalSpend,
      当前剩余金额: currentBalance,
      服务员工: serviceStaff,
      主要皮肤问题: this.normalizeList(request.primarySkinConcerns),
      项目偏好: this.normalizeList(request.projectPreferences),
      服务雷区: this.normalizeList(request.serviceRisks),
      服务风格: this.normalizeList(request.servicePreferences),
      是否在哺乳期: this.normalizeText(request.specialHealthStatus, 300),
      疼痛耐受度: this.normalizeText(request.painTolerance, 100),
      健康注意补充: this.normalizeText(request.healthNotes, 1000),
      消费与资产补充: this.normalizeText(request.consumptionNotes, 1000),
      沟通备注: this.normalizeText(request.communicationNotes, 1000),
      建档人员: actor.displayName,
      建档方式: '工作台手动新增',
    };
    const normalizedProfile: Record<string, unknown> = Object.fromEntries(
      Object.entries(rawProfile).filter(([, value]: [string, unknown]) =>
        this.hasValue(value),
      ),
    );
    const completeness: number = Math.min(
      100,
      Math.round((Object.keys(normalizedProfile).length * 100) / 74),
    );
    const insertedRows: Array<{ id: string }> = await this.database
      .insert(customerAsset)
      .values({
        sourceRecordId: `manual_${randomUUID()}`,
        customerName: name,
        mobile,
        nickname,
        memberLevel,
        initialSource,
        totalSpend: totalSpend === undefined ? null : String(totalSpend),
        currentBalance:
          currentBalance === undefined ? null : String(currentBalance),
        serviceStaff: serviceStaff.join('、') || null,
        profileCompleteness: completeness,
        rawProfile: normalizedProfile,
        sourceSyncedAt: new Date(),
      })
      .returning({ id: customerAsset.id });
    return insertedRows[0];
  }

  private normalizeList(values?: string[]): string[] {
    if (!Array.isArray(values)) return [];
    return Array.from(
      new Set(
        values
          .map((value: string) => this.normalizeText(value, 200))
          .filter((value): value is string => Boolean(value)),
      ),
    ).slice(0, 20);
  }

  private normalizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized: string = value
      .replace(/[<>\u0000-\u001f]/gu, '')
      .trim()
      .slice(0, maxLength);
    return normalized || undefined;
  }

  private normalizeNumber(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return Math.min(value, 999999999);
  }

  private hasValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    if (value === null || value === undefined) return false;
    return String(value).trim().length > 0;
  }
}
