import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';

import { customerAsset } from '@server/database/schema';
import type {
  CustomerAssetDetail,
  CustomerAssetForService,
  CustomerCardAsset,
  CustomerCardAssetSummary,
  CustomerCardRight,
  CustomerAssetProfileGroup,
  CustomerAssetSegmentItem,
  CustomerAssetSegmentsResponse,
  CustomerAssetSupplement,
  CustomerAssetsResponse,
  CustomerAssetStats,
  CustomerAssetSummary,
  ServiceActor,
  ServiceAppointment,
  UpdateCustomerAssetSupplementRequest,
} from '@shared/api.interface';
import { CustomerAssetSupplementService } from './customer-asset-supplement.service';
import {
  CRITICAL_PROFILE_FIELDS,
  PROFILE_GROUPS,
  formatCurrency,
  formatProfileValue,
  hasProfileValue,
  healthProfileValues,
  normalizeCustomerName,
  normalizeRawProfile,
  profileList,
  type ProfileGroupDefinition,
} from './customer-asset.profile';

type CustomerAssetRow = typeof customerAsset.$inferSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized: string = value.trim();
  return normalized || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed: number = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function exactMoney(value: string | number | null): string | undefined {
  if (value === null) return undefined;
  const matched: RegExpMatchArray | null = String(value).match(
    /^(-?)(\d+)(?:\.(\d+))?$/u,
  );
  if (!matched) return undefined;
  return `${matched[1] || ''}${matched[2]}.${`${matched[3] || ''}00`.slice(0, 2)}`;
}

function parseCardRight(value: unknown): CustomerCardRight | undefined {
  if (!isRecord(value)) return undefined;
  const name: string | undefined = optionalString(value.name);
  if (!name) return undefined;
  return {
    name,
    type: optionalString(value.type),
    gift: optionalString(value.gift),
    discountRule: optionalString(value.discountRule),
    total: optionalNumber(value.total),
    used: optionalNumber(value.used),
    remaining: optionalNumber(value.remaining),
  };
}

function parseCardAsset(value: unknown): CustomerCardAsset | undefined {
  if (!isRecord(value)) return undefined;
  const cardName: string | undefined = optionalString(value.cardName);
  if (!cardName) return undefined;
  return {
    sourceKey: optionalString(value.sourceKey) || cardName,
    source: optionalString(value.source) || '有赞客户资产',
    cardName,
    category: optionalString(value.category),
    cardType: optionalString(value.cardType),
    status: optionalString(value.status) || '状态待确认',
    validity: optionalString(value.validity),
    acquiredAt: optionalString(value.acquiredAt),
    paidAmount: optionalNumber(value.paidAmount),
    purchaseStore: optionalString(value.purchaseStore),
    cardNumber: optionalString(value.cardNumber),
    accountNumber: optionalString(value.accountNumber),
    principalBalance: optionalNumber(value.principalBalance),
    giftBalance: optionalNumber(value.giftBalance),
    sessionBalance: optionalNumber(value.sessionBalance),
    sessionRemaining: optionalNumber(value.sessionRemaining),
    sessionGiftRemaining: optionalNumber(value.sessionGiftRemaining),
    rights: Array.isArray(value.rights)
      ? value.rights
          .map(parseCardRight)
          .filter((item): item is CustomerCardRight => Boolean(item))
      : [],
  };
}

function parseCardAssets(value: unknown): CustomerCardAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseCardAsset)
    .filter((item): item is CustomerCardAsset => Boolean(item));
}

function buildCardSummary(
  cards: CustomerCardAsset[],
  refunds: CustomerCardAsset[],
): CustomerCardAssetSummary {
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  cards.forEach((card: CustomerCardAsset): void => {
    statusCounts[card.status] = (statusCounts[card.status] || 0) + 1;
    const category: string = card.category || '未分类';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });
  const countStatus = (status: string): number =>
    cards.filter((card: CustomerCardAsset) => card.status === status).length;
  return {
    total: cards.length,
    active: countStatus('使用中'),
    expired: countStatus('已过期'),
    invalid: 0,
    refunded: refunds.length,
    statusCounts,
    categoryCounts,
  };
}

