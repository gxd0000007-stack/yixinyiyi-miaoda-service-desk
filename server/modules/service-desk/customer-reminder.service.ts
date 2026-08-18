import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthorizationSDK,
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
  type ForceRoleDTO,
  type UserSimpleDTO,
} from '@lark-apaas/fullstack-nestjs-core';
import { like } from 'drizzle-orm';
import {
  FRONT_DESK_ROLE,
  STORE_OWNER_ROLE,
} from '../../../shared/role.constants';

import type {
  CompleteCustomerFollowupTaskRequest,
  CompleteCustomerFollowupTaskResponse,
  CustomerAssetSummary,
  CustomerFollowupEvidence,
  CustomerFollowupTask,
  CustomerFollowupTasksResponse,
  CustomerPrivilegeTier,
  ServiceActor,
  ServiceAppointment,
  ServiceAppointmentHistoryDay,
  ServiceMentionUser,
} from '@shared/api.interface';
import { serviceConfig } from '../../database/schema';
import { CustomerAssetService } from '../customer-asset/customer-asset.service';
import { ServiceDeskService } from './service-desk.service';

interface ShanghaiDateParts {
  year: number;
  month: number;
  day: number;
}

interface CustomerVisit {
  customer: CustomerAssetSummary;
  date: string;
  appointment: ServiceAppointment;
}

interface FollowupCustomer extends CustomerVisit {
  stage: 'D+1' | 'D+3' | 'D+21';
  content: string;
}

interface FollowupTaskState {
  evidence: CustomerFollowupEvidence[];
  completedAt: string;
  completedBy: string;
}

export interface AutomatedReminderResult {
  matchedCustomers: number;
  sentMessages: number;
  skippedMessages: number;
}

const DEFAULT_OWNER_MENTION: ServiceMentionUser = {
  userId: 'ou_6298cdf3a55a36b5ab07560ef37769d6',
  name: 'WANS',
  role: '老板',
};
const NOTICE_CHUNK_SIZE: number = 8;
const PRIVILEGE_TIERS: CustomerPrivilegeTier[] = [
  '追光者',
  '绘光师',
  '蕴光主',
];

export function privilegeTierForText(
  value?: string,
): CustomerPrivilegeTier | undefined {
  const normalized: string = value?.replace(/\s+/gu, '') || '';
  return PRIVILEGE_TIERS.find((tier: CustomerPrivilegeTier) =>
    normalized.includes(tier),
  );
}

function shanghaiDateParts(value: Date): ShanghaiDateParts {
  const parts: Intl.DateTimeFormatPart[] = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const partValue = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part: Intl.DateTimeFormatPart) => part.type === type)?.value);
  return {
    year: partValue('year'),
    month: partValue('month'),
    day: partValue('day'),
  };
}

