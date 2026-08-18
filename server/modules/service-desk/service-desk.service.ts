import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { createHash, createHmac } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { eq, inArray, like } from 'drizzle-orm';

import { serviceConfig, serviceState } from '@server/database/schema';
import type {
  AppointmentMutationResponse,
  CompleteServiceRequest,
  CompleteServiceResponse,
  ConfigureServiceRequest,
  ConfigureServiceResponse,
  SaveServiceAppointmentRequest,
  SaveServiceAppointmentResponse,
  ServiceActor,
  ServiceAppointment,
  ServiceAppointmentHistoryDay,
  ServiceAppointmentHistoryResponse,
  ServiceAppointmentSchedule,
  ServiceAppointmentsResponse,
  ServiceFeishuConfig,
  ServiceMentionUser,
  ServiceRoleResponse,
  ServiceStaffRole,
  ServiceStaffSchedule,
  ServiceStaffShift,
  ServiceStateResponse,
  UpdateServiceAssignmentRequest,
  UpdateServiceAssignmentResponse,
  UpdateServiceStaffScheduleRequest,
  UpdateServiceStaffScheduleResponse,
  UpdateServiceStateRequest,
} from '@shared/api.interface';
import {
  FRONT_DESK_ROLE,
  NURSE_ROLE,
  SKIN_MANAGER_ROLE,
  STORE_OWNER_ROLE,
  hasRole,
  isStoreOwnerRole,
  sanitizeStoreRoles,
} from '../../../shared/role.constants';
import { CustomerAssetService } from '../customer-asset/customer-asset.service';

interface ConfigRow {
  configKey: string;
  configValue: string;
}

interface AppointmentConfigRow extends ConfigRow {
  updatedAt: Date;
}

interface AppointmentProgressRow {
  appointmentId: string;
  completedTaskIds: string;
}

interface FeishuWebhookResponse {
  code?: number;
  msg?: string;
  StatusCode?: number;
  StatusMessage?: string;
}

const STAGE_TASK_IDS: Record<string, string[]> = {
  preparation: [
    'room_light',
    'room_scent',
    'room_temp',
    'room_bed',
    'room_tray',
    'room_music',
    'room_photo',
    'tech_schedule',
    'tech_preview',
    'tech_project',
    'tech_history',
    'travel_care',
    'travel_car',
    'travel_walk',
    'drink_confirm',
  ],
  arrival: [
    'arrival_greet',
    'arrival_nosay',
    'arrival_sofa',
    'arrival_project',
    'arrival_drink',
    'arrival_shoes',
    'arrival_bag',
    'arrival_room_check',
  ],
  consultation: [
    'consult_history',
    'consult_nursing',
    'consult_goal',
    'consult_sop',
    'consult_script',
    'consult_enhance',
  ],
  in_service: [
    'service_temp',
    'service_blanket',
    'service_head',
    'service_no_privacy',
    'service_praise',
    'service_ask',
  ],
  post_service: [
    'post_meal',
    'post_mirror',
    'post_valuables',
    'post_bag',
    'post_seat',
    'post_escort',
  ],
  follow_up: [
    'follow_env',
    'follow_pressure',
    'follow_concern',
    'follow_new_pref',
    'follow_new_info',
    'follow_archive',
  ],
};

const KNOWN_TASK_IDS: string[] = Object.values(STAGE_TASK_IDS).flat();
const PREPARATION_TASK_IDS: string[] = STAGE_TASK_IDS.preparation;
const LEGACY_TASK_ID_MAP: Record<string, string[]> = {
  room: ['room_light', 'room_temp'],
  scent: ['room_scent', 'room_music'],
  bed: ['room_bed', 'room_tray'],
  photo: ['room_photo'],
  tech: ['tech_schedule', 'tech_preview', 'tech_project', 'tech_history'],
  route: ['travel_care', 'travel_car', 'travel_walk'],
  drink: ['drink_confirm'],
  arrival_belongings: ['arrival_bag'],
  arrival_confirm: ['arrival_project'],
  arrival_handoff: ['arrival_room_check'],
  consult_skin: ['consult_history'],
  consult_health: ['consult_nursing'],
  consult_plan: ['consult_sop', 'consult_script'],
  consult_confirm: ['consult_enhance'],
  service_temperature: ['service_temp'],
  service_comfort: ['service_blanket', 'service_head', 'service_ask'],
  service_privacy: ['service_no_privacy'],
  post_compare: ['post_mirror'],
  post_feedback: ['post_mirror'],
  post_advice: ['post_meal'],
  post_record: ['post_valuables'],
  post_checkout: ['post_seat'],
  follow_profile: ['follow_env', 'follow_pressure', 'follow_concern'],
  follow_d1: ['follow_new_pref'],
  follow_d3: ['follow_new_info'],
};

const CONFIG_KEYS: string[] = [
  'webhook_url',
  'webhook_sign_secret',
  'action_pin_hash',
  'chat_url',
];

const DELETED_APPOINTMENT_PREFIX = 'deleted_appointment:';
const APPOINTMENTS_CONFIG_KEY = 'appointments_json';
const APPOINTMENT_DAY_PREFIX = 'appointments_day:';
const STAFF_SCHEDULE_PREFIX = 'staff_schedule:';
const LEGACY_APPOINTMENT_DATE = '2026-08-07';
const STAFF_DIRECTORY: Array<{
  staffName: string;
  role: ServiceStaffRole;
  roleLabel: string;
  defaultShift: Exclude<ServiceStaffShift, '休息'>;
}> = [
  { staffName: '欣欣', role: 'skin_manager', roleLabel: '皮肤管理师', defaultShift: '早班' },
  { staffName: '冉冉', role: 'skin_manager', roleLabel: '皮肤管理师', defaultShift: '晚班' },
  { staffName: '思思', role: 'skin_manager', roleLabel: '皮肤管理师', defaultShift: '早班' },
  { staffName: '万万', role: 'nurse', roleLabel: '护士', defaultShift: '早班' },
  { staffName: '红红', role: 'front_desk', roleLabel: '前台', defaultShift: '早班' },
  { staffName: '岗岗', role: 'front_desk', roleLabel: '前台', defaultShift: '晚班' },
];

