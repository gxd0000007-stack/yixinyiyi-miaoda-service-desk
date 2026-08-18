import type { FC } from 'react';
import type {
  CustomerAssetForService,
  ServiceStaffSchedule,
  ServiceStaffShift,
} from '@shared/api.interface';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Pencil,
  Play,
  ShieldCheck,
  UserX,
  Users,
} from 'lucide-react';
import CustomerFollowupTaskBoard from './CustomerFollowupTaskBoard';
import CustomerMembershipBadge from '../components/CustomerMembershipBadge';
import { appointmentMembershipLabel } from './customer-membership';

export type EmployeeStaffRole =
  | 'skin_manager'
  | 'nurse'
  | 'front_desk'
  | 'team';

export type EmployeeTaskStatus = '待到店' | '准备中' | '服务中' | '已完成';

export interface EmployeeStaffProfile {
  name: string;
  role: EmployeeStaffRole;
  roleLabel: string;
  responsibility: string;
  scopeLabel: string;
}

export interface EmployeeAppointmentSource {
  id: number;
  time: string;
  name: string;
  project: string;
  room: string;
  technician: string;
  status: EmployeeTaskStatus;
  member: string;
  customerAsset?: CustomerAssetForService;
}

interface EmployeeCommandItem {
  appointment: EmployeeAppointmentSource;
  action: string;
  phaseIndex: number;
  stageLabel: string;
  isPriority: boolean;
}

interface EmployeeTodayCommandProps {
  profile: EmployeeStaffProfile;
  appointments: EmployeeAppointmentSource[];
  allAppointments: EmployeeAppointmentSource[];
  staffSchedules: ServiceStaffSchedule[];
  priorityAppointmentIds: number[];
  selectedId: number;
  search: string;
  showStaffSelector: boolean;
  canEditAppointments: boolean;
  canEditStaffSchedule: boolean;
  savingStaffName: string;
  onSelectStaff: (name: string) => void;
  onOpenAppointment: (appointmentId: number, phaseIndex: number) => void;
  onEditAppointment: (appointmentId: number) => void;
  onUpdateStaffSchedule: (
    staffName: string,
    shift: ServiceStaffShift,
  ) => void;
}

export const EMPLOYEE_STAFF_PROFILES: EmployeeStaffProfile[] = [
  {
    name: '欣欣',
    role: 'skin_manager',
    roleLabel: '皮肤管理师',
    responsibility: '负责本人客户的到店诊断、护理执行、效果确认和服务记录。',
    scopeLabel: '只显示分配给我的客户',
  },
  {
    name: '冉冉',
    role: 'skin_manager',
    roleLabel: '皮肤管理师',
    responsibility: '负责本人客户的到店诊断、护理执行、效果确认和服务记录。',
    scopeLabel: '只显示分配给我的客户',
  },
  {
    name: '思思',
    role: 'skin_manager',
    roleLabel: '皮肤管理师',
    responsibility: '负责本人客户的到店诊断、护理执行、效果确认和服务记录。',
    scopeLabel: '只显示分配给我的客户',
  },
  {
    name: '万万',
    role: 'nurse',
    roleLabel: '护士',
    responsibility: '负责全店客户的健康核对、安全边界、耐受观察和异常协同。',
    scopeLabel: '显示全店安全协同任务',
  },
  {
    name: '红红',
    role: 'front_desk',
    roleLabel: '前台',
    responsibility: '负责全店客户的资料、到店、房间、接待、结算与回访交接。',
    scopeLabel: '显示全店接待协同任务',
  },
  {
    name: '岗岗',
    role: 'front_desk',
    roleLabel: '前台',
    responsibility: '负责全店客户的资料、到店、房间、接待、结算与回访交接。',
    scopeLabel: '显示全店接待协同任务',
  },
];

const FALLBACK_PROFILE: EmployeeStaffProfile = {
  name: '门店伙伴',
  role: 'team',
  roleLabel: '门店协同',
  responsibility:
    '当前账号尚未匹配岗位，先显示全店协同任务，老板可在员工预览中核对岗位。',
  scopeLabel: '显示全店协同任务',
};