@Injectable()
export class CustomerAssetService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
    private readonly supplementService: CustomerAssetSupplementService,
  ) {}

  async findAll(
    queryValue: string,
    pageValue: number,
    pageSizeValue: number,
  ): Promise<CustomerAssetsResponse> {
    const query: string = queryValue.trim();
    const page: number = Math.max(1, pageValue);
    const pageSize: number = Math.min(50, Math.max(1, pageSizeValue));
    const condition = query
      ? or(
          ilike(customerAsset.customerName, `%${query}%`),
          ilike(customerAsset.nickname, `%${query}%`),
          ilike(customerAsset.mobile, `%${query}%`),
          ilike(customerAsset.memberLevel, `%${query}%`),
          ilike(customerAsset.initialSource, `%${query}%`),
        )
      : undefined;
    const listQuery = condition
      ? this.database
          .select()
          .from(customerAsset)
          .where(condition)
      : this.database.select().from(customerAsset);
    const countQuery = condition
      ? this.database
          .select({ id: customerAsset.id })
          .from(customerAsset)
          .where(condition)
      : this.database.select({ id: customerAsset.id }).from(customerAsset);
    const [rows, matchedRows, allRows, supplements] = await Promise.all([
      listQuery
        .orderBy(
          sql`${customerAsset.totalSpend} DESC NULLS LAST`,
          customerAsset.customerName,
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      countQuery,
      this.database.select().from(customerAsset),
      this.supplementService.findAll(),
    ]);
    return {
      items: rows.map((row: CustomerAssetRow) =>
        this.toSummary(row, supplements.get(row.id)),
      ),
      total: matchedRows.length,
      page,
      pageSize,
      stats: this.buildStats(allRows, supplements),
    };
  }

  async findAllSummaries(): Promise<CustomerAssetSummary[]> {
    const [rows, supplements]: [
      CustomerAssetRow[],
      Map<string, CustomerAssetSupplement>,
    ] = await Promise.all([
      this.database
        .select()
        .from(customerAsset)
        .orderBy(desc(customerAsset.totalSpend), customerAsset.customerName),
      this.supplementService.findAll(),
    ]);
    return rows.map((row: CustomerAssetRow) =>
      this.toSummary(row, supplements.get(row.id)),
    );
  }

  async findDetail(id: string): Promise<CustomerAssetDetail> {
    const [rows, supplement]: [CustomerAssetRow[], CustomerAssetSupplement] =
      await Promise.all([
        this.database
          .select()
          .from(customerAsset)
          .where(eq(customerAsset.id, id))
          .limit(1),
        this.supplementService.findOne(id),
      ]);
    const row: CustomerAssetRow | undefined = rows[0];
    if (!row) throw new NotFoundException('未找到该客户资产');
    return this.toDetail(row, supplement);
  }

  async findSegments(): Promise<CustomerAssetSegmentsResponse> {
    const [rows, supplements]: [
      CustomerAssetRow[],
      Map<string, CustomerAssetSupplement>,
    ] = await Promise.all([
      this.database
        .select()
        .from(customerAsset)
        .orderBy(desc(customerAsset.totalSpend), customerAsset.customerName),
      this.supplementService.findAll(),
    ]);
    const items: CustomerAssetSegmentItem[] = rows.map(
      (row: CustomerAssetRow): CustomerAssetSegmentItem => {
        const supplement: CustomerAssetSupplement | undefined =
          supplements.get(row.id);
        const summary: CustomerAssetSummary = this.toSummary(row, supplement);
        const profile: Record<string, unknown> = this.mergeProfile(
          row,
          supplement,
        );
        return {
          ...summary,
          missingFields: this.getMissingFields(profile),
        };
      },
    );
    return {
      highValueCustomers: items
        .filter(
          (item: CustomerAssetSegmentItem) => (item.totalSpend || 0) >= 10000,
        )
        .sort(
          (left: CustomerAssetSegmentItem, right: CustomerAssetSegmentItem) =>
            (right.totalSpend || 0) - (left.totalSpend || 0) ||
            left.name.localeCompare(right.name, 'zh-CN'),
        ),
      incompleteCustomers: items
        .filter(
          (item: CustomerAssetSegmentItem) => item.missingFields.length > 0,
        )
        .sort(
          (left: CustomerAssetSegmentItem, right: CustomerAssetSegmentItem) =>
            left.profileCompleteness - right.profileCompleteness,
        ),
    };
  }

  async updateSupplement(
    id: string,
    request: UpdateCustomerAssetSupplementRequest,
    actor: ServiceActor,
  ): Promise<CustomerAssetDetail> {
    const rows: CustomerAssetRow[] = await this.database
      .select()
      .from(customerAsset)
      .where(eq(customerAsset.id, id))
      .limit(1);
    const row: CustomerAssetRow | undefined = rows[0];
    if (!row) throw new NotFoundException('未找到该客户资产');
    const supplement: CustomerAssetSupplement =
      await this.supplementService.save(id, request, actor);
    return this.toDetail(row, supplement);
  }

  async enrichAppointments(
    appointments: ServiceAppointment[],
  ): Promise<ServiceAppointment[]> {
    if (appointments.length === 0) return appointments;
    const [rows, supplements]: [
      CustomerAssetRow[],
      Map<string, CustomerAssetSupplement>,
    ] = await Promise.all([
      this.database.select().from(customerAsset),
      this.supplementService.findAll(),
    ]);
    const aliases = new Map<string, CustomerAssetRow[]>();
    rows.forEach((row: CustomerAssetRow) => {
      const profile: Record<string, unknown> = this.mergeProfile(
        row,
        supplements.get(row.id),
      );
      const candidates: string[] = Array.from(
        new Set(
          [
            row.customerName,
            row.nickname || '',
            ...profileList(profile, '真实姓名'),
            ...profileList(profile, '姓名分组'),
          ]
            .map((value: string) => normalizeCustomerName(value))
            .filter(Boolean),
        ),
      );
      candidates.forEach((alias: string) => {
        aliases.set(alias, [...(aliases.get(alias) || []), row]);
      });
    });
    return appointments.map((appointment: ServiceAppointment) => {
      const appointmentAliases: string[] = Array.from(
        new Set(
          [appointment.name, appointment.nickname]
            .map((value: string) => normalizeCustomerName(value))
            .filter(Boolean),
        ),
      );
      const matchedRows: CustomerAssetRow[] = appointmentAliases.flatMap(
        (alias: string) => aliases.get(alias) || [],
      );
      const uniqueMatches: CustomerAssetRow[] = Array.from(
        new Map(
          matchedRows.map((row: CustomerAssetRow) => [row.id, row]),
        ).values(),
      );
      const row: CustomerAssetRow | undefined =
        uniqueMatches.length === 1 ? uniqueMatches[0] : undefined;
      if (!row) return appointment;
      const supplement: CustomerAssetSupplement | undefined =
        supplements.get(row.id);
      const serviceProfile: CustomerAssetForService = this.toServiceProfile(
        row,
        supplement,
      );
      const profile: Record<string, unknown> = this.mergeProfile(
        row,
        supplement,
      );
      const serviceStaff: string[] = profileList(profile, '服务员工');
      const realTags: string[] = Array.from(
        new Set([
          ...profileList(profile, '主要皮肤问题'),
          ...profileList(profile, '项目偏好'),
          ...profileList(profile, '服务雷区'),
        ]),
      ).slice(0, 6);
      return {
        ...appointment,
        nickname: row.nickname || appointment.nickname,
        member: supplement?.memberLevel || row.memberLevel || appointment.member,
        fixedTechnician:
          serviceStaff[0] || appointment.fixedTechnician,
        arrivalMethod:
          profileList(profile, '到店方式')[0] ||
          appointment.arrivalMethod,
        cardBalance:
          supplement?.currentBalance === undefined && row.currentBalance === null
            ? appointment.cardBalance
            : formatCurrency(
                supplement?.currentBalance ?? Number(row.currentBalance),
              ),
        remainingProjects:
          appointment.remainingProjects?.length
            ? appointment.remainingProjects
            : serviceProfile.availableCardRights.map((right) => ({
                name: right.name,
                times: right.remaining,
                expires: right.expires,
              })),
        tags: realTags.length > 0 ? realTags : appointment.tags,
        customerAsset: serviceProfile,
      };
    });
  }

  private toSummary(
    row: CustomerAssetRow,
    supplement?: CustomerAssetSupplement,
  ): CustomerAssetSummary {
    const profile: Record<string, unknown> = this.mergeProfile(row, supplement);
    const primarySkinConcerns: string[] = profileList(
      profile,
      '主要皮肤问题',
    );
    const projectPreferences: string[] = profileList(profile, '项目偏好');
    const serviceRisks: string[] = profileList(profile, '服务雷区');
    return {
      id: row.id,
      sourceRecordId: row.sourceRecordId,
      name: row.customerName,
      avatarPreset: supplement?.avatarPreset,
      avatarUrl: supplement?.avatarUrl,
      nickname: row.nickname || undefined,
      mobile: supplement?.mobile || row.mobile || undefined,
      memberLevel: supplement?.memberLevel || row.memberLevel || undefined,
      initialSource: supplement?.initialSource || row.initialSource || undefined,
      totalSpend:
        supplement?.totalSpend ??
        (row.totalSpend === null ? undefined : Number(row.totalSpend)),
      currentBalance:
        supplement?.currentBalance ??
        (row.currentBalance === null ? undefined : Number(row.currentBalance)),
      totalSpendExact: exactMoney(row.totalSpend),
      currentBalanceExact: exactMoney(row.currentBalance),
      serviceStaff: profileList(profile, '服务员工'),
      profileCompleteness: this.calculateCompleteness(row, profile),
      primarySkinConcerns,
      projectPreferences,
      serviceRisks,
      birthday: profileList(profile, '生日')[0],
      memberExpiresAt: profileList(profile, '会员到期时间')[0],
      importantDates: profileList(profile, '重要纪念日'),
      followupRules: profileList(profile, '产品购买跟进'),
      healthFlags: [
        ...healthProfileValues(profile, '是否怀孕', '怀孕'),
        ...healthProfileValues(profile, '是否在哺乳期', '哺乳期'),
        ...healthProfileValues(profile, '月经期', '月经期'),
        ...healthProfileValues(profile, '身体敏感度', '身体敏感度'),
        ...healthProfileValues(profile, '疼痛耐受度', '疼痛耐受度'),
      ],
      tags: Array.from(
        new Set([
          ...primarySkinConcerns,
          ...projectPreferences,
          ...profileList(profile, '消费类型'),
        ]),
      ).slice(0, 6),
      sourceSyncedAt: row.sourceSyncedAt.toISOString(),
    };
  }

  private toDetail(
    row: CustomerAssetRow,
    supplement: CustomerAssetSupplement,
  ): CustomerAssetDetail {
    const profile: Record<string, unknown> = this.mergeProfile(row, supplement);
    const cardAssets: CustomerCardAsset[] = parseCardAssets(
      profile['有赞卡项'],
    ).filter(
      (card: CustomerCardAsset): boolean => card.status !== '已失效',
    );
    const refundRecords: CustomerCardAsset[] = parseCardAssets(
      profile['有赞退款记录'],
    );
    const profileGroups: CustomerAssetProfileGroup[] = PROFILE_GROUPS.map(
      (group: ProfileGroupDefinition): CustomerAssetProfileGroup => ({
        id: group.id,
        title: group.title,
        description: group.description,
        items: group.fields
          .filter((field: string) => hasProfileValue(profile[field]))
          .map((field: string) => ({
            label: field,
            value: formatProfileValue(profile[field]),
          })),
      }),
    ).filter((group: CustomerAssetProfileGroup) => group.items.length > 0);
    return {
      ...this.toSummary(row, supplement),
      profileGroups,
      rawProfile: profile,
      supplement,
      cardAssets,
      refundRecords,
      cardAssetSummary: buildCardSummary(cardAssets, refundRecords),
    };
  }

  private toServiceProfile(
    row: CustomerAssetRow,
    supplement?: CustomerAssetSupplement,
  ): CustomerAssetForService {
    const profile: Record<string, unknown> = this.mergeProfile(row, supplement);
    const availableCardRights = parseCardAssets(profile['有赞卡项'])
      .filter((card: CustomerCardAsset) => card.status === '使用中')
      .flatMap((card: CustomerCardAsset) =>
        card.rights
          .filter(
            (right: CustomerCardRight) => (right.remaining || 0) > 0,
          )
          .map((right: CustomerCardRight) => ({
            name: right.name,
            remaining: right.remaining || 0,
            cardName: card.cardName,
            category: card.category,
            expires: card.validity || '有效期待确认',
          })),
      );
    return {
      assetId: row.id,
      sourceRecordId: row.sourceRecordId,
      avatarPreset: supplement?.avatarPreset,
      avatarUrl: supplement?.avatarUrl,
      profileCompleteness: this.calculateCompleteness(row, profile),
      memberLevel: supplement?.memberLevel || row.memberLevel || undefined,
      initialSource: supplement?.initialSource || row.initialSource || undefined,
      totalSpend:
        supplement?.totalSpend ??
        (row.totalSpend === null ? undefined : Number(row.totalSpend)),
      currentBalance:
        supplement?.currentBalance ??
        (row.currentBalance === null ? undefined : Number(row.currentBalance)),
      serviceStaff: profileList(profile, '服务员工'),
      primarySkinConcerns: profileList(profile, '主要皮肤问题'),
      projectPreferences: [
        ...profileList(profile, '项目偏好'),
        ...profileList(profile, '基础项目'),
        ...profileList(profile, '分层水光'),
        ...profileList(profile, '科技美肤'),
        ...profileList(profile, '问题肌项目'),
      ],
      serviceRisks: profileList(profile, '服务雷区'),
      servicePreferences: [
        ...profileList(profile, '服务风格'),
        ...profileList(profile, '服务氛围偏好'),
        ...profileList(profile, '房间偏好'),
        ...profileList(profile, '手法偏好'),
        ...profileList(profile, '餐食饮品偏好'),
      ],
      consumptionProfile: [
        ...profileList(profile, '消费类型'),
        ...profileList(profile, '消费潜力'),
        ...profileList(profile, '成交卡点'),
      ],
      decisionFactors: profileList(profile, '对消费决策影响'),
      entryMotives: profileList(profile, '进店动机'),
      healthFlags: [
        ...healthProfileValues(profile, '是否怀孕', '怀孕'),
        ...healthProfileValues(profile, '是否在哺乳期', '哺乳期'),
        ...healthProfileValues(profile, '月经期', '月经期'),
        ...healthProfileValues(profile, '身体敏感度', '身体敏感度'),
        ...healthProfileValues(profile, '疼痛耐受度', '疼痛耐受度'),
      ],
      followupRules: [
        ...profileList(profile, '产品购买跟进'),
        ...profileList(profile, '重要纪念日'),
      ],
      availableCardRights,
    };
  }

  private buildStats(
    rows: CustomerAssetRow[],
    supplements: Map<string, CustomerAssetSupplement>,
  ): CustomerAssetStats {
    const total: number = rows.length;
    const completenessTotal: number = rows.reduce(
      (sum: number, row: CustomerAssetRow) => {
        const profile: Record<string, unknown> = this.mergeProfile(
          row,
          supplements.get(row.id),
        );
        return sum + this.calculateCompleteness(row, profile);
      },
      0,
    );
    const latestSyncedAt: Date | undefined = rows
      .filter((row: CustomerAssetRow) =>
        !row.sourceRecordId.startsWith('manual_'),
      )
      .map((row: CustomerAssetRow) => row.sourceSyncedAt)
      .sort((left: Date, right: Date) => right.getTime() - left.getTime())[0];
    return {
      total,
      memberCount: rows.filter(
        (row: CustomerAssetRow) => {
          const level: string = String(
            supplements.get(row.id)?.memberLevel || row.memberLevel || '',
          ).trim();
          return Boolean(level) && level !== '非会员';
        },
      ).length,
      highValueCount: rows.filter(
        (row: CustomerAssetRow) =>
          (supplements.get(row.id)?.totalSpend ??
            Number(row.totalSpend || 0)) >= 10000,
      ).length,
      averageCompleteness:
        total === 0 ? 0 : Math.round(completenessTotal / total),
      fieldCount: 74,
      sourceName: '客户画像',
      latestSyncedAt: latestSyncedAt?.toISOString(),
    };
  }

  private mergeProfile(
    row: CustomerAssetRow,
    supplement?: CustomerAssetSupplement,
  ): Record<string, unknown> {
    const profile: Record<string, unknown> = normalizeRawProfile(
      row.rawProfile,
    );
    this.setIfMissing(profile, '手机号', row.mobile);
    this.setIfMissing(profile, '会员档位', row.memberLevel);
    this.setIfMissing(profile, '初始来源', row.initialSource);
    this.setIfMissing(profile, '累计消费金额', row.totalSpend);
    this.setIfMissing(profile, '当前剩余金额', row.currentBalance);
    this.setIfMissing(profile, '服务员工', row.serviceStaff);
    if (!supplement) return profile;
    this.setIfPresent(profile, '手机号', supplement.mobile);
    this.setIfPresent(profile, '会员档位', supplement.memberLevel);
    this.setIfPresent(profile, '初始来源', supplement.initialSource);
    this.setIfPresent(profile, '累计消费金额', supplement.totalSpend);
    this.setIfPresent(profile, '当前剩余金额', supplement.currentBalance);
    this.setIfPresent(profile, '服务员工', supplement.serviceStaff);
    this.setIfPresent(
      profile,
      '主要皮肤问题',
      supplement.primarySkinConcerns,
    );
    this.setIfPresent(profile, '项目偏好', supplement.projectPreferences);
    this.setIfPresent(profile, '服务雷区', supplement.serviceRisks);
    this.setIfPresent(profile, '服务风格', supplement.servicePreferences);
    this.setIfPresent(
      profile,
      '是否在哺乳期',
      supplement.specialHealthStatus,
    );
    this.setIfPresent(profile, '疼痛耐受度', supplement.painTolerance);
    this.setIfPresent(profile, '健康注意补充', supplement.healthNotes);
    this.setIfPresent(profile, '消费与资产补充', supplement.consumptionNotes);
    this.setIfPresent(profile, '沟通备注', supplement.communicationNotes);
    return profile;
  }

  private calculateCompleteness(
    row: CustomerAssetRow,
    profile: Record<string, unknown>,
  ): number {
    const sourceProfile: Record<string, unknown> = this.mergeProfile(row);
    const additionalCount: number = Object.keys(profile).filter(
      (field: string) =>
        !hasProfileValue(sourceProfile[field]) &&
        hasProfileValue(profile[field]),
    ).length;
    return Math.min(
      100,
      row.profileCompleteness + Math.round((additionalCount * 100) / 74),
    );
  }

  private getMissingFields(profile: Record<string, unknown>): string[] {
    return CRITICAL_PROFILE_FIELDS
      .filter(
        (definition: { field: string; label: string }) =>
          !hasProfileValue(profile[definition.field]),
      )
      .map(
        (definition: { field: string; label: string }) => definition.label,
      );
  }

  private setIfMissing(
    profile: Record<string, unknown>,
    field: string,
    value: unknown,
  ): void {
    if (hasProfileValue(profile[field])) return;
    this.setIfPresent(profile, field, value);
  }

  private setIfPresent(
    profile: Record<string, unknown>,
    field: string,
    value: unknown,
  ): void {
    if (hasProfileValue(value)) profile[field] = value;
  }
}