@Injectable()
export class ServiceDeskService {
  private readonly logger = new Logger(ServiceDeskService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly database: PostgresJsDatabase,
    private readonly httpService: HttpService,
    private readonly customerAssetService: CustomerAssetService,
  ) {}

  async getState(appointmentId: string): Promise<ServiceStateResponse> {
    const normalizedId: string = this.normalizeAppointmentId(appointmentId);
    let rows = await this.database
      .select()
      .from(serviceState)
      .where(eq(serviceState.appointmentId, normalizedId))
      .limit(1);
    const legacyId: string | undefined = this.legacyAppointmentId(normalizedId);
    if (rows.length === 0 && legacyId) {
      rows = await this.database
        .select()
        .from(serviceState)
        .where(eq(serviceState.appointmentId, legacyId))
        .limit(1);
    }
    const config: Map<string, string> = await this.getConfig();
    const assignedTechnician: string | undefined =
      (await this.getAssignedTechnician(normalizedId)) ||
      (legacyId ? await this.getAssignedTechnician(legacyId) : undefined);
    const row = rows[0];

    return {
      appointmentId: normalizedId,
      completedTaskIds: row
        ? this.parseTaskIds(row.completedTaskIds)
        : this.defaultTaskIds(normalizedId),
      assignedTechnician,
      actor: {
        displayName: row?.actorName || '数据前台',
        userId: row?.actorUserId || undefined,
      },
      updatedAt: row?.updatedAt?.toISOString(),
      feishu: this.buildFeishuConfig(config),
    };
  }

  async getRole(actor: ServiceActor): Promise<ServiceRoleResponse> {
    const activeRoles = sanitizeStoreRoles(actor.roles);
    const scopedActor: ServiceActor = { ...actor, roles: activeRoles };
    const isOwner = this.isOwner(scopedActor);
    const isFrontDesk = hasRole(activeRoles, FRONT_DESK_ROLE);
    const isSkinManager = hasRole(activeRoles, SKIN_MANAGER_ROLE);
    const isNurse = hasRole(activeRoles, NURSE_ROLE);
    const jobRole = isOwner
      ? 'owner'
      : isFrontDesk
        ? 'front_desk'
        : isSkinManager
          ? 'skin_manager'
          : isNurse
            ? 'nurse'
            : 'unassigned';
    const canEditAppointments = isOwner || isFrontDesk;
    const hasStoreRole = jobRole !== 'unassigned';
    const permissions = {
      viewOwnerPortal: isOwner,
      viewEmployeePortal: hasStoreRole,
      viewCustomerAssets: isOwner || isFrontDesk,
      viewCustomerReminders: isOwner || isFrontDesk,
      viewPriorityClients: isOwner || isFrontDesk,
      viewAllAppointments: hasStoreRole,
      executeOwnTasks: hasStoreRole,
      editAppointments: canEditAppointments,
      editStaffSchedule: canEditAppointments,
      manageStaffRoles: isOwner || isFrontDesk,
      checkout: canEditAppointments,
      manageInventory: canEditAppointments,
    };
    return {
      actor: scopedActor,
      role: isOwner ? 'owner' : 'employee',
      jobRole,
      permissionVersion: '2026-08-17-inventory-scope-v3',
      permissions,
      canDelete: isOwner,
      canEditAppointments,
      canEditStaffSchedule: canEditAppointments,
      canManageStaffRoles: permissions.manageStaffRoles,
      deletedAppointmentIds: isOwner
        ? await this.getDeletedAppointmentIds()
        : [],
    };
  }

  async getAppointments(): Promise<ServiceAppointmentsResponse> {
    const rows: Array<{
      configValue: string;
      updatedAt: Date;
    }> = await this.database
      .select({
        configValue: serviceConfig.configValue,
        updatedAt: serviceConfig.updatedAt,
      })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, APPOINTMENTS_CONFIG_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) return { appointments: [] };