function normalizedName(value: string): string {
  return value.replace(/\s+/gu, '').toLocaleLowerCase();
}

export function resolveEmployeeStaffProfile(
  viewerName: string,
  isOwner: boolean,
  previewName: string,
  platformRoles: string[] = [],
): EmployeeStaffProfile {
  const targetName = isOwner ? previewName || '欣欣' : viewerName;
  const normalizedTarget = normalizedName(targetName);
  const matched = EMPLOYEE_STAFF_PROFILES.find((profile) => {
    const normalizedProfile = normalizedName(profile.name);
    return (
      normalizedTarget === normalizedProfile ||
      normalizedTarget.includes(normalizedProfile) ||
      normalizedProfile.includes(normalizedTarget)
    );
  });
  if (matched) return matched;
  const roleFromPlatform: EmployeeStaffRole = platformRoles.includes('skin_manager')
    ? 'skin_manager'
    : platformRoles.includes('nurse')
      ? 'nurse'
      : platformRoles.includes('appointment_schedule_editor')
        ? 'front_desk'
        : 'team';
  const roleCopy: Record<EmployeeStaffRole, Omit<EmployeeStaffProfile, 'name' | 'role'>> = {
    skin_manager: {
      roleLabel: '皮肤管理师',
      responsibility: '负责本人客户的到店诊断、护理执行、效果确认和服务记录。',
      scopeLabel: '只显示分配给我的客户',
    },
    nurse: {
      roleLabel: '护士',
      responsibility: '负责全店客户的健康标记、安全复核与护理协同。',
      scopeLabel: '显示全店安全协同任务',
    },
    front_desk: {
      roleLabel: '前台',
      responsibility: '负责资料、到店、房间、接待、结算、回访及员工日常管理。',
      scopeLabel: '显示全店接待协同任务',
    },
    team: {
      roleLabel: FALLBACK_PROFILE.roleLabel,
      responsibility: FALLBACK_PROFILE.responsibility,
      scopeLabel: FALLBACK_PROFILE.scopeLabel,
    },
  };
  return {
    name: targetName || FALLBACK_PROFILE.name,
    role: roleFromPlatform,
    ...roleCopy[roleFromPlatform],
  };
}

export function appointmentsForEmployeeProfile(
  profile: EmployeeStaffProfile,
  appointments: EmployeeAppointmentSource[],
): EmployeeAppointmentSource[] {
  if (profile.role !== 'skin_manager') return appointments;
  const profileName = normalizedName(profile.name);
  return appointments.filter(
    (appointment) => normalizedName(appointment.technician) === profileName,
  );
}

export function phaseIndexForEmployeeTask(status: EmployeeTaskStatus): number {
  if (status === '服务中') return 3;
  if (status === '已完成') return 5;
  return 0;
}

function actionForRole(
  role: EmployeeStaffRole,
  status: EmployeeTaskStatus,
): string {
  const phaseKey = status === '准备中' ? '待到店' : status;
  const actions: Record<
    Exclude<EmployeeStaffRole, 'team'>,
    Record<'待到店' | '服务中' | '已完成', string>
  > = {
    skin_manager: {
      待到店: '查看客户档案和上次反馈，确认本次项目、房间与服务准备。',
      服务中: '执行护理步骤，持续确认温度、力度、舒适度和重点区域反应。',
      已完成: '补充效果记录、客户反馈与画像，并确认下一次维护安排。',
    },
    nurse: {
      待到店: '查看健康标记、禁忌和历史反应，完成服务前安全复核。',
      服务中: '观察客户耐受与异常反应，及时完成护理安全协同。',
      已完成: '复核护理后反应与离店注意事项，补充健康跟进记录。',
    },
    front_desk: {
      待到店: '完成客户资料、到店确认、房间、饮品和接待准备。',
      服务中: '跟进房间、饮品餐食和现场需求，做好跨岗位交接。',
      已完成: '核对结算、随身物品和服务归档，并安排后续回访提醒。',
    },
  };

  if (role === 'team') {
    if (phaseKey === '服务中')
      return '查看当前服务进度，并完成本人负责的现场协同。';
    if (phaseKey === '已完成') return '检查服务记录、结算和回访是否已经闭环。';
    return '查看客户资料和本次预约，完成本人负责的到店前准备。';
  }
  return actions[role][phaseKey];
}