export function shanghaiDateKey(value: Date): string {
  const parts: ShanghaiDateParts = shanghaiDateParts(value);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export function shiftDateKey(dateKey: string, offsetDays: number): string {
  const [year, month, day]: number[] = dateKey
    .split('-')
    .map((part: string): number => Number(part));
  const shifted: Date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return [
    String(shifted.getUTCFullYear()).padStart(4, '0'),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function dayDifference(laterDateKey: string, earlierDateKey: string): number {
  const toDayNumber = (dateKey: string): number => {
    const [year, month, day]: number[] = dateKey
      .split('-')
      .map((part: string): number => Number(part));
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  return toDayNumber(laterDateKey) - toDayNumber(earlierDateKey);
}

function normalizeName(value: string): string {
  return value.replace(/\s+/gu, '').trim();
}

function safeText(value: string): string {
  return value.replace(/[<>&\r\n]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function maskedMobile(value?: string): string {
  const mobile: string = value?.replace(/\s+/gu, '') || '';
  if (!mobile) return '电话待补充';
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

function chineseDate(dateKey: string): string {
  const [, month, day]: string[] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function birthdayMonthDay(value?: string): string | undefined {
  if (!value) return undefined;
  const match: RegExpMatchArray | null = value.match(
    /(?:\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/u,
  );
  if (!match) return undefined;
  return `${String(Number(match[1])).padStart(2, '0')}-${String(
    Number(match[2]),
  ).padStart(2, '0')}`;
}

export function isBirthdayOnDate(
  birthday: string | undefined,
  dateKey: string,
): boolean {
  const monthDay: string = dateKey.slice(5);
  return birthdayMonthDay(birthday) === monthDay;
}

export function followupStageFor(
  visitDateKey: string,
  todayDateKey: string,
): FollowupCustomer['stage'] | undefined {
  const days: number = dayDifference(todayDateKey, visitDateKey);
  if (days === 1) return 'D+1';
  if (days === 3) return 'D+3';
  if (days === 21) return 'D+21';
  return undefined;
}

@Injectable()
export class CustomerReminderService {
  private readonly logger = new Logger(CustomerReminderService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
    private readonly customerAssetService: CustomerAssetService,
    private readonly serviceDeskService: ServiceDeskService,
    private readonly authorizationSDK: AuthorizationSDK,
  ) {}

  async sendTomorrowBirthdayReminder(
    referenceTime: Date = new Date(),
  ): Promise<AutomatedReminderResult> {
    const todayDateKey: string = shanghaiDateKey(referenceTime);
    const targetDateKey: string = shiftDateKey(todayDateKey, 2);
    const customers: CustomerAssetSummary[] =
      await this.customerAssetService.findAllSummaries();
    const birthdayCustomers: CustomerAssetSummary[] = customers
      .filter((customer: CustomerAssetSummary) =>
        Boolean(privilegeTierForText(customer.memberLevel)) &&
        isBirthdayOnDate(customer.birthday, targetDateKey),
      )
      .sort((left: CustomerAssetSummary, right: CustomerAssetSummary) =>
        left.name.localeCompare(right.name, 'zh-CN'),
      );
    if (birthdayCustomers.length === 0) {
      this.logger.log(`${targetDateKey} 无生日客户，跳过群提醒`);
      return { matchedCustomers: 0, sentMessages: 0, skippedMessages: 0 };
    }

    const mentions: ServiceMentionUser[] = await this.getNotificationMentions();
    const chunks: CustomerAssetSummary[][] = this.chunkItems(birthdayCustomers);
    const messages: string[] = chunks.map(
      (chunk: CustomerAssetSummary[], index: number): string =>
        this.buildBirthdayMessage(
          chunk,
          birthdayCustomers.length,
          targetDateKey,
          mentions,
          index,
          chunks.length,
        ),
    );
    return this.sendNoticeMessages(
      'birthday',
      targetDateKey,
      birthdayCustomers.length,
      messages,
    );
  }

  async sendTodayFollowupReminder(
    referenceTime: Date = new Date(),
  ): Promise<AutomatedReminderResult> {
    const todayDateKey: string = shanghaiDateKey(referenceTime);
    const [customers, history]: [
      CustomerAssetSummary[],
      Awaited<ReturnType<ServiceDeskService['getAppointmentHistory']>>,
    ] = await Promise.all([
      this.customerAssetService.findAllSummaries(),
      this.serviceDeskService.getAppointmentHistory(),
    ]);
    const followups: FollowupCustomer[] = this.buildFollowupCustomers(
      customers,
      history.days,
      todayDateKey,
    );
    if (followups.length === 0) {
      this.logger.log(`${todayDateKey} 无到期回访客户，跳过群提醒`);
      return { matchedCustomers: 0, sentMessages: 0, skippedMessages: 0 };
    }

    const mentions: ServiceMentionUser[] = await this.getNotificationMentions();
    const chunks: FollowupCustomer[][] = this.chunkItems(followups);
    const messages: string[] = chunks.map(
      (chunk: FollowupCustomer[], index: number): string =>
        this.buildFollowupMessage(
          chunk,
          followups.length,
          todayDateKey,
          mentions,
          index,
          chunks.length,
        ),
    );
    return this.sendNoticeMessages(
      'followup',
      todayDateKey,
      followups.length,
      messages,
    );
  }

  async getTodayFollowupTasks(
    referenceTime: Date = new Date(),
  ): Promise<CustomerFollowupTasksResponse> {
    const todayDateKey: string = shanghaiDateKey(referenceTime);
    const [customers, history]: [
      CustomerAssetSummary[],
      Awaited<ReturnType<ServiceDeskService['getAppointmentHistory']>>,
    ] = await Promise.all([
      this.customerAssetService.findAllSummaries(),
      this.serviceDeskService.getAppointmentHistory(),
    ]);
    const followups: FollowupCustomer[] = this.buildFollowupCustomers(
      customers,
      history.days,
      todayDateKey,
    );
    const taskStates: Map<string, FollowupTaskState> =
      await this.getFollowupTaskStates();
    const items: CustomerFollowupTask[] = followups.map(
      (item: FollowupCustomer): CustomerFollowupTask => {
        const id: string = this.followupTaskId(item, todayDateKey);
        const state: FollowupTaskState | undefined = taskStates.get(id);
        return {
          id,
          date: todayDateKey,
          customerId: item.customer.id,
          customerName: item.customer.name,
          customerMobile: item.customer.mobile,
          memberLevel: item.customer.memberLevel,
          stage: item.stage,
          lastVisitDate: item.date,
          lastProject: item.appointment.project,
          assignedStaff: item.appointment.technician,
          content: item.content,
          status: state ? 'completed' : 'pending',
          evidence: state?.evidence || [],
          completedAt: state?.completedAt,
          completedBy: state?.completedBy,
        };
      },
    );
    return { date: todayDateKey, items };
  }

  async completeFollowupTask(
    request: CompleteCustomerFollowupTaskRequest,
    actor: ServiceActor,
  ): Promise<CompleteCustomerFollowupTaskResponse> {
    const taskId: string = request.taskId?.trim();
    const response: CustomerFollowupTasksResponse =
      await this.getTodayFollowupTasks();
    const task: CustomerFollowupTask | undefined = response.items.find(
      (item: CustomerFollowupTask) => item.id === taskId,
    );
    if (!task) throw new NotFoundException('回访任务不存在或已过期');
    const evidence: CustomerFollowupEvidence[] = request.evidence || [];
    if (evidence.length === 0) {
      throw new BadRequestException('请先上传回访图片作为完成凭证');
    }
    if (evidence.length > 6) {
      throw new BadRequestException('每次回访最多上传6张凭证图片');
    }
    const normalizedEvidence: CustomerFollowupEvidence[] = evidence.map(
      (item: CustomerFollowupEvidence): CustomerFollowupEvidence => {
        if (!item.id || !item.filePath || !item.bucketId || !item.url) {
          throw new BadRequestException('回访图片信息不完整');
        }
        return {
          id: item.id,
          filePath: item.filePath,
          bucketId: item.bucketId,
          url: item.url,
          name: item.name?.slice(0, 255) || '回访凭证',
          uploadedAt: item.uploadedAt || new Date().toISOString(),
        };
      },
    );
    const completedAt: string = new Date().toISOString();
    const state: FollowupTaskState = {
      evidence: normalizedEvidence,
      completedAt,
      completedBy: actor.displayName,
    };
    await this.database
      .insert(serviceConfig)
      .values({
        configKey: this.followupStateKey(taskId),
        configValue: JSON.stringify(state),
        updatedAt: new Date(completedAt),
      })
      .onConflictDoUpdate({
        target: serviceConfig.configKey,
        set: {
          configValue: JSON.stringify(state),
          updatedAt: new Date(completedAt),
        },
      });
    return {
      saved: true,
      task: {
        ...task,
        status: 'completed',
        evidence: normalizedEvidence,
        completedAt,
        completedBy: actor.displayName,
      },
    };
  }

  private buildFollowupCustomers(
    customers: CustomerAssetSummary[],
    days: ServiceAppointmentHistoryDay[],
    todayDateKey: string,
  ): FollowupCustomer[] {
    const byId: Map<string, CustomerAssetSummary> = new Map(
      customers.map((customer: CustomerAssetSummary) => [customer.id, customer]),
    );
    const aliases: Map<string, CustomerAssetSummary[]> = new Map();
    customers.forEach((customer: CustomerAssetSummary) => {
      [customer.name, customer.nickname || '']
        .map((name: string) => normalizeName(name))
        .filter(Boolean)
        .forEach((name: string) => {
          aliases.set(name, [...(aliases.get(name) || []), customer]);
        });
    });

    const latestVisits: Map<string, CustomerVisit> = new Map();
    days.forEach((day: ServiceAppointmentHistoryDay) => {
      if (day.date >= todayDateKey) return;
      day.appointments.forEach((appointment: ServiceAppointment) => {
        const customer: CustomerAssetSummary | undefined =
          this.findAppointmentCustomer(appointment, byId, aliases);
        if (!customer) return;
        const current: CustomerVisit | undefined = latestVisits.get(customer.id);
        if (!current || day.date > current.date) {
          latestVisits.set(customer.id, { customer, date: day.date, appointment });
        }
      });
    });

    return Array.from(latestVisits.values())
      .flatMap((visit: CustomerVisit): FollowupCustomer[] => {
        const stage: FollowupCustomer['stage'] | undefined = followupStageFor(
          visit.date,
          todayDateKey,
        );
        if (!stage) return [];
        return [{ ...visit, stage, content: this.followupContent(visit, stage) }];
      })
      .sort((left: FollowupCustomer, right: FollowupCustomer) =>
        left.stage.localeCompare(right.stage) ||
        left.appointment.time.localeCompare(right.appointment.time) ||
        left.customer.name.localeCompare(right.customer.name, 'zh-CN'),
      );
  }

  private followupTaskId(item: FollowupCustomer, dateKey: string): string {
    return `${dateKey}:${item.customer.id}:${item.stage}`;
  }

  private followupStateKey(taskId: string): string {
    return `followup:${taskId}`;
  }

  private async getFollowupTaskStates(): Promise<Map<string, FollowupTaskState>> {
    const rows: Array<{ configKey: string; configValue: string }> =
      await this.database
        .select({
          configKey: serviceConfig.configKey,
          configValue: serviceConfig.configValue,
        })
        .from(serviceConfig)
        .where(like(serviceConfig.configKey, 'followup:%'));
    const states: Map<string, FollowupTaskState> = new Map();
    rows.forEach((row: { configKey: string; configValue: string }) => {
      try {
        const parsed: FollowupTaskState = JSON.parse(
          row.configValue,
        ) as FollowupTaskState;
        if (!Array.isArray(parsed.evidence) || !parsed.completedAt) return;
        states.set(row.configKey.slice('followup:'.length), parsed);
      } catch {
        this.logger.warn(`回访任务状态无法解析: ${row.configKey}`);
      }
    });
    return states;
  }

  private findAppointmentCustomer(
    appointment: ServiceAppointment,
    byId: Map<string, CustomerAssetSummary>,
    aliases: Map<string, CustomerAssetSummary[]>,
  ): CustomerAssetSummary | undefined {
    const assetId: string | undefined = appointment.customerAsset?.assetId;
    if (assetId && byId.has(assetId)) return byId.get(assetId);
    const matches: CustomerAssetSummary[] = [
      appointment.name,
      appointment.nickname,
    ]
      .map((name: string) => normalizeName(name || ''))
      .filter(Boolean)
      .flatMap((name: string) => aliases.get(name) || []);
    const unique: CustomerAssetSummary[] = Array.from(
      new Map(
        matches.map((customer: CustomerAssetSummary) => [customer.id, customer]),
      ).values(),
    );
    return unique.length === 1 ? unique[0] : undefined;
  }

  private followupContent(
    visit: CustomerVisit,
    stage: FollowupCustomer['stage'],
  ): string {
    const profileRule: string | undefined = visit.customer.followupRules[0];
    if (profileRule) return `档案重点：${safeText(profileRule)}`;
    if (stage === 'D+1') {
      return '询问舒适度、泛红、刺痛、紧绷和居家护理执行情况。';
    }
    if (stage === 'D+3') {
      return '确认真实效果、同光线对比、客户主观感受和护理反馈。';
    }
    return '结合效果、项目余次和皮肤周期给出下次到店建议。';
  }

  private async getNotificationMentions(): Promise<ServiceMentionUser[]> {
    try {
      const roles: ForceRoleDTO[] = await this.authorizationSDK.roles.list({
        needMember: true,
      });
      const roleLabels: Map<string, string> = new Map([
        [STORE_OWNER_ROLE, '老板'],
        [FRONT_DESK_ROLE, '前台'],
      ]);
      const byUserId: Map<string, ServiceMentionUser> = new Map();
      roles
        .filter((role: ForceRoleDTO) => roleLabels.has(role.bizID || ''))
        .forEach((role: ForceRoleDTO) => {
          const roleLabel: string = roleLabels.get(role.bizID || '') || '负责人';
          const members: UserSimpleDTO[] = role.roleMembers?.userList || [];
          members.forEach((member: UserSimpleDTO) => {
            const userId: string =
              member.employeeID ||
              (member.userID?.startsWith('ou_') ? member.userID : '');
            if (!userId) return;
            const name: string =
              member.name?.zh_cn || member.name?.en_us || '相关负责人';
            const existing: ServiceMentionUser | undefined = byUserId.get(userId);
            byUserId.set(userId, {
              userId,
              name: safeText(existing?.name || name),
              role: existing ? `${existing.role}、${roleLabel}` : roleLabel,
            });
          });
        });
      if (!Array.from(byUserId.values()).some(
        (mention: ServiceMentionUser) => mention.role.includes('老板'),
      )) {
        byUserId.set(DEFAULT_OWNER_MENTION.userId, DEFAULT_OWNER_MENTION);
      }
      return Array.from(byUserId.values());
    } catch (error) {
      const message: string = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`读取老板与前台角色失败，使用老板兜底提醒: ${message}`);
      return [DEFAULT_OWNER_MENTION];
    }
  }

  private mentionLine(mentions: ServiceMentionUser[]): string {
    return mentions
      .map(
        (mention: ServiceMentionUser) =>
          `<at user_id="${mention.userId}">${safeText(mention.name)}</at>` +
          `（${safeText(mention.role)}）`,
      )
      .join(' ');
  }

  private buildBirthdayMessage(
    customers: CustomerAssetSummary[],
    total: number,
    targetDateKey: string,
    mentions: ServiceMentionUser[],
    chunkIndex: number,
    chunkCount: number,
  ): string {
    const partLabel: string = chunkCount > 1
      ? `｜第${chunkIndex + 1}/${chunkCount}组`
      : '';
    const customerLines: string[] = customers.flatMap(
      (customer: CustomerAssetSummary, index: number): string[] => {
        const owner: string = customer.serviceStaff.join('、') || '前台待分配';
        const tier: CustomerPrivilegeTier = privilegeTierForText(
          customer.memberLevel,
        ) || '追光者';
        const script: string = this.birthdayScript(customer.name, tier);
        const ritualLines: string[] = tier === '蕴光主'
          ? [
              '   店内仪式：预留包间，完成投影、鲜花和灯光生日布置。',
              '   协同执行：当次美容师与前台共同准备，到店前完成复核。',
            ]
          : [];
        return [
          `${chunkIndex * NOTICE_CHUNK_SIZE + index + 1}. ${safeText(customer.name)}` +
            `｜${tier}` +
            `｜${maskedMobile(customer.mobile)}`,
          `   熟悉员工：${safeText(owner)}｜生日：${chineseDate(targetDateKey)}`,
          `   可直接复制话术：${script}`,
          ...ritualLines,
        ];
      },
    );
    return [
      this.mentionLine(mentions),
      `🎂 两天后生日客户提醒｜${chineseDate(targetDateKey)}${partLabel}`,
      `客户资料库共识别 ${total} 位特权卡生日客户：`,
      ...customerLines,
      '执行要求：追光者、绘光师发送生日祝福；蕴光主同步启动店内生日仪式准备。',
      '沟通原则：先真诚祝福，不把生日提醒直接变成促销。',
      '通知对象：老板与前台（按员工角色权限自动更新）。',
    ].join('\n');
  }

  private birthdayScript(
    customerName: string,
    tier: CustomerPrivilegeTier,
  ): string {
    const name: string = safeText(customerName);
    if (tier === '追光者') {
      return `亲爱的${name}，提前祝您生日快乐！愿新的一岁依然明亮、自在，每一天都有好状态和好心情。壹心壹意医疗美容一直记得您，也一直在这里陪伴您。`;
    }
    if (tier === '绘光师') {
      return `亲爱的${name}，提前祝您生日快乐！愿新的一岁里，您继续把生活绘成自己喜欢的样子，被温柔对待，也始终自信闪耀。感谢您一直信任壹心壹意医疗美容。`;
    }
    return `亲爱的${name}，提前祝您生日快乐！愿新的一岁光芒蕴藏、万事从容，每一份热爱都得到回应。谢谢您把美丽与信任交给壹心壹意医疗美容，我们为您准备了一份专属生日仪式，期待陪您度过一段美好时光。`;
  }

  private buildFollowupMessage(
    followups: FollowupCustomer[],
    total: number,
    todayDateKey: string,
    mentions: ServiceMentionUser[],
    chunkIndex: number,
    chunkCount: number,
  ): string {
    const partLabel: string = chunkCount > 1
      ? `｜第${chunkIndex + 1}/${chunkCount}组`
      : '';
    const customerLines: string[] = followups.flatMap(
      (item: FollowupCustomer, index: number): string[] => {
        const responsible: string = item.appointment.technician;
        return [
          `${chunkIndex * NOTICE_CHUNK_SIZE + index + 1}. ` +
            `${safeText(item.customer.name)}｜${item.stage}｜${maskedMobile(
              item.customer.mobile,
            )}`,
          `   上次：${chineseDate(item.date)} ${safeText(
            item.appointment.project,
          )}｜技师：${safeText(item.appointment.technician)}`,
          `   负责人：${safeText(responsible)}｜${item.content}`,
        ];
      },
    );
    return [
      this.mentionLine(mentions),
      `📞 今日客户回访名单｜${chineseDate(todayDateKey)}${partLabel}`,
      `今天共有 ${total} 位客户到达 D+1 / D+3 / D+21 回访节点：`,
      ...customerLines,
      '完成要求：由上一次服务员工执行，上传回访图片凭证后点击“执行完成”；异常立即同步老板。',
      '通知对象：老板与前台（按员工角色权限自动更新）。',
    ].join('\n');
  }

  private chunkItems<T>(items: T[]): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += NOTICE_CHUNK_SIZE) {
      chunks.push(items.slice(index, index + NOTICE_CHUNK_SIZE));
    }
    return chunks;
  }

  private async sendNoticeMessages(
    kind: 'birthday' | 'followup',
    dateKey: string,
    matchedCustomers: number,
    messages: string[],
  ): Promise<AutomatedReminderResult> {
    let sentMessages: number = 0;
    let skippedMessages: number = 0;
    for (let index = 0; index < messages.length; index += 1) {
      const marker: string = `auto_notice:${kind}:${dateKey}:${index + 1}`;
      if (await this.serviceDeskService.hasAutomatedNoticeBeenSent(marker)) {
        skippedMessages += 1;
        continue;
      }
      await this.serviceDeskService.sendAutomatedGroupMessage(messages[index]);
      await this.serviceDeskService.markAutomatedNoticeSent(marker);
      sentMessages += 1;
    }
    return { matchedCustomers, sentMessages, skippedMessages };
  }
}