    try {
      const parsed = JSON.parse(row.configValue) as ServiceAppointmentsResponse;
      const appointmentsWithProgress: ServiceAppointment[] =
        await this.applyServiceProgress(
          this.normalizeAppointments(parsed.appointments),
          this.normalizeServiceDate(parsed.schedule?.date || ''),
        );
      const appointments: ServiceAppointment[] =
        await this.customerAssetService.enrichAppointments(
          appointmentsWithProgress,
        );
      return {
        appointments,
        schedule: parsed.schedule,
        staffSchedules: await this.getStaffSchedules(parsed.schedule?.date || ''),
        updatedAt: row.updatedAt?.toISOString(),
      };
    } catch {
      this.logger.error('预约表配置无法解析');
      return { appointments: [] };
    }
  }

  async getAppointmentHistory(): Promise<ServiceAppointmentHistoryResponse> {
    const archivedRows: AppointmentConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
        updatedAt: serviceConfig.updatedAt,
      })
      .from(serviceConfig)
      .where(like(serviceConfig.configKey, `${APPOINTMENT_DAY_PREFIX}%`));
    const latestRows: AppointmentConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
        updatedAt: serviceConfig.updatedAt,
      })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, APPOINTMENTS_CONFIG_KEY))
      .limit(1);

    const byDate = new Map<string, ServiceAppointmentHistoryDay>();
    archivedRows.forEach((row: AppointmentConfigRow) => {
      const dateHint: string = row.configKey.slice(
        APPOINTMENT_DAY_PREFIX.length,
      );
      const day: ServiceAppointmentHistoryDay | null =
        this.parseAppointmentHistoryDay(row, dateHint);
      if (day) byDate.set(day.date, day);
    });
    const latestRow: AppointmentConfigRow | undefined = latestRows[0];
    if (latestRow) {
      const latestDay: ServiceAppointmentHistoryDay | null =
        this.parseAppointmentHistoryDay(latestRow);
      if (latestDay && !byDate.has(latestDay.date)) {
        byDate.set(latestDay.date, latestDay);
      }
    }

    const rawDays: ServiceAppointmentHistoryDay[] = Array.from(
      byDate.values(),
    ).sort((left: ServiceAppointmentHistoryDay, right: ServiceAppointmentHistoryDay) =>
      left.date.localeCompare(right.date),
    );
    const days: ServiceAppointmentHistoryDay[] = await Promise.all(
      rawDays.map(
        async (
          day: ServiceAppointmentHistoryDay,
        ): Promise<ServiceAppointmentHistoryDay> => ({
          ...day,
          appointments: await this.customerAssetService.enrichAppointments(
            await this.applyServiceProgress(day.appointments, day.date),
          ),
          staffSchedules: await this.getStaffSchedules(day.date),
        }),
      ),
    );
    return {
      days,
      updatedAt: days.at(-1)?.updatedAt,
    };
  }

  async saveAppointment(
    request: SaveServiceAppointmentRequest,
    actor: ServiceActor,
  ): Promise<SaveServiceAppointmentResponse> {
    this.assertAppointmentEditor(actor);
    const date = this.normalizeServiceDate(request.date);
    if (!date) throw new BadRequestException('预约日期不正确');

    const input = request.appointment;
    const time = input.time?.trim();
    const name = input.name?.trim();
    const project = input.project?.trim();
    const room = input.room?.trim();
    const technician = input.technician?.trim();
    const hasNurseSelection = typeof input.nurse === 'string';
    const hasFrontDeskSelection = typeof input.frontDesk === 'string';
    const nurse = input.nurse?.trim() || undefined;
    const frontDesk = input.frontDesk?.trim() || undefined;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(time)) {
      throw new BadRequestException('到店时间不正确');
    }
    if (!name || name.length > 40) {
      throw new BadRequestException('请填写客户姓名');
    }
    if (!project || project.length > 120) {
      throw new BadRequestException('请填写服务项目');
    }
    if (!room || room.length > 20) {
      throw new BadRequestException('请填写服务房间');
    }
    const technicianProfile = STAFF_DIRECTORY.find(
      (staff) => staff.staffName === technician && staff.role === 'skin_manager',
    );
    if (!technicianProfile) {
      throw new BadRequestException('请选择在岗的皮肤管理师');
    }
    const nurseProfile = nurse
      ? STAFF_DIRECTORY.find(
          (staff) => staff.staffName === nurse && staff.role === 'nurse',
        )
      : undefined;
    if (nurse && !nurseProfile) {
      throw new BadRequestException('请选择正确的协作护士');
    }
    const frontDeskProfile = frontDesk
      ? STAFF_DIRECTORY.find(
          (staff) =>
            staff.staffName === frontDesk && staff.role === 'front_desk',
        )
      : undefined;
    if (frontDesk && !frontDeskProfile) {
      throw new BadRequestException('请选择正确的当班前台');
    }
    const schedules = await this.getStaffSchedules(date);
    const technicianSchedule = schedules.find(
      (schedule) => schedule.staffName === technician,
    );
    if (technicianSchedule?.shift === '休息') {
      throw new ConflictException(`${technician}当天休息，不能安排预约`);
    }
    const nurseSchedule = nurse
      ? schedules.find((schedule) => schedule.staffName === nurse)
      : undefined;
    if (nurseSchedule?.shift === '休息') {
      throw new ConflictException(`${nurse}当天休息，不能安排协作护理`);
    }
    const frontDeskSchedule = frontDesk
      ? schedules.find((schedule) => schedule.staffName === frontDesk)
      : undefined;
    if (frontDeskSchedule?.shift === '休息') {
      throw new ConflictException(`${frontDesk}当天休息，不能设为当班前台`);
    }

    const day = (await this.readAppointmentDay(date)) || {
      date,
      appointments: [],
      schedule: {
        date,
        label: this.formatServiceDate(date),
        weekday: this.formatServiceWeekday(date),
        note: '由老板或前台手动创建预约',
        sourceName: '工作台手动预约',
      },
    };
    const currentAppointments = this.normalizeAppointments(day.appointments);
    const requestedId = Number(input.id);
    const existing = Number.isInteger(requestedId)
      ? currentAppointments.find((item) => item.id === requestedId)
      : undefined;
    if (input.id !== undefined && !existing) {
      throw new BadRequestException('要修改的预约不存在，请刷新后重试');
    }
    const nextId = existing
      ? existing.id
      : Math.max(0, ...currentAppointments.map((item) => item.id)) + 1;
    const appointment: ServiceAppointment = existing
      ? {
          ...existing,
          time,
          name,
          nickname: existing.nickname || name.slice(-2),
          project,
          room,
          fixedTechnician: technician,
          technician,
          nurse: hasNurseSelection ? nurse : existing.nurse,
          frontDesk: hasFrontDeskSelection ? frontDesk : existing.frontDesk,
          amount: input.amount?.trim() || existing.amount,
        }
      : {
          id: nextId,
          time,
          name,
          nickname: name.slice(-2),
          project,
          room,
          fixedTechnician: technician,
          technician,
          nurse,
          frontDesk,
          status: '待到店',
          member: '待识别客户',
          accent: '#5c78d8',
          amount: input.amount?.trim() || '待确认',
          tags: ['新预约', '待建档'],
        };
    const appointments = existing
      ? currentAppointments.map((item) =>
          item.id === appointment.id ? appointment : item,
        )
      : [...currentAppointments, appointment];
    const updatedAt = new Date();
    await this.persistAppointmentDay(
      {
        ...day,
        appointments: appointments.sort((left, right) =>
          left.time.localeCompare(right.time),
        ),
      },
      updatedAt,
    );
    return {
      saved: true,
      appointment,
      actor,
      updatedAt: updatedAt.toISOString(),
    };
  }

  async updateStaffSchedule(
    request: UpdateServiceStaffScheduleRequest,
    actor: ServiceActor,
  ): Promise<UpdateServiceStaffScheduleResponse> {
    this.assertAppointmentEditor(actor);
    const date = this.normalizeServiceDate(request.date);
    if (!date) throw new BadRequestException('排班日期不正确');
    const staff = STAFF_DIRECTORY.find(
      (item) => item.staffName === request.staffName?.trim(),
    );
    if (!staff) throw new BadRequestException('员工不存在');
    const shift = request.shift;
    if (!['早班', '晚班', '休息'].includes(shift)) {
      throw new BadRequestException('班次不存在');
    }
    if (shift === '休息' && staff.role === 'skin_manager') {
      const day = await this.readAppointmentDay(date);
      const assignedCount = day?.appointments.filter(
        (appointment) => appointment.technician === staff.staffName,
      ).length;
      if (assignedCount) {
        throw new ConflictException(
          `${staff.staffName}当天已有 ${assignedCount} 位预约，请先调整预约技师`,
        );
      }
    }
    const current = await this.getStaffSchedules(date);
    const schedules = current.map((schedule) =>
      schedule.staffName === staff.staffName
        ? this.buildStaffSchedule(date, staff, shift)
        : schedule,
    );
    const updatedAt = new Date();
    await this.upsertConfig(
      `${STAFF_SCHEDULE_PREFIX}${date}`,
      JSON.stringify(schedules),
      updatedAt,
    );
    return {
      saved: true,
      schedules,
      actor,
      updatedAt: updatedAt.toISOString(),
    };
  }

  async updateState(
    request: UpdateServiceStateRequest,
    actor: ServiceActor,
  ): Promise<ServiceStateResponse> {
    const appointmentId: string = this.normalizeAppointmentId(
      request.appointmentId,
    );
    const taskId: string = request.taskId?.trim();
    if (!KNOWN_TASK_IDS.includes(taskId)) {
      throw new BadRequestException('服务动作不存在');
    }
    await this.assertCanOperateAppointment(appointmentId, actor);
    if (!request.completed) {
      this.assertOwner(actor, '只有老板可以取消已完成的执行记录');
    }

    const current: ServiceStateResponse = await this.getState(appointmentId);
    const nextTaskIds: string[] = request.completed
      ? Array.from(new Set([...current.completedTaskIds, taskId]))
      : current.completedTaskIds.filter((item: string) => item !== taskId);
    const updatedAt: Date = new Date();

    await this.database
      .insert(serviceState)
      .values({
        appointmentId,
        completedTaskIds: JSON.stringify(nextTaskIds),
        actorName: actor.displayName,
        actorUserId: actor.userId,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: serviceState.appointmentId,
        set: {
          completedTaskIds: JSON.stringify(nextTaskIds),
          actorName: actor.displayName,
          actorUserId: actor.userId,
          updatedAt,
        },
      });

    return {
      ...current,
      completedTaskIds: nextTaskIds,
      actor,
      updatedAt: updatedAt.toISOString(),
    };
  }

  async updateAssignment(
    request: UpdateServiceAssignmentRequest,
    actor: ServiceActor,
  ): Promise<UpdateServiceAssignmentResponse> {
    const appointmentId: string = this.normalizeAppointmentId(
      request.appointmentId,
    );
    this.assertAppointmentEditor(actor);
    const technician: string = request.technician?.trim();
    if (!technician || technician.length < 2 || technician.length > 20) {
      throw new BadRequestException('请填写2至20个字的本次服务技师姓名');
    }
    if (/[<>\r\n]/u.test(technician)) {
      throw new BadRequestException('本次服务技师姓名包含无效字符');
    }

    const updatedAt = new Date();
    await this.upsertConfig(
      this.assignmentConfigKey(appointmentId),
      technician,
      updatedAt,
    );

    return {
      saved: true,
      appointmentId,
      assignedTechnician: technician,
      actor,
      updatedAt: updatedAt.toISOString(),
    };
  }

  async completeService(
    request: CompleteServiceRequest,
    actor: ServiceActor,
  ): Promise<CompleteServiceResponse> {
    const appointmentId: string = this.normalizeAppointmentId(
      request.appointmentId,
    );
    await this.assertCanOperateAppointment(appointmentId, actor);
    const completedTaskIds: string[] = this.parseTaskIds(
      JSON.stringify(request.completedTaskIds),
    );
    const stageId: string = request.stageId?.trim();
    const stageTaskIds: string[] | undefined = STAGE_TASK_IDS[stageId];
    if (!stageTaskIds) {
      throw new BadRequestException('服务阶段不存在');
    }
    const missingTaskIds: string[] = stageTaskIds.filter(
      (taskId: string) => !completedTaskIds.includes(taskId),
    );
    if (missingTaskIds.length > 0) {
      throw new BadRequestException(
        `请先完成本阶段剩余 ${missingTaskIds.length} 项动作`,
      );
    }

    const updatedAt: Date = new Date();
    await this.database
      .insert(serviceState)
      .values({
        appointmentId,
        completedTaskIds: JSON.stringify(completedTaskIds),
        actorName: actor.displayName,
        actorUserId: actor.userId,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: serviceState.appointmentId,
        set: {
          completedTaskIds: JSON.stringify(completedTaskIds),
          actorName: actor.displayName,
          actorUserId: actor.userId,
          updatedAt,
        },
      });

    const config: Map<string, string> = await this.getConfig();
    const webhookUrl: string | undefined = config.get('webhook_url');
    if (!webhookUrl) {
      throw new ServiceUnavailableException('飞书群机器人尚未连接');
    }

    const syncKey: string = this.buildStageSyncKey(
      appointmentId,
      stageId,
      updatedAt,
    );
    const previousSync = await this.database
      .select({ configKey: serviceConfig.configKey })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, syncKey))
      .limit(1);
    if (previousSync.length > 0) {
      return {
        saved: true,
        sent: true,
        duplicate: true,
        mentionCount: this.normalizeMentions(request.mentionUsers).length,
        chatUrl: config.get('chat_url'),
      };
    }

    const message: string = this.buildCompletionMessage(
      request,
      actor,
      updatedAt,
      stageTaskIds.length,
    );
    await this.sendWebhook(
      webhookUrl,
      config.get('webhook_sign_secret'),
      message,
    );
    await this.upsertConfig(syncKey, updatedAt.toISOString(), updatedAt);

    return {
      saved: true,
      sent: true,
      duplicate: false,
      mentionCount: this.normalizeMentions(request.mentionUsers).length,
      chatUrl: config.get('chat_url'),
    };
  }

  async configure(
    request: ConfigureServiceRequest,
    actor: ServiceActor,
  ): Promise<ConfigureServiceResponse> {
    this.assertOwner(actor, '只有老板可以修改群机器人配置');
    const config: Map<string, string> = await this.getConfig();
    if (config.has('webhook_url')) {
      throw new ConflictException('飞书群已经连接，无需重复配置');
    }

    const webhookUrl: string = request.webhookUrl?.trim();
    const signSecret: string = request.signSecret?.trim() || '';
    this.assertWebhookUrl(webhookUrl);

    const updatedAt: Date = new Date();
    await this.upsertConfig('webhook_url', webhookUrl, updatedAt);
    if (signSecret) {
      await this.upsertConfig('webhook_sign_secret', signSecret, updatedAt);
    }

    return {
      configured: true,
      chatUrlConfigured: config.has('chat_url'),
    };
  }

  async sendAutomatedGroupMessage(message: string): Promise<void> {
    const config: Map<string, string> = await this.getConfig();
    const webhookUrl: string | undefined = config.get('webhook_url');
    if (!webhookUrl) {
      throw new ServiceUnavailableException('飞书群机器人尚未连接');
    }
    await this.sendWebhook(
      webhookUrl,
      config.get('webhook_sign_secret'),
      message,
    );
  }

  async hasAutomatedNoticeBeenSent(configKey: string): Promise<boolean> {
    const rows: Array<{ configKey: string }> = await this.database
      .select({ configKey: serviceConfig.configKey })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, configKey))
      .limit(1);
    return rows.length > 0;
  }

  async markAutomatedNoticeSent(configKey: string): Promise<void> {
    const sentAt: Date = new Date();
    await this.upsertConfig(configKey, sentAt.toISOString(), sentAt);
  }

  async deleteAppointment(
    appointmentIdValue: string,
    actor: ServiceActor,
  ): Promise<AppointmentMutationResponse> {
    this.assertOwner(actor, '只有老板可以删除预约');
    const appointmentId = this.normalizeAppointmentId(appointmentIdValue);
    const updatedAt = new Date();
    await this.upsertConfig(
      `${DELETED_APPOINTMENT_PREFIX}${appointmentId}`,
      JSON.stringify({
        deletedBy: actor.displayName,
        deletedByUserId: actor.userId || '',
        deletedAt: updatedAt.toISOString(),
      }),
      updatedAt,
    );
    return {
      saved: true,
      appointmentId,
      deleted: true,
      actor,
      updatedAt: updatedAt.toISOString(),
    };
  }

  async restoreAppointment(
    appointmentIdValue: string,
    actor: ServiceActor,
  ): Promise<AppointmentMutationResponse> {
    this.assertOwner(actor, '只有老板可以恢复预约');
    const appointmentId = this.normalizeAppointmentId(appointmentIdValue);
    const updatedAt = new Date();
    await this.database
      .delete(serviceConfig)
      .where(
        eq(
          serviceConfig.configKey,
          `${DELETED_APPOINTMENT_PREFIX}${appointmentId}`,
        ),
      );
    return {
      saved: true,
      appointmentId,
      deleted: false,
      actor,
      updatedAt: updatedAt.toISOString(),
    };
  }

  private isOwner(actor: ServiceActor): boolean {
    return isStoreOwnerRole(actor.roles);
  }

  private canEditAppointments(actor: ServiceActor): boolean {
    return this.isOwner(actor) || hasRole(actor.roles, FRONT_DESK_ROLE);
  }

  private async assertCanOperateAppointment(
    appointmentId: string,
    actor: ServiceActor,
  ): Promise<void> {
    if (this.canEditAppointments(actor)) return;

    const appointment = (await this.getAppointments()).appointments.find(
      (item) =>
        String(item.id) === appointmentId ||
        appointmentId.endsWith(`:${String(item.id)}`),
    );
    if (!appointment) {
      throw new BadRequestException('预约不存在');
    }

    const actorName = actor.displayName.trim();
    if (
      hasRole(actor.roles, SKIN_MANAGER_ROLE) &&
      appointment.technician.trim() === actorName
    ) {
      return;
    }
    if (
      hasRole(actor.roles, NURSE_ROLE) &&
      appointment.nurse?.trim() === actorName
    ) {
      return;
    }

    throw new ForbiddenException('只能执行分配给自己的客户任务');
  }

  private assertOwner(actor: ServiceActor, message: string): void {
    if (!this.isOwner(actor)) {
      throw new ForbiddenException(message);
    }
  }

  private assertAppointmentEditor(actor: ServiceActor): void {
    if (!this.canEditAppointments(actor)) {
      throw new ForbiddenException('只有老板和前台可以修改预约与排班');
    }
  }

  private buildStaffSchedule(
    date: string,
    staff: (typeof STAFF_DIRECTORY)[number],
    shift: ServiceStaffShift,
  ): ServiceStaffSchedule {
    const hours =
      shift === '早班'
        ? { startTime: '09:00', endTime: '18:00' }
        : shift === '晚班'
          ? { startTime: '11:00', endTime: '20:00' }
          : {};
    return {
      date,
      staffName: staff.staffName,
      role: staff.role,
      roleLabel: staff.roleLabel,
      shift,
      ...hours,
      monthlyRestDays: 4,
    };
  }

  private defaultStaffSchedules(date: string): ServiceStaffSchedule[] {
    return STAFF_DIRECTORY.map((staff) =>
      this.buildStaffSchedule(date, staff, staff.defaultShift),
    );
  }

  private async getStaffSchedules(
    dateValue: string,
  ): Promise<ServiceStaffSchedule[]> {
    const date = this.normalizeServiceDate(dateValue);
    if (!date) return [];
    const rows = await this.database
      .select({ configValue: serviceConfig.configValue })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, `${STAFF_SCHEDULE_PREFIX}${date}`))
      .limit(1);
    if (!rows[0]) return this.defaultStaffSchedules(date);
    try {
      const saved = JSON.parse(rows[0].configValue) as ServiceStaffSchedule[];
      const byName = new Map(saved.map((item) => [item.staffName, item.shift]));
      return STAFF_DIRECTORY.map((staff) =>
        this.buildStaffSchedule(
          date,
          staff,
          byName.get(staff.staffName) || staff.defaultShift,
        ),
      );
    } catch {
      this.logger.error(`员工排班无法解析: ${date}`);
      return this.defaultStaffSchedules(date);
    }
  }

  private async readAppointmentDay(
    date: string,
  ): Promise<ServiceAppointmentHistoryDay | null> {
    const archivedRows: AppointmentConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
        updatedAt: serviceConfig.updatedAt,
      })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, `${APPOINTMENT_DAY_PREFIX}${date}`))
      .limit(1);
    if (archivedRows[0]) {
      return this.parseAppointmentHistoryDay(archivedRows[0], date);
    }
    const latestRows: AppointmentConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
        updatedAt: serviceConfig.updatedAt,
      })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, APPOINTMENTS_CONFIG_KEY))
      .limit(1);
    const latest = latestRows[0]
      ? this.parseAppointmentHistoryDay(latestRows[0])
      : null;
    return latest?.date === date ? latest : null;
  }

  private async persistAppointmentDay(
    day: ServiceAppointmentHistoryDay,
    updatedAt: Date,
  ): Promise<void> {
    const payload = JSON.stringify({
      appointments: day.appointments,
      schedule: { ...day.schedule, date: day.date },
    });
    await this.upsertConfig(
      `${APPOINTMENT_DAY_PREFIX}${day.date}`,
      payload,
      updatedAt,
    );

    const latestRows = await this.database
      .select({ configValue: serviceConfig.configValue })
      .from(serviceConfig)
      .where(eq(serviceConfig.configKey, APPOINTMENTS_CONFIG_KEY))
      .limit(1);
    let latestDate = '';
    try {
      const latest = latestRows[0]
        ? (JSON.parse(latestRows[0].configValue) as ServiceAppointmentsResponse)
        : undefined;
      latestDate = this.normalizeServiceDate(latest?.schedule?.date || '');
    } catch {
      this.logger.error('最新预约表无法解析，已保留历史日数据');
    }
    if (!latestDate || latestDate === day.date) {
      await this.upsertConfig(APPOINTMENTS_CONFIG_KEY, payload, updatedAt);
    }
  }

  private async getDeletedAppointmentIds(): Promise<string[]> {
    const rows = await this.database
      .select({ configKey: serviceConfig.configKey })
      .from(serviceConfig)
      .where(like(serviceConfig.configKey, `${DELETED_APPOINTMENT_PREFIX}%`));
    return rows.map((row) =>
      row.configKey.slice(DELETED_APPOINTMENT_PREFIX.length),
    );
  }

  private async getConfig(): Promise<Map<string, string>> {
    const rows: ConfigRow[] = await this.database
      .select({
        configKey: serviceConfig.configKey,
        configValue: serviceConfig.configValue,
      })
      .from(serviceConfig)
      .where(inArray(serviceConfig.configKey, CONFIG_KEYS));
    return new Map(
      rows.map((row: ConfigRow): [string, string] => [
        row.configKey,
        row.configValue,
      ]),
    );
  }

  private async getAssignedTechnician(
    appointmentId: string,
  ): Promise<string | undefined> {
    const rows = await this.database
      .select({ configValue: serviceConfig.configValue })
      .from(serviceConfig)
      .where(
        eq(serviceConfig.configKey, this.assignmentConfigKey(appointmentId)),
      )
      .limit(1);
    return rows[0]?.configValue || undefined;
  }

  private assignmentConfigKey(appointmentId: string): string {
    const digest = createHash('sha256')
      .update(appointmentId, 'utf8')
      .digest('hex')
      .slice(0, 40);
    return `assigned_technician_${digest}`;
  }

  private async upsertConfig(
    configKey: string,
    configValue: string,
    updatedAt: Date,
  ): Promise<void> {
    await this.database
      .insert(serviceConfig)
      .values({ configKey, configValue, updatedAt })
      .onConflictDoUpdate({
        target: serviceConfig.configKey,
        set: { configValue, updatedAt },
      });
  }

  private buildFeishuConfig(config: Map<string, string>): ServiceFeishuConfig {
    const chatUrl: string | undefined = config.get('chat_url');
    return {
      webhookConfigured: config.has('webhook_url'),
      chatUrlConfigured: Boolean(chatUrl),
      chatUrl,
    };
  }

  private buildCompletionMessage(
    request: CompleteServiceRequest,
    actor: ServiceActor,
    completedAt: Date,
    stageTaskCount: number,
  ): string {
    const time: string = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(completedAt);

    const mentions: ServiceMentionUser[] = this.normalizeMentions(
      request.mentionUsers,
    );
    const mentionLine: string = mentions
      .map(
        (mention: ServiceMentionUser) =>
          `<at user_id="${mention.userId}">${this.escapeMentionName(mention.name)}</at>（${mention.role}）`,
      )
      .join(' ');
    return [
      mentionLine,
      `✅ ${request.clientName} · ${request.stageName}已完成`,
      `通知岗位：老板/群主、当次技师${request.technician}、行政前台`,
      `服务项目：${request.projectName}`,
      `房间：${request.room}`,
      `服务技师：${request.technician}`,
      `本阶段进度：${stageTaskCount}/${stageTaskCount}`,
      `完成人：${actor.displayName}`,
      `完成时间：${time}`,
      `下一阶段：${request.nextStageName || '本次服务已全部闭环'}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private normalizeMentions(
    value: ServiceMentionUser[] | undefined,
  ): ServiceMentionUser[] {
    if (!Array.isArray(value)) return [];
    const byUserId = new Map<string, ServiceMentionUser>();
    value.forEach((item: ServiceMentionUser) => {
      const userId: string = item?.userId?.trim() || '';
      if (!/^[A-Za-z0-9_-]{2,128}$/u.test(userId) || userId === 'all') return;
      const name: string = this.escapeMentionName(item?.name || '相关负责人');
      const role: string = this.escapeMentionName(item?.role || '相关负责人');
      const existing = byUserId.get(userId);
      byUserId.set(userId, {
        userId,
        name: existing?.name || name,
        role: existing ? `${existing.role}、${role}` : role,
      });
    });
    return Array.from(byUserId.values());
  }

  private escapeMentionName(value: string): string {
    return (
      value
        .replace(/[<>&\r\n]/gu, '')
        .trim()
        .slice(0, 80) || '相关负责人'
    );
  }

  private buildStageSyncKey(
    appointmentId: string,
    stageId: string,
    completedAt: Date,
  ): string {
    const serviceDay: string = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(completedAt);
    const digest: string = createHash('sha256')
      .update(`${appointmentId}|${stageId}|${serviceDay}`, 'utf8')
      .digest('hex')
      .slice(0, 40);
    return `stage_sync_${digest}`;
  }

  private async sendWebhook(
    webhookUrl: string,
    signSecret: string | undefined,
    text: string,
  ): Promise<void> {
    try {
      const timestamp: string = Math.floor(Date.now() / 1000).toString();
      const signature = signSecret
        ? createHmac('sha256', `${timestamp}\n${signSecret}`)
            .update('')
            .digest('base64')
        : undefined;
      const response = await firstValueFrom(
        this.httpService.post<FeishuWebhookResponse>(webhookUrl, {
          ...(signature ? { timestamp, sign: signature } : {}),
          msg_type: 'text',
          content: { text },
        }),
      );
      const result: FeishuWebhookResponse = response.data;
      const succeeded: boolean = result.code === 0 || result.StatusCode === 0;
      if (!succeeded) {
        throw new Error(
          result.msg || result.StatusMessage || '飞书机器人返回失败',
        );
      }
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : '未知错误';
      this.logger.error(`飞书群同步失败: ${errorMessage}`);
      throw new ServiceUnavailableException('飞书群同步失败，请稍后重试');
    }
  }

  private assertWebhookUrl(webhookUrl: string): void {
    try {
      const url: URL = new URL(webhookUrl);
      const allowedHost: boolean =
        url.hostname === 'open.feishu.cn' ||
        url.hostname === 'open.larksuite.com';
      if (!allowedHost || !url.pathname.includes('/open-apis/bot/v2/hook/')) {
        throw new Error('invalid webhook');
      }
    } catch {
      throw new BadRequestException('请输入有效的飞书群机器人 Webhook 地址');
    }
  }

  private normalizeAppointmentId(value: string): string {
    const appointmentId: string = value?.trim();
    if (!appointmentId || appointmentId.length > 64) {
      throw new BadRequestException('预约编号不正确');
    }
    return appointmentId;
  }

  private appointmentRecordId(date: string, appointmentId: number): string {
    return date ? `${date}:${appointmentId}` : String(appointmentId);
  }

  private legacyAppointmentId(appointmentId: string): string | undefined {
    const prefix = `${LEGACY_APPOINTMENT_DATE}:`;
    return appointmentId.startsWith(prefix)
      ? appointmentId.slice(prefix.length)
      : undefined;
  }

  private parseAppointmentHistoryDay(
    row: AppointmentConfigRow,
    dateHint = '',
  ): ServiceAppointmentHistoryDay | null {
    try {
      const parsed = JSON.parse(row.configValue) as ServiceAppointmentsResponse;
      const schedule: ServiceAppointmentSchedule | undefined = parsed.schedule;
      const date: string = this.normalizeServiceDate(
        schedule?.date || dateHint,
      );
      if (!date) return null;
      return {
        date,
        appointments: this.normalizeAppointments(parsed.appointments),
        schedule: {
          date,
          label: schedule?.label || this.formatServiceDate(date),
          weekday: schedule?.weekday || this.formatServiceWeekday(date),
          note: schedule?.note || '历史预约已归档',
          sourceName: schedule?.sourceName || '预约历史归档',
          sourceMessageId: schedule?.sourceMessageId,
          importedAt: schedule?.importedAt,
        },
        updatedAt: row.updatedAt.toISOString(),
      };
    } catch {
      this.logger.error(`预约历史无法解析: ${row.configKey}`);
      return null;
    }
  }

  private normalizeServiceDate(value: string): string {
    const normalized: string = value?.trim() || '';
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return '';
    const date: Date = new Date(`${normalized}T12:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? '' : normalized;
  }

  private formatServiceDate(dateValue: string): string {
    const parts: string[] = dateValue.split('-');
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  }

  private formatServiceWeekday(dateValue: string): string {
    const date: Date = new Date(`${dateValue}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      weekday: 'long',
    }).format(date);
  }

  private async applyServiceProgress(
    appointments: ServiceAppointment[],
    serviceDate = '',
  ): Promise<ServiceAppointment[]> {
    if (appointments.length === 0) return [];
    const appointmentIds: string[] = Array.from(
      new Set(
        appointments.flatMap((appointment: ServiceAppointment) => {
          const recordId: string = this.appointmentRecordId(
            serviceDate,
            appointment.id,
          );
          return serviceDate === LEGACY_APPOINTMENT_DATE
            ? [recordId, String(appointment.id)]
            : [recordId];
        }),
      ),
    );
    const rows: AppointmentProgressRow[] = await this.database
      .select({
        appointmentId: serviceState.appointmentId,
        completedTaskIds: serviceState.completedTaskIds,
      })
      .from(serviceState)
      .where(inArray(serviceState.appointmentId, appointmentIds));
    const taskIdsByAppointment = new Map<string, string[]>(
      rows.map(
        (row: AppointmentProgressRow): [string, string[]] => [
          row.appointmentId,
          this.parseTaskIds(row.completedTaskIds),
        ],
      ),
    );
    const assignedTechnicians = new Map<string, string>(
      (
        await Promise.all(
          appointments.map(async (appointment: ServiceAppointment) => {
            const recordId: string = this.appointmentRecordId(
              serviceDate,
              appointment.id,
            );
            const assignedTechnician: string | undefined =
              (await this.getAssignedTechnician(recordId)) ||
              (serviceDate === LEGACY_APPOINTMENT_DATE
                ? await this.getAssignedTechnician(String(appointment.id))
                : undefined);
            return assignedTechnician
              ? ([recordId, assignedTechnician] as const)
              : null;
          }),
        )
      ).filter((item): item is readonly [string, string] => item !== null),
    );
    const serviceStageTaskIds: string[] = [
      ...STAGE_TASK_IDS.consultation,
      ...STAGE_TASK_IDS.in_service,
      ...STAGE_TASK_IDS.post_service,
      ...STAGE_TASK_IDS.follow_up,
    ];
    return appointments.map(
      (appointment: ServiceAppointment): ServiceAppointment => {
        const recordId: string = this.appointmentRecordId(
          serviceDate,
          appointment.id,
        );
        const assignedTechnician: string | undefined =
          assignedTechnicians.get(recordId);
        const appointmentWithAssignment: ServiceAppointment =
          assignedTechnician
            ? { ...appointment, technician: assignedTechnician }
            : appointment;
        const completedTaskIds: string[] =
          taskIdsByAppointment.get(recordId) ||
          (serviceDate === LEGACY_APPOINTMENT_DATE
            ? taskIdsByAppointment.get(String(appointment.id))
            : undefined) ||
          [];
        if (completedTaskIds.length >= KNOWN_TASK_IDS.length) {
          return { ...appointmentWithAssignment, status: '已完成' };
        }
        if (
          completedTaskIds.some((taskId: string) =>
            serviceStageTaskIds.includes(taskId),
          )
        ) {
          return { ...appointmentWithAssignment, status: '服务中' };
        }
        if (completedTaskIds.length > 0 && appointment.status === '待到店') {
          return { ...appointmentWithAssignment, status: '准备中' };
        }
        return appointmentWithAssignment;
      },
    );
  }

  private normalizeAppointments(value: unknown): ServiceAppointment[] {
    if (!Array.isArray(value)) return [];
    const allowedStatuses = new Set<ServiceAppointment['status']>([
      '待到店',
      '准备中',
      '服务中',
      '已完成',
    ]);
    return value
      .slice(0, 100)
      .map((item: unknown, index: number): ServiceAppointment | null => {
        if (!item || typeof item !== 'object') return null;
        const source = item as Partial<ServiceAppointment>;
        const name = typeof source.name === 'string' ? source.name.trim() : '';
        const time = typeof source.time === 'string' ? source.time.trim() : '';
        if (!name || !/^\d{1,2}:\d{2}$/u.test(time)) return null;
        const technician =
          typeof source.technician === 'string' && source.technician.trim()
            ? source.technician.trim()
            : '待填写';
        const status = allowedStatuses.has(source.status || '待到店')
          ? (source.status as ServiceAppointment['status'])
          : '待到店';
        return {
          id:
            typeof source.id === 'number' && Number.isSafeInteger(source.id)
              ? source.id
              : index + 1,
          time,
          name,
          nickname:
            typeof source.nickname === 'string' && source.nickname.trim()
              ? source.nickname.trim()
              : name,
          project:
            typeof source.project === 'string' && source.project.trim()
              ? source.project.trim()
              : '项目待确认',
          room:
            typeof source.room === 'string' && source.room.trim()
              ? source.room.trim()
              : '待安排',
          fixedTechnician:
            typeof source.fixedTechnician === 'string' &&
            source.fixedTechnician.trim()
              ? source.fixedTechnician.trim()
              : technician,
          technician,
          nurse:
            typeof source.nurse === 'string' && source.nurse.trim()
              ? source.nurse.trim()
              : undefined,
          frontDesk:
            typeof source.frontDesk === 'string' && source.frontDesk.trim()
              ? source.frontDesk.trim()
              : undefined,
          status,
          member:
            typeof source.member === 'string' && source.member.trim()
              ? source.member.trim()
              : '预约客户',
          accent:
            typeof source.accent === 'string' && source.accent.trim()
              ? source.accent.trim()
              : '#2f6bff',
          amount:
            typeof source.amount === 'string' && source.amount.trim()
              ? source.amount.trim()
              : '待确认',
          tags: Array.isArray(source.tags)
            ? source.tags
                .filter((tag): tag is string => typeof tag === 'string')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 12)
            : [],
          arrivalMethod: source.arrivalMethod,
          lastVisit: source.lastVisit,
          lastSpend: source.lastSpend,
          cardBalance: source.cardBalance,
          remainingProjects: source.remainingProjects,
        };
      })
      .filter((item): item is ServiceAppointment => item !== null)
      .sort((left, right) => left.time.localeCompare(right.time));
  }

  private parseTaskIds(value: string): string[] {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      const migratedTaskIds: string[] = parsed.flatMap((item: unknown) => {
        if (typeof item !== 'string') return [];
        return LEGACY_TASK_ID_MAP[item] || [item];
      });
      return Array.from(
        new Set(
          migratedTaskIds.filter((item: string) =>
            KNOWN_TASK_IDS.includes(item),
          ),
        ),
      );
    } catch {
      return [];
    }
  }

  private defaultTaskIds(appointmentId: string): string[] {
    const legacyId: string =
      this.legacyAppointmentId(appointmentId) || appointmentId;
    return legacyId === '1' ? [...PREPARATION_TASK_IDS] : [];
  }
}