function stageLabelFor(status: EmployeeTaskStatus): string {
  if (status === '服务中') return '现在处理';
  if (status === '准备中') return '准备接待';
  if (status === '已完成') return '后续维护';
  return '到店前准备';
}

function taskRank(status: EmployeeTaskStatus): number {
  if (status === '服务中') return 0;
  if (status === '准备中') return 1;
  if (status === '待到店') return 2;
  return 3;
}

function matchesSearch(
  appointment: EmployeeAppointmentSource,
  search: string,
): boolean {
  const keyword = search.trim().toLocaleLowerCase();
  if (!keyword) return true;
  return [
    appointment.name,
    appointment.project,
    appointment.technician,
    appointment.room,
  ].some((value) => value.toLocaleLowerCase().includes(keyword));
}

const EmployeeTodayCommand: FC<EmployeeTodayCommandProps> = ({
  profile,
  appointments,
  allAppointments,
  staffSchedules,
  priorityAppointmentIds,
  selectedId,
  search,
  showStaffSelector,
  canEditAppointments,
  canEditStaffSchedule,
  savingStaffName,
  onSelectStaff,
  onOpenAppointment,
  onEditAppointment,
  onUpdateStaffSchedule,
}) => {
  const scopedAppointments = appointmentsForEmployeeProfile(
    profile,
    appointments,
  );
  const commandItems: EmployeeCommandItem[] = scopedAppointments
    .filter((appointment) => matchesSearch(appointment, search))
    .map((appointment) => ({
      appointment,
      action: actionForRole(profile.role, appointment.status),
      phaseIndex: phaseIndexForEmployeeTask(appointment.status),
      stageLabel: stageLabelFor(appointment.status),
      isPriority: priorityAppointmentIds.includes(appointment.id),
    }))
    .sort(
      (left, right) =>
        taskRank(left.appointment.status) -
          taskRank(right.appointment.status) ||
        left.appointment.time.localeCompare(right.appointment.time),
    );
  const primaryTask =
    commandItems.find((item) => item.appointment.status !== '已完成') ||
    commandItems[0];
  const pendingCount = scopedAppointments.filter(
    (appointment) =>
      appointment.status === '待到店' || appointment.status === '准备中',
  ).length;
  const inServiceCount = scopedAppointments.filter(
    (appointment) => appointment.status === '服务中',
  ).length;
  const completedCount = scopedAppointments.filter(
    (appointment) => appointment.status === '已完成',
  ).length;
  const profileSchedule = staffSchedules.find(
    (schedule) => schedule.staffName === profile.name,
  );
  const storeAppointments = allAppointments
    .filter((appointment) => matchesSearch(appointment, search))
    .sort((left, right) => left.time.localeCompare(right.time));
  const storeInServiceCount = allAppointments.filter(
    (appointment) => appointment.status === '服务中',
  ).length;
  const storePendingCount = allAppointments.filter((appointment) =>
    ['待到店', '准备中'].includes(appointment.status),
  ).length;

  return (
    <section className="employee-command-center panel">
      <div className="employee-command-heading">
        <div className="employee-role-identity">
          <span className={`employee-role-icon ${profile.role}`}>
            {profile.role === 'nurse' ? <ShieldCheck /> : <ClipboardCheck />}
          </span>
          <div>
            <span className="eyebrow">员工今日任务 · 按岗位自动分配</span>
            <h2>
              {profile.name} <b>· {profile.roleLabel}</b>
            </h2>
            <p>{profile.responsibility}</p>
          </div>
        </div>
        <div className="employee-identity-badges">
          <div className="employee-scope-badge">{profile.scopeLabel}</div>
          <div
            className={`employee-shift-badge ${profileSchedule?.shift === '休息' ? 'off' : ''}`}
          >
            <CalendarDays />
            {profileSchedule
              ? profileSchedule.shift === '休息'
                ? '今日休息'
                : `${profileSchedule.shift} ${profileSchedule.startTime}–${profileSchedule.endTime}`
              : '班次待排'}
          </div>
          <div className="employee-store-count-badge">
            <Users />
            全店今日 {allAppointments.length} 位预约
          </div>
        </div>
      </div>

      {showStaffSelector && (
        <div className="employee-staff-selector" aria-label="老板预览员工任务">
          <span>老板预览：</span>
          {EMPLOYEE_STAFF_PROFILES.map((staff) => (
            <button
              type="button"
              key={staff.name}
              className={staff.name === profile.name ? 'active' : ''}
              onClick={() => onSelectStaff(staff.name)}
            >
              <strong>{staff.name}</strong>
              <small>{staff.roleLabel}</small>
            </button>
          ))}
        </div>
      )}

      <section className="employee-store-overview">
        <div className="employee-store-overview-heading">
          <div>
            <span className="eyebrow">全店今日预约 · 第一时间先看</span>
            <h3>今天全店共有 {allAppointments.length} 位客户到店</h3>
            <p>
              待接待 {storePendingCount} 位 · 服务中 {storeInServiceCount} 位 ·
              全员可见
            </p>
          </div>
          <span className={canEditAppointments ? 'editable' : 'readonly'}>
            {canEditAppointments ? <Pencil /> : <Eye />}
            {canEditAppointments
              ? '老板 / 前台可调整'
              : '员工只读，不可修改'}
          </span>
        </div>
        <div className="employee-store-appointment-list">
          {storeAppointments.map((appointment) => (
            <article key={appointment.id}>
              <div className="employee-store-card-top">
                <time>{appointment.time}</time>
                <i className={appointment.status}>{appointment.status}</i>
              </div>
              <div className="employee-store-client">
                <div className="employee-customer-name-line">
                  <strong>{appointment.name}</strong>
                  <CustomerMembershipBadge
                    label={appointmentMembershipLabel(
                      appointment.customerAsset,
                      appointment.member,
                    )}
                    compact
                  />
                </div>
                <small>{appointment.project}</small>
              </div>
              <div className="employee-store-card-meta">
                <span>技师 {appointment.technician}</span>
                <span>{appointment.room}房</span>
              </div>
              <div className="employee-store-card-actions">
                <button
                  type="button"
                  onClick={() =>
                    onOpenAppointment(
                      appointment.id,
                      phaseIndexForEmployeeTask(appointment.status),
                    )
                  }
                >
                  <Eye />
                  查看详情
                </button>
                {canEditAppointments && (
                  <button
                    type="button"
                    className="edit"
                    onClick={() => onEditAppointment(appointment.id)}
                  >
                    <Pencil />
                    修改
                  </button>
                )}
              </div>
            </article>
          ))}
          {storeAppointments.length === 0 && (
            <div className="employee-store-empty">没有匹配的全店预约</div>
          )}
        </div>
      </section>

      <div className="employee-command-summary">
        <div>
          <Clock3 />
          <span>待到店 / 准备</span>
          <strong>{pendingCount}</strong>
        </div>
        <div>
          <Play />
          <span>正在服务</span>
          <strong>{inServiceCount}</strong>
        </div>
        <div>
          <CheckCircle2 />
          <span>已完成</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <CustomerFollowupTaskBoard
        mode="employee"
        staffName={profile.name}
        canComplete={profile.role === 'skin_manager'}
      />

      <div className="employee-command-body" data-ai-section-type="card-list">
        <section className="employee-next-task">
          <div className="employee-next-label">
            <span>{primaryTask ? '现在先做' : '今日状态'}</span>
            {primaryTask?.isPriority && <b>重点客户</b>}
          </div>
          {primaryTask ? (
            <>
              <div className="employee-next-client">
                <time>{primaryTask.appointment.time}</time>
                <div>
                  <div className="employee-customer-name-line large">
                    <h3>{primaryTask.appointment.name}</h3>
                    <CustomerMembershipBadge
                      label={appointmentMembershipLabel(
                        primaryTask.appointment.customerAsset,
                        primaryTask.appointment.member,
                      )}
                    />
                  </div>
                  <p>
                    {primaryTask.appointment.project} ·{' '}
                    {primaryTask.appointment.room}房
                  </p>
                </div>
                <span>{primaryTask.stageLabel}</span>
              </div>
              <div className="employee-next-action">
                <small>你的具体任务</small>
                <strong>{primaryTask.action}</strong>
              </div>
              {primaryTask.isPriority && (
                <p className="employee-priority-note">
                  ! 该客户需要重点关注，进入后先查看客户档案与关注原因。
                </p>
              )}
              <button
                type="button"
                className="employee-start-button"
                onClick={() =>
                  onOpenAppointment(
                    primaryTask.appointment.id,
                    primaryTask.phaseIndex,
                  )
                }
              >
                {primaryTask.appointment.status === '已完成'
                  ? '查看后续维护'
                  : primaryTask.appointment.id === selectedId
                    ? '继续执行任务'
                    : '开始这个任务'}
                <ArrowRight />
              </button>
            </>
          ) : (
            <div className="employee-command-empty">
              <CheckCircle2 />
              <strong>
                {search ? '没有找到匹配任务' : '今天暂无本人任务'}
              </strong>
              <p>
                {search
                  ? '清空顶部搜索后可查看完整任务。'
                  : '新的预约或排班同步后，会自动出现在这里。'}
              </p>
            </div>
          )}
        </section>

        <section className="employee-task-queue">
          <div className="employee-queue-heading">
            <div>
              <span>按执行顺序排列</span>
              <h3>我的今日任务清单</h3>
            </div>
            <b>{commandItems.length} 项</b>
          </div>
          <div className="employee-queue-list">
            {commandItems.map((item, index) => (
              <button
                type="button"
                key={item.appointment.id}
                className={item.appointment.id === selectedId ? 'selected' : ''}
                onClick={() =>
                  onOpenAppointment(item.appointment.id, item.phaseIndex)
                }
              >
                <span className="employee-queue-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="employee-queue-main">
                  <span>
                    <time>{item.appointment.time}</time>
                    <strong>{item.appointment.name}</strong>
                    <CustomerMembershipBadge
                      label={appointmentMembershipLabel(
                        item.appointment.customerAsset,
                        item.appointment.member,
                      )}
                      compact
                    />
                    {item.isPriority && <i>重点</i>}
                  </span>
                  <small>
                    {item.stageLabel} · {item.action}
                  </small>
                </span>
                <ArrowRight />
              </button>
            ))}
          </div>
        </section>

      </div>

      <section className="employee-roster-board">
        <div className="employee-roster-heading">
          <div>
            <span className="eyebrow">今日员工排班</span>
            <h3>早班 09:00–18:00 · 晚班 11:00–20:00 · 月休 4 天</h3>
          </div>
          <span>
            <Users />
            {canEditStaffSchedule ? '老板 / 前台可排班' : '全员只读'}
          </span>
        </div>
        <div className="employee-roster-list">
          {staffSchedules.map((schedule) => (
            <article
              className={schedule.shift === '休息' ? 'off' : ''}
              key={schedule.staffName}
            >
              <div>
                <strong>{schedule.staffName}</strong>
                <small>{schedule.roleLabel}</small>
              </div>
              {canEditStaffSchedule ? (
                <select
                  aria-label={`调整${schedule.staffName}的班次`}
                  disabled={savingStaffName === schedule.staffName}
                  value={schedule.shift}
                  onChange={(event) =>
                    onUpdateStaffSchedule(
                      schedule.staffName,
                      event.target.value as ServiceStaffShift,
                    )
                  }
                >
                  <option value="早班">早班 09:00–18:00</option>
                  <option value="晚班">晚班 11:00–20:00</option>
                  <option value="休息">今日休息</option>
                </select>
              ) : (
                <span>
                  {schedule.shift === '休息' ? <UserX /> : <Clock3 />}
                  {schedule.shift === '休息'
                    ? '今日休息'
                    : `${schedule.shift} ${schedule.startTime}–${schedule.endTime}`}
                </span>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};

export default EmployeeTodayCommand;
