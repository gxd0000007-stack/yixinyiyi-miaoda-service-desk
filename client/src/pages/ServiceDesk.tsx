'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BellRing,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  ClipboardCheck,
  ContactRound,
  CreditCard,
  LayoutDashboard,
  Menu,
  PackageSearch,
  ReceiptText,
  Star,
  UserCog,
  X,
} from 'lucide-react';
import type {
  CustomerAssetForService,
  CustomerCardAvailableRight,
  CustomerPrivilegeTier,
  ServiceJobRole,
  ServicePermissionScope,
  ServiceRoleResponse,
  ServiceStaffSchedule,
  ServiceStaffShift,
} from '@shared/api.interface';
import StructuredContent from '../components/StructuredContent';
import CustomerAvatar from '../components/CustomerAvatar';
import CustomerMembershipBadge from '../components/CustomerMembershipBadge';
import {
  YOUZAN_SERVICE_CATALOG,
  YOUZAN_SERVICE_CATEGORIES,
} from '../data/youzan-service-catalog';
import CustomerAssetLibrary from './CustomerAssetLibrary';
import CustomerCardWalletDialog from './CustomerCardWalletDialog';
import CustomerCheckoutDialog from './CustomerCheckoutDialog';
import CustomerReminderCenter from './CustomerReminderCenter';
import {
  appointmentMembershipLabel,
  customerPrivilegeTier,
} from './customer-membership';
import EmployeeTodayCommand, {
  appointmentsForEmployeeProfile,
  resolveEmployeeStaffProfile,
} from './EmployeeTodayCommand';
import {
  type OwnerDailyMetrics,
  type OwnerDailyMetricType,
} from './OwnerDailyDataPanel';
import {
  type OwnerAnalysisModuleType,
  type OwnerRealtimeAnalysis,
} from './OwnerRealtimeAnalysisPanel';
import OwnerTodayCommand from './OwnerTodayCommand';
import '../service-desk.css';

type AppointmentStatus = '待到店' | '准备中' | '服务中' | '已完成';

type Appointment = {
  id: number;
  time: string;
  name: string;
  nickname: string;
  project: string;
  room: string;
  fixedTechnician: string;
  technician: string;
  nurse?: string;
  frontDesk?: string;
  status: AppointmentStatus;
  member: string;
  accent: string;
  amount: string;
  tags: string[];
  sourceServiceId?: string;
  serviceDurationMinutes?: number;
  arrivalMethod?: string;
  lastVisit?: string;
  lastSpend?: string;
  cardBalance?: string;
  remainingProjects?: Array<{ name: string; times: number; expires: string }>;
  customerAsset?: CustomerAssetForService;
};

type AppointmentSchedule = {
  date?: string;
  label: string;
  weekday: string;
  note: string;
  sourceName: string;
  sourceMessageId?: string;
  importedAt?: string;
};

type AppointmentHistoryDay = {
  date: string;
  appointments: Appointment[];
  schedule: AppointmentSchedule;
  staffSchedules?: ServiceStaffSchedule[];
  updatedAt?: string;
};

type WeeklyAppointment = Appointment & {
  date: string;
  dateLabel: string;
  weekday: string;
};

type PriorityAssessment = {
  appointment: Appointment;
  score: number;
  reasons: string[];
  actions: string[];
  consumptionSummary: string;
};

type EmployeeWeeklyReport = {
  technician: string;
  appointments: WeeklyAppointment[];
  completedCount: number;
  inServiceCount: number;
  pendingCount: number;
  totalReceivable: number;
  settledReceivable: number;
  cardConsumption: number;
  projectWriteoff: number;
  onsiteReceivable: number;
  completionRate: number;
  averageTicket: number;
  strengths: string[];
  improvements: string[];
};

type SettlementBreakdown = {
  totalReceivable: number;
  cardConsumption: number;
  projectWriteoff: number;
  onsiteReceivable: number;
  settlementStatus: '已结算' | '待结算';
  settlementBasis: string;
};

type ApiErrorPayload = {
  error?: string | { message?: string };
};

type ServiceTask = {
  id: string;
  owner: string;
  text: string;
  group: string;
};

type ServicePhase = {
  id: string;
  name: string;
  label: string;
  description: string;
  uploadLabel: string;
  tasks: ServiceTask[];
};

type DetailItem = {
  label: string;
  value: string;
  customerName?: string;
  customerMeta?: string;
  customerBadge?: string;
};

type DetailView = {
  eyebrow: string;
  title: string;
  description: string;
  items: DetailItem[];
  layout?: 'default' | 'customer_cards';
} | null;

type OwnerMetricType = 'appointments' | 'in_service' | 'completed';

type FollowupId = 'd1' | 'd3' | 'd21';

type GuidanceStep = {
  stage: string;
  title: string;
  purpose: string;
  script: string;
};

type CustomerGuidance = {
  source: string;
  previousProject: string;
  previousResult: string;
  todayAssessment: string;
  primaryRecommendation: string;
  optionalRecommendation: string;
  safetyBoundary: string;
  consultationSteps: GuidanceStep[];
  enhancementTheme: string;
  enhancementSteps: GuidanceStep[];
};

type MentionUser = {
  userId: string;
  name: string;
  role: string;
};

type ViewerRole = 'owner' | 'employee';
type ActivePortal = 'owner' | 'employee';
type WorkspaceView = 'service_desk' | 'customer_assets' | 'customer_reminders';
type OwnerSection = 'overview' | 'weekly' | 'appointments';
type EmployeeSection = 'overview' | 'service' | 'weekly';
type PlatformContext = {
  userId?: string;
  userType?: string;
  loginUrl?: string;
};

const EMPTY_SERVICE_PERMISSIONS: ServicePermissionScope = {
  viewOwnerPortal: false,
  viewEmployeePortal: false,
  viewCustomerAssets: false,
  viewCustomerReminders: false,
  viewPriorityClients: false,
  viewAllAppointments: false,
  executeOwnTasks: false,
  editAppointments: false,
  editStaffSchedule: false,
  manageStaffRoles: false,
  checkout: false,
  manageInventory: false,
};

type DemoPreference = {
  serviceStyle: string;
  roomTemp: string;
  scent: string;
  music: string;
  bedAngle: string;
  pressure: string;
  food: string;
  drink: string;
  communication: string;
  currentState: string;
  interest: string;
  newInfo: string;
};

const FEISHU_GROUP_OWNER: MentionUser = {
  userId: 'ou_6298cdf3a55a36b5ab07560ef37769d6',
  name: 'WANS',
  role: '老板/群主',
};
const DEMO_MODE = false;
const TECHNICIAN_FEISHU_USERS: Record<string, MentionUser> = {};
const DEFAULT_STAFF_SCHEDULES: Array<
  Omit<ServiceStaffSchedule, 'date' | 'monthlyRestDays'>
> = [
  {
    staffName: '欣欣',
    role: 'skin_manager',
    roleLabel: '皮肤管理师',
    shift: '早班',
    startTime: '09:00',
    endTime: '18:00',
  },
  {
    staffName: '冉冉',
    role: 'skin_manager',
    roleLabel: '皮肤管理师',
    shift: '晚班',
    startTime: '11:00',
    endTime: '20:00',
  },
  {
    staffName: '思思',
    role: 'skin_manager',
    roleLabel: '皮肤管理师',
    shift: '早班',
    startTime: '09:00',
    endTime: '18:00',
  },
  {
    staffName: '万万',
    role: 'nurse',
    roleLabel: '护士',
    shift: '早班',
    startTime: '09:00',
    endTime: '18:00',
  },
  {
    staffName: '红红',
    role: 'front_desk',
    roleLabel: '前台',
    shift: '早班',
    startTime: '09:00',
    endTime: '18:00',
  },
  {
    staffName: '岗岗',
    role: 'front_desk',
    roleLabel: '前台',
    shift: '晚班',
    startTime: '11:00',
    endTime: '20:00',
  },
];

const SERVICE_ROOM_OPTIONS = [
  'VIP房',
  '双人间',
  '单人间1',
  '单人间2',
  '单人间4',
] as const;

const STAFF_SHIFT_OPTIONS: Array<{
  value: ServiceStaffShift;
  label: string;
}> = [
  { value: '早班', label: '早班 09:00–18:00' },
  { value: '晚班', label: '晚班 11:00–20:00' },
  { value: '休息', label: '休息（每人月休4天）' },
];

function defaultStaffSchedules(date: string): ServiceStaffSchedule[] {
  return DEFAULT_STAFF_SCHEDULES.map((schedule) => ({
    ...schedule,
    date,
    monthlyRestDays: 4,
  }));
}

function getPlatformContext(): PlatformContext {
  return (
    (
      window as Window & {
        __platform__?: PlatformContext;
      }
    ).__platform__ ?? {}
  );
}
function isFeishuWebView() {
  return /feishu|lark|bytedancewebview/iu.test(navigator.userAgent);
}

function serviceApi(path: string) {
  const basePath =
    (window as Window & { __BASENAME__?: string }).__BASENAME__?.replace(
      /\/$/,
      '',
    ) || '';
  return `${basePath}${path}`;
}

function serviceHeaders() {
  const csrfCookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith('suda-csrf-token='));
  const cookieToken = csrfCookie?.slice('suda-csrf-token='.length);
  const csrfToken =
    (cookieToken ? decodeURIComponent(cookieToken) : '') || window.csrfToken;

  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-Suda-Csrf-Token': csrfToken } : {}),
  };
}

function apiErrorMessage(data: ApiErrorPayload, fallback: string) {
  if (typeof data.error === 'string') return data.error;
  return data.error?.message || fallback;
}

function careScriptsFor(appointment: Appointment, imported: boolean) {
  if (imported) {
    return {
      preparation: `${appointment.name}，您好，提醒您明天${appointment.time}有预约。项目、房间和到店方式正在为您确认，确认后会及时同步；如果时间有变化请随时告诉我们。`,
      arrival: `${appointment.name}，您好，您到了。我们先核对今天的项目、房间和服务技师，再根据您今天的真实状态开始服务。`,
      consultation: `${appointment.name}，我先了解您今天最想改善的问题和当前感受，再结合检查结果说明适合的项目、预期和注意事项，您确认后我们再开始。`,
      in_service: `${appointment.name}，现在的温度、力度和整体舒适度合适吗？任何地方需要调整请直接告诉我。`,
      post_service: `${appointment.name}，今天的服务已经完成。我们一起确认即时效果和注意事项，并把本次真实反馈记录到档案里。`,
      follow_up: `${appointment.name}，想回访一下您服务后的感受。如有泛红、刺痛或其他不适请及时告诉我们，我们会继续跟进。`,
    };
  }
  if (appointment.id !== 1) {
    return {
      preparation: `${appointment.nickname}，提醒您今天${appointment.time}的${appointment.project}已经安排好了，${appointment.room}房和${appointment.technician}老师都已为您预留。您按之前的${appointment.arrivalMethod}方式过来吗？`,
      arrival: `${appointment.nickname}，欢迎您，房间和服务用品已经按档案提前准备好了。我们先确认今天的状态和${appointment.project}安排。`,
      consultation: `${appointment.nickname}，我先结合上次记录和您今天的真实状态确认重点，再说明${appointment.project}的步骤、预期和注意事项，您确认后我们开始。`,
      in_service: `${appointment.nickname}，现在的温度、力度和整体舒适度合适吗？我会按您今天的反馈及时调整。`,
      post_service: `${appointment.nickname}，今天的${appointment.project}已经完成。我们一起看同光线对比并确认您的即时感受，再说明回家后的维护重点。`,
      follow_up: `${appointment.nickname}，想回访一下您做完${appointment.project}后的感受，有任何需要调整的地方请随时告诉我们。`,
    };
  }
  return {
    preparation:
      '启慧，提醒一下您明天下午3点的护理，我这边已经提前安排好了。明天下午天气炎热，想确认一下您还是开车过来吗？我们会提前准备降温物品在电梯口等您。',
    arrival:
      '哈啰呀，启慧，下午好，您来了。房间都已经提前为您安排好了。餐食已经按照您昨天的吩咐已经准备好了。',
    consultation:
      '启慧，我看到您刚刚生完宝宝，最近应该比较关注提亮，也会在意项目适不适合哺乳期，反黑、防晒和之后能不能正常化妆。今天我们看了您的真实状态，您选择的三明治美白很适合目前的皮肤管理；我把适用范围和注意事项跟您说明清楚，这个项目不是侵入类的治疗，孕期、哺乳期都可以放心做，主要功效是提亮、美白以及滋润。我会在您嘴周和额头比较暗沉的部位去给您做加强，您确认后我们再开始。',
    in_service:
      '启慧，灯光和温度和香味我按照您之前的习惯提前调过了，您现在感觉合适吗？',
    post_service:
      '启慧，今天的护理到这里就结束了，您看下镜子效果。餐食是在房间用还是下楼到大厅用呢？',
    follow_up:
      '启慧，今天感觉怎么样？有任何不适随时联系我们。您的画像已更新，下次为您准备花香调房间和下雨白噪音音乐。',
  };
}

const demoPreferences: Record<number, DemoPreference> = {
  1: {
    serviceStyle: '仆人式尊享服务',
    roomTemp: '25℃',
    scent: '木质调',
    music: '轻音乐',
    bedAngle: '15°',
    pressure: '肩部大力度，头部轻力度',
    food: '常温白开水、小汤圆、牛肉面、哈密瓜',
    drink: '常温白开水',
    communication: '真诚赞美，不打探隐私，多询问舒适度',
    currentState: '哺乳期，刚生完二胎',
    interest: '最近喜欢做美甲',
    newInfo: '换了一辆电车',
  },
  2: {
    serviceStyle: '安静休息型熟客服务',
    roomTemp: '24℃',
    scent: '无香',
    music: '低音量白噪音',
    bedAngle: '10°',
    pressure: '面部轻柔，肩颈中等力度',
    food: '温水、水果杯',
    drink: '温水',
    communication: '关键步骤轻声确认，其余时间减少聊天',
    currentState: '近期空调环境较多，面颊紧绷',
    interest: '喜欢瑜伽和轻食',
    newInfo: '近期出差频率增加',
  },
  3: {
    serviceStyle: '首次到店安心陪伴服务',
    roomTemp: '26℃',
    scent: '无香',
    music: '轻音乐',
    bedAngle: '15°',
    pressure: '全程轻柔，敏感区域减摩擦',
    food: '温水、低糖点心',
    drink: '温水',
    communication: '先解释再操作，建立明确暂停信号',
    currentState: '首次到店、怕冷，需建立皮肤基线',
    interest: '关注敏感肌居家护理',
    newInfo: '首次建立完整客户画像',
  },
  4: {
    serviceStyle: 'VIP固定技师对照式服务',
    roomTemp: '24℃',
    scent: '白茶调',
    music: '轻音乐',
    bedAngle: '10°',
    pressure: '肩颈中大力度，面部中等力度',
    food: '常温水、坚果、水果',
    drink: '常温水',
    communication: '用左右对照说明变化，不作永久效果承诺',
    currentState: '近期睡眠不足，咬肌紧张',
    interest: '喜欢运动和摄影',
    newInfo: '希望固定保留同角度效果照片',
  },
  5: {
    serviceStyle: '上班族放松恢复服务',
    roomTemp: '25℃',
    scent: '无香',
    music: '下雨白噪音',
    bedAngle: '15°',
    pressure: '肩背大力度，颈部中等力度',
    food: '温水、低糖点心',
    drink: '温水',
    communication: '少聊工作，多确认酸胀与力度',
    currentState: '久坐、肩颈紧张，近期加班',
    interest: '喜欢徒步和咖啡',
    newInfo: '希望下班后保留固定晚间档',
  },
  6: {
    serviceStyle: '新客透明解释型服务',
    roomTemp: '25℃',
    scent: '无香',
    music: '轻音乐',
    bedAngle: '10°',
    pressure: '面部轻柔，重点区域逐步确认',
    food: '常温水、水果',
    drink: '常温水',
    communication: '每个关键步骤先说明，不制造皮肤焦虑',
    currentState: '首次焕肤体验，需确认耐受与近期护肤变化',
    interest: '关注通勤妆容和防晒',
    newInfo: '首次建立耐受与效果基线',
  },
};

function demoPreferenceFor(appointment: Appointment): DemoPreference {
  const asset = appointment.customerAsset;
  if (asset) {
    const servicePreferences = asset.servicePreferences.join('、');
    const concerns = asset.primarySkinConcerns.join('、');
    const health = asset.healthFlags.join('、');
    const risks = asset.serviceRisks.join('、');
    return {
      serviceStyle:
        servicePreferences || '按客户资料库偏好执行，并在到店时再次确认',
      roomTemp: health.includes('怕冷') ? '26℃' : '25℃',
      scent: servicePreferences.includes('无香') ? '无香' : '到店再次确认',
      music: servicePreferences.includes('安静')
        ? '轻音乐或关闭音乐'
        : '轻音乐',
      bedAngle: '到店根据舒适度确认',
      pressure: servicePreferences || '先用中等力度测试，再按客户反馈调整',
      food: servicePreferences || '按客户资料库餐食饮品偏好准备',
      drink: servicePreferences || '常温水',
      communication:
        risks.length > 0
          ? `严格避开：${risks}`
          : '结合真实需求沟通，不制造焦虑、不强推项目',
      currentState:
        [concerns, health].filter(Boolean).join('；') || '到店重新确认真实状态',
      interest:
        asset.entryMotives.join('、') || asset.consumptionProfile.join('、'),
      newInfo: `资料库完整度 ${asset.profileCompleteness}%，服务后写回新增偏好`,
    };
  }
  return demoPreferences[appointment.id] ?? demoPreferences[1];
}

const initialAppointments: Appointment[] = [
  {
    id: 1,
    time: '15:00',
    name: '王启慧',
    nickname: '启慧',
    project: '三明治美白',
    room: '101',
    fixedTechnician: '欣欣',
    technician: '欣欣',
    status: '准备中',
    member: '1688会员老客',
    accent: '#7c5cff',
    amount: '¥1,688',
    tags: ['重点关怀', '美白提亮', '哺乳期', '敏感肌'],
    arrivalMethod: '开车',
    lastVisit: '07月12日',
    lastSpend: '¥1,688',
    cardBalance: '¥4,260',
    remainingProjects: [
      { name: '三明治美白', times: 2, expires: '2027年03月31日' },
      { name: '水光补水管理', times: 1, expires: '2027年03月31日' },
      { name: '舒缓修护管理', times: 1, expires: '2027年03月31日' },
      { name: '肩颈舒压护理', times: 1, expires: '2026年12月31日' },
    ],
  },
  {
    id: 2,
    time: '10:00',
    name: '林晓雯',
    nickname: '晓雯',
    project: '深层补水管理',
    room: '203',
    fixedTechnician: '小米',
    technician: '小米',
    status: '已完成',
    member: '铂金会员',
    accent: '#2f80ed',
    amount: '¥980',
    tags: ['补水', '熟客', '安静休息'],
    arrivalMethod: '打车',
    lastVisit: '07月26日',
    lastSpend: '¥980',
    cardBalance: '¥3,280',
    remainingProjects: [
      { name: '深层补水管理', times: 3, expires: '2027年05月31日' },
      { name: '眼周保湿护理', times: 2, expires: '2027年05月31日' },
    ],
  },
  {
    id: 3,
    time: '11:30',
    name: '周雅琪',
    nickname: '雅琪',
    project: '舒缓修护',
    room: '202',
    fixedTechnician: '圆圆',
    technician: '圆圆',
    status: '服务中',
    member: '储值会员',
    accent: '#16a085',
    amount: '¥1,280',
    tags: ['舒缓', '首次到店', '怕冷'],
    arrivalMethod: '步行',
    lastVisit: '首次到店',
    lastSpend: '首次到店',
    cardBalance: '¥2,000',
    remainingProjects: [
      { name: '舒缓修护', times: 4, expires: '2027年08月07日' },
    ],
  },
  {
    id: 4,
    time: '13:30',
    name: '陈思妍',
    nickname: '思妍',
    project: '面部轮廓管理',
    room: 'VIP 1',
    fixedTechnician: '佳佳',
    technician: '佳佳',
    status: '服务中',
    member: '黑钻会员',
    accent: '#ef8d32',
    amount: '¥2,380',
    tags: ['轮廓', 'VIP', '固定技师'],
    arrivalMethod: '开车',
    lastVisit: '07月18日',
    lastSpend: '¥2,380',
    cardBalance: '¥16,800',
    remainingProjects: [
      { name: '面部轮廓管理', times: 6, expires: '2027年06月30日' },
      { name: '肩颈衔接放松', times: 3, expires: '2027年06月30日' },
    ],
  },
  {
    id: 5,
    time: '16:30',
    name: '许静怡',
    nickname: '静怡',
    project: '肩颈舒压护理',
    room: '206',
    fixedTechnician: '安安',
    technician: '安安',
    status: '待到店',
    member: '次卡客户',
    accent: '#d05788',
    amount: '¥680',
    tags: ['肩颈', '上班族', '大力度'],
    arrivalMethod: '地铁',
    lastVisit: '07月22日',
    lastSpend: '¥680',
    cardBalance: '¥1,360',
    remainingProjects: [
      { name: '肩颈舒压护理', times: 5, expires: '2026年12月31日' },
    ],
  },
  {
    id: 6,
    time: '18:00',
    name: '赵若澜',
    nickname: '若澜',
    project: '净透焕肤管理',
    room: '205',
    fixedTechnician: '欣欣',
    technician: '欣欣',
    status: '待到店',
    member: '新客体验',
    accent: '#4f9c76',
    amount: '¥1,080',
    tags: ['焕肤', '新客', '需建档'],
    arrivalMethod: '网约车',
    lastVisit: '首次到店',
    lastSpend: '首次到店',
    cardBalance: '¥1,080',
    remainingProjects: [
      { name: '净透焕肤管理', times: 1, expires: '2026年09月30日' },
    ],
  },
];

const initialSchedule: AppointmentSchedule = {
  date: '2026-08-07',
  label: '8月7日',
  weekday: '星期五',
  note: '标准Demo',
  sourceName: '标准流程Demo',
};

const servicePhases: ServicePhase[] = [
  {
    id: 'preparation',
    name: '到店前准备',
    label: '14:30前',
    description:
      '预约前30分钟完成环境、技师、出行与饮品准备，所有动作可现场勾选',
    uploadLabel: '上传准备照片',
    tasks: [
      {
        id: 'room_light',
        owner: '数据前台',
        text: '仅打开氛围灯',
        group: '房间环境',
      },
      {
        id: 'room_scent',
        owner: '数据前台',
        text: '房间香味为木质调',
        group: '房间环境',
      },
      {
        id: 'room_temp',
        owner: '数据前台',
        text: '房间温度调至25℃',
        group: '房间环境',
      },
      {
        id: 'room_bed',
        owner: '数据前台',
        text: '床头角度升高15°',
        group: '房间环境',
      },
      {
        id: 'room_tray',
        owner: '数据前台',
        text: '浴裙、一次性头巾放置于托盘内，托盘置床中央',
        group: '房间环境',
      },
      {
        id: 'room_music',
        owner: '数据前台',
        text: '确认房间音乐为轻音乐',
        group: '房间环境',
      },
      {
        id: 'room_photo',
        owner: '数据前台',
        text: '拍照确认并发送到服务群',
        group: '房间环境',
      },
      {
        id: 'tech_schedule',
        owner: '数据前台',
        text: '通过排班表确认本次管理师为欣欣',
        group: '技师安排',
      },
      {
        id: 'tech_preview',
        owner: '欣欣',
        text: '提前查看卡内余额、个人偏好、兴趣偏好、剩余项目',
        group: '技师安排',
      },
      {
        id: 'tech_project',
        owner: '欣欣',
        text: '确认本次服务项目为三明治美白',
        group: '技师安排',
      },
      {
        id: 'tech_history',
        owner: '欣欣',
        text: '查看上次服务反馈、环境偏好与力度记录',
        group: '技师安排',
      },
      {
        id: 'travel_care',
        owner: '行政前台',
        text: '预约前一天发送出行提醒+高温关怀话术',
        group: '出行关怀',
      },
      {
        id: 'travel_car',
        owner: '行政前台',
        text: '若开车：提前发送停车位置、入口和电梯路线',
        group: '出行关怀',
      },
      {
        id: 'travel_walk',
        owner: '行政前台',
        text: '若打车/步行：准备遮阳伞和小风扇，到最近入口等待',
        group: '出行关怀',
      },
      {
        id: 'drink_confirm',
        owner: '行政前台',
        text: '确认饮品为常温白开水、小吃为小汤圆、餐食为牛肉面、水果为哈密瓜',
        group: '饮品餐食',
      },
    ],
  },
  {
    id: 'arrival',
    name: '到店接待',
    label: '15:00',
    description:
      '仆人式尊享服务，提前知道客户喜好，减少陌生询问，说话方式为崇拜夸奖式',
    uploadLabel: '上传到店照片',
    tasks: [
      {
        id: 'arrival_greet',
        owner: '行政前台',
        text: '门口迎接：「哈啰呀启慧，下午好，您来了。房间都已提前为您安排好了。」',
        group: '门口迎接',
      },
      {
        id: 'arrival_nosay',
        owner: '行政前台',
        text: '【禁语】不说「请问预约了吗？」、不当面询问由谁服务',
        group: '门口迎接',
      },
      {
        id: 'arrival_sofa',
        owner: '欣欣',
        text: '主动引导入店，指引客人到大厅沙发坐下',
        group: '入店照顾',
      },
      {
        id: 'arrival_project',
        owner: '欣欣',
        text: '确认今天做的项目为三明治美白',
        group: '入店照顾',
      },
      {
        id: 'arrival_drink',
        owner: '行政前台',
        text: '端上常温白开水',
        group: '入店照顾',
      },
      {
        id: 'arrival_shoes',
        owner: '欣欣',
        text: '蹲下为客人换鞋',
        group: '入店照顾',
      },
      {
        id: 'arrival_bag',
        owner: '欣欣',
        text: '主动帮客人提包和其他物品，引导上楼进入房间',
        group: '入店照顾',
      },
      {
        id: 'arrival_room_check',
        owner: '欣欣',
        text: '轻确认灯光/温度/香味/床品/音乐：「启慧，灯光和温度我按您习惯调过了，现在合适吗？」',
        group: '进入房间',
      },
    ],
  },
  {
    id: 'consultation',
    name: '护理前沟通',
    label: '皮肤确认',
    description: '核对皮肤历史但不做结论，确认哺乳期禁忌，围绕美白提亮安心沟通',
    uploadLabel: '上传护理前照片',
    tasks: [
      {
        id: 'consult_history',
        owner: '欣欣',
        text: '查看历史皮肤记录（敏感肌、两颊红），但不把历史当今天结论',
        group: '肤况确认',
      },
      {
        id: 'consult_nursing',
        owner: '欣欣',
        text: '因客户在哺乳期，确认不进行侵入式治疗类项目',
        group: '安全确认',
      },
      {
        id: 'consult_goal',
        owner: '欣欣',
        text: '客户刚生完二胎，核心诉求：面部白皙、去除黄气',
        group: '需求沟通',
      },
      {
        id: 'consult_sop',
        owner: '欣欣',
        text: '项目确认后，只使用对应已批准SOP的说明',
        group: '方案说明',
      },
      {
        id: 'consult_script',
        owner: '欣欣',
        text: '表达参考：告知三明治美白适合哺乳期，非侵入类，提亮+美白+滋润',
        group: '方案说明',
      },
      {
        id: 'consult_enhance',
        owner: '欣欣',
        text: '告知会在嘴周和额头暗沉部位做加强，客户确认后开始',
        group: '共同确认',
      },
    ],
  },
  {
    id: 'in_service',
    name: '护理中服务',
    label: '舒适跟进',
    description:
      '仆人式全方位服务：关注温度与被子、头部放松、聊天禁区与夸奖式赞美',
    uploadLabel: '上传护理过程照片',
    tasks: [
      {
        id: 'service_temp',
        owner: '欣欣',
        text: '持续关注温度、被子覆盖和身体舒适度',
        group: '舒适跟进',
      },
      {
        id: 'service_blanket',
        owner: '欣欣',
        text: '仆人式服务：客户动一下就重新盖好被子',
        group: '舒适跟进',
      },
      {
        id: 'service_head',
        owner: '欣欣',
        text: '客户刚生完宝宝，多放松头部让客户更放松休息',
        group: '特别关怀',
      },
      {
        id: 'service_no_privacy',
        owner: '欣欣',
        text: '【禁语】禁止打探客人的隐私',
        group: '聊天禁区',
      },
      {
        id: 'service_praise',
        owner: '欣欣',
        text: '客户提到自己时给予充分赞美（夸奖衣服、发型、包包）',
        group: '聊天方式',
      },
      {
        id: 'service_ask',
        owner: '欣欣',
        text: '主动嘘寒问暖：冷不冷？需不需要喝水？水冷了吗？',
        group: '舒适跟进',
      },
    ],
  },
  {
    id: 'post_service',
    name: '护理后服务',
    label: '效果确认',
    description: '餐食安排、效果确认、贵重物品提醒、主动提包带离店',
    uploadLabel: '上传护理后照片',
    tasks: [
      {
        id: 'post_meal',
        owner: '欣欣',
        text: '确认餐食在房间还是楼下大厅食用，需要时行政前台送餐进房',
        group: '餐食安排',
      },
      {
        id: 'post_mirror',
        owner: '欣欣',
        text: '拿镜子跟客人强化项目效果',
        group: '效果确认',
      },
      {
        id: 'post_valuables',
        owner: '欣欣',
        text: '提醒并确认贵重物品已携带',
        group: '离店确认',
      },
      {
        id: 'post_bag',
        owner: '欣欣',
        text: '主动帮客人提包包和物品，引导下楼',
        group: '仆人式服务',
      },
      {
        id: 'post_seat',
        owner: '欣欣',
        text: '客人入座大厅后，将物品放置在其身边',
        group: '仆人式服务',
      },
      {
        id: 'post_escort',
        owner: '行政前台',
        text: '整理随身物品并护送客户离店',
        group: '离店礼遇',
      },
    ],
  },
  {
    id: 'follow_up',
    name: '离店后维护',
    label: '画像回传',
    description: '更新客户画像与本次新增偏好，为下次服务提供精准依据',
    uploadLabel: '上传回访凭证',
    tasks: [
      {
        id: 'follow_env',
        owner: '数据前台',
        text: '环境偏好复核：下次气味改为花香调，音乐改为下雨白噪音',
        group: '画像回传',
      },
      {
        id: 'follow_pressure',
        owner: '欣欣',
        text: '力度反馈记录：头部力度小一点，肩膀力度大一点',
        group: '画像回传',
      },
      {
        id: 'follow_concern',
        owner: '欣欣',
        text: '记录本次主要护理顾虑：客户询问能不能马上变白',
        group: '画像回传',
      },
      {
        id: 'follow_new_pref',
        owner: '欣欣',
        text: '新增客户偏好记录：最近喜欢做美甲',
        group: '画像回传',
      },
      {
        id: 'follow_new_info',
        owner: '数据前台',
        text: '新增客户信息：换了一辆电车',
        group: '画像回传',
      },
      {
        id: 'follow_archive',
        owner: '数据前台',
        text: '归档照片、反馈和本次服务复盘',
        group: '服务归档',
      },
    ],
  },
];

const customerGuidanceById: Record<number, CustomerGuidance> = {
  1: {
    source:
      '07月12日水光补水管理记录 + 护理后回访 + 当前哺乳期、敏感肌与提亮诉求',
    previousProject: '水光补水管理 · ¥980',
    previousResult:
      '护理后皮肤整体稳定、补水感明显，两颊轻微泛红未持续；客户满意度 5/5。',
    todayAssessment:
      '先核对今天是否刺痛、脱皮、爆痘或更换护肤品，再观察两颊、额头与嘴周；当前重点是黄气和局部暗沉，不把历史敏感当作今天的结论。',
    primaryRecommendation:
      '本次继续三明治美白：先做温和补水与舒缓，再在额头、嘴周暗沉位置按已批准SOP局部加强，兼顾提亮与滋润。',
    optionalRecommendation:
      '本次不追加高刺激项目；护理后以居家保湿、防晒和 D+3 效果回访作为增强方案。',
    safetyBoundary:
      '哺乳期与敏感肌只做生活美容范围内的温和护理；出现持续刺痛、明显泛红或不适立即暂停，不承诺马上变白或绝不反黑。',
    consultationSteps: [
      {
        stage: '01 · 承接上次',
        title: '先说上次真实结果',
        purpose: '让客户感到被记住，同时为今天的评估建立依据。',
        script:
          '启慧，上次做完水光补水后，您反馈整体很舒服，皮肤的水润度也保持得不错，两颊当时有一点点红但没有持续。今天我们还是先看您此刻的真实状态，再决定怎么做。',
      },
      {
        stage: '02 · 四问一看',
        title: '确认今天的变化',
        purpose: '先问感受，再观察额头、嘴周和两颊，不直接下结论。',
        script:
          '这几天有没有刺痛、脱皮或突然冒痘？最近有没有换新的护肤品？您今天最想改善的是黄气、暗沉，还是整体没精神的感觉？我再帮您一起看一下额头、嘴周和两颊。',
      },
      {
        stage: '03 · 给出方案',
        title: '说明为什么这样搭配',
        purpose: '把上次补水基础与这次提亮目标连起来。',
        script:
          '您上次补水后的稳定度不错，所以今天可以在保留温和补水和滋润的基础上，做三明治美白；额头和嘴周我会做局部加强，两颊按今天的耐受度处理，不追求一次做得过重。',
      },
      {
        stage: '04 · 共同确认',
        title: '说明边界后再开始',
        purpose: '降低顾虑，让客户对项目和注意事项有清晰预期。',
        script:
          '今天我们以温和提亮和肤感改善为目标，不做侵入类或高刺激项目。过程中有任何刺痛或不舒服您马上告诉我，我会立即停下来复核。这个安排您确认后我们再开始。',
      },
    ],
    enhancementTheme:
      '把“上次补水后更稳定”与“本次在稳定基础上做提亮”连成一条真实效果线索。',
    enhancementSteps: [
      {
        stage: '开始服务',
        title: '先强化上次的好基础',
        purpose: '唤起客户对上次效果的正向记忆。',
        script:
          '启慧，您上次补水做完后的稳定度和水润感都不错，这说明皮肤对温和补水的接受度很好。今天我们就在这个基础上继续做提亮，不会为了追求快而把护理做重。',
      },
      {
        stage: '局部加强',
        title: '让客户知道加强在哪里',
        purpose: '把效果增强落到可理解的具体区域。',
        script:
          '我现在会在额头和嘴周暗沉的位置多做一点细致加强；两颊还是以舒缓和稳定为主，这样提亮会更均匀，肤感也更舒服。',
      },
      {
        stage: '服务中段',
        title: '用感受验证效果',
        purpose: '让客户参与确认，不替客户宣布效果。',
        script:
          '现在这一侧已经完成了，您可以感受一下紧绷感有没有减轻、皮肤是不是更润一些。等两边都完成后，我们再一起对照整体的透亮感。',
      },
      {
        stage: '护理结束',
        title: '照镜时说具体变化',
        purpose: '强调真实可见变化，同时交代效果维护。',
        script:
          '您看，今天额头和嘴周的暗沉感柔和了一些，整体看起来更有水润感。上次补水带来的稳定基础很好，这次是在这个基础上把提亮继续往前推进；回去做好保湿和防晒，三天后我再跟您确认肤感。',
      },
    ],
  },
  2: {
    source: '07月26日深层补水记录 + 最近回访 + 安静休息偏好',
    previousProject: '深层补水管理',
    previousResult:
      '护理后紧绷感减轻，第二天肤感仍柔软；客户希望服务中减少聊天。',
    todayAssessment:
      '确认近期空调环境、饮水与紧绷区域，重点观察鼻翼和面颊的缺水感。',
    primaryRecommendation:
      '继续深层补水管理，面颊分层补水、鼻翼减少摩擦，服务中保持安静。',
    optionalRecommendation:
      '眼周可做温和保湿加强；不在同次叠加清洁力度较高的项目。',
    safetyBoundary:
      '只依据当日肤况调整护理强度，不用单次水润感替代长期皮肤管理结论。',
    consultationSteps: [
      {
        stage: '01 · 回顾',
        title: '承接上次补水感受',
        purpose: '确认上次效果是否持续。',
        script:
          '晓雯，上次做完后您说紧绷感轻了很多，第二天摸起来也比较柔软。今天这种水润感大概维持了多久？',
      },
      {
        stage: '02 · 评估',
        title: '找到今天最干的位置',
        purpose: '让项目针对真实区域。',
        script:
          '最近空调吹得多吗？现在最容易干的是面颊、鼻翼还是嘴周？我先看一下今天的状态，再调整每个区域的补水层次。',
      },
      {
        stage: '03 · 方案',
        title: '说明分区补水',
        purpose: '让客户理解不是机械重复上次项目。',
        script:
          '今天还是补水管理，但会把面颊做得更细一些，鼻翼减少摩擦，眼周只做温和保湿；服务中我尽量不打扰您休息。',
      },
      {
        stage: '04 · 确认',
        title: '确认舒适度与安静偏好',
        purpose: '把沟通偏好落实为服务动作。',
        script:
          '过程中我只在关键步骤轻声确认一次舒适度，其他时间您安心休息，有任何不舒服随时示意我就好。',
      },
    ],
    enhancementTheme: '用“上次紧绷减轻、第二天仍柔软”承接今天的分区补水。',
    enhancementSteps: [
      {
        stage: '开始服务',
        title: '唤起上次柔软肤感',
        purpose: '建立连续管理感。',
        script:
          '上次做完您第二天还觉得皮肤比较柔软，说明补水的接受度不错。今天我们把这份水润感继续巩固。',
      },
      {
        stage: '面颊加强',
        title: '说明分区变化',
        purpose: '把效果增强说具体。',
        script:
          '今天面颊的缺水感比鼻翼更明显，我会在这里多做一层温和补水，鼻翼则减少摩擦。',
      },
      {
        stage: '服务中段',
        title: '轻声确认不打扰',
        purpose: '在安静偏好下完成效果确认。',
        script:
          '晓雯，我只轻声确认一下：现在面颊有没有更放松、更柔润一些？如果舒服您继续休息就好。',
      },
      {
        stage: '护理结束',
        title: '对照紧绷与柔软度',
        purpose: '用客户能感知的指标描述效果。',
        script:
          '今天先看紧绷感和柔软度，面颊摸起来比刚到店时更饱满一些。回去正常保湿，明天我再问您持续感受。',
      },
    ],
  },
  3: {
    source: '首次到店建档 + 当前舒缓修护诉求 + 怕冷标签',
    previousProject: '暂无历史消费记录',
    previousResult:
      '首次到店，不套用他人案例或虚构上次效果，以本次即时感受建立基线。',
    todayAssessment:
      '先确认泛红、刺痒、近期换护肤品及温度舒适度，建立首份皮肤与服务偏好记录。',
    primaryRecommendation:
      '本次以舒缓修护为主，减少摩擦和叠加项目，先建立耐受与舒适基线。',
    optionalRecommendation:
      '护理结束记录泛红变化与舒适度，D+1 再决定后续补水或提亮安排。',
    safetyBoundary:
      '首次到店不使用“上次效果很好”类话术；不以肉眼观察替代医疗诊断。',
    consultationSteps: [
      {
        stage: '01 · 建立基线',
        title: '说明首次评估逻辑',
        purpose: '让客户知道今天先求稳。',
        script:
          '雅琪，您是第一次来，我们不会直接套固定方案。先了解今天真实的不舒服和泛红位置，再从最温和的修护开始。',
      },
      {
        stage: '02 · 询问',
        title: '确认敏感诱因',
        purpose: '减少不必要刺激。',
        script:
          '最近有没有刺痒、脱皮或更换护肤品？冷风和热水会不会让皮肤更红？您最希望今天先缓解哪一种感受？',
      },
      {
        stage: '03 · 方案',
        title: '解释先修护后管理',
        purpose: '管理项目预期。',
        script:
          '今天先做舒缓修护，减少摩擦和项目叠加；等我们有了这次真实反馈，再决定后续是补水还是提亮。',
      },
      {
        stage: '04 · 确认',
        title: '建立暂停信号',
        purpose: '保证首次服务安全感。',
        script:
          '过程中如果有刺痛、发热或温度不舒服，您马上告诉我，我们随时可以暂停调整。',
      },
    ],
    enhancementTheme:
      '首次到店以即时舒适度和前后对照建立效果证据，不虚构历史效果。',
    enhancementSteps: [
      {
        stage: '开始服务',
        title: '强调今天先求稳',
        purpose: '降低第一次服务的不确定感。',
        script:
          '今天我们的效果重点不是做得越多越好，而是让泛红区域更安稳、肤感更舒服。',
      },
      {
        stage: '服务中段',
        title: '记录即时感受',
        purpose: '建立个人基线。',
        script:
          '现在这一步完成后，您感觉刺痒或发热有没有减轻？我会把您的真实感受记录下来。',
      },
      {
        stage: '局部处理',
        title: '说明为何减少刺激',
        purpose: '让减法护理显得有依据。',
        script:
          '两颊今天比较敏感，我这里会减少摩擦，不额外叠加刺激步骤，这是为了把舒适和稳定放在第一位。',
      },
      {
        stage: '护理结束',
        title: '建立下次可比较记录',
        purpose: '为复购沟通提供真实依据。',
        script:
          '今天的泛红和舒适度我们已经拍照记录，明天再看持续感受；下次就可以根据您的真实反馈做更精准的安排。',
      },
    ],
  },
  4: {
    source: '上次面部轮廓管理记录 + 固定技师反馈 + VIP 服务偏好',
    previousProject: '面部轮廓管理',
    previousResult:
      '护理后下颌缘视觉更利落，肩颈放松感好；客户认可左右对照方式。',
    todayAssessment:
      '确认近期睡眠、咬肌紧张和左右侧差异，先拍同角度基线照再服务。',
    primaryRecommendation:
      '继续面部轮廓管理，重点下颌缘与咬肌放松，左右分区对照。',
    optionalRecommendation:
      '肩颈衔接放松作为效果辅助，不额外承诺瘦脸或永久改变。',
    safetyBoundary: '只描述即时视觉与放松感，不使用治疗、永久塑形等承诺。',
    consultationSteps: [
      {
        stage: '01 · 回顾',
        title: '承接上次下颌线反馈',
        purpose: '激活客户对效果的正向记忆。',
        script:
          '思妍，上次做完您很喜欢下颌缘更利落的感觉，肩颈也放松了不少。今天最近有没有熬夜或咬肌特别紧？',
      },
      {
        stage: '02 · 对照',
        title: '建立同角度基线',
        purpose: '让前后比较更可信。',
        script:
          '我们先按和上次一样的角度拍一张基线照，再看左右两侧紧张度，今天重点放在更紧的一侧。',
      },
      {
        stage: '03 · 方案',
        title: '说明轮廓与肩颈衔接',
        purpose: '解释效果增强路径。',
        script:
          '今天先放松肩颈和咬肌，再细做下颌缘；这样视觉线条会更自然，不会只追求用力。',
      },
      {
        stage: '04 · 确认',
        title: '限定即时效果范围',
        purpose: '避免过度承诺。',
        script:
          '我们看今天的即时线条和放松感，不承诺永久改变；您确认这个目标后我们开始。',
      },
    ],
    enhancementTheme: '用同角度左右对照，把上次下颌缘更利落的感受延续到本次。',
    enhancementSteps: [
      {
        stage: '开始服务',
        title: '先提上次认可点',
        purpose: '让客户记起明确效果。',
        script:
          '上次您最认可的是下颌缘更利落、肩颈更轻松，今天我们继续沿着这两个点做。',
      },
      {
        stage: '单侧完成',
        title: '进行左右即时对照',
        purpose: '用可见差异增强感知。',
        script:
          '这一侧先完成了，您可以看一下下颌缘的转折和脸侧的放松感，我们再做另一侧。',
      },
      {
        stage: '肩颈衔接',
        title: '解释放松对轮廓的帮助',
        purpose: '让辅助步骤有逻辑。',
        script:
          '肩颈放松以后，脸侧紧张感也会更自然，所以这一步是在帮助整体视觉更协调。',
      },
      {
        stage: '护理结束',
        title: '同角度复拍确认',
        purpose: '用一致条件呈现即时变化。',
        script:
          '我们按刚才同样角度再拍一张，今天重点看下颌缘清晰度和左右协调感，后续维持还要结合生活习惯。',
      },
    ],
  },
  5: {
    source: '上次肩颈舒压记录 + 上班族久坐情况 + 大力度偏好',
    previousProject: '肩颈舒压护理',
    previousResult: '护理后右侧紧张感下降，转头更轻松；客户偏好肩部大力度。',
    todayAssessment:
      '先确认疼痛、麻木等异常信号与左右紧张差异，再决定力度，不直接沿用上次强度。',
    primaryRecommendation:
      '继续肩颈舒压，右侧斜方肌重点放松，左侧以平衡和舒适为主。',
    optionalRecommendation:
      '服务后提供工位拉伸提醒；如有持续疼痛或麻木建议及时就医评估。',
    safetyBoundary:
      '不把放松护理描述为治疗；出现尖锐疼痛、麻木或头晕立即停止。',
    consultationSteps: [
      {
        stage: '01 · 回顾',
        title: '承接上次转头更轻松',
        purpose: '确认效果是否持续。',
        script:
          '静怡，上次做完右侧紧张感降了不少，转头也更轻松。这个状态维持了几天？',
      },
      {
        stage: '02 · 排查',
        title: '先问异常信号',
        purpose: '区分普通紧张与需停止的情况。',
        script:
          '最近有没有尖锐疼痛、麻木、头晕或手臂放射不适？如果有，我们今天先不做强刺激。',
      },
      {
        stage: '03 · 方案',
        title: '今天重新确认力度',
        purpose: '避免机械复用大力度。',
        script:
          '今天右侧还是比较紧，我会重点放松，但力度从中等开始，您觉得需要再加我们再调整。',
      },
      {
        stage: '04 · 确认',
        title: '建立即时反馈方式',
        purpose: '提高服务可控性。',
        script:
          '您用一到十分告诉我力度感受，控制在舒服但有效的范围，不需要忍痛。',
      },
    ],
    enhancementTheme:
      '强调上次右侧放松和转头轻松的真实感受，用活动度复测增强效果感知。',
    enhancementSteps: [
      {
        stage: '开始服务',
        title: '说出上次改善点',
        purpose: '让客户回忆身体感受。',
        script:
          '上次您右侧放松后转头明显轻松一些，今天我们先对比一下当前左右差异。',
      },
      {
        stage: '右侧加强',
        title: '说明为何重点处理',
        purpose: '让增强动作有依据。',
        script:
          '现在右侧比左侧紧一些，我会在这里多停留，但力度按您今天的耐受来。',
      },
      {
        stage: '服务中段',
        title: '复测活动度',
        purpose: '用动作而非口号验证效果。',
        script:
          '这一侧完成后您轻轻转一下头，感受范围和拉扯感有没有变化，我们再决定后面怎么调整。',
      },
      {
        stage: '护理结束',
        title: '总结真实改善',
        purpose: '把效果与居家维护连接。',
        script:
          '今天右侧拉扯感比刚来时轻了一些，转头也更顺。回去工作间隙做短时间拉伸，能帮助把轻松感维持得更久。',
      },
    ],
  },
  6: {
    source: '新客首次建档 + 净透焕肤诉求 + 当前皮肤观察',
    previousProject: '暂无历史消费记录',
    previousResult:
      '首次到店，没有历史效果可引用；以本次照片、感受和回访建立个人记录。',
    todayAssessment:
      '确认近期是否刷酸、晒伤、爆痘或使用功效型产品，观察油脂、角质与敏感区域。',
    primaryRecommendation:
      '先做温和净透与补水平衡，减少一次性叠加，服务后观察24小时反应。',
    optionalRecommendation: 'D+1 回访稳定后，再规划后续净透频率和居家护理。',
    safetyBoundary:
      '首次服务不承诺一次解决闭口、痘印或肤色问题；异常反应立即停止并建议专业评估。',
    consultationSteps: [
      {
        stage: '01 · 建档',
        title: '说明首次评估',
        purpose: '建立透明预期。',
        script:
          '若澜，您是第一次来，我们先把今天的皮肤状态和日常习惯了解清楚，不会直接把清洁力度做得很重。',
      },
      {
        stage: '02 · 询问',
        title: '确认近期功效产品',
        purpose: '避免叠加刺激。',
        script:
          '最近有没有刷酸、晒伤、爆痘，或者使用新的美白、祛痘产品？今天最想改善的是粗糙、油脂还是暗沉？',
      },
      {
        stage: '03 · 方案',
        title: '解释温和净透',
        purpose: '让客户理解第一次先建立耐受。',
        script:
          '今天先做温和净透和补水平衡，敏感区域减少摩擦；等看完24小时反应，再规划后续频率。',
      },
      {
        stage: '04 · 确认',
        title: '约定回访与记录',
        purpose: '把首次效果变成可追踪数据。',
        script:
          '我们会留存同光线照片，明天再回访您的肤感；有任何持续不适请及时联系我们。',
      },
    ],
    enhancementTheme:
      '首次到店不说“上次效果”，改用本次前后对照与24小时回访增强可信度。',
    enhancementSteps: [
      {
        stage: '开始服务',
        title: '明确首次效果指标',
        purpose: '把关注点从夸张结果转为真实感受。',
        script:
          '第一次我们重点看清爽度、柔软度和舒适度，不追求一次处理所有问题。',
      },
      {
        stage: '局部处理',
        title: '解释分区力度',
        purpose: '体现方案的个性化。',
        script:
          '鼻翼油脂感更明显，这里会细做；两颊相对敏感，我会减少摩擦和叠加。',
      },
      {
        stage: '服务中段',
        title: '邀请即时反馈',
        purpose: '记录客户个人耐受。',
        script:
          '现在完成一侧，您感受一下有没有刺痛或紧绷，您的反馈会成为以后调整方案的依据。',
      },
      {
        stage: '护理结束',
        title: '建立首份效果记录',
        purpose: '为下次沟通提供真实历史。',
        script:
          '今天整体清爽度和柔软度比刚来时更好一些，我们已经留存同光线照片；明天的肤感回访会决定下一步安排。',
      },
    ],
  },
};

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+08:00`);
}

function dateKeyFromDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function shiftDateKey(dateKey: string, amount: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKeyFromDate(date);
}

function displayDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function displayWeekday(dateKey: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'long',
  }).format(dateFromKey(dateKey));
}

function buildCalendarHistory(days: AppointmentHistoryDay[]) {
  const validDays = days
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/u.test(day.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (validDays.length === 0) {
    return [
      {
        date: initialSchedule.date || '2026-08-07',
        appointments: initialAppointments,
        schedule: initialSchedule,
      },
    ];
  }
  const byDate = new Map(validDays.map((day) => [day.date, day]));
  const today = dateKeyFromDate(new Date());
  const start = validDays[0].date;
  const latestImported = validDays[validDays.length - 1].date;
  const end = latestImported > today ? latestImported : today;
  const calendarDays: AppointmentHistoryDay[] = [];
  let cursor = start;
  while (cursor <= end && calendarDays.length < 730) {
    const archived = byDate.get(cursor);
    calendarDays.push(
      archived || {
        date: cursor,
        appointments: [],
        schedule: {
          date: cursor,
          label: displayDateLabel(cursor),
          weekday: displayWeekday(cursor),
          note: '当日没有同步到预约记录',
          sourceName: '每日预约归档',
        },
      },
    );
    cursor = shiftDateKey(cursor, 1);
  }
  return calendarDays;
}

function amountValue(amount: string) {
  return Number(amount.replace(/[^\d.]/gu, '')) || 0;
}

function currencyValue(value: number) {
  return `¥${value.toLocaleString('zh-CN')}`;
}

function settlementFor(appointment: Appointment): SettlementBreakdown {
  const totalReceivable = amountValue(appointment.amount);
  const accountText = `${appointment.member} ${appointment.tags.join(' ')}`;
  const recordedBalance =
    appointment.customerAsset?.currentBalance ??
    amountValue(appointment.cardBalance || '');
  let cardConsumption = 0;
  let projectWriteoff = 0;
  let onsiteReceivable = totalReceivable;
  let settlementBasis = '现场收款';

  if (/次卡|项目卡|疗程卡/u.test(accountText)) {
    projectWriteoff = totalReceivable;
    onsiteReceivable = 0;
    settlementBasis = '项目/次卡账户';
  } else if (recordedBalance > 0 && /储值|会员|黑钻|VIP/u.test(accountText)) {
    cardConsumption = Math.min(recordedBalance, totalReceivable);
    onsiteReceivable = Math.max(0, totalReceivable - cardConsumption);
    settlementBasis =
      onsiteReceivable > 0 ? '卡金抵扣 + 现场补差' : '会员卡金账户';
  }

  return {
    totalReceivable,
    cardConsumption,
    projectWriteoff,
    onsiteReceivable,
    settlementStatus: appointment.status === '已完成' ? '已结算' : '待结算',
    settlementBasis,
  };
}

function settlementTotals(appointments: Appointment[]) {
  return appointments.reduce(
    (totals, appointment) => {
      const settlement = settlementFor(appointment);
      totals.totalReceivable += settlement.totalReceivable;
      totals.cardConsumption += settlement.cardConsumption;
      totals.projectWriteoff += settlement.projectWriteoff;
      totals.onsiteReceivable += settlement.onsiteReceivable;
      if (settlement.settlementStatus === '已结算') {
        totals.settledReceivable += settlement.totalReceivable;
      }
      return totals;
    },
    {
      totalReceivable: 0,
      settledReceivable: 0,
      cardConsumption: 0,
      projectWriteoff: 0,
      onsiteReceivable: 0,
    },
  );
}

function chineseDateKey(value: string) {
  const match = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/u);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

const PRIORITY_THRESHOLD = 4;
function privilegeTierForAppointment(
  appointment: Appointment,
): CustomerPrivilegeTier | undefined {
  return customerPrivilegeTier(
    appointment.customerAsset?.memberLevel || appointment.member,
    appointment.customerAsset?.availableCardRights.map(
      (right: CustomerCardAvailableRight): string => right.cardName,
    ) || [],
  );
}

function shortDateKey(value: string | undefined, serviceDate: string) {
  const match = value?.match(/^(\d{1,2})月(\d{1,2})日$/u);
  if (!match || !serviceDate) return '';
  const year = Number(serviceDate.slice(0, 4));
  const month = Number(match[1]);
  const serviceMonth = Number(serviceDate.slice(5, 7));
  const inferredYear = month > serviceMonth + 6 ? year - 1 : year;
  return `${inferredYear}-${String(month).padStart(2, '0')}-${String(Number(match[2])).padStart(2, '0')}`;
}

function priorityAssessmentFor(
  appointment: Appointment,
  serviceDate: string,
  previousAppointments: WeeklyAppointment[],
): PriorityAssessment | null {
  const privilegeTier: CustomerPrivilegeTier | undefined =
    privilegeTierForAppointment(appointment);
  if (!privilegeTier) return null;
  const reasons: string[] = [];
  const actions: string[] = [];
  let score = PRIORITY_THRESHOLD;
  reasons.push(`已购买${privilegeTier}特权卡，纳入今日重点客户清单`);
  actions.push(`按${privilegeTier}权益标准复核服务细节与历史消费记录`);
  const asset = appointment.customerAsset;
  const assetTags = asset
    ? [
        ...asset.primarySkinConcerns,
        ...asset.healthFlags,
        ...asset.serviceRisks,
      ]
    : [];
  const tags = [...appointment.tags, ...assetTags].filter(
    (tag) =>
      !['历史工作台恢复', '飞书预约表同步', '标准流程Demo'].includes(tag),
  );
  const explicitTags = tags.filter((tag) => /重点关怀|重点关注/u.test(tag));
  const healthTags = tags.filter((tag) =>
    /哺乳|孕期|备孕|过敏|禁忌|术后|恢复期/u.test(tag),
  );
  const skinTags = tags.filter((tag) =>
    /敏感|肤况观察|耐受|泛红|痘|屏障/u.test(tag),
  );
  const newClientTags = tags.filter((tag) =>
    /新客|首次到店|需建档|待建档|资料待补全/u.test(tag),
  );
  const comfortTags = tags.filter((tag) =>
    /怕冷|力度关注|大力度|温度关注|疼痛|高温到店/u.test(tag),
  );

  const lastSpend = amountValue(appointment.lastSpend || '');
  const totalSpend = asset?.totalSpend ?? 0;
  const currentAmount = amountValue(appointment.amount);
  const cardBalance =
    asset?.currentBalance ?? amountValue(appointment.cardBalance || '');
  const remainingTimes = (appointment.remainingProjects || []).reduce(
    (total, project) => total + project.times,
    0,
  );
  const hasRemainingProjects = Boolean(appointment.remainingProjects?.length);
  const consumptionSummary = [
    `累计消费${totalSpend ? `¥${totalSpend.toLocaleString('zh-CN')}` : '待确认'}`,
    `上次消费${lastSpend ? `¥${lastSpend.toLocaleString('zh-CN')}` : '待确认'}`,
    `卡内余额${cardBalance ? `¥${cardBalance.toLocaleString('zh-CN')}` : '待确认'}`,
    `剩余项目${hasRemainingProjects ? `${remainingTimes}次` : '待确认'}`,
    `上次到店${appointment.lastVisit || '待确认'}`,
  ].join(' · ');

  if (totalSpend >= 10_000 || lastSpend >= 2_000 || cardBalance >= 10_000) {
    score += 4;
    reasons.push(
      `历史消费需要保持服务一致性：累计消费${totalSpend ? `¥${totalSpend.toLocaleString('zh-CN')}` : '待确认'}，卡内余额${cardBalance ? `¥${cardBalance.toLocaleString('zh-CN')}` : '待确认'}`,
    );
    actions.push(
      '核对历史项目、固定技师、上次效果与会员权益，避免服务体验断层',
    );
  }
  if (
    cardBalance > 0 &&
    lastSpend > 0 &&
    cardBalance <= Math.max(lastSpend * 1.2, 1_500)
  ) {
    score += 3;
    reasons.push(
      `消费余额需要提前说明：卡内余额${appointment.cardBalance}，接近上次消费${appointment.lastSpend}`,
    );
    actions.push('到店前核对本次核销方式与余额，不临场制造补款压力');
  }
  if (hasRemainingProjects && remainingTimes <= 1) {
    score += 3;
    reasons.push(`历史项目余次偏低：当前仅剩 ${remainingTimes} 次`);
    actions.push('先说明现有项目余次和使用顺序，再讨论后续方案');
  }

  const previousVisitKey = shortDateKey(appointment.lastVisit, serviceDate);
  if (previousVisitKey) {
    const daysSinceVisit = Math.floor(
      (dateFromKey(serviceDate).getTime() -
        dateFromKey(previousVisitKey).getTime()) /
        86_400_000,
    );
    if (daysSinceVisit >= 45) {
      score += 2;
      reasons.push(
        `距离上次到店已有 ${daysSinceVisit} 天，需要重新确认当前状态`,
      );
      actions.push('不要直接照搬上次方案，先重新观察并记录本次基线');
    }
  }
  if (
    lastSpend > 0 &&
    currentAmount > 0 &&
    Math.abs(currentAmount - lastSpend) / lastSpend >= 0.35
  ) {
    score += 2;
    reasons.push('本次总应收与历史消费差异较大，需要确认项目与会员权益一致');
    actions.push('前台先说明金额变化依据，客户确认后再执行或核销');
  }
  const lastAppointment = previousAppointments.at(-1);
  if (lastAppointment && lastAppointment.project !== appointment.project) {
    score += 2;
    reasons.push(
      `本次项目与历史记录不同：上次${lastAppointment.project}，本次${appointment.project}`,
    );
    actions.push('结合上次真实反馈说明项目变化原因，不默认客户已经理解');
  }

  if (healthTags.length > 0) {
    score += 4;
    reasons.push(`健康状态需优先复核：${healthTags.join('、')}`);
    actions.push('护理前再次确认今天的真实状态、耐受与项目边界');
  }
  if (skinTags.length > 0) {
    score += 2;
    reasons.push(`肤况需要到店复核：${skinTags.join('、')}`);
    actions.push('先观察、询问和留档，再决定项目步骤与强度');
  }
  if (
    newClientTags.length > 0 ||
    appointment.lastVisit === '首次到店' ||
    /新客/u.test(appointment.member)
  ) {
    score += 4;
    reasons.push(
      `首次到店或档案待建立${newClientTags.length ? `：${newClientTags.join('、')}` : ''}`,
    );
    actions.push('前台先补齐基础档案，技师建立肤况、耐受和效果基线');
  }
  if (comfortTags.length > 0) {
    score += 1;
    reasons.push(`服务体验需特别确认：${comfortTags.join('、')}`);
    actions.push('服务前确认温度、力度与不适反馈方式，并在护理中复核');
  }

  if (asset?.serviceRisks.length) {
    score += 3;
    reasons.push(`客户资料库已记录服务雷区：${asset.serviceRisks.join('、')}`);
    actions.push('前台和当次技师服务前共同复核雷区，并在交接中明确确认');
  }
  if (asset && asset.profileCompleteness < 45) {
    score += 3;
    reasons.push(
      `客户档案完整度仅 ${asset.profileCompleteness}%，关键资料需要补全`,
    );
    actions.push('只补充缺失信息，不覆盖客户资料库已有的真实记录');
  }
  if (
    asset?.projectPreferences.length &&
    !asset.projectPreferences.some((project: string) =>
      appointment.project.includes(project),
    )
  ) {
    score += 2;
    reasons.push(
      `本次项目与档案需求需复核：档案偏好${asset.projectPreferences.join('、')}，本次${appointment.project}`,
    );
    actions.push('到店后先说明本次项目与历史需求的关联，再由客户确认执行');
  }

  if (explicitTags.length > 0) {
    score += 2;
    reasons.push(`档案已有人工重点标记：${explicitTags.join('、')}`);
    actions.push('到店前由前台和当次技师共同复核历史关怀记录');
  }

  const unresolved: string[] = [];
  if (/待确认/u.test(appointment.project)) unresolved.push('项目待确认');
  if (/待/u.test(appointment.room)) unresolved.push('房间待安排');
  if (/待填写|待分配/u.test(appointment.technician)) {
    unresolved.push('当次技师待确认');
  }
  if (!/^¥/u.test(appointment.amount)) unresolved.push('金额待确认');
  if (unresolved.length > 0) {
    score += 4;
    reasons.push(`预约资料未闭环：${unresolved.join('、')}`);
    actions.push('到店前由前台补齐预约信息，确认后再进入标准服务流程');
  }

  const expiringProjects = (appointment.remainingProjects || []).filter(
    (project) => {
      const expiryKey = chineseDateKey(project.expires);
      if (!expiryKey || !serviceDate) return false;
      const days = Math.ceil(
        (dateFromKey(expiryKey).getTime() -
          dateFromKey(serviceDate).getTime()) /
          86_400_000,
      );
      return days <= 60;
    },
  );
  if (expiringProjects.length > 0) {
    score += 4;
    reasons.push(
      `项目临近或已经到期：${expiringProjects.map((item) => item.name).join('、')}`,
    );
    actions.push('沟通时核对剩余次数和有效期，不在客户不知情时直接核销');
  }

  if (
    /黑钻|VIP/u.test(appointment.member) &&
    appointment.fixedTechnician !== appointment.technician
  ) {
    score += 2;
    reasons.push(
      `会员服务一致性需交接：固定技师${appointment.fixedTechnician}，本次技师${appointment.technician}`,
    );
    actions.push('服务前完成历史效果、沟通偏好和操作力度交接');
  }

  if (score < PRIORITY_THRESHOLD) return null;
  return { appointment, score, reasons, actions, consumptionSummary };
}

function normalizedPersonName(value: string) {
  return value.replace(/\s+/gu, '').toLowerCase();
}

function appointmentRecordKey(date: string, appointmentId: number) {
  return `${date}:${appointmentId}`;
}

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort(
    (left, right) => right[1] - left[1],
  )[0];
}

function buildEmployeeWeeklyReport(
  technician: string,
  appointments: WeeklyAppointment[],
): EmployeeWeeklyReport {
  const completedAppointments = appointments.filter(
    (item) => item.status === '已完成',
  );
  const completedCount = completedAppointments.length;
  const inServiceCount = appointments.filter(
    (item) => item.status === '服务中',
  ).length;
  const pendingCount = appointments.length - completedCount - inServiceCount;
  const settlements = settlementTotals(appointments);
  const completionRate = appointments.length
    ? Math.round((completedCount / appointments.length) * 100)
    : 0;
  const averageTicket = appointments.length
    ? Math.round(settlements.totalReceivable / appointments.length)
    : 0;
  const popularProject = mostFrequent(appointments.map((item) => item.project));
  const strengths = [
    completedCount > 0
      ? `已完成 ${completedCount} 位客户，已结算应收 ${currencyValue(settlements.settledReceivable)}。`
      : appointments.length > 0
        ? '本周预约均已进入个人明细，客户、项目和服务时间可逐条追踪。'
        : '本周暂无预约分配。',
    popularProject
      ? `${popularProject[0]}共 ${popularProject[1]} 人次，是本周最熟悉的服务项目。`
      : '同步预约后会自动识别个人优势项目。',
    appointments.length > 0
      ? `个人总应收 ${currencyValue(settlements.totalReceivable)}：卡金消耗 ${currencyValue(settlements.cardConsumption)}、项目核销 ${currencyValue(settlements.projectWriteoff)}、现场应收 ${currencyValue(settlements.onsiteReceivable)}。`
      : '个人结算结构会在预约分配后自动汇总。',
  ];
  const improvements = [
    pendingCount > 0
      ? `还有 ${pendingCount} 人次待执行，需要继续完成标准流程与服务闭环。`
      : '待执行预约已全部处理。',
    inServiceCount > 0
      ? `${inServiceCount} 人次处于服务中，完成后需补齐护理记录与回访安排。`
      : '当前没有停留在服务中的预约。',
    completionRate < 60 && appointments.length > 0
      ? `当前预约闭环率为 ${completionRate}%，建议优先处理已到店客户并及时更新状态。`
      : `当前预约闭环率为 ${completionRate}%，继续保持逐单更新。`,
  ];
  return {
    technician,
    appointments,
    completedCount,
    inServiceCount,
    pendingCount,
    totalReceivable: settlements.totalReceivable,
    settledReceivable: settlements.settledReceivable,
    cardConsumption: settlements.cardConsumption,
    projectWriteoff: settlements.projectWriteoff,
    onsiteReceivable: settlements.onsiteReceivable,
    completionRate,
    averageTicket,
    strengths,
    improvements,
  };
}

const clientTabs = [
  '客户档案',
  '本次诊断',
  '服务流程',
  '效果增强',
  '护理记录',
  '跟进维护',
];

function StatusPill({ status }: { status: AppointmentStatus }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

function MiniIcon({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`mini-icon mini-icon-${tone}`}>{children}</span>;
}

function getCustomerGuidance(appointment: Appointment): CustomerGuidance {
  const asset = appointment.customerAsset;
  if (asset) {
    const skinConcerns = asset.primarySkinConcerns.join('、') || '到店确认肤况';
    const projectPreferences =
      asset.projectPreferences.join('、') || appointment.project;
    const healthFlags = asset.healthFlags.join('、');
    const serviceRisks = asset.serviceRisks.join('、');
    const decisionFactors = asset.decisionFactors.join('、');
    const entryMotives = asset.entryMotives.join('、');
    const optionalProject = asset.projectPreferences.find(
      (project: string) => !appointment.project.includes(project),
    );
    return {
      source: `客户资料库真实档案（完整度 ${asset.profileCompleteness}%）+ 本次${appointment.project}预约`,
      previousProject: `档案项目偏好：${projectPreferences}`,
      previousResult:
        `累计消费${asset.totalSpend === undefined ? '待补充' : `¥${asset.totalSpend.toLocaleString('zh-CN')}`}，` +
        `当前余额${asset.currentBalance === undefined ? '待补充' : `¥${asset.currentBalance.toLocaleString('zh-CN')}`}；效果仍以客户本次真实反馈为准。`,
      todayAssessment: `重点确认${skinConcerns}${healthFlags ? `；健康注意事项：${healthFlags}` : ''}。`,
      primaryRecommendation: `本次以${appointment.project}为主，结合资料库中的${projectPreferences}和今天的真实耐受调整步骤。`,
      optionalRecommendation: optionalProject
        ? `客户档案同时记录了${optionalProject}需求，仅在本次状态适合且客户主动确认时作为后续建议。`
        : '本次不追加未记录需求，服务后根据真实效果再形成下一次建议。',
      safetyBoundary: [
        serviceRisks ? `严格避开服务雷区：${serviceRisks}` : '',
        healthFlags ? `护理前复核：${healthFlags}` : '',
        '不承诺确定效果，出现不适立即暂停。',
      ]
        .filter(Boolean)
        .join('；'),
      consultationSteps: [
        {
          stage: '01 · 档案复核',
          title: '确认资料库中的真实需求',
          purpose: '避免套用固定模板或其他客户信息。',
          script: `${appointment.nickname}，我看到您档案里主要关注${skinConcerns}${entryMotives ? `，这次到店需求来源是${entryMotives}` : ''}，今天有没有新的变化？`,
        },
        {
          stage: '02 · 今日评估',
          title: '确认肤况与健康边界',
          purpose: '历史档案用于提示，今天的状态决定实际执行。',
          script: `开始前我会再确认今天的真实肤况和耐受${healthFlags ? `，尤其是${healthFlags}` : ''}，如有不舒服我们随时暂停调整。`,
        },
        {
          stage: '03 · 说明方案',
          title: '把项目与历史需求对齐',
          purpose: '说明为什么这样安排，而不是强推。',
          script: `今天先以${appointment.project}为主，因为它和您档案里的${projectPreferences}需求相衔接；具体强度以现场评估为准。`,
        },
        {
          stage: '04 · 共同确认',
          title: '按客户决策方式完成确认',
          purpose: '尊重消费决策因素与沟通节奏。',
          script: decisionFactors
            ? `您档案里比较关注${decisionFactors}，我先把这部分说明清楚，您确认后我们再开始。`
            : '我先把步骤、边界和预期说明清楚，您确认后我们再开始。',
        },
      ],
      enhancementTheme: `围绕${skinConcerns}和本次${appointment.project}建立真实前后对照，延续档案中的项目需求。`,
      enhancementSteps: [
        {
          stage: '开始服务',
          title: '明确本次观察指标',
          purpose: '将客户历史需求转成可观察的效果目标。',
          script: `今天我们重点看${skinConcerns}在舒适度、肤感和重点区域上的变化，不做夸张承诺。`,
        },
        {
          stage: '重点区域',
          title: '说明增强动作依据',
          purpose: '让客户知道动作来自真实档案和现场判断。',
          script: `您的档案一直关注${skinConcerns}，这个区域今天状态适合，我会在安全范围内做更细致的处理。`,
        },
        {
          stage: '服务中段',
          title: '按偏好复核体验',
          purpose: '同时验证力度、温度和沟通偏好。',
          script: `目前的舒适度和力度是否合适？我会把您今天新增的感受继续写回客户资料库。`,
        },
        {
          stage: '护理结束',
          title: '形成新的效果资产',
          purpose: '让本次真实结果成为下次诊断依据。',
          script: `我们用同样光线和角度确认今天的变化，并记录您的真实感受，后续回访和下次方案都会以这次结果为依据。`,
        },
      ],
    };
  }
  return (
    customerGuidanceById[appointment.id] ?? {
      source: `${appointment.member}客户档案 + 当前${appointment.project}预约 + ${appointment.tags.join('、')}标签`,
      previousProject: '历史项目待补充',
      previousResult:
        '暂未读取到完整历史效果，先以本次到店询问、观察和同光线照片建立依据。',
      todayAssessment: `先确认今天的真实状态、近期护理变化和主要诉求，再判断${appointment.project}是否需要调整。`,
      primaryRecommendation: `以${appointment.project}为本次主项目，实际步骤和强度以今天的耐受与已批准SOP为准。`,
      optionalRecommendation:
        '本次结束后记录即时感受并安排 D+1 回访，再决定后续项目。',
      safetyBoundary:
        '历史信息不足时不猜测、不套用他人案例、不承诺确定效果；出现不适立即暂停。',
      consultationSteps: [
        {
          stage: '01 · 补齐历史',
          title: '确认上次项目与反馈',
          purpose: '补全生成个性化方案所需的依据。',
          script: `${appointment.nickname}，我先跟您确认一下上次做的项目、做完后的感受，以及效果大概维持了多久。`,
        },
        {
          stage: '02 · 今日评估',
          title: '询问今天的真实状态',
          purpose: '不把历史状态直接当作今天结论。',
          script:
            '今天有没有刺痛、紧绷、脱皮或其他不舒服？您这次最希望先改善哪一个问题？',
        },
        {
          stage: '03 · 说明方案',
          title: '讲清项目与调整理由',
          purpose: '让客户理解每个服务动作。',
          script: `今天先以${appointment.project}为主，我会根据刚才确认的状态调整重点区域和服务强度。`,
        },
        {
          stage: '04 · 共同确认',
          title: '说明边界再开始',
          purpose: '建立合理预期和暂停信号。',
          script:
            '过程中如果有任何不舒服请马上告诉我，我们会立即暂停复核；您确认后我们再开始。',
        },
      ],
      enhancementTheme:
        '历史效果资料不足时，使用本次真实前后对照和客户感受进行效果引导。',
      enhancementSteps: [
        {
          stage: '开始服务',
          title: '明确今天的效果指标',
          purpose: '让效果可观察、可回访。',
          script:
            '今天我们先约定看舒适度、肤感和重点区域的即时变化，不做夸张承诺。',
        },
        {
          stage: '重点区域',
          title: '说明增强动作',
          purpose: '让客户知道为什么在这里加强。',
          script:
            '这个区域今天更需要关注，我会在安全范围内多做一点细致处理，其他区域以稳定为主。',
        },
        {
          stage: '服务中段',
          title: '邀请客户参与确认',
          purpose: '用真实感受代替单向宣告效果。',
          script:
            '这一侧已经完成，您感受一下和刚开始相比有没有更舒服，我们再调整后面的步骤。',
        },
        {
          stage: '护理结束',
          title: '记录真实结果',
          purpose: '为下次方案建立可靠历史。',
          script:
            '我们用同样光线和角度一起看今天的变化，并把您的感受记录下来，明天再回访持续情况。',
        },
      ],
    }
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [appointmentItems, setAppointmentItems] =
    useState<Appointment[]>(initialAppointments);
  const [appointmentSchedule, setAppointmentSchedule] =
    useState<AppointmentSchedule>(initialSchedule);
  const [staffSchedules, setStaffSchedules] = useState<ServiceStaffSchedule[]>(
    () => defaultStaffSchedules(initialSchedule.date || '2026-08-07'),
  );
  const [appointmentHistory, setAppointmentHistory] = useState<
    AppointmentHistoryDay[]
  >(() =>
    buildCalendarHistory([
      {
        date: initialSchedule.date || '2026-08-07',
        appointments: initialAppointments,
        schedule: initialSchedule,
      },
    ]),
  );
  const [selectedDate, setSelectedDate] = useState(
    initialSchedule.date || '2026-08-07',
  );
  const [selectedId, setSelectedId] = useState(initialAppointments[0].id);
  const [filter, setFilter] = useState('全部');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('服务流程');
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [doneTasks, setDoneTasks] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    number | null
  >(null);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stageSyncStatus, setStageSyncStatus] = useState<
    'idle' | 'sent' | 'error'
  >('idle');
  const [savingTask, setSavingTask] = useState('');
  const [currentActor, setCurrentActor] = useState('数据前台');
  const [currentActorUserId, setCurrentActorUserId] = useState('');
  const [cloudState, setCloudState] = useState<'loading' | 'saved' | 'error'>(
    'loading',
  );
  const [feishuConfigured, setFeishuConfigured] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [signSecretInput, setSignSecretInput] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [cardWalletOpen, setCardWalletOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [profileNote, setProfileNote] = useState('');
  const [technicianModalOpen, setTechnicianModalOpen] = useState(false);
  const [technicianDraft, setTechnicianDraft] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [followupCreated, setFollowupCreated] = useState<string[]>([]);
  const [newAppointmentName, setNewAppointmentName] = useState('');
  const [newAppointmentTime, setNewAppointmentTime] = useState('19:30');
  const [newAppointmentRoom, setNewAppointmentRoom] = useState('单人间1');
  const [newAppointmentTechnician, setNewAppointmentTechnician] =
    useState('欣欣');
  const [newAppointmentNurse, setNewAppointmentNurse] = useState('');
  const [newAppointmentNurseShift, setNewAppointmentNurseShift] =
    useState<ServiceStaffShift>('早班');
  const [newAppointmentFrontDesk, setNewAppointmentFrontDesk] =
    useState('红红');
  const [newAppointmentFrontDeskShift, setNewAppointmentFrontDeskShift] =
    useState<ServiceStaffShift>('早班');
  const [newAppointmentShift, setNewAppointmentShift] =
    useState<ServiceStaffShift>('早班');
  const [newAppointmentProjectId, setNewAppointmentProjectId] = useState(
    YOUZAN_SERVICE_CATALOG[0]?.id || '',
  );
  const [newAppointmentProjectSearch, setNewAppointmentProjectSearch] =
    useState('');
  const [newAppointmentCategory, setNewAppointmentCategory] =
    useState<(typeof YOUZAN_SERVICE_CATEGORIES)[number]>('全部');
  const [viewerRole, setViewerRole] = useState<ViewerRole>('employee');
  const [viewerJobRole, setViewerJobRole] =
    useState<ServiceJobRole>('unassigned');
  const [servicePermissions, setServicePermissions] =
    useState<ServicePermissionScope>(EMPTY_SERVICE_PERMISSIONS);
  const [canEditAppointments, setCanEditAppointments] = useState(false);
  const [canEditStaffSchedule, setCanEditStaffSchedule] = useState(false);
  const [canManageStaffRoles, setCanManageStaffRoles] = useState(false);
  const [platformRoles, setPlatformRoles] = useState<string[]>([]);
  const [savingStaffName, setSavingStaffName] = useState('');
  const [viewerName, setViewerName] = useState('正在识别身份');
  const [roleLoading, setRoleLoading] = useState(true);
  const [activePortal, setActivePortal] = useState<ActivePortal>('employee');
  const [workspaceView, setWorkspaceView] =
    useState<WorkspaceView>('service_desk');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [ownerSection, setOwnerSection] = useState<OwnerSection>('overview');
  const [employeeSection, setEmployeeSection] =
    useState<EmployeeSection>('overview');
  const [assetFocusQuery, setAssetFocusQuery] = useState<string>('');
  const [selectedWeeklyTechnician, setSelectedWeeklyTechnician] = useState('');
  const [employeePreviewName, setEmployeePreviewName] = useState('欣欣');
  const [deletedAppointmentIds, setDeletedAppointmentIds] = useState<string[]>(
    [],
  );
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [restoreSavingId, setRestoreSavingId] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const clientContentRef = useRef<HTMLDivElement>(null);
  const autoSyncedStageKeysRef = useRef(new Set<string>());
  const appointmentHistoryRef =
    useRef<AppointmentHistoryDay[]>(appointmentHistory);
  const selectedDateRef = useRef(selectedDate);
  const historyLoadedRef = useRef(false);

  const selectedNewAppointmentService = useMemo(
    () =>
      YOUZAN_SERVICE_CATALOG.find(
        (service) => service.id === newAppointmentProjectId,
      ),
    [newAppointmentProjectId],
  );
  const filteredNewAppointmentServices = useMemo(() => {
    const keyword = newAppointmentProjectSearch.trim().toLocaleLowerCase();
    return YOUZAN_SERVICE_CATALOG.filter((service) => {
      const matchesCategory =
        newAppointmentCategory === '全部' ||
        service.category === newAppointmentCategory;
      const searchText = `${service.name} ${service.category} ${service.tag}`;
      return (
        matchesCategory &&
        (!keyword || searchText.toLocaleLowerCase().includes(keyword))
      );
    });
  }, [newAppointmentCategory, newAppointmentProjectSearch]);
  const skinManagerSchedules = useMemo(
    () => staffSchedules.filter((schedule) => schedule.role === 'skin_manager'),
    [staffSchedules],
  );
  const nurseSchedules = useMemo(
    () => staffSchedules.filter((schedule) => schedule.role === 'nurse'),
    [staffSchedules],
  );
  const frontDeskSchedules = useMemo(
    () => staffSchedules.filter((schedule) => schedule.role === 'front_desk'),
    [staffSchedules],
  );

  useEffect(() => {
    const selectedSchedule = skinManagerSchedules.find(
      (schedule) => schedule.staffName === newAppointmentTechnician,
    );
    if (selectedSchedule) setNewAppointmentShift(selectedSchedule.shift);
  }, [newAppointmentTechnician, skinManagerSchedules]);

  useEffect(() => {
    const selectedSchedule = nurseSchedules.find(
      (schedule) => schedule.staffName === newAppointmentNurse,
    );
    if (selectedSchedule) setNewAppointmentNurseShift(selectedSchedule.shift);
  }, [newAppointmentNurse, nurseSchedules]);

  useEffect(() => {
    const selectedSchedule = frontDeskSchedules.find(
      (schedule) => schedule.staffName === newAppointmentFrontDesk,
    );
    if (selectedSchedule) {
      setNewAppointmentFrontDeskShift(selectedSchedule.shift);
    }
  }, [frontDeskSchedules, newAppointmentFrontDesk]);

  const activeAppointments = useMemo(
    () =>
      appointmentItems.filter(
        (item) =>
          !deletedAppointmentIds.includes(
            appointmentRecordKey(selectedDate, item.id),
          ),
      ),
    [appointmentItems, deletedAppointmentIds, selectedDate],
  );
  const deletedAppointments = useMemo(
    () =>
      appointmentItems.filter((item) =>
        deletedAppointmentIds.includes(
          appointmentRecordKey(selectedDate, item.id),
        ),
      ),
    [appointmentItems, deletedAppointmentIds, selectedDate],
  );
  const selected =
    activeAppointments.find((item) => item.id === selectedId) ??
    activeAppointments[0] ??
    initialAppointments[0];
  const selectedAppointmentKey = appointmentRecordKey(selectedDate, selectedId);
  const importedFromFeishu = selected.tags.includes('飞书预约表同步');
  const importedNeedsProfile =
    importedFromFeishu && selected.tags.includes('资料待补全');
  const selectedPreference = demoPreferenceFor(selected);
  const careScripts = careScriptsFor(selected, importedNeedsProfile);
  const guidance = getCustomerGuidance(selected);
  const currentPhase = useMemo(() => {
    const phase = servicePhases[selectedPhaseIndex];
    const assignedTechnician =
      selected.technician === '待填写' ? '待确认技师' : selected.technician;
    const templateTechnician = '欣欣';
    return {
      ...phase,
      tasks: phase.tasks.map((task) => {
        let taskText = task.text
          .split(templateTechnician)
          .join(assignedTechnician)
          .split('三明治美白')
          .join(selected.project)
          .split('启慧')
          .join(selected.nickname)
          .replace('房间香味为木质调', `房间香味为${selectedPreference.scent}`)
          .replace(
            '房间温度调至25℃',
            `房间温度调至${selectedPreference.roomTemp}`,
          )
          .replace(
            '床头角度升高15°',
            `床头角度升高${selectedPreference.bedAngle}`,
          )
          .replace(
            '确认房间音乐为轻音乐',
            `确认房间音乐为${selectedPreference.music}`,
          )
          .replace(
            '确认饮品为常温白开水、小吃为小汤圆、餐食为牛肉面、水果为哈密瓜',
            `确认饮品餐食为${selectedPreference.food}`,
          )
          .replace('端上常温白开水', `端上${selectedPreference.drink}`);
        if (selected.id !== 1) {
          taskText = taskText
            .replace(
              '查看历史皮肤记录（敏感肌、两颊红），但不把历史当今天结论',
              `查看客户历史与上次反馈，但以今天的真实状态重新确认`,
            )
            .replace(
              '因客户在哺乳期，确认不进行侵入式治疗类项目',
              '确认客户当日禁忌、近期变化与项目安全边界',
            )
            .replace(
              '客户刚生完二胎，核心诉求：面部白皙、去除黄气',
              `确认本次核心诉求：${guidance.todayAssessment}`,
            )
            .replace(
              `表达参考：告知${selected.project}适合哺乳期，非侵入类，提亮+美白+滋润`,
              `说明${selected.project}的适用范围、预期效果与注意事项`,
            )
            .replace(
              '告知会在嘴周和额头暗沉部位做加强，客户确认后开始',
              '说明本次重点区域与增强动作，客户确认后开始',
            )
            .replace(
              '客户刚生完宝宝，多放松头部让客户更放松休息',
              '根据客户当日状态安排对应的头部或肩颈放松',
            );
        }
        if (importedNeedsProfile) {
          taskText = taskText
            .replace('房间香味为木质调', '确认客户房间香味偏好')
            .replace('房间温度调至25℃', '确认客户房间温度偏好')
            .replace('床头角度升高15°', '确认客户床头角度偏好')
            .replace(/确认饮品为.*$/u, '确认客户饮品、餐食与忌口')
            .replace(/若开车：.*$/u, '确认到店方式后准备对应路线与接待')
            .replace(/若打车\/步行：.*$/u, '确认到店方式后准备对应路线与接待');
        }
        return {
          ...task,
          owner:
            task.owner === templateTechnician ? assignedTechnician : task.owner,
          text: taskText,
        };
      }),
    };
  }, [
    guidance.todayAssessment,
    importedNeedsProfile,
    selected.id,
    selected.nickname,
    selected.project,
    selected.technician,
    selectedPreference.bedAngle,
    selectedPreference.drink,
    selectedPreference.food,
    selectedPreference.music,
    selectedPreference.roomTemp,
    selectedPreference.scent,
    selectedPhaseIndex,
  ]);
  const currentDay = {
    ...appointmentSchedule,
    count: activeAppointments.length,
  };
  const currentDayIndex = appointmentHistory.findIndex(
    (day) => day.date === selectedDate,
  );
  const canViewPreviousDay = currentDayIndex > 0;
  const canViewNextDay =
    currentDayIndex >= 0 && currentDayIndex < appointmentHistory.length - 1;
  const scheduleHeading = `${appointmentSchedule.label}预约`;
  const scheduleDayWord = appointmentSchedule.label;

  const filteredAppointments = useMemo(() => {
    return activeAppointments.filter((item) => {
      const matchesFilter =
        filter === '全部' ||
        (filter === '待服务' && ['待到店', '准备中'].includes(item.status)) ||
        item.status === filter;
      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        [item.name, item.project, item.technician, item.room].some((value) =>
          value.toLowerCase().includes(keyword),
        );
      return matchesFilter && matchesSearch;
    });
  }, [activeAppointments, filter, search]);

  const isOwnerViewer =
    viewerJobRole === 'owner' && servicePermissions.viewOwnerPortal;
  const isFrontDeskViewer = viewerJobRole === 'front_desk';
  const isSkinManagerViewer = viewerJobRole === 'skin_manager';
  const isNurseViewer = viewerJobRole === 'nurse';
  const canViewCustomerManagement =
    servicePermissions.viewCustomerAssets ||
    servicePermissions.viewCustomerReminders;
  const canViewPriorityManagement = servicePermissions.viewPriorityClients;
  const hasStoreRole = servicePermissions.viewEmployeePortal;
  const viewerRoleLabel = isOwnerViewer
    ? '老板 / 管理员'
    : isFrontDeskViewer
      ? '门店前台'
      : isSkinManagerViewer
        ? '皮肤管理师'
        : isNurseViewer
          ? '护士'
          : '尚未分配门店岗位';
  const viewerScopeDescription = isOwnerViewer
    ? '可查看全部端口，并管理预约、排班、客户资产、结算、员工权限和数据恢复。'
    : isFrontDeskViewer
      ? '可查看全店预约，管理预约与排班、客户运营、开单结算和非老板岗位。'
      : isSkinManagerViewer
        ? '可只读查看全店预约，并执行分配给自己的客户诊断、护理、效果确认和服务记录。'
        : isNurseViewer
          ? '可只读查看全店预约，并执行分配给自己的护理、安全确认和医疗协作任务。'
          : '当前飞书账号尚未分配门店岗位，不能进入业务工作台。';

  const activeEmployeeProfile = useMemo(
    () =>
      resolveEmployeeStaffProfile(
        viewerName,
        viewerRole === 'owner',
        employeePreviewName,
        platformRoles,
      ),
    [employeePreviewName, platformRoles, viewerName, viewerRole],
  );
  const activeEmployeeAppointments = useMemo(
    () =>
      appointmentsForEmployeeProfile(activeEmployeeProfile, activeAppointments),
    [activeAppointments, activeEmployeeProfile],
  );

  const ownerMetrics = useMemo(() => {
    const serviceAppointments = activeAppointments.filter(
      (item: Appointment) => item.status === '服务中',
    );
    const completedAppointments = activeAppointments.filter(
      (item: Appointment) => item.status === '已完成',
    );
    const pendingAppointments = activeAppointments.filter((item: Appointment) =>
      ['待到店', '准备中'].includes(item.status),
    );
    const settlements = settlementTotals(activeAppointments);
    return {
      serviceAppointments,
      completedAppointments,
      pendingAppointments,
      serviceCount: serviceAppointments.length,
      completedCount: completedAppointments.length,
      pendingCount: pendingAppointments.length,
      ...settlements,
      pendingSettlement:
        settlements.totalReceivable - settlements.settledReceivable,
      averageTicket:
        activeAppointments.length > 0
          ? Math.round(settlements.totalReceivable / activeAppointments.length)
          : 0,
    };
  }, [activeAppointments]);
  const previousDayAppointments = useMemo<Appointment[]>(() => {
    const previousDate: string = shiftDateKey(selectedDate, -1);
    const previousDay = appointmentHistory.find(
      (day: AppointmentHistoryDay) => day.date === previousDate,
    );
    return (previousDay?.appointments || []).filter(
      (item: Appointment) =>
        !deletedAppointmentIds.includes(
          appointmentRecordKey(previousDate, item.id),
        ),
    );
  }, [appointmentHistory, deletedAppointmentIds, selectedDate]);
  const previousOwnerMetrics = useMemo<OwnerDailyMetrics>(() => {
    const settlements = settlementTotals(previousDayAppointments);
    const completedCount: number = previousDayAppointments.filter(
      (item: Appointment) => item.status === '已完成',
    ).length;
    return {
      ...settlements,
      pendingSettlement:
        settlements.totalReceivable - settlements.settledReceivable,
      completedCount,
      averageTicket:
        previousDayAppointments.length > 0
          ? Math.round(
              settlements.totalReceivable / previousDayAppointments.length,
            )
          : 0,
    };
  }, [previousDayAppointments]);
  const incompleteProfileAppointments = useMemo<Appointment[]>(() => {
    return activeAppointments.filter((item: Appointment) => {
      const incompleteTag: boolean = item.tags.some((tag: string) =>
        /资料待补全|需建档|待建档|新客/u.test(tag),
      );
      const incompleteAppointment: boolean = /待确认|待填写|待分配/u.test(
        `${item.project} ${item.technician} ${item.room}`,
      );
      return (
        !item.customerAsset ||
        item.customerAsset.profileCompleteness < 80 ||
        incompleteTag ||
        incompleteAppointment
      );
    });
  }, [activeAppointments]);
  const ownerRealtimeBase = useMemo<OwnerRealtimeAnalysis>(() => {
    const appointmentCount: number = activeAppointments.length;
    const serviceCompletionRate: number =
      appointmentCount > 0
        ? Math.round((ownerMetrics.completedCount / appointmentCount) * 100)
        : 0;
    const pendingSettlementRate: number =
      ownerMetrics.totalReceivable > 0
        ? Math.round(
            (ownerMetrics.pendingSettlement / ownerMetrics.totalReceivable) *
              100,
          )
        : 0;
    const cardConsumptionRate: number =
      ownerMetrics.totalReceivable > 0
        ? Math.round(
            (ownerMetrics.cardConsumption / ownerMetrics.totalReceivable) * 100,
          )
        : 0;
    const dailyReceivableChange: number | null =
      previousOwnerMetrics.totalReceivable > 0
        ? Math.round(
            ((ownerMetrics.totalReceivable -
              previousOwnerMetrics.totalReceivable) /
              previousOwnerMetrics.totalReceivable) *
              100,
          )
        : null;
    const unfinishedCount: number =
      appointmentCount - ownerMetrics.completedCount;
    const matchedProfileCount: number = activeAppointments.filter(
      (item: Appointment) => Boolean(item.customerAsset),
    ).length;
    const remainingProjectCount: number = activeAppointments.filter(
      (item: Appointment) =>
        (item.remainingProjects || []).some(
          (project: { name: string; times: number; expires: string }) =>
            project.times > 0,
        ),
    ).length;
    const issueCount: number = [
      unfinishedCount > 0,
      ownerMetrics.pendingSettlement > 0,
      incompleteProfileAppointments.length > 0,
      dailyReceivableChange !== null && dailyReceivableChange < 0,
    ].filter(Boolean).length;
    let summary: string;
    if (appointmentCount === 0) {
      summary = '今日暂无预约数据，飞书群预约表同步后将自动生成经营分析。';
    } else if (incompleteProfileAppointments.length > 0) {
      summary =
        `今日 ${appointmentCount} 位预约已闭环 ${ownerMetrics.completedCount} 位，` +
        `待结算 ${currencyValue(ownerMetrics.pendingSettlement)}，` +
        `${incompleteProfileAppointments.length} 位客户资料需优先补充。`;
    } else if (ownerMetrics.pendingSettlement > 0) {
      summary =
        `今日 ${appointmentCount} 位预约已闭环 ${ownerMetrics.completedCount} 位，` +
        `当前首要问题是 ${currencyValue(ownerMetrics.pendingSettlement)} 尚未结算。`;
    } else {
      summary =
        `今日 ${appointmentCount} 位客户服务与结算已全部闭环，` +
        `总应收 ${currencyValue(ownerMetrics.totalReceivable)}，经营状态稳定。`;
    }
    return {
      summary,
      issueCount,
      appointmentCount,
      pendingCount: ownerMetrics.pendingCount,
      inServiceCount: ownerMetrics.serviceCount,
      completedCount: ownerMetrics.completedCount,
      serviceCompletionRate,
      totalReceivable: ownerMetrics.totalReceivable,
      pendingSettlement: ownerMetrics.pendingSettlement,
      pendingSettlementRate,
      cardConsumption: ownerMetrics.cardConsumption,
      cardConsumptionRate,
      projectWriteoff: ownerMetrics.projectWriteoff,
      onsiteReceivable: ownerMetrics.onsiteReceivable,
      dailyReceivableChange,
      priorityClientCount: 0,
      matchedProfileCount,
      missingProfileCount: incompleteProfileAppointments.length,
      remainingProjectCount,
    };
  }, [
    activeAppointments,
    incompleteProfileAppointments.length,
    ownerMetrics,
    previousOwnerMetrics.totalReceivable,
  ]);
  const weekStartDate = useMemo(() => {
    const weekday = dateFromKey(selectedDate).getUTCDay();
    return shiftDateKey(selectedDate, -(weekday === 0 ? 6 : weekday - 1));
  }, [selectedDate]);
  const weekEndDate = useMemo(
    () => shiftDateKey(weekStartDate, 6),
    [weekStartDate],
  );
  const weekRangeLabel = `${displayDateLabel(weekStartDate)}—${displayDateLabel(weekEndDate)}`;
  const weeklyAppointments = useMemo<WeeklyAppointment[]>(
    () =>
      appointmentHistory
        .filter((day) => day.date >= weekStartDate && day.date <= weekEndDate)
        .flatMap((day) =>
          day.appointments
            .filter(
              (item) =>
                !deletedAppointmentIds.includes(
                  appointmentRecordKey(day.date, item.id),
                ),
            )
            .map((item) => ({
              ...item,
              date: day.date,
              dateLabel: day.schedule.label,
              weekday: day.schedule.weekday,
            })),
        )
        .sort((left, right) =>
          `${left.date} ${left.time}`.localeCompare(
            `${right.date} ${right.time}`,
          ),
        ),
    [appointmentHistory, deletedAppointmentIds, weekEndDate, weekStartDate],
  );
  const weeklyTechnicians = useMemo(
    () =>
      Array.from(new Set(weeklyAppointments.map((item) => item.technician)))
        .filter(
          (technician) => technician && !/待分配|待填写/u.test(technician),
        )
        .sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [weeklyAppointments],
  );
  const activeWeeklyTechnician = useMemo(() => {
    if (viewerRole === 'owner') {
      if (activeEmployeeProfile.role === 'skin_manager') {
        return activeEmployeeProfile.name;
      }
      return weeklyTechnicians.includes(selectedWeeklyTechnician)
        ? selectedWeeklyTechnician
        : weeklyTechnicians[0] || '暂无分配';
    }
    const viewer = normalizedPersonName(viewerName);
    return (
      weeklyTechnicians.find((technician) => {
        const normalizedTechnician = normalizedPersonName(technician);
        return (
          Boolean(viewer) &&
          (normalizedTechnician.includes(viewer) ||
            viewer.includes(normalizedTechnician))
        );
      }) || viewerName
    );
  }, [
    activeEmployeeProfile,
    selectedWeeklyTechnician,
    viewerName,
    viewerRole,
    weeklyTechnicians,
  ]);
  const employeeWeeklyAppointments = useMemo<WeeklyAppointment[]>(() => {
    const activeName = normalizedPersonName(activeWeeklyTechnician);
    return weeklyAppointments.filter(
      (item) => normalizedPersonName(item.technician) === activeName,
    );
  }, [activeWeeklyTechnician, weeklyAppointments]);
  const employeeWeeklyReports = useMemo(
    () =>
      weeklyTechnicians.map((technician) =>
        buildEmployeeWeeklyReport(
          technician,
          weeklyAppointments.filter((item) => item.technician === technician),
        ),
      ),
    [weeklyAppointments, weeklyTechnicians],
  );
  const weeklySummary = useMemo(() => {
    const completedCount = weeklyAppointments.filter(
      (item) => item.status === '已完成',
    ).length;
    const inServiceCount = weeklyAppointments.filter(
      (item) => item.status === '服务中',
    ).length;
    const pendingCount = weeklyAppointments.length - completedCount;
    const settlements = settlementTotals(weeklyAppointments);
    const uniqueCustomers = new Set(weeklyAppointments.map((item) => item.name))
      .size;
    const popularProject = mostFrequent(
      weeklyAppointments.map((item) => item.project),
    );
    const busiestDay = mostFrequent(
      weeklyAppointments.map((item) => item.dateLabel),
    );
    const technicianCounts = Array.from(
      weeklyAppointments.reduce((counts, item) => {
        counts.set(item.technician, (counts.get(item.technician) || 0) + 1);
        return counts;
      }, new Map<string, number>()),
    ).sort((left, right) => right[1] - left[1]);
    const archivedDayCount = new Set(
      weeklyAppointments.map((item) => item.date),
    ).size;
    const completionRate = weeklyAppointments.length
      ? Math.round((completedCount / weeklyAppointments.length) * 100)
      : 0;
    const strengths = [
      archivedDayCount > 0
        ? `本周已有 ${archivedDayCount} 天预约完成独立归档，历史不会再被新日期覆盖。`
        : '本周尚无预约归档，收到群预约表后会自动进入周报。',
      popularProject
        ? `${popularProject[0]}为本周主要项目，共 ${popularProject[1]} 人次，便于提前准备物料与统一服务重点。`
        : '项目结构会在预约同步后自动分析。',
      technicianCounts.length > 1
        ? `本周已分配 ${technicianCounts.length} 位技师，最高负载 ${technicianCounts[0][1]} 人次。`
        : '技师负载会随排班自动汇总。',
    ];
    const risks = [
      pendingCount > 0
        ? `${pendingCount} 人次尚未形成“已完成”闭环，需要员工继续勾选标准流程。`
        : '本周预约均已完成服务闭环。',
      settlements.totalReceivable > settlements.settledReceivable
        ? `仍有 ${currencyValue(settlements.totalReceivable - settlements.settledReceivable)} 待结算，需在服务完成后核对实际收银结果。`
        : '本周总应收已全部完成结算。',
      technicianCounts[0] &&
      weeklyAppointments.length > 1 &&
      technicianCounts[0][1] / weeklyAppointments.length > 0.6
        ? `${technicianCounts[0][0]}承担 ${technicianCounts[0][1]} 人次，排班相对集中，建议检查峰值时段。`
        : '当前技师负载未出现明显过度集中。',
    ];
    return {
      archivedDayCount,
      busiestDay,
      completedCount,
      completionRate,
      ...settlements,
      inServiceCount,
      pendingCount,
      pendingSettlement:
        settlements.totalReceivable - settlements.settledReceivable,
      strengths,
      risks,
      technicianCounts,
      uniqueCustomers,
    };
  }, [weeklyAppointments]);
  const employeeWeeklySummary = useMemo(
    () =>
      buildEmployeeWeeklyReport(
        activeWeeklyTechnician,
        employeeWeeklyAppointments,
      ),
    [activeWeeklyTechnician, employeeWeeklyAppointments],
  );
  const priorityAssessments = useMemo(
    () =>
      activeAppointments
        .map((appointment) => {
          const customerName = normalizedPersonName(appointment.name);
          const previousAppointments = appointmentHistory
            .filter((day) => day.date < selectedDate)
            .flatMap((day) =>
              day.appointments
                .filter(
                  (item) => normalizedPersonName(item.name) === customerName,
                )
                .map((item) => ({
                  ...item,
                  date: day.date,
                  dateLabel: day.schedule.label,
                  weekday: day.schedule.weekday,
                })),
            )
            .sort((left, right) =>
              `${left.date} ${left.time}`.localeCompare(
                `${right.date} ${right.time}`,
              ),
            );
          return priorityAssessmentFor(
            appointment,
            selectedDate,
            previousAppointments,
          );
        })
        .filter(
          (assessment): assessment is PriorityAssessment => assessment !== null,
        )
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.appointment.time.localeCompare(right.appointment.time),
        ),
    [activeAppointments, appointmentHistory, selectedDate],
  );
  const attentionAppointments = useMemo(
    () => priorityAssessments.map((assessment) => assessment.appointment),
    [priorityAssessments],
  );
  const ownerRealtimeAnalysis = useMemo<OwnerRealtimeAnalysis>(() => {
    const priorityClientCount: number = priorityAssessments.length;
    const summary: string =
      priorityClientCount > 0
        ? `${ownerRealtimeBase.summary.replace(/。$/u, '')}，` +
          `其中 ${priorityClientCount} 位为特权卡重点客户。`
        : ownerRealtimeBase.summary;
    return {
      ...ownerRealtimeBase,
      summary,
      issueCount:
        ownerRealtimeBase.issueCount + (priorityClientCount > 0 ? 1 : 0),
      priorityClientCount,
    };
  }, [ownerRealtimeBase, priorityAssessments.length]);
  const selectedPriorityAssessment = priorityAssessments.find(
    (assessment) => assessment.appointment.id === selected.id,
  );

  const currentPhaseDoneCount = currentPhase.tasks.filter((task) =>
    doneTasks.includes(task.id),
  ).length;
  const completion = Math.round(
    (currentPhaseDoneCount / currentPhase.tasks.length) * 100,
  );

  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;
    const loadAppointments = () => {
      fetch(serviceApi('/api/service-appointment-history'), {
        headers: serviceHeaders(),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error('预约历史加载失败');
          return data as {
            days?: AppointmentHistoryDay[];
          };
        })
        .then((data) => {
          if (!active || !data.days?.length) return;
          const calendarHistory = buildCalendarHistory(data.days);
          const previousHistory = appointmentHistoryRef.current;
          const previousLatest = previousHistory.at(-1)?.date;
          const wasViewingLatest =
            !historyLoadedRef.current ||
            !selectedDateRef.current ||
            selectedDateRef.current === previousLatest;
          const preservedDay = calendarHistory.find(
            (day) => day.date === selectedDateRef.current,
          );
          const targetDay =
            (wasViewingLatest ? calendarHistory.at(-1) : preservedDay) ||
            calendarHistory.at(-1);
          appointmentHistoryRef.current = calendarHistory;
          setAppointmentHistory(calendarHistory);
          historyLoadedRef.current = true;
          if (targetDay) applyAppointmentDay(targetDay);
        })
        .catch(() => setCloudState('error'));
    };
    loadAppointments();
    const refreshTimer = window.setInterval(loadAppointments, 30_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const platform = getPlatformContext();
    if (
      !platform.userId &&
      platform.loginUrl &&
      isFeishuWebView() &&
      !window.sessionStorage.getItem('service-login-redirected')
    ) {
      window.sessionStorage.setItem('service-login-redirected', '1');
      const loginUrl = new URL(platform.loginUrl, window.location.origin);
      loginUrl.searchParams.set('redirect_uri', window.location.href);
      window.location.replace(loginUrl.toString());
      return;
    }

    let active = true;
    fetch(
      serviceApi(
        `/api/service-role?permissionVersion=${encodeURIComponent('2026-08-17-inventory-scope-v3')}&t=${Date.now()}`,
      ),
      {
        headers: {
          ...serviceHeaders(),
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
      },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            apiErrorMessage(data as ApiErrorPayload, '身份识别失败'),
          );
        }
        return data as ServiceRoleResponse;
      })
      .then((data) => {
        if (!active) return;
        const role: ViewerRole = data.role === 'owner' ? 'owner' : 'employee';
        setViewerRole(role);
        setViewerJobRole(data.jobRole || 'unassigned');
        setServicePermissions(
          data.permissionVersion === '2026-08-17-inventory-scope-v3'
            ? data.permissions
            : EMPTY_SERVICE_PERMISSIONS,
        );
        setViewerName(data.actor?.displayName || '门店员工');
        setCanEditAppointments(Boolean(data.canEditAppointments));
        setCanEditStaffSchedule(Boolean(data.canEditStaffSchedule));
        setCanManageStaffRoles(Boolean(data.canManageStaffRoles));
        setPlatformRoles(data.actor?.roles || []);
        setDeletedAppointmentIds(data.deletedAppointmentIds || []);
        setActivePortal(role === 'owner' ? 'owner' : 'employee');
        setRoleLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setViewerRole('employee');
        setViewerJobRole('unassigned');
        setServicePermissions(EMPTY_SERVICE_PERMISSIONS);
        setViewerName('身份识别失败');
        setCanEditAppointments(false);
        setCanEditStaffSchedule(false);
        setCanManageStaffRoles(false);
        setPlatformRoles([]);
        setActivePortal('employee');
        setRoleLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (!isOwnerViewer && activePortal === 'owner') {
      setActivePortal('employee');
      setOwnerSection('overview');
    }
    if (!canViewCustomerManagement && workspaceView !== 'service_desk') {
      setWorkspaceView('service_desk');
      setAssetFocusQuery('');
    }
  }, [
    activePortal,
    canViewCustomerManagement,
    isOwnerViewer,
    roleLoading,
    workspaceView,
  ]);

  useEffect(() => {
    if (
      activeAppointments.length > 0 &&
      !activeAppointments.some((item) => item.id === selectedId)
    ) {
      setSelectedId(activeAppointments[0].id);
    }
  }, [activeAppointments, selectedId]);

  useEffect(() => {
    if (
      activePortal === 'employee' &&
      activeEmployeeAppointments.length > 0 &&
      !activeEmployeeAppointments.some((item) => item.id === selectedId)
    ) {
      setSelectedId(activeEmployeeAppointments[0].id);
      setSelectedPhaseIndex(0);
      setTab('服务流程');
    }
  }, [activeEmployeeAppointments, activePortal, selectedId]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(
      serviceApi(
        `/api/service-state?appointmentId=${encodeURIComponent(selectedAppointmentKey)}`,
      ),
      {
        headers: serviceHeaders(),
      },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            apiErrorMessage(data as ApiErrorPayload, '共享进度加载失败'),
          );
        }
        return data as {
          completedTaskIds: string[];
          assignedTechnician?: string;
          actor?: { displayName?: string; userId?: string };
          feishu?: { webhookConfigured?: boolean; chatUrlConfigured?: boolean };
        };
      })
      .then((data) => {
        if (!active) return;
        setDoneTasks(data.completedTaskIds);
        if (data.assignedTechnician) {
          setAppointmentItems((current) =>
            current.map((item) =>
              item.id === selectedId
                ? {
                    ...item,
                    technician: data.assignedTechnician || item.technician,
                  }
                : item,
            ),
          );
        }
        setCurrentActor(data.actor?.displayName || '数据前台');
        setCurrentActorUserId(data.actor?.userId || '');
        setFeishuConfigured(Boolean(data.feishu?.webhookConfigured));
        setCloudState('saved');
        setStageSyncStatus('idle');
      })
      .catch(() => {
        if (!active) return;
        setCloudState('error');
      });
    return () => {
      active = false;
    };
  }, [selectedAppointmentKey, selectedId]);

  useEffect(() => {
    setStageSyncStatus('idle');
  }, [selectedAppointmentKey, selectedPhaseIndex]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function openDetail(view: Exclude<DetailView, null>) {
    setDetailView(view);
  }

  function ownerAppointmentDetailItems(
    appointments: Appointment[],
  ): DetailItem[] {
    if (appointments.length === 0) {
      return [{ label: '当前状态', value: '暂无符合条件的客户记录' }];
    }
    return appointments.map((appointment: Appointment) => ({
      label: `${appointment.name}｜${appointment.time}`,
      customerName: appointment.name,
      customerMeta: `${appointment.time} · ${appointment.room}房`,
      customerBadge: appointmentMembershipLabel(
        appointment.customerAsset,
        appointment.member,
      ),
      value:
        `项目：${appointment.project}；状态：${appointment.status}；` +
        `当次技师：${appointment.technician}；房间：${appointment.room}房；` +
        `总应收：${appointment.amount}；会员：${appointment.member}`,
    }));
  }

  function ownerSettlementDetailItems(
    appointments: Appointment[],
  ): DetailItem[] {
    if (appointments.length === 0) {
      return [{ label: '当前状态', value: '今日暂无客户结算记录' }];
    }
    return appointments.map((appointment: Appointment) => {
      const settlement = settlementFor(appointment);
      return {
        label: `${appointment.name}｜${appointment.time}`,
        customerName: appointment.name,
        customerMeta: `${appointment.time} · ${appointment.member}`,
        customerBadge: appointmentMembershipLabel(
          appointment.customerAsset,
          appointment.member,
        ),
        value:
          `项目：${appointment.project}；` +
          `总应收：${currencyValue(settlement.totalReceivable)}；` +
          `卡金消耗：${currencyValue(settlement.cardConsumption)}；` +
          `项目/次卡核销：${currencyValue(settlement.projectWriteoff)}；` +
          `现场应收：${currencyValue(settlement.onsiteReceivable)}；` +
          `结算状态：${settlement.settlementStatus} · ${settlement.settlementBasis}`,
      };
    });
  }

  function openOwnerMetricDetail(metric: OwnerMetricType): void {
    if (metric === 'appointments') {
      openDetail({
        eyebrow: '老板经营看板 · 当日预约',
        title: `${scheduleHeading}共 ${activeAppointments.length} 位客户`,
        description: '按到店时间列出客户、项目、技师、房间、状态和金额。',
        items: ownerAppointmentDetailItems(activeAppointments),
        layout: 'customer_cards',
      });
      return;
    }
    if (metric === 'in_service') {
      openDetail({
        eyebrow: '老板经营看板 · 实时服务',
        title: `当前 ${ownerMetrics.serviceCount} 位客户服务中`,
        description: '老板可以直接核对正在服务的客户和现场安排。',
        items: ownerAppointmentDetailItems(ownerMetrics.serviceAppointments),
        layout: 'customer_cards',
      });
      return;
    }
    if (metric === 'completed') {
      openDetail({
        eyebrow: '老板经营看板 · 今日闭环',
        title: `今日已完成 ${ownerMetrics.completedCount} 位客户`,
        description: `已结算应收 ${currencyValue(ownerMetrics.settledReceivable)}，以下为已归档明细。`,
        items: ownerAppointmentDetailItems(ownerMetrics.completedAppointments),
        layout: 'customer_cards',
      });
    }
  }

  function openOwnerDailyMetricDetail(metric: OwnerDailyMetricType): void {
    const definitions: Record<
      OwnerDailyMetricType,
      {
        label: string;
        value: number;
        appointments: Appointment[];
        count?: boolean;
      }
    > = {
      total_receivable: {
        label: '总应收金额',
        value: ownerMetrics.totalReceivable,
        appointments: activeAppointments,
      },
      card_consumption: {
        label: '卡金消耗',
        value: ownerMetrics.cardConsumption,
        appointments: activeAppointments.filter(
          (item: Appointment) => settlementFor(item).cardConsumption > 0,
        ),
      },
      project_writeoff: {
        label: '项目／次卡核销',
        value: ownerMetrics.projectWriteoff,
        appointments: activeAppointments.filter(
          (item: Appointment) => settlementFor(item).projectWriteoff > 0,
        ),
      },
      onsite_receivable: {
        label: '现场应收',
        value: ownerMetrics.onsiteReceivable,
        appointments: activeAppointments.filter(
          (item: Appointment) => settlementFor(item).onsiteReceivable > 0,
        ),
      },
      settled_receivable: {
        label: '已结算金额',
        value: ownerMetrics.settledReceivable,
        appointments: ownerMetrics.completedAppointments,
      },
      pending_settlement: {
        label: '待结算金额',
        value: ownerMetrics.pendingSettlement,
        appointments: activeAppointments.filter(
          (item: Appointment) => item.status !== '已完成',
        ),
      },
      completed_count: {
        label: '成交客户数',
        value: ownerMetrics.completedCount,
        appointments: ownerMetrics.completedAppointments,
        count: true,
      },
      average_ticket: {
        label: '客单价',
        value: ownerMetrics.averageTicket,
        appointments: activeAppointments,
      },
    };
    const definition = definitions[metric];
    openDetail({
      eyebrow: `老板经营看板 · ${definition.label}`,
      title: `${definition.label} ${
        definition.count
          ? `${definition.value} 位`
          : currencyValue(definition.value)
      }`,
      description:
        `${scheduleHeading}按每位客户的服务金额、账户类型和完成状态实时计算；` +
        '以下是构成当前指标的对应客户明细。',
      items:
        metric === 'completed_count'
          ? ownerAppointmentDetailItems(definition.appointments)
          : ownerSettlementDetailItems(definition.appointments),
      layout: 'customer_cards',
    });
  }

  function openOwnerAnalysisDetail(module: OwnerAnalysisModuleType): void {
    const unfinishedAppointments: Appointment[] = activeAppointments.filter(
      (item: Appointment) => item.status !== '已完成',
    );
    const pendingSettlementAppointments: Appointment[] =
      activeAppointments.filter(
        (item: Appointment) =>
          settlementFor(item).settlementStatus === '待结算',
      );
    const matchedProfileAppointments: Appointment[] = activeAppointments.filter(
      (item: Appointment) => Boolean(item.customerAsset),
    );
    const remainingProjectAppointments: Appointment[] =
      activeAppointments.filter((item: Appointment) =>
        (item.remainingProjects || []).some(
          (project: { name: string; times: number; expires: string }) =>
            project.times > 0,
        ),
      );
    const appointmentNames = (appointments: Appointment[]): string =>
      appointments.length > 0
        ? appointments
            .map((item: Appointment) => `${item.name}（${item.time}）`)
            .join('、')
        : '无';
    const overviewItems: DetailItem[] = [
      {
        label: '到店执行',
        value:
          `今日预约：${ownerRealtimeAnalysis.appointmentCount} 位；` +
          `待服务：${ownerRealtimeAnalysis.pendingCount} 位；` +
          `服务中：${ownerRealtimeAnalysis.inServiceCount} 位；` +
          `已完成：${ownerRealtimeAnalysis.completedCount} 位；` +
          `服务闭环率：${ownerRealtimeAnalysis.serviceCompletionRate}%；` +
          `未闭环客户：${appointmentNames(unfinishedAppointments)}；` +
          '处理建议：按到店时间推进标准服务流程，完成后立即结算与归档',
      },
      {
        label: '结算消耗',
        value:
          `总应收：${currencyValue(ownerRealtimeAnalysis.totalReceivable)}；` +
          `待结算：${currencyValue(ownerRealtimeAnalysis.pendingSettlement)} ` +
          `（${ownerRealtimeAnalysis.pendingSettlementRate}%）；` +
          `卡金消耗：${currencyValue(ownerRealtimeAnalysis.cardConsumption)}；` +
          `项目/次卡核销：${currencyValue(ownerRealtimeAnalysis.projectWriteoff)}；` +
          `现场应收：${currencyValue(ownerRealtimeAnalysis.onsiteReceivable)}；` +
          `待结算客户：${appointmentNames(pendingSettlementAppointments)}`,
      },
      {
        label: '客户资产',
        value:
          `动态重点客户：${ownerRealtimeAnalysis.priorityClientCount} 位；` +
          `资料已匹配：${ownerRealtimeAnalysis.matchedProfileCount} 位；` +
          `资料待补：${ownerRealtimeAnalysis.missingProfileCount} 位；` +
          `有剩余项目客户：${ownerRealtimeAnalysis.remainingProjectCount} 位；` +
          `重点客户：${appointmentNames(attentionAppointments)}；` +
          `待补客户：${appointmentNames(incompleteProfileAppointments)}`,
      },
    ];

    if (module === 'all') {
      openDetail({
        eyebrow: '老板经营看板 · 实时数据分析',
        title: `${scheduleHeading}实时经营汇总`,
        description:
          `${ownerRealtimeAnalysis.summary} 以下模块使用当日预约、服务进度、` +
          '结算拆分、历史消费和客户资料库实时计算。',
        items: overviewItems,
      });
      return;
    }

    if (module === 'appointment_overview') {
      openOwnerMetricDetail('appointments');
      return;
    }

    if (module === 'pending_service') {
      openDetail({
        eyebrow: '实时数据分析 · 待服务',
        title: `当前 ${ownerMetrics.pendingCount} 位客户待服务`,
        description: '按到店时间查看仍处于待到店或准备中的客户和现场安排。',
        items: ownerAppointmentDetailItems(ownerMetrics.pendingAppointments),
        layout: 'customer_cards',
      });
      return;
    }

    if (module === 'in_service') {
      openOwnerMetricDetail('in_service');
      return;
    }

    if (module === 'service_progress') {
      openDetail({
        eyebrow: '实时数据分析 · 服务闭环',
        title: `服务闭环率 ${ownerRealtimeAnalysis.serviceCompletionRate}%`,
        description:
          `已完成 ${ownerMetrics.completedCount} 位，` +
          `还有 ${unfinishedAppointments.length} 位需要继续推进标准服务流程。`,
        items: ownerAppointmentDetailItems(unfinishedAppointments),
        layout: 'customer_cards',
      });
      return;
    }

    if (module === 'total_receivable') {
      openOwnerDailyMetricDetail('total_receivable');
      return;
    }

    if (module === 'pending_settlement') {
      openOwnerDailyMetricDetail('pending_settlement');
      return;
    }

    if (module === 'card_consumption') {
      openOwnerDailyMetricDetail('card_consumption');
      return;
    }

    if (module === 'project_writeoff') {
      openOwnerDailyMetricDetail('project_writeoff');
      return;
    }

    if (module === 'onsite_receivable') {
      openOwnerDailyMetricDetail('onsite_receivable');
      return;
    }

    if (module === 'priority_clients') {
      openPriorityClientDetail();
      return;
    }

    if (module === 'matched_profiles') {
      const matchedItems: DetailItem[] =
        matchedProfileAppointments.length > 0
          ? matchedProfileAppointments.map((item: Appointment) => ({
              label: `${item.name}｜${item.time}`,
              customerName: item.name,
              customerMeta: `${item.time} · ${item.project}`,
              customerBadge: appointmentMembershipLabel(
                item.customerAsset,
                item.member,
              ),
              value:
                `档案完整度：${item.customerAsset?.profileCompleteness ?? 0}%；` +
                `累计消费：${
                  item.customerAsset?.totalSpend !== undefined
                    ? currencyValue(item.customerAsset.totalSpend)
                    : '待确认'
                }；` +
                `卡内余额：${
                  item.customerAsset?.currentBalance !== undefined
                    ? currencyValue(item.customerAsset.currentBalance)
                    : '待确认'
                }；` +
                `服务员工：${item.customerAsset?.serviceStaff.join('、') || '待确认'}；` +
                '调用范围：诊断方案、服务偏好、沟通话术和跟进维护',
            }))
          : [{ label: '匹配状态', value: '今日预约暂未匹配到客户资料库' }];
      openDetail({
        eyebrow: '实时数据分析 · 客户资料已匹配',
        title: `${matchedProfileAppointments.length} 位客户资料已匹配`,
        description: '以下客户已从客户资料库调取真实档案供前端流程使用。',
        items: matchedItems,
        layout: 'customer_cards',
      });
      return;
    }

    if (module === 'data_quality') {
      const dataQualityItems: DetailItem[] =
        incompleteProfileAppointments.length > 0
          ? incompleteProfileAppointments.map((item: Appointment) => ({
              label: `${item.name}｜${item.time}`,
              customerName: item.name,
              customerMeta: `${item.time} · ${item.project}`,
              customerBadge: appointmentMembershipLabel(
                item.customerAsset,
                item.member,
              ),
              value:
                `档案完整度：${item.customerAsset?.profileCompleteness ?? 0}%；` +
                `当前问题：${
                  item.customerAsset
                    ? '档案字段不足或预约仍有待确认项'
                    : '未匹配客户资料库'
                }；` +
                `历史消费：${
                  item.customerAsset?.totalSpend !== undefined
                    ? currencyValue(item.customerAsset.totalSpend)
                    : '待补充'
                }；` +
                '需补内容：健康肤况、历史消费、服务偏好、项目资产与沟通注意事项；' +
                '处理建议：进入客户资料库找到该客户并补充档案',
            }))
          : [{ label: '资料状态', value: '今日预约客户资料均达到执行要求' }];
      openDetail({
        eyebrow: '实时数据分析 · 资料完整度',
        title: `${incompleteProfileAppointments.length} 位客户资料待补`,
        description:
          '资料不足会影响诊断方案、沟通话术、服务偏好与动态重点客户判断。',
        items: dataQualityItems,
        layout: 'customer_cards',
      });
      return;
    }

    const remainingProjectItems: DetailItem[] =
      remainingProjectAppointments.length > 0
        ? remainingProjectAppointments.map((item: Appointment) => ({
            label: `${item.name}｜${item.time}`,
            customerName: item.name,
            customerMeta: `${item.time} · ${item.member}`,
            customerBadge: appointmentMembershipLabel(
              item.customerAsset,
              item.member,
            ),
            value:
              `本次项目：${item.project}；` +
              `剩余项目：${(item.remainingProjects || [])
                .filter(
                  (project: { name: string; times: number; expires: string }) =>
                    project.times > 0,
                )
                .map(
                  (project: { name: string; times: number; expires: string }) =>
                    `${project.name} ${project.times}次（${project.expires}）`,
                )
                .join('、')}；` +
              '处理建议：服务前核对余次、有效期和本次核销项目',
          }))
        : [{ label: '项目资产', value: '今日预约客户暂无已识别的剩余项目' }];
    openDetail({
      eyebrow: '实时数据分析 · 剩余项目',
      title: `${remainingProjectAppointments.length} 位客户有剩余项目`,
      description: '逐位显示项目名称、剩余次数和有效期，供服务与核销前复核。',
      items: remainingProjectItems,
      layout: 'customer_cards',
    });
  }

  function openPriorityClientDetail(priorityClient?: Appointment) {
    const selectedAssessment = priorityClient
      ? priorityAssessments.find(
          (assessment) => assessment.appointment.id === priorityClient.id,
        )
      : undefined;
    if (selectedAssessment) {
      setSelectedId(selectedAssessment.appointment.id);
      openDetail({
        eyebrow: '特权卡重点客户 · 会员权益评估',
        title: `${selectedAssessment.appointment.name}｜${selectedAssessment.appointment.project}服务提示`,
        description:
          '以下内容以历史消费、项目资产和会员服务一致性为主要依据，再结合健康肤况、服务偏好和预约完整度动态判断，不使用固定人数。',
        items: [
          {
            label: '预约信息',
            value: `${selectedAssessment.appointment.time} · ${selectedAssessment.appointment.room}房 · 本次技师${selectedAssessment.appointment.technician}`,
          },
          {
            label: '历史消费重点',
            value: selectedAssessment.consumptionSummary,
          },
          {
            label: '关注原因',
            value: selectedAssessment.reasons.join('；'),
          },
          {
            label: '本次执行重点',
            value: selectedAssessment.actions.join('；'),
          },
          {
            label: '客户档案',
            value: `${selectedAssessment.appointment.member} · ${selectedAssessment.appointment.tags.join('、')}`,
          },
          {
            label: '判断分值',
            value: `${selectedAssessment.score} 分；达到 ${PRIORITY_THRESHOLD} 分才进入今日重点客户清单`,
          },
        ],
      });
      return;
    }

    if (priorityAssessments.length === 0) {
      openDetail({
        eyebrow: '特权卡重点客户 · 今日筛选完成',
        title: '今日没有需要升级关注的客户',
        description:
          '系统已逐位检查客户档案；没有客户达到重点关注阈值，员工仍按标准全流程执行。',
        items: [
          {
            label: '历史消费与项目',
            value:
              '上次消费、卡内余额、剩余项目、项目有效期、到店间隔和本次消费变化为主要判断依据',
          },
          {
            label: '健康与肤况',
            value: '孕哺期、敏感过敏、术后恢复、禁忌和耐受等信息优先判断',
          },
          {
            label: '档案完整度',
            value: '新客、首次到店、待建档及项目、房间、技师未确认会升级关注',
          },
          {
            label: '服务一致性',
            value:
              '固定技师交接、会员权益、特殊温度和力度需求作为补充判断，不会单独为了凑人数而入选',
          },
        ],
      });
      return;
    }

    openDetail({
      eyebrow: '特权卡重点客户 · 今日完整清单',
      title: `${appointmentSchedule.label}共有 ${priorityAssessments.length} 位重点客户`,
      description:
        '人数由每位客户的真实档案条件计算，可能为0位、1位或多位；以下逐位说明关注原因和执行动作。',
      items: priorityAssessments.map((assessment) => ({
        label: `${assessment.appointment.name}｜${assessment.appointment.time}`,
        customerName: assessment.appointment.name,
        customerMeta: `${assessment.appointment.time} · ${assessment.appointment.project}`,
        customerBadge: appointmentMembershipLabel(
          assessment.appointment.customerAsset,
          assessment.appointment.member,
        ),
        value: `${assessment.consumptionSummary}。关注：${assessment.reasons.join('；')}。执行：${assessment.actions.join('；')}`,
      })),
      layout: 'customer_cards',
    });
  }

  function openFixedTechnicianDetail() {
    openDetail({
      eyebrow: '客户归属 · 固定技师',
      title: `${selected.name}｜固定技师 ${selected.fixedTechnician}`,
      description:
        '固定技师代表长期服务归属和历史了解人，不等同于本次实际服务人员。',
      items: [
        { label: '固定技师', value: selected.fixedTechnician },
        { label: '本次技师', value: selected.technician },
        {
          label: '主要职责',
          value:
            '维护长期客户画像、复核历史偏好，并在更换技师时完成重点信息交接',
        },
        {
          label: '交接要求',
          value:
            '本次技师开始服务前，应查看肤况记录、禁忌、力度、环境偏好和上次反馈',
        },
      ],
    });
  }

  function openArrivalMethodDetail() {
    if (importedFromFeishu && !selected.arrivalMethod) {
      openDetail({
        eyebrow: '到店信息 · 待确认',
        title: `${selected.name}｜到店方式待确认`,
        description: '预约表未包含交通方式，前台确认后再准备对应路线与接待。',
        items: [
          { label: '当前状态', value: '待确认' },
          {
            label: '前台动作',
            value: '联系客户确认开车、打车、步行或其他方式',
          },
          {
            label: '确认后',
            value: '发送对应入口与路线，并安排需要的迎接服务',
          },
        ],
      });
      return;
    }
    openDetail({
      eyebrow: '到店信息 · 出行关怀',
      title: `${selected.name}｜到店方式`,
      description: '历史方式用于提前准备，当次预约仍需再次确认。',
      items: [
        { label: '常用方式', value: selected.arrivalMethod || '待确认' },
        {
          label: '本次确认',
          value:
            selected.id === 1 ? '客户已确认开车到店' : '预约前再次向客户确认',
        },
        {
          label: '前台动作',
          value: '提前发送停车位置、入口照片、电梯路线和联系电话',
        },
        {
          label: '变化处理',
          value: '若改为步行或打车，准备遮阳伞和小风扇并到最近入口等候',
        },
      ],
    });
  }

  function openLastSpendDetail() {
    if (importedFromFeishu && !selected.lastSpend) {
      openDetail({
        eyebrow: '消费记录 · 待同步',
        title: `${selected.name}｜上次消费待补全`,
        description: '预约表未包含消费记录，前台补全后会在这里展示。',
        items: [
          { label: '当前来源', value: appointmentSchedule.sourceName },
          {
            label: '待补字段',
            value: '消费日期、项目、金额、支付方式、服务技师和反馈',
          },
          { label: '本次处理', value: '不使用本次总应收代替上次消费' },
        ],
      });
      return;
    }
    openDetail({
      eyebrow: '消费记录 · 上次消费',
      title: `${selected.name}｜上次消费明细`,
      description: '这里展示的是上一次已完成消费，不代表本次服务金额。',
      items: [
        {
          label: '消费日期',
          value:
            selected.id === 1
              ? '2026年07月12日'
              : selected.lastVisit || '最近一次到店',
        },
        {
          label: '消费项目',
          value: selected.id === 1 ? '水光补水管理' : selected.project,
        },
        { label: '实付金额', value: selected.lastSpend || selected.amount },
        {
          label: '支付方式',
          value: selected.id === 1 ? '会员卡扣款' : '已完成支付',
        },
        { label: '服务技师', value: selected.fixedTechnician },
        {
          label: '客户反馈',
          value:
            selected.id === 1
              ? '护理后舒适，两颊未出现持续泛红，满意度5/5'
              : '已归档到护理记录',
        },
      ],
    });
  }

  function openCardBalanceDetail() {
    if (selected.customerAsset?.assetId) {
      setCardWalletOpen(true);
      return;
    }
    const remainingCount =
      selected.remainingProjects?.reduce(
        (total, item) => total + item.times,
        0,
      ) ?? 0;
    openDetail({
      eyebrow: '会员资产 · 卡内余额',
      title: `${selected.name}｜卡内余额`,
      description:
        '储值余额与项目次数分开统计；本窗口显示当前可用余额及最近变动。',
      items: [
        { label: '储值余额', value: selected.cardBalance || '待同步' },
        {
          label: '项目次数',
          value: selected.remainingProjects
            ? `${remainingCount}次，点击“剩余项目”可看项目构成`
            : '待同步',
        },
        {
          label: '最近变动',
          value: importedNeedsProfile
            ? '待同步'
            : selected.id === 1
              ? '-¥1,688 · 2026年07月12日 · 水光补水管理'
              : '最近消费记录已归档',
        },
        {
          label: '余额口径',
          value: '客户资料匹配后由门店独立卡资产中心统一记账',
        },
        {
          label: '使用提醒',
          value: '本次服务开始前由前台再次核对余额、项目抵扣方式和客户确认结果',
        },
      ],
    });
  }

  function updateSelectedWalletBalance(totalBalanceExact: string): void {
    const numericBalance: number = Number(totalBalanceExact);
    const displayBalance: string = Number.isFinite(numericBalance)
      ? `¥${numericBalance.toLocaleString('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `¥${totalBalanceExact}`;
    const updateAppointment = (item: Appointment): Appointment =>
      item.id === selected.id
        ? {
            ...item,
            cardBalance: displayBalance,
            customerAsset: item.customerAsset
              ? { ...item.customerAsset, currentBalance: numericBalance }
              : item.customerAsset,
          }
        : item;
    setAppointmentItems((current: Appointment[]) =>
      current.map(updateAppointment),
    );
    setAppointmentHistory((current: AppointmentHistoryDay[]) =>
      current.map((day: AppointmentHistoryDay) =>
        day.date === selectedDate
          ? {
              ...day,
              appointments: day.appointments.map(updateAppointment),
            }
          : day,
      ),
    );
    flash(`${selected.name}的卡内余额已更新为 ${displayBalance}`);
  }

  function openRemainingProjectsDetail() {
    if (importedFromFeishu && !selected.remainingProjects) {
      openDetail({
        eyebrow: '会员资产 · 待同步',
        title: `${selected.name}｜剩余项目待补全`,
        description: '预约表未包含项目卡信息，不能推测项目名称和次数。',
        items: [
          { label: '当前状态', value: '等待前台同步项目卡或收银系统记录' },
          { label: '待补字段', value: '项目名称、剩余次数、有效期和适用范围' },
          {
            label: '服务要求',
            value: '开始服务前必须向客户核对项目和扣次方式',
          },
        ],
      });
      return;
    }
    const projects = selected.remainingProjects ?? [
      { name: selected.project, times: 3, expires: '以会员卡有效期为准' },
    ];
    const total = projects.reduce((sum, item) => sum + item.times, 0);
    openDetail({
      eyebrow: '会员资产 · 剩余项目',
      title: `${selected.name}｜剩余项目 ${total}次`,
      description:
        '项目名称、剩余次数和有效期分别展示，员工安排预约前应先核对适用范围。',
      items: [
        ...projects.map((item) => ({
          label: `${item.name} × ${item.times}次`,
          value: `有效期至 ${item.expires}`,
        })),
        {
          label: '使用顺序',
          value: '优先结合客户当次诉求、肤况和项目有效期安排，不默认消耗次数',
        },
        {
          label: '核销要求',
          value: '服务开始前再次确认项目名称与次数，服务完成后由前台完成核销',
        },
      ],
    });
  }

  function openLastVisitDetail() {
    if (importedFromFeishu && !selected.lastVisit) {
      openDetail({
        eyebrow: '到店记录 · 待同步',
        title: `${selected.name}｜上次到店待补全`,
        description: '预约表未包含历史到店记录，前台补全后会显示完整服务交接。',
        items: [
          { label: '当前来源', value: appointmentSchedule.sourceName },
          {
            label: '待补字段',
            value: '到店日期、项目、技师、现场记录和回访结果',
          },
          {
            label: '本次要求',
            value: '以客户今天的真实状态重新确认，不沿用未知历史',
          },
        ],
      });
      return;
    }
    openDetail({
      eyebrow: '到店记录 · 最近一次',
      title: `${selected.name}｜上次到店详情`,
      description: '最近一次完整服务记录，用于本次接待和技师交接。',
      items: [
        {
          label: '到店日期',
          value:
            selected.lastVisit || (selected.id === 1 ? '07月12日' : '07月26日'),
        },
        {
          label: '服务项目',
          value: selected.id === 1 ? '水光补水管理' : selected.project,
        },
        { label: '服务技师', value: selected.fixedTechnician },
        {
          label: '现场记录',
          value:
            selected.id === 1
              ? '两颊轻微泛红；肩颈希望加大力度；整体舒适度良好'
              : '服务记录已归档',
        },
        {
          label: '回访结果',
          value: selected.id === 1 ? '次日反馈舒适，无持续泛红' : '已完成回访',
        },
      ],
    });
  }

  function openReminderDetail(type: 'nursing' | 'arrival' | 'communication') {
    if (DEMO_MODE && selected.id !== 1) {
      const demoReminder = {
        nursing: {
          title: `${selected.name}｜${selected.project}服务重点`,
          items: [
            { label: '客户状态', value: selectedPreference.currentState },
            { label: '今日评估', value: guidance.todayAssessment },
            { label: '项目建议', value: guidance.primaryRecommendation },
            { label: '安全边界', value: guidance.safetyBoundary },
          ],
        },
        arrival: {
          title: `${selected.name}｜到店接待安排`,
          items: [
            {
              label: '时间与房间',
              value: `${selected.time} · ${selected.room}房`,
            },
            { label: '到店方式', value: selected.arrivalMethod || '现场确认' },
            { label: '服务技师', value: selected.technician },
            {
              label: '房间准备',
              value: `${selectedPreference.roomTemp} · ${selectedPreference.scent} · ${selectedPreference.music}`,
            },
          ],
        },
        communication: {
          title: `${selected.name}｜沟通方式`,
          items: [
            { label: '服务风格', value: selectedPreference.serviceStyle },
            { label: '沟通偏好', value: selectedPreference.communication },
            { label: '力度偏好', value: selectedPreference.pressure },
            {
              label: '员工原则',
              value: '不打探隐私，多询问舒适度，不夸大或保证效果',
            },
          ],
        },
      }[type];
      openDetail({
        eyebrow: '智能提醒 · 标准Demo',
        title: demoReminder.title,
        description:
          '标准流程保持一致，内容根据该客户需求、购买项目和历史偏好生成。',
        items: demoReminder.items,
      });
      return;
    }
    if (importedNeedsProfile) {
      const importedReminder = {
        nursing: {
          title: `${selected.name}｜预约资料待补全`,
          items: [
            {
              label: '已识别',
              value: `预约时间 ${selected.time}，预约技师 ${selected.technician}`,
            },
            {
              label: '待确认',
              value: '本次项目、房间、客户禁忌与当前真实状态',
            },
            {
              label: '员工动作',
              value: '到店前联系客户确认；未确认前不生成具体项目判断',
            },
          ],
        },
        arrival: {
          title: `${selected.name}｜到店安排待确认`,
          items: [
            { label: '到店时间', value: selected.time },
            { label: '到店方式', value: selected.arrivalMethod || '待确认' },
            {
              label: '员工动作',
              value: '确认交通方式后再发送对应路线并安排迎接',
            },
          ],
        },
        communication: {
          title: `${selected.name}｜沟通偏好待补录`,
          items: [
            { label: '当前状态', value: '预约表没有沟通偏好记录' },
            {
              label: '首次询问',
              value: '主动确认称呼、聊天频率、隐私边界和舒适度反馈方式',
            },
            {
              label: '记录要求',
              value: '将客户当次确认结果回写档案，供下次服务使用',
            },
          ],
        },
      }[type];
      openDetail({
        eyebrow: '智能提醒 · 飞书预约同步',
        title: importedReminder.title,
        description: '仅展示已从预约表识别的信息；缺失资料不会自动推测。',
        items: importedReminder.items,
      });
      return;
    }
    const reminderDetails = {
      nursing: {
        eyebrow: '智能提醒 · 服务安全',
        title: `${selected.name}｜哺乳期服务提醒`,
        description:
          '护理开始前由技师逐项确认，任何一项不满足时先暂停并升级处理。',
        items: [
          {
            label: '触发原因',
            value: '客户画像包含哺乳期、敏感肌和两颊历史易红记录',
          },
          {
            label: '护理前确认',
            value:
              '询问今天是否有持续刺痛、破损、异常泛红、过敏或正在使用特殊药物',
          },
          {
            label: '可执行范围',
            value:
              '仅使用门店已批准SOP和已确认产品，不临时增加侵入式或治疗类项目',
          },
          {
            label: '过程观察',
            value: '额头、嘴周加强时降低刺激；每个关键步骤主动询问舒适度',
          },
          {
            label: '暂停条件',
            value: '出现持续刺痛、灼热或明显泛红时立即暂停，由技师复核并记录',
          },
          {
            label: '负责人',
            value: `当次技师 ${selected.technician}；前台负责同步异常和客户沟通记录`,
          },
        ],
      },
      arrival: {
        eyebrow: '智能提醒 · 到店关怀',
        title: `${selected.name}｜高温到店关怀`,
        description:
          '从出发确认到进入房间的完整接待动作，避免客户在高温天气下反复寻找入口。',
        items: [
          {
            label: '到店方式',
            value: '客户通常开车到店，预约前再次确认是否按原方式前往',
          },
          {
            label: '提前发送',
            value: '停车位置、入口照片、电梯路线和前台联系电话',
          },
          {
            label: '迎接准备',
            value:
              '如开车则提前确认车位；如步行则准备遮阳伞和小风扇并到最近入口等候',
          },
          {
            label: '进店降温',
            value:
              '先提供常温白开水，避免立即使用过冷饮品或直接进入高温护理环节',
          },
          {
            label: '房间状态',
            value: '提前调至25℃，打开氛围灯和轻音乐，确认体感后再开始',
          },
          {
            label: '负责人',
            value: '行政前台负责路线、迎接和饮品；数据前台确认房间状态',
          },
        ],
      },
      communication: {
        eyebrow: '智能提醒 · 沟通边界',
        title: `${selected.name}｜沟通偏好`,
        description:
          '员工接待、护理与离店沟通统一遵循，既有温度也保护客户隐私。',
        items: [
          {
            label: '推荐语气',
            value: '真诚、轻声、慢一点；先赞美具体状态，再说明服务动作',
          },
          {
            label: '建议询问',
            value: '多询问温度、力度、声音和整体舒适度，让客户能随时调整',
          },
          {
            label: '避免话题',
            value: '不追问家庭隐私、收入、伴侣关系或客户未主动提及的私人变化',
          },
          {
            label: '推荐开场',
            value: `“${selected.nickname}，房间已经按您之前的习惯准备好了，今天有任何需要调整的地方随时告诉我。”`,
          },
          {
            label: '服务中',
            value: '客户想休息时减少闲聊；需要说明步骤时使用短句，不连续推销',
          },
          {
            label: '负责人',
            value: '前台完成偏好交接，当次技师在服务中持续确认并回写变化',
          },
        ],
      },
    };
    openDetail(reminderDetails[type]);
  }

  function openPreferenceDetail(
    type: 'environment' | 'pressure' | 'food' | 'conversation',
  ) {
    if (DEMO_MODE && selected.id !== 1) {
      const details = {
        environment: {
          title: '房间环境完整标准',
          items: [
            { label: '温度', value: selectedPreference.roomTemp },
            { label: '香味', value: selectedPreference.scent },
            { label: '音乐', value: selectedPreference.music },
            { label: '床头角度', value: selectedPreference.bedAngle },
          ],
        },
        pressure: {
          title: '力度与手法偏好',
          items: [
            { label: '记录偏好', value: selectedPreference.pressure },
            {
              label: '现场要求',
              value: '先从安全力度开始，在关键节点再次确认舒适度',
            },
          ],
        },
        food: {
          title: '饮品与餐食准备',
          items: [
            { label: '已确认', value: selectedPreference.food },
            {
              label: '送达要求',
              value: '按客户到店与服务阶段安排，不影响护理流程',
            },
          ],
        },
        conversation: {
          title: '沟通方式与边界',
          items: [
            { label: '沟通偏好', value: selectedPreference.communication },
            { label: '共同边界', value: '不打探隐私、不制造焦虑、不保证结果' },
          ],
        },
      }[type];
      openDetail({
        eyebrow: '服务偏好 · 标准Demo',
        title: `${selected.name}｜${details.title}`,
        description: '偏好已经写入完整Demo档案，员工到店前可直接查看并执行。',
        items: details.items,
      });
      return;
    }
    if (importedNeedsProfile) {
      const labels = {
        environment: '房间环境',
        pressure: '力度偏好',
        food: '饮品餐食',
        conversation: '沟通方式',
      };
      openDetail({
        eyebrow: '服务偏好 · 待同步',
        title: `${selected.name}｜${labels[type]}待确认`,
        description: '当前预约表不包含该项偏好，需要员工首次联系或到店时确认。',
        items: [
          { label: '当前状态', value: '暂无可靠记录' },
          {
            label: '员工动作',
            value: '礼貌询问客户当次需要，不把演示数据当作真实偏好',
          },
          {
            label: '完成后',
            value: '将客户明确确认的内容写入档案，作为下次服务参考',
          },
        ],
      });
      return;
    }
    const preferenceDetails = {
      environment: {
        eyebrow: '服务偏好 · 房间环境',
        title: `${selected.name}｜房间环境完整标准`,
        description:
          '到店前完成布置，客户进房后只做确认，不让客户重新提出要求。',
        items: [
          {
            label: '温度',
            value: '预设25℃；客户到房后询问体感，再以1℃为单位微调',
          },
          {
            label: '灯光',
            value: '使用氛围灯，避免强顶光直射面部；效果对比时再切换统一光线',
          },
          {
            label: '香味',
            value: '木质调香，保持淡雅；如当日嗅觉敏感则立即停用',
          },
          {
            label: '音乐',
            value: '轻音乐、低音量；客户想休息时关闭聊天提醒和外放声音',
          },
          {
            label: '完成凭证',
            value: '到店前拍摄房间照片，确认床品、托盘、灯光和温度后存档',
          },
        ],
      },
      pressure: {
        eyebrow: '服务偏好 · 力度',
        title: `${selected.name}｜力度与手法偏好`,
        description: '力度按部位区分，不能把“喜欢大力度”理解成所有区域都加重。',
        items: [
          {
            label: '肩颈',
            value: '偏好大力度，先从中等力度开始，确认后再逐步加强',
          },
          { label: '头部', value: '偏好轻力度，避免持续按压同一点位' },
          {
            label: '面部',
            value: '敏感肌，以舒缓、减少摩擦为主；两颊易红区域降低力度',
          },
          {
            label: '确认节点',
            value: '开始后3分钟、调整体位后、重点区域完成后各询问一次',
          },
          {
            label: '记录要求',
            value: '记录客户当次真实反馈，不能只沿用上一次力度数据',
          },
        ],
      },
      food: {
        eyebrow: '服务偏好 · 饮品餐食',
        title: `${selected.name}｜饮品与餐食准备`,
        description:
          '以本次预约确认结果为准，历史偏好只用于提前询问，不直接默认下单。',
        items: [
          {
            label: '饮品',
            value: '常温白开水，不主动提供冰饮；进店后先少量补水',
          },
          { label: '点心', value: '偏好小汤圆，出品前再次确认当日是否需要' },
          {
            label: '餐食',
            value: '偏好牛肉面；确认用餐时间、份量和是否需要避口',
          },
          {
            label: '水果',
            value: '历史偏好哈密瓜，以当天新鲜度和客户确认结果为准',
          },
          {
            label: '交接动作',
            value: '行政前台准备并标注客户姓名，护理结束前10分钟确认送餐位置',
          },
        ],
      },
      conversation: {
        eyebrow: '服务偏好 · 沟通方式',
        title: `${selected.name}｜沟通方式与禁区`,
        description: '用真诚赞美建立舒适感，不用探问隐私或制造焦虑推动项目。',
        items: [
          {
            label: '喜欢',
            value: '真诚、具体的赞美；例如气色、穿搭或今天状态中的真实优点',
          },
          {
            label: '不喜欢',
            value: '高音量、连续推销、打探隐私，以及对身材和家庭关系的评价',
          },
          {
            label: '项目沟通',
            value: '先复述客户诉求，再解释建议项目与调整理由，最后等待客户确认',
          },
          {
            label: '效果表达',
            value: '引用客户真实反馈和可观察变化，不承诺结果、不夸大即时效果',
          },
          {
            label: '安静信号',
            value: '客户闭眼或回答变短时降低交流频率，仅保留必要的舒适度确认',
          },
        ],
      },
    };
    openDetail(preferenceDetails[type]);
  }

  function openGuidanceTab(target: '本次诊断' | '效果增强') {
    setTab(target);
    window.requestAnimationFrame(() => {
      clientContentRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function openGuidanceStep(
    kind: '诊断沟通' | '效果增强',
    step: GuidanceStep,
    index: number,
  ) {
    openDetail({
      eyebrow: `${selected.name} · ${kind}`,
      title: `${index + 1}. ${step.title}`,
      description: `使用阶段：${step.stage}。员工可直接使用推荐说法，并根据客户当下反馈调整。`,
      items: [
        { label: '沟通目的', value: step.purpose },
        { label: '推荐说法', value: step.script },
        {
          label: '确认动作',
          value:
            '说完后停下来听客户反馈；客户未确认前，不直接进入下一步或追加项目。',
        },
      ],
    });
  }

  async function copyGuidance(label: string, steps: GuidanceStep[]) {
    const text = steps
      .map((step) => `${step.stage}｜${step.title}\n${step.script}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(`${label}已复制`);
    } catch {
      flash(`已为你整理${label}`);
    }
  }

  function choosePhase(index: number) {
    setSelectedPhaseIndex(index);
    setTab('服务流程');
  }

  function applyAppointmentDay(
    day: AppointmentHistoryDay,
    appointmentId?: number,
  ) {
    const appointments = [...day.appointments].sort((left, right) =>
      left.time.localeCompare(right.time),
    );
    selectedDateRef.current = day.date;
    setSelectedDate(day.date);
    setAppointmentItems(appointments);
    setAppointmentSchedule({ ...day.schedule, date: day.date });
    setStaffSchedules(
      day.staffSchedules?.length
        ? day.staffSchedules
        : defaultStaffSchedules(day.date),
    );
    setFilter('全部');
    setSearch('');
    setSelectedPhaseIndex(0);
    setTab('服务流程');
    if (appointments.length > 0) {
      const target = appointments.find((item) => item.id === appointmentId);
      setSelectedId(target?.id || appointments[0].id);
    }
  }

  function changeDay(direction: number) {
    const currentIndex = appointmentHistory.findIndex(
      (day) => day.date === selectedDate,
    );
    if (currentIndex < 0) return;
    const nextIndex = Math.max(
      0,
      Math.min(appointmentHistory.length - 1, currentIndex + direction),
    );
    const nextDay = appointmentHistory[nextIndex];
    if (nextDay) applyAppointmentDay(nextDay);
  }

  function openNewAppointment() {
    if (!canEditAppointments) {
      flash('只有老板和前台可以新增预约');
      return;
    }
    setEditingAppointmentId(null);
    setNewAppointmentName('');
    setNewAppointmentTime('19:30');
    setNewAppointmentRoom('单人间1');
    setNewAppointmentProjectId(YOUZAN_SERVICE_CATALOG[0]?.id || '');
    setNewAppointmentProjectSearch('');
    setNewAppointmentCategory('全部');
    const available = skinManagerSchedules.find(
      (schedule) => schedule.shift !== '休息',
    );
    if (available) {
      setNewAppointmentTechnician(available.staffName);
      setNewAppointmentShift(available.shift);
    }
    setNewAppointmentNurse('');
    setNewAppointmentNurseShift('早班');
    const availableFrontDesk = frontDeskSchedules.find(
      (schedule) => schedule.shift !== '休息',
    );
    setNewAppointmentFrontDesk(availableFrontDesk?.staffName || '');
    setNewAppointmentFrontDeskShift(availableFrontDesk?.shift || '早班');
    setModalOpen(true);
  }

  function openEditAppointment(appointmentId: number) {
    if (!canEditAppointments) {
      flash('当前账号只能查看全店预约');
      return;
    }
    const appointment = activeAppointments.find(
      (item) => item.id === appointmentId,
    );
    if (!appointment) return;
    const service = YOUZAN_SERVICE_CATALOG.find(
      (item) =>
        item.id === appointment.sourceServiceId ||
        item.name === appointment.project,
    );
    setEditingAppointmentId(appointment.id);
    setNewAppointmentName(appointment.name);
    setNewAppointmentTime(appointment.time);
    setNewAppointmentRoom(appointment.room);
    setNewAppointmentTechnician(appointment.technician);
    setNewAppointmentNurse(appointment.nurse || '');
    const nurseSchedule = nurseSchedules.find(
      (schedule) => schedule.staffName === appointment.nurse,
    );
    setNewAppointmentNurseShift(nurseSchedule?.shift || '早班');
    const availableFrontDesk = frontDeskSchedules.find(
      (schedule) => schedule.shift !== '休息',
    );
    const frontDeskName =
      appointment.frontDesk || availableFrontDesk?.staffName || '';
    const frontDeskSchedule = frontDeskSchedules.find(
      (schedule) => schedule.staffName === frontDeskName,
    );
    setNewAppointmentFrontDesk(frontDeskName);
    setNewAppointmentFrontDeskShift(
      frontDeskSchedule?.shift || availableFrontDesk?.shift || '早班',
    );
    const technicianSchedule = skinManagerSchedules.find(
      (schedule) => schedule.staffName === appointment.technician,
    );
    if (technicianSchedule) setNewAppointmentShift(technicianSchedule.shift);
    if (service) setNewAppointmentProjectId(service.id);
    setNewAppointmentProjectSearch('');
    setNewAppointmentCategory('全部');
    setModalOpen(true);
  }

  async function saveNewAppointment() {
    if (!canEditAppointments) {
      flash('只有老板和前台可以修改预约');
      return;
    }
    const name = newAppointmentName.trim();
    if (!name) {
      flash('请先填写客户姓名');
      return;
    }
    if (!selectedNewAppointmentService) {
      flash('请先选择服务项目');
      return;
    }
    const technicianSchedule = skinManagerSchedules.find(
      (schedule) => schedule.staffName === newAppointmentTechnician,
    );
    if (!technicianSchedule) {
      flash('请选择本次服务员工');
      return;
    }
    if (newAppointmentShift === '休息') {
      flash('休息员工不能安排预约，请改选早班或晚班');
      return;
    }
    const nurseSchedule = newAppointmentNurse
      ? nurseSchedules.find(
          (schedule) => schedule.staffName === newAppointmentNurse,
        )
      : undefined;
    if (newAppointmentNurse && !nurseSchedule) {
      flash('请选择本次协作护士');
      return;
    }
    if (newAppointmentNurse && newAppointmentNurseShift === '休息') {
      flash(`${newAppointmentNurse}今天休息，请改选早班或晚班`);
      return;
    }
    const frontDeskSchedule = frontDeskSchedules.find(
      (schedule) => schedule.staffName === newAppointmentFrontDesk,
    );
    if (!frontDeskSchedule) {
      flash('请选择当班前台');
      return;
    }
    if (newAppointmentFrontDeskShift === '休息') {
      flash(`${newAppointmentFrontDesk}今天休息，请改选早班或晚班`);
      return;
    }
    setAppointmentSaving(true);
    try {
      if (technicianSchedule.shift !== newAppointmentShift) {
        const schedules = await updateStaffSchedule(
          newAppointmentTechnician,
          newAppointmentShift,
        );
        if (!schedules) return;
      }
      if (nurseSchedule && nurseSchedule.shift !== newAppointmentNurseShift) {
        const schedules = await updateStaffSchedule(
          newAppointmentNurse,
          newAppointmentNurseShift,
        );
        if (!schedules) return;
      }
      if (frontDeskSchedule.shift !== newAppointmentFrontDeskShift) {
        const schedules = await updateStaffSchedule(
          newAppointmentFrontDesk,
          newAppointmentFrontDeskShift,
        );
        if (!schedules) return;
      }
      const response = await fetch(serviceApi('/api/service-appointment'), {
        method: 'PATCH',
        headers: serviceHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          appointment: {
            id: editingAppointmentId || undefined,
            time: newAppointmentTime,
            name,
            project: selectedNewAppointmentService.name,
            room: newAppointmentRoom,
            technician: newAppointmentTechnician,
            nurse: newAppointmentNurse,
            frontDesk: newAppointmentFrontDesk,
            amount: currencyValue(selectedNewAppointmentService.price),
            sourceServiceId: selectedNewAppointmentService.id,
            serviceDurationMinutes:
              selectedNewAppointmentService.durationMinutes,
          },
        }),
      });
      const data = (await response.json()) as {
        appointment?: Appointment;
        error?: string | { message?: string };
      };
      if (!response.ok || !data.appointment) {
        throw new Error(apiErrorMessage(data, '预约保存失败'));
      }
      const savedAppointment: Appointment = {
        ...data.appointment,
        sourceServiceId: selectedNewAppointmentService.id,
        serviceDurationMinutes: selectedNewAppointmentService.durationMinutes,
      };
      setAppointmentItems((current) => {
        const exists = current.some((item) => item.id === savedAppointment.id);
        const next = exists
          ? current.map((item) =>
              item.id === savedAppointment.id ? savedAppointment : item,
            )
          : [...current, savedAppointment];
        return next.sort((left, right) => left.time.localeCompare(right.time));
      });
      setAppointmentHistory((current) =>
        current.map((day) =>
          day.date === selectedDate
            ? {
                ...day,
                appointments: day.appointments.some(
                  (item) => item.id === savedAppointment.id,
                )
                  ? day.appointments.map((item) =>
                      item.id === savedAppointment.id ? savedAppointment : item,
                    )
                  : [...day.appointments, savedAppointment],
              }
            : day,
        ),
      );
      setSelectedId(savedAppointment.id);
      setSelectedPhaseIndex(0);
      setTab('服务流程');
      setModalOpen(false);
      flash(
        editingAppointmentId
          ? `${name}的预约已更新`
          : `${name}的预约已加入今日服务台`,
      );
    } catch (error) {
      flash(error instanceof Error ? error.message : '预约保存失败');
    } finally {
      setAppointmentSaving(false);
    }
  }

  async function updateStaffSchedule(
    staffName: string,
    shift: ServiceStaffShift,
  ): Promise<ServiceStaffSchedule[] | null> {
    if (!canEditStaffSchedule) {
      flash('当前账号只能查看排班');
      return null;
    }
    setSavingStaffName(staffName);
    try {
      const response = await fetch(serviceApi('/api/service-staff-schedule'), {
        method: 'PATCH',
        headers: serviceHeaders(),
        body: JSON.stringify({ date: selectedDate, staffName, shift }),
      });
      const data = (await response.json()) as {
        schedules?: ServiceStaffSchedule[];
        error?: string | { message?: string };
      };
      if (!response.ok || !data.schedules) {
        throw new Error(apiErrorMessage(data, '排班保存失败'));
      }
      setStaffSchedules(data.schedules);
      setAppointmentHistory((current) =>
        current.map((day) =>
          day.date === selectedDate
            ? { ...day, staffSchedules: data.schedules }
            : day,
        ),
      );
      flash(`${staffName}已调整为${shift}`);
      return data.schedules;
    } catch (error) {
      flash(error instanceof Error ? error.message : '排班保存失败');
      return null;
    } finally {
      setSavingStaffName('');
    }
  }

  function followupTaskKey(id: FollowupId) {
    return `${selectedAppointmentKey}:${id}`;
  }

  function isFollowupCreated(id: FollowupId) {
    return followupCreated.includes(followupTaskKey(id));
  }

  function openFollowupDetail(id: FollowupId, created = isFollowupCreated(id)) {
    const followupDates = {
      d1: displayDateLabel(shiftDateKey(selectedDate, 1)),
      d3: displayDateLabel(shiftDateKey(selectedDate, 3)),
      d21: displayDateLabel(shiftDateKey(selectedDate, 21)),
    };
    const remainingProjects = selected.remainingProjects?.length
      ? selected.remainingProjects
          .map((project) => `${project.name}${project.times}次`)
          .join('；')
      : '项目余次待确认';
    const commonItems = [
      {
        label: '当前状态',
        value: created
          ? '任务已创建，可按下方标准内容执行并记录结果'
          : '待创建；点击卡片后会立即创建并打开本详情',
      },
      {
        label: '客户与项目',
        value: `${selected.name} · ${selected.project} · 本次技师${selected.technician}`,
      },
    ];

    if (id === 'd1') {
      openDetail({
        eyebrow: `${selected.name} · 离店后维护 D+1`,
        title: '舒适度回访执行详情',
        description:
          '这是 D+1 卡片在工作台内的实际详情页。员工按标准话术回访，记录异常与舒适度，不需要离开飞书工作台。',
        items: [
          ...commonItems,
          {
            label: '执行日期与负责人',
            value: `${followupDates.d1} ${selected.time} · 当次技师${selected.technician}`,
          },
          {
            label: '标准回访话术',
            value: `${selected.nickname}，想回访一下您做完${selected.project}后的感受。现在有没有持续泛红、刺痛、紧绷或其他不舒服？整体舒适度怎么样？`,
          },
          {
            label: '必须记录',
            value:
              '泛红/刺痛/紧绷情况、整体舒适度、客户新增偏好、是否需要技师或老板介入。',
          },
          {
            label: '完成后的数据去向',
            value:
              '写回当前客户的护理记录与客户档案；有异常时同步老板/群主、当次技师和前台。',
          },
        ],
      });
      return;
    }

    if (id === 'd3') {
      openDetail({
        eyebrow: `${selected.name} · 离店后维护 D+3`,
        title: '效果关怀执行详情',
        description:
          '这是 D+3 卡片在工作台内的实际详情页，用于确认真实效果、居家护理执行情况与客户主观感受。',
        items: [
          ...commonItems,
          {
            label: '执行日期与负责人',
            value: `${followupDates.d3} · 数据前台跟进，当次技师${selected.technician}复核`,
          },
          {
            label: '效果增强话术',
            value: `${selected.nickname}，这几天看下来，${selected.project}带来的改善应该已经更稳定了。您自己最明显的感受是什么？如果方便，可以在同一光线下拍一张照片，我们一起对比效果。`,
          },
          {
            label: '必须记录',
            value:
              '客户主观感受、同光线效果照片、居家护理执行情况、异常反应及后续处理。',
          },
          {
            label: '完成后的数据去向',
            value:
              '写回护理记录和效果档案，作为 D+21 下次预约建议与后续项目诊断的依据。',
          },
        ],
      });
      return;
    }

    openDetail({
      eyebrow: `${selected.name} · 离店后维护 D+21`,
      title: '下次预约建议执行详情',
      description:
        '这是 D+21 卡片在工作台内的实际详情页。建议必须结合历史消费、项目余次与本次效果，不做固定推销。',
      items: [
        ...commonItems,
        {
          label: '执行日期与负责人',
          value: `${followupDates.d21} · 固定技师${selected.fixedTechnician}主跟进，前台协同预约`,
        },
        {
          label: '历史消费依据',
          value: `上次到店${selected.lastVisit ?? '待确认'} · 上次消费${selected.lastSpend ?? selected.amount} · 卡内余额${selected.cardBalance ?? '待确认'}`,
        },
        {
          label: '剩余项目依据',
          value: remainingProjects,
        },
        {
          label: '预约沟通话术',
          value: `${selected.nickname}，结合您这次${selected.project}的反馈和现在的状态，建议下一次继续以效果稳定和衔接为主。您更方便工作日还是周末？我先按您的节奏预留合适时间。`,
        },
        {
          label: '必须记录',
          value:
            '下一次需求、预约意向、偏好日期与技师；暂不预约时记录原因和下一次联系时间。',
        },
        {
          label: '完成后的数据去向',
          value:
            '有意向则进入预约列表；暂不预约则保留在客户跟进记录，并按约定日期再次提醒。',
        },
      ],
    });
  }

  function createFollowup(id: FollowupId, message: string) {
    const taskKey = followupTaskKey(id);
    const alreadyCreated = followupCreated.includes(taskKey);
    if (!alreadyCreated) {
      setFollowupCreated((current) => [...current, taskKey]);
      flash(message);
    }
    openFollowupDetail(id, true);
  }

  function openTechnicianAssignment() {
    setTechnicianDraft(
      ['待填写', '待分配'].includes(selected.technician)
        ? ''
        : selected.technician,
    );
    setAssignmentError('');
    setTechnicianModalOpen(true);
  }

  function openEmployeeAppointment(appointmentId: number, phaseIndex = 0) {
    setSelectedId(appointmentId);
    setSelectedPhaseIndex(phaseIndex);
    setTab('服务流程');
    setActivePortal('employee');
    setEmployeeSection('service');
    window.requestAnimationFrame(() => {
      clientContentRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function selectEmployeePreview(name: string) {
    setEmployeePreviewName(name);
    const profile = resolveEmployeeStaffProfile(viewerName, true, name);
    const scopedAppointments = appointmentsForEmployeeProfile(
      profile,
      activeAppointments,
    );
    if (scopedAppointments[0]) {
      setSelectedId(scopedAppointments[0].id);
      setSelectedPhaseIndex(0);
      setTab('服务流程');
    }
    if (profile.role === 'skin_manager') {
      setSelectedWeeklyTechnician(profile.name);
    }
  }

  function openWeeklyAppointment(appointment: WeeklyAppointment) {
    const day = appointmentHistory.find(
      (historyDay) => historyDay.date === appointment.date,
    );
    if (!day) return;
    applyAppointmentDay(day, appointment.id);
    setActivePortal('employee');
    setEmployeeSection('service');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function confirmDeleteAppointment() {
    if (!deleteTarget || deleteSaving) return;
    if (viewerRole !== 'owner') {
      flash('只有老板可以删除预约');
      setDeleteTarget(null);
      return;
    }
    setDeleteSaving(true);
    try {
      const response = await fetch(
        serviceApi(
          `/api/service-appointment?appointmentId=${encodeURIComponent(
            appointmentRecordKey(selectedDate, deleteTarget.id),
          )}`,
        ),
        { method: 'DELETE', headers: serviceHeaders() },
      );
      const data = (await response.json()) as ApiErrorPayload;
      if (!response.ok) throw new Error(apiErrorMessage(data, '删除失败'));
      setDeletedAppointmentIds((current) =>
        Array.from(
          new Set([
            ...current,
            appointmentRecordKey(selectedDate, deleteTarget.id),
          ]),
        ),
      );
      flash(`${deleteTarget.name}的预约已移入回收站`);
      setDeleteTarget(null);
    } catch (error) {
      flash(error instanceof Error ? error.message : '删除失败，请重试');
    } finally {
      setDeleteSaving(false);
    }
  }

  async function restoreAppointment(appointment: Appointment) {
    if (viewerRole !== 'owner' || restoreSavingId) return;
    const appointmentKey = appointmentRecordKey(selectedDate, appointment.id);
    setRestoreSavingId(appointmentKey);
    try {
      const response = await fetch(
        serviceApi('/api/service-appointment/restore'),
        {
          method: 'POST',
          headers: serviceHeaders(),
          body: JSON.stringify({ appointmentId: appointmentKey }),
        },
      );
      const data = (await response.json()) as ApiErrorPayload;
      if (!response.ok) throw new Error(apiErrorMessage(data, '恢复失败'));
      setDeletedAppointmentIds((current) =>
        current.filter((id) => id !== appointmentKey),
      );
      flash(`${appointment.name}的预约已恢复`);
    } catch (error) {
      flash(error instanceof Error ? error.message : '恢复失败，请重试');
    } finally {
      setRestoreSavingId('');
    }
  }

  async function saveTechnicianAssignment() {
    const technician = technicianDraft.trim();
    if (technician.length < 2 || technician.length > 20) {
      setAssignmentError('请填写2至20个字的本次服务技师姓名');
      return;
    }
    await performTechnicianAssignment(technician);
  }

  async function performTechnicianAssignment(technician: string) {
    if (assignmentSaving) return;
    setAssignmentSaving(true);
    setAssignmentError('');
    try {
      const response = await fetch(serviceApi('/api/service-assignment'), {
        method: 'PATCH',
        headers: serviceHeaders(),
        body: JSON.stringify({
          appointmentId: selectedAppointmentKey,
          technician,
        }),
      });
      const data = (await response.json()) as ApiErrorPayload & {
        assignedTechnician?: string;
        actor?: { displayName?: string; userId?: string };
      };
      if (!response.ok)
        throw new Error(apiErrorMessage(data, '本次技师保存失败'));
      const assignedTechnician = data.assignedTechnician || technician;
      setAppointmentItems((current) =>
        current.map((item) =>
          item.id === selectedId
            ? { ...item, technician: assignedTechnician }
            : item,
        ),
      );
      setCurrentActor(data.actor?.displayName || currentActor);
      setCurrentActorUserId(data.actor?.userId || currentActorUserId);
      setTechnicianModalOpen(false);
      flash(`本次服务技师已更新为${assignedTechnician}`);
    } catch (error) {
      setAssignmentError(
        error instanceof Error ? error.message : '本次技师保存失败，请重试',
      );
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function toggleTask(id: string) {
    if (doneTasks.includes(id) && viewerRole !== 'owner') {
      flash('已完成记录已锁定，员工不能删除或取消');
      return;
    }
    await performToggleTask(id);
  }

  async function performToggleTask(id: string) {
    if (savingTask) return;
    const wasDone = doneTasks.includes(id);
    const nextDone = !wasDone;
    const nextTaskIds = nextDone
      ? Array.from(new Set([...doneTasks, id]))
      : doneTasks.filter((taskId) => taskId !== id);
    setSavingTask(id);
    setDoneTasks(nextTaskIds);
    setCloudState('loading');
    try {
      const response = await fetch(serviceApi('/api/service-state'), {
        method: 'PATCH',
        headers: serviceHeaders(),
        body: JSON.stringify({
          appointmentId: selectedAppointmentKey,
          taskId: id,
          completed: nextDone,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        actor?: { displayName?: string; userId?: string };
      };
      if (!response.ok) throw new Error(apiErrorMessage(data, '保存失败'));
      setCurrentActor(data.actor?.displayName || '门店员工');
      setCurrentActorUserId(data.actor?.userId || '');
      setCloudState('saved');
      const phaseCompleted =
        nextDone &&
        currentPhase.tasks.every((task) => nextTaskIds.includes(task.id));
      if (phaseCompleted) {
        await completeAndSync(nextTaskIds, true, data.actor?.userId || '');
      }
    } catch (error) {
      setDoneTasks((current) =>
        wasDone ? [...current, id] : current.filter((taskId) => taskId !== id),
      );
      setCloudState('error');
      flash(error instanceof Error ? error.message : '进度保存失败，请重试');
    } finally {
      setSavingTask('');
    }
  }

  function notificationMentions(actorUserId: string): MentionUser[] {
    const mentions: MentionUser[] = [FEISHU_GROUP_OWNER];
    const technician = TECHNICIAN_FEISHU_USERS[selected.technician];
    if (technician) mentions.push(technician);
    if (actorUserId) {
      mentions.push({
        userId: actorUserId,
        name: currentActor || '行政前台',
        role: '行政前台',
      });
    }
    return mentions;
  }

  async function completeAndSync(
    completedTaskIdsOverride?: string[],
    automatic = false,
    actorUserIdOverride?: string,
  ) {
    const completedTaskIds = completedTaskIdsOverride || doneTasks;
    const remaining = currentPhase.tasks.filter(
      (task) => !completedTaskIds.includes(task.id),
    ).length;
    if (remaining > 0) {
      flash(`请先完成“${currentPhase.name}”剩余 ${remaining} 项动作`);
      return;
    }
    if (syncing) return;
    const stageKey = `${selectedAppointmentKey}:${currentPhase.id}`;
    if (automatic && autoSyncedStageKeysRef.current.has(stageKey)) return;
    if (automatic) autoSyncedStageKeysRef.current.add(stageKey);
    setSyncing(true);
    setStageSyncStatus('idle');
    try {
      const response = await fetch(serviceApi('/api/service-complete'), {
        method: 'POST',
        headers: serviceHeaders(),
        body: JSON.stringify({
          appointmentId: selectedAppointmentKey,
          clientName: selected.name,
          projectName: selected.project,
          room: selected.room,
          technician: selected.technician,
          stageId: currentPhase.id,
          stageName: currentPhase.name,
          nextStageName: servicePhases[selectedPhaseIndex + 1]?.name,
          completedTaskIds,
          mentionUsers: notificationMentions(
            actorUserIdOverride || currentActorUserId,
          ),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        saved?: boolean;
        duplicate?: boolean;
        mentionCount?: number;
      };
      if (!response.ok) throw new Error(apiErrorMessage(data, '同步失败'));
      setStageSyncStatus('sent');
      flash(
        data.duplicate
          ? `${currentPhase.name}已同步，无需重复发送`
          : `${currentPhase.name}已自动同步并@相关负责人`,
      );
    } catch (error) {
      autoSyncedStageKeysRef.current.delete(stageKey);
      setStageSyncStatus('error');
      flash(error instanceof Error ? error.message : '同步失败，请重试');
    } finally {
      setSyncing(false);
    }
  }

  async function copyScript() {
    const phase = currentPhase.id || 'preparation';
    const script = careScripts[phase] || careScripts.preparation;
    try {
      await navigator.clipboard.writeText(script);
      flash('关怀话术已复制');
    } catch {
      flash('已为你选中关怀话术');
    }
  }

  async function submitServiceSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const webhookUrl = webhookInput.trim();
    if (!webhookUrl.includes('/open-apis/bot/v2/hook/')) {
      setSetupError('请粘贴完整的飞书群机器人 Webhook 地址');
      return;
    }
    setSetupSaving(true);
    setSetupError('');
    try {
      const response = await fetch(serviceApi('/api/service-config'), {
        method: 'POST',
        headers: serviceHeaders(),
        body: JSON.stringify({
          webhookUrl,
          signSecret: signSecretInput.trim(),
        }),
      });
      const data = (await response.json()) as ApiErrorPayload;
      if (!response.ok) throw new Error(apiErrorMessage(data, '连接失败'));
      setFeishuConfigured(true);
      setSetupModalOpen(false);
      setWebhookInput('');
      setSignSecretInput('');
      flash('飞书群已连接');
    } catch (error) {
      setSetupError(
        error instanceof Error ? error.message : '连接失败，请重试',
      );
    } finally {
      setSetupSaving(false);
    }
  }

  if (roleLoading) {
    return (
      <main className="app-shell service-access-state">
        <section className="panel">
          <span className="eyebrow">飞书身份验证</span>
          <h1>正在识别你的门店岗位…</h1>
          <p>识别完成后，只会显示该岗位允许查看和操作的内容。</p>
        </section>
      </main>
    );
  }

  if (!hasStoreRole) {
    return (
      <main className="app-shell service-access-state">
        <section className="panel">
          <span className="eyebrow">尚未分配岗位</span>
          <h1>{viewerName} 暂时不能进入门店工作台</h1>
          <p>请联系老板或前台，在“员工与权限”中为该飞书账号分配门店岗位。</p>
          <div className="access-role-note">
            未分配岗位不会显示客户、预约、余额或经营数据。
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="workspace-menu-button"
          type="button"
          aria-label="打开功能导航"
          aria-expanded={navigationOpen}
          onClick={() => setNavigationOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="brand-title">
              壹心壹意医疗美容 ·{' '}
              {workspaceView === 'customer_assets'
                ? '客户资料库'
                : workspaceView === 'customer_reminders'
                  ? '客户提醒中心'
                  : activePortal === 'owner'
                    ? '老板管理端'
                    : '员工执行端'}
            </div>
            <div className="brand-subtitle">
              {workspaceView === 'customer_assets'
                ? '客户画像、消费资产与服务标准统一管理'
                : workspaceView === 'customer_reminders'
                  ? '流失预警、回访周期与客户关怀统一执行'
                  : activePortal === 'owner'
                    ? '经营总览、权限管理与数据治理'
                    : '客户全流程执行与现场填写'}
            </div>
          </div>
        </div>
        <button
          className="user-chip"
          onClick={() =>
            openDetail({
              eyebrow: '当前登录账号',
              title: viewerName,
              description: viewerScopeDescription,
              items: [
                {
                  label: '角色',
                  value: viewerRoleLabel,
                },
                {
                  label: '数据状态',
                  value: cloudState === 'saved' ? '已连接云端' : '正在连接云端',
                },
                {
                  label: '飞书群',
                  value: feishuConfigured ? '已连接' : '尚未连接',
                },
              ],
            })
          }
        >
          {viewerName.slice(0, 1)}
        </button>
      </header>

      <div
        className={`workspace-shell ${navigationOpen ? 'navigation-open' : ''}`}
      >
        <button
          className="workspace-nav-backdrop"
          type="button"
          aria-label="关闭功能导航"
          onClick={() => setNavigationOpen(false)}
        />
        <aside className="workspace-sidebar" aria-label="工作台主导航">
          <div className="workspace-sidebar-head">
            <div>
              <span>壹心壹意</span>
              <strong>门店工作台</strong>
            </div>
            <button
              type="button"
              aria-label="关闭功能导航"
              onClick={() => setNavigationOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {workspaceView === 'service_desk' && canEditAppointments && (
            <section
              className="workspace-quick-actions"
              aria-label="常用现场操作"
            >
              <span className="workspace-nav-label">常用操作</span>
              <button
                className="workspace-quick-action checkout"
                type="button"
                onClick={() => {
                  setCheckoutOpen(true);
                  setNavigationOpen(false);
                }}
              >
                <span className="workspace-quick-action-icon">
                  <ReceiptText aria-hidden="true" />
                </span>
                <span className="workspace-quick-action-copy">
                  <strong>开单结算</strong>
                  <small>查询客户、扣卡与收款</small>
                </span>
              </button>
              <button
                className="workspace-quick-action appointment"
                type="button"
                onClick={() => {
                  openNewAppointment();
                  setNavigationOpen(false);
                }}
              >
                <span className="workspace-quick-action-icon">
                  <CalendarPlus aria-hidden="true" />
                </span>
                <span className="workspace-quick-action-copy">
                  <strong>新增预约</strong>
                  <small>选择客户、项目与人员</small>
                </span>
              </button>
            </section>
          )}

          <nav className="workspace-nav">
            <section className="workspace-nav-section">
              <span className="workspace-nav-label">工作台</span>
              {isOwnerViewer && (
                <button
                  className={`workspace-nav-item ${workspaceView === 'service_desk' && activePortal === 'owner' ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    setWorkspaceView('service_desk');
                    setActivePortal('owner');
                    setOwnerSection('overview');
                    setNavigationOpen(false);
                  }}
                >
                  <LayoutDashboard aria-hidden="true" />
                  <span>老板管理端</span>
                </button>
              )}
              <button
                className={`workspace-nav-item ${workspaceView === 'service_desk' && activePortal === 'employee' ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setWorkspaceView('service_desk');
                  setActivePortal('employee');
                  setEmployeeSection('overview');
                  setNavigationOpen(false);
                }}
              >
                <ClipboardCheck aria-hidden="true" />
                <span>员工执行端</span>
              </button>
            </section>

            {(canViewCustomerManagement || canViewPriorityManagement) && (
              <section className="workspace-nav-section">
                <span className="workspace-nav-label">客户管理</span>
                {canViewCustomerManagement && (
                  <button
                    className={`workspace-nav-item ${workspaceView === 'customer_assets' ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setAssetFocusQuery('');
                      setWorkspaceView('customer_assets');
                      setNavigationOpen(false);
                    }}
                  >
                    <ContactRound aria-hidden="true" />
                    <span>客户资料库</span>
                  </button>
                )}
                {canViewCustomerManagement && (
                  <button
                    className={`workspace-nav-item ${workspaceView === 'customer_reminders' ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setWorkspaceView('customer_reminders');
                      setNavigationOpen(false);
                    }}
                  >
                    <BellRing aria-hidden="true" />
                    <span>客户提醒</span>
                  </button>
                )}
                {canViewPriorityManagement && (
                  <button
                    className="workspace-nav-item"
                    type="button"
                    onClick={() => {
                      setWorkspaceView('service_desk');
                      openPriorityClientDetail();
                      setNavigationOpen(false);
                    }}
                  >
                    <Star aria-hidden="true" />
                    <span>重点客户</span>
                    <em>{attentionAppointments.length}</em>
                  </button>
                )}
              </section>
            )}

            {(canManageStaffRoles ||
              servicePermissions.manageInventory ||
              viewerRole === 'owner') && (
              <section className="workspace-nav-section">
                <span className="workspace-nav-label">经营管理</span>
                {canManageStaffRoles && (
                  <button
                    className="workspace-nav-item"
                    type="button"
                    onClick={() => navigate('/staff-permissions')}
                  >
                    <UserCog aria-hidden="true" />
                    <span>员工与权限</span>
                  </button>
                )}
                {servicePermissions.manageInventory && (
                  <button
                    className="workspace-nav-item"
                    type="button"
                    onClick={() => navigate('/inventory')}
                  >
                    <PackageSearch aria-hidden="true" />
                    <span>产品与库存</span>
                  </button>
                )}
                {servicePermissions.manageInventory && (
                  <button
                    className="workspace-nav-item"
                    type="button"
                    onClick={() => navigate('/card-items')}
                  >
                    <CreditCard aria-hidden="true" />
                    <span>卡项与项目</span>
                  </button>
                )}
                {viewerRole === 'owner' && (
                  <button
                    className="workspace-nav-item"
                    type="button"
                    onClick={() => navigate('/card-data-analytics')}
                  >
                    <BarChart3 aria-hidden="true" />
                    <span>数据分析</span>
                  </button>
                )}
              </section>
            )}
          </nav>

          {workspaceView === 'service_desk' && activePortal === 'employee' && (
            <label className="workspace-sidebar-search">
              <span>搜索</span>
              <input
                ref={searchRef}
                aria-label="搜索客户、项目或技师"
                placeholder="客户、项目或技师"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          )}

          <div className="workspace-sidebar-footer">
            <span>{viewerRoleLabel}</span>
            <strong>{viewerName}</strong>
            <small>
              {cloudState === 'saved' ? '云端数据已同步' : '正在连接云端'}
            </small>
          </div>
        </aside>

        <div className="workspace-main">
          {workspaceView === 'customer_assets' && canViewCustomerManagement ? (
            <CustomerAssetLibrary
              initialQuery={assetFocusQuery}
              onBack={() => setWorkspaceView('service_desk')}
            />
          ) : workspaceView === 'customer_reminders' &&
            canViewCustomerManagement ? (
            <CustomerReminderCenter
              onBack={() => setWorkspaceView('service_desk')}
              onOpenAsset={(customer) => {
                setAssetFocusQuery(customer.name);
                setWorkspaceView('customer_assets');
              }}
            />
          ) : activePortal === 'owner' && isOwnerViewer ? (
            <section className="owner-page">
              <div className="owner-welcome">
                <div>
                  <div className="eyebrow">老板管理模式 · 可执行管理操作</div>
                  <h1>门店经营与执行总览</h1>
                  <p>
                    经营、客户、结算与权限数据仅老板端显示；所有管理操作均按飞书岗位校验。
                  </p>
                </div>
                <div className="owner-date-tools">
                  <div className="date-switcher">
                    <button
                      aria-label="前一天"
                      onClick={() => changeDay(-1)}
                      disabled={!canViewPreviousDay}
                    >
                      ‹
                    </button>
                    <button className="date-current">
                      <strong>{currentDay.label}</strong>
                      <span>{currentDay.weekday} · 每日归档</span>
                    </button>
                    <button
                      aria-label="后一天"
                      onClick={() => changeDay(1)}
                      disabled={!canViewNextDay}
                    >
                      ›
                    </button>
                  </div>
                  <div className="owner-identity">
                    <span>当前身份</span>
                    <strong>{`${viewerName} · 老板`}</strong>
                    <small>当前账号已匹配专属老板角色</small>
                  </div>
                </div>
              </div>

              {ownerSection === 'overview' ? (
                <section className="panel workspace-directory owner-directory">
                  <div className="workspace-directory-heading">
                    <div>
                      <span className="eyebrow">一级目录 · 老板工作台</span>
                      <h2>选择需要处理的管理模块</h2>
                      <p>
                        今日经营重点直接显示在下方；周报和预约管理点击后单独查看。
                      </p>
                    </div>
                    <b>2 个管理入口</b>
                  </div>
                  <div className="workspace-directory-grid owner-directory-grid">
                    <button
                      className="directory-card"
                      type="button"
                      onClick={() => setOwnerSection('weekly')}
                    >
                      <CalendarRange aria-hidden="true" />
                      <span>
                        <strong>本周经营复盘</strong>
                        <small>预约、成交、员工负载与优劣势</small>
                      </span>
                      <em>进入 →</em>
                    </button>
                    <button
                      className="directory-card"
                      type="button"
                      onClick={() => setOwnerSection('appointments')}
                    >
                      <CalendarClock aria-hidden="true" />
                      <span>
                        <strong>预约与现场管理</strong>
                        <small>修改预约、执行进度、权限与回收站</small>
                      </span>
                      <em>进入 →</em>
                    </button>
                  </div>
                </section>
              ) : (
                <section className="panel secondary-page-head">
                  <button
                    type="button"
                    onClick={() => setOwnerSection('overview')}
                  >
                    ← 返回一级目录
                  </button>
                  <div>
                    <span>
                      老板管理端 /{' '}
                      {ownerSection === 'weekly'
                        ? '本周经营复盘'
                        : '预约与现场管理'}
                    </span>
                    <h2>
                      {ownerSection === 'weekly'
                        ? '本周经营复盘'
                        : '预约与现场管理'}
                    </h2>
                    <p>
                      {ownerSection === 'weekly'
                        ? '集中查看本周预约、成交、员工负载和经营问题。'
                        : '集中处理预约、执行进度、权限边界和可恢复记录。'}
                    </p>
                  </div>
                </section>
              )}

              {ownerSection === 'overview' && (
                <OwnerTodayCommand
                  dateLabel={currentDay.label}
                  updatedAt={appointmentSchedule.importedAt}
                  current={ownerMetrics}
                  previous={previousOwnerMetrics}
                  analysis={ownerRealtimeAnalysis}
                  onSelectDaily={openOwnerDailyMetricDetail}
                  onSelectAnalysis={openOwnerAnalysisDetail}
                />
              )}

              {ownerSection === 'weekly' && (
                <section className="panel weekly-dashboard owner-weekly-dashboard">
                  <div className="weekly-heading">
                    <div>
                      <span className="eyebrow">老板周报 · 每周自动汇总</span>
                      <h2>全店本周预约与服务复盘</h2>
                      <p>
                        {weekRangeLabel} · 从每日归档和员工实际完成进度实时计算
                      </p>
                    </div>
                    <b>{weeklySummary.archivedDayCount} 天已有预约</b>
                  </div>
                  <div className="weekly-metric-grid">
                    <article>
                      <span>本周预约</span>
                      <strong>{weeklyAppointments.length}</strong>
                      <small>{weeklySummary.uniqueCustomers} 位客户</small>
                    </article>
                    <article>
                      <span>服务闭环</span>
                      <strong>{weeklySummary.completionRate}%</strong>
                      <small>{weeklySummary.completedCount} 人次已完成</small>
                    </article>
                    <article>
                      <span>本周总应收</span>
                      <strong>
                        {currencyValue(weeklySummary.totalReceivable)}
                      </strong>
                      <small>
                        已结算 {currencyValue(weeklySummary.settledReceivable)}{' '}
                        · 待结算{' '}
                        {currencyValue(weeklySummary.pendingSettlement)}
                      </small>
                    </article>
                    <article>
                      <span>预约高峰</span>
                      <strong>{weeklySummary.busiestDay?.[0] || '暂无'}</strong>
                      <small>
                        {weeklySummary.busiestDay
                          ? `${weeklySummary.busiestDay[1]} 人次`
                          : '等待预约同步'}
                      </small>
                    </article>
                  </div>
                  <div className="weekly-body-grid">
                    <div className="weekly-insight-grid">
                      <section className="weekly-insight positive">
                        <h3>本周优势</h3>
                        <ul>
                          {weeklySummary.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                      <section className="weekly-insight warning">
                        <h3>待改进与经营风险</h3>
                        <ul>
                          {weeklySummary.risks.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                      <section className="weekly-technicians">
                        <h3>技师本周负载</h3>
                        {weeklySummary.technicianCounts.length > 0 ? (
                          weeklySummary.technicianCounts.map(
                            ([name, count]) => (
                              <div key={name}>
                                <span>{name}</span>
                                <i>
                                  <b
                                    style={{
                                      width: `${Math.max(
                                        12,
                                        Math.round(
                                          (count / weeklyAppointments.length) *
                                            100,
                                        ),
                                      )}%`,
                                    }}
                                  />
                                </i>
                                <strong>{count} 人次</strong>
                              </div>
                            ),
                          )
                        ) : (
                          <p>本周暂无技师排班数据</p>
                        )}
                      </section>
                    </div>
                    <section className="weekly-detail">
                      <div>
                        <h3>本周具体预约明细</h3>
                        <span>点击任一客户进入当天完整服务流程</span>
                      </div>
                      <div className="weekly-detail-list">
                        {weeklyAppointments.length > 0 ? (
                          weeklyAppointments.map((item) => (
                            <button
                              key={`${item.date}-${item.id}`}
                              onClick={() => openWeeklyAppointment(item)}
                            >
                              <time>
                                {item.dateLabel}
                                <small>{item.weekday}</small>
                              </time>
                              <span>
                                <span className="customer-name-membership-row">
                                  <strong>{item.name}</strong>
                                  <CustomerMembershipBadge
                                    label={appointmentMembershipLabel(
                                      item.customerAsset,
                                      item.member,
                                    )}
                                    compact
                                  />
                                </span>
                                <small>
                                  {item.time} · {item.project} ·{' '}
                                  {item.technician} · {item.room}房
                                </small>
                              </span>
                              <StatusPill status={item.status} />
                              <em>{item.amount}</em>
                            </button>
                          ))
                        ) : (
                          <div className="weekly-empty">
                            本周暂无预约；群里发送预约表后会自动进入这里。
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </section>
              )}

              {ownerSection === 'appointments' && (
                <>
                  <div className="owner-grid">
                    <section className="panel owner-appointments">
                      <div className="owner-section-head">
                        <div>
                          <h2>{scheduleHeading}管理</h2>
                          <p>可进入执行端查看详情，或将错误预约移入回收站。</p>
                        </div>
                        {canEditAppointments && (
                          <button
                            className="secondary-button"
                            onClick={() => openNewAppointment()}
                          >
                            +新增预约
                          </button>
                        )}
                      </div>
                      <div className="owner-table-wrap">
                        <table className="owner-table">
                          <thead>
                            <tr>
                              <th>时间 / 房间</th>
                              <th>客户</th>
                              <th>项目</th>
                              <th>当次技师</th>
                              <th>状态</th>
                              <th>金额</th>
                              <th>管理</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeAppointments.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <strong>{item.time}</strong>
                                  <span>{item.room}房</span>
                                </td>
                                <td>
                                  <span className="customer-name-membership-row">
                                    <strong>{item.name}</strong>
                                    <CustomerMembershipBadge
                                      label={appointmentMembershipLabel(
                                        item.customerAsset,
                                        item.member,
                                      )}
                                      compact
                                    />
                                  </span>
                                </td>
                                <td>{item.project}</td>
                                <td>{item.technician}</td>
                                <td>
                                  <StatusPill status={item.status} />
                                </td>
                                <td>
                                  <strong>{item.amount}</strong>
                                </td>
                                <td>
                                  <div className="owner-row-actions">
                                    {canEditAppointments && (
                                      <button
                                        onClick={() =>
                                          openEditAppointment(item.id)
                                        }
                                      >
                                        修改预约
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        openEmployeeAppointment(item.id)
                                      }
                                    >
                                      查看执行
                                    </button>
                                    <button
                                      className="danger-link"
                                      disabled={viewerRole !== 'owner'}
                                      title={
                                        viewerRole === 'owner'
                                          ? '将预约移入回收站'
                                          : '员工可查看，但只有老板可以删除'
                                      }
                                      onClick={() => setDeleteTarget(item)}
                                    >
                                      {viewerRole === 'owner'
                                        ? '删除'
                                        : '仅老板删除'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <aside className="owner-side">
                      <section className="panel permission-card">
                        <div className="owner-section-head">
                          <div>
                            <h2>权限边界</h2>
                            <p>前后端双重校验</p>
                          </div>
                          <span className="permission-lock">锁</span>
                        </div>
                        <ul>
                          <li>
                            <strong>全员可以</strong>
                            <span>
                              查看客户资料库、客户提醒、老板管理端和员工执行端
                            </span>
                          </li>
                          <li>
                            <strong>老板与前台可以</strong>
                            <span>
                              新增员工、分配非老板岗位、修改预约与调整排班；老板另可管理最高权限、删除与恢复
                            </span>
                          </li>
                          <li>
                            <strong>管理师与护士只读</strong>
                            <span>
                              可看全店预约，只执行自己的客户任务，不能调整排班与预约
                            </span>
                          </li>
                          <li>
                            <strong>老板专有</strong>
                            <span>
                              删除与恢复预约、取消已完成记录、管理系统配置
                            </span>
                          </li>
                        </ul>
                      </section>
                      <section className="panel owner-alerts">
                        <div className="owner-section-head">
                          <div>
                            <h2>门店待关注</h2>
                            <p>今日经营提醒</p>
                          </div>
                        </div>
                        {priorityAssessments.length > 0 ? (
                          priorityAssessments.map((assessment) => (
                            <button
                              key={assessment.appointment.id}
                              onClick={() =>
                                openPriorityClientDetail(assessment.appointment)
                              }
                            >
                              <i>!</i>
                              <span>
                                <strong>
                                  {assessment.appointment.name} ·{' '}
                                  {assessment.appointment.time}
                                </strong>
                                <small>{assessment.reasons[0]}</small>
                              </span>
                              <em>详情 →</em>
                            </button>
                          ))
                        ) : (
                          <p className="owner-alerts-empty">
                            今日客户档案均未达到重点关注阈值
                          </p>
                        )}
                        <button
                          onClick={() => {
                            setFilter('待服务');
                            setActivePortal('employee');
                          }}
                        >
                          <i>候</i>
                          <span>
                            <strong>
                              {ownerMetrics.pendingCount} 位待服务
                            </strong>
                            <small>请核对项目、房间和当次技师</small>
                          </span>
                          <em>查看 →</em>
                        </button>
                      </section>
                    </aside>
                  </div>

                  <section className="panel recycle-panel">
                    <div className="owner-section-head">
                      <div>
                        <h2>预约回收站</h2>
                        <p>删除为可恢复操作，员工端不会显示这些内容。</p>
                      </div>
                      <span className="recycle-count">
                        {deletedAppointments.length} 条
                      </span>
                    </div>
                    {deletedAppointments.length === 0 ? (
                      <div className="recycle-empty">暂无已删除预约</div>
                    ) : (
                      <div className="recycle-list">
                        {deletedAppointments.map((item) => (
                          <div key={item.id}>
                            <span>
                              <span className="customer-name-membership-row">
                                <strong>{item.name}</strong>
                                <CustomerMembershipBadge
                                  label={appointmentMembershipLabel(
                                    item.customerAsset,
                                    item.member,
                                  )}
                                  compact
                                />
                              </span>
                              <small>
                                {item.time} · {item.project}
                              </small>
                            </span>
                            <button
                              onClick={() => restoreAppointment(item)}
                              disabled={
                                viewerRole !== 'owner' ||
                                restoreSavingId ===
                                  appointmentRecordKey(selectedDate, item.id)
                              }
                              title={
                                viewerRole === 'owner'
                                  ? '恢复这条预约'
                                  : '员工可查看，但只有老板可以恢复'
                              }
                            >
                              {viewerRole !== 'owner'
                                ? '仅老板恢复'
                                : restoreSavingId ===
                                    appointmentRecordKey(selectedDate, item.id)
                                  ? '正在恢复…'
                                  : '恢复预约'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </section>
          ) : (
            <section className="page-wrap">
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">
                    {currentDay.weekday.toUpperCase()} · {currentDay.label}
                  </div>
                  <h1>
                    早上好，{scheduleDayWord}有 <em>{currentDay.count} 位</em>{' '}
                    客人到店
                  </h1>
                  {currentDay.note ? (
                    <div className="welcome-summary">
                      <span>{appointmentSchedule.sourceName}已加载</span>
                      <button
                        className={`priority-entry ${
                          attentionAppointments.length === 0 ? 'empty' : ''
                        }`}
                        onClick={() => openPriorityClientDetail()}
                      >
                        <i>{attentionAppointments.length > 0 ? '!' : '✓'}</i>
                        <strong>
                          {attentionAppointments.length > 0
                            ? `${attentionAppointments.length} 位重点客户需要关注`
                            : '今日无重点客户'}
                        </strong>
                        <em>
                          {attentionAppointments.length > 0
                            ? '查看详情 →'
                            : '查看判断规则 →'}
                        </em>
                      </button>
                    </div>
                  ) : (
                    <p>点击今日可返回实时服务列表。</p>
                  )}
                </div>
                <div className="date-switcher">
                  <button
                    aria-label="前一天"
                    onClick={() => changeDay(-1)}
                    disabled={!canViewPreviousDay}
                  >
                    ‹
                  </button>
                  <button className="date-current">
                    <strong>{currentDay.label}</strong>
                    <span>
                      {currentDay.weekday} · {scheduleHeading}
                    </span>
                  </button>
                  <button
                    aria-label="后一天"
                    onClick={() => changeDay(1)}
                    disabled={!canViewNextDay}
                  >
                    ›
                  </button>
                </div>
              </div>

              {employeeSection === 'overview' ? (
                <section className="panel workspace-directory employee-directory">
                  <div className="workspace-directory-heading">
                    <div>
                      <span className="eyebrow">一级目录 · 员工工作台</span>
                      <h2>今天先看任务，需要执行时再进入</h2>
                      <p>
                        首页直接显示全店预约和分配给你的任务；客户执行与个人周报进入二级页面。
                      </p>
                    </div>
                    <b>
                      {activeEmployeeProfile.role === 'skin_manager'
                        ? '2 个执行入口'
                        : '1 个执行入口'}
                    </b>
                  </div>
                  <div className="workspace-directory-grid employee-directory-grid">
                    <button
                      className="directory-card"
                      type="button"
                      onClick={() => setEmployeeSection('service')}
                    >
                      <ClipboardCheck aria-hidden="true" />
                      <span>
                        <strong>客户服务执行</strong>
                        <small>客户档案、六阶段流程与服务记录</small>
                      </span>
                      <em>进入 →</em>
                    </button>
                    {activeEmployeeProfile.role === 'skin_manager' && (
                      <button
                        className="directory-card"
                        type="button"
                        onClick={() => setEmployeeSection('weekly')}
                      >
                        <CalendarRange aria-hidden="true" />
                        <span>
                          <strong>我的本周复盘</strong>
                          <small>个人预约、闭环、金额与改进建议</small>
                        </span>
                        <em>进入 →</em>
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <section className="panel secondary-page-head">
                  <button
                    type="button"
                    onClick={() => setEmployeeSection('overview')}
                  >
                    ← 返回一级目录
                  </button>
                  <div>
                    <span>
                      员工执行端 /{' '}
                      {employeeSection === 'weekly'
                        ? '我的本周复盘'
                        : '客户服务执行'}
                    </span>
                    <h2>
                      {employeeSection === 'weekly'
                        ? `${activeWeeklyTechnician}的本周复盘`
                        : '客户服务执行'}
                    </h2>
                    <p>
                      {employeeSection === 'weekly'
                        ? '集中查看个人预约、闭环、金额和需要改进的环节。'
                        : '选择客户后，按标准流程完成今天的服务任务与记录。'}
                    </p>
                  </div>
                </section>
              )}

              {employeeSection === 'overview' && (
                <EmployeeTodayCommand
                  profile={activeEmployeeProfile}
                  appointments={activeAppointments}
                  allAppointments={activeAppointments}
                  staffSchedules={staffSchedules}
                  priorityAppointmentIds={attentionAppointments.map(
                    (item) => item.id,
                  )}
                  selectedId={selectedId}
                  search={search}
                  showStaffSelector={viewerRole === 'owner'}
                  canEditAppointments={canEditAppointments}
                  canEditStaffSchedule={canEditStaffSchedule}
                  savingStaffName={savingStaffName}
                  onSelectStaff={selectEmployeePreview}
                  onOpenAppointment={openEmployeeAppointment}
                  onEditAppointment={openEditAppointment}
                  onUpdateStaffSchedule={(staffName, shift) => {
                    void updateStaffSchedule(staffName, shift);
                  }}
                />
              )}

              {employeeSection === 'weekly' &&
                activeEmployeeProfile.role === 'skin_manager' && (
                  <section className="panel weekly-dashboard employee-weekly-dashboard">
                    <div className="weekly-heading">
                      <div>
                        <span className="eyebrow">员工个人周报 · 独立统计</span>
                        <h2>{activeWeeklyTechnician}的本周预约成交明细</h2>
                        <p>
                          {weekRangeLabel} · 成交按“预约状态已完成”口径统计 ·
                          点击客户可继续执行标准全流程
                        </p>
                      </div>
                      <b>{employeeWeeklyAppointments.length} 人次</b>
                    </div>
                    {viewerRole === 'owner' &&
                      employeeWeeklyReports.length > 0 && (
                        <div
                          className="weekly-employee-selector"
                          aria-label="切换员工个人周报"
                        >
                          {employeeWeeklyReports.map((report) => (
                            <button
                              key={report.technician}
                              className={
                                report.technician === activeWeeklyTechnician
                                  ? 'active'
                                  : ''
                              }
                              onClick={() =>
                                setSelectedWeeklyTechnician(report.technician)
                              }
                            >
                              <strong>{report.technician}</strong>
                              <span>
                                {report.appointments.length} 人次 ·{' '}
                                {report.completionRate}%
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    <div className="employee-weekly-content">
                      <div className="employee-weekly-metrics">
                        <article>
                          <span>本周预约</span>
                          <strong>{employeeWeeklyAppointments.length}</strong>
                        </article>
                        <article>
                          <span>已成交 / 闭环</span>
                          <strong>
                            {employeeWeeklySummary.completedCount}
                          </strong>
                        </article>
                        <article>
                          <span>预约成交率</span>
                          <strong>
                            {employeeWeeklySummary.completionRate}%
                          </strong>
                        </article>
                        <article>
                          <span>待执行</span>
                          <strong>{employeeWeeklySummary.pendingCount}</strong>
                        </article>
                        <article>
                          <span>已结算应收</span>
                          <strong>
                            {currencyValue(
                              employeeWeeklySummary.settledReceivable,
                            )}
                          </strong>
                        </article>
                        <article>
                          <span>个人总应收</span>
                          <strong>
                            {currencyValue(
                              employeeWeeklySummary.totalReceivable,
                            )}
                          </strong>
                        </article>
                        <article>
                          <span>卡金消耗</span>
                          <strong>
                            {currencyValue(
                              employeeWeeklySummary.cardConsumption,
                            )}
                          </strong>
                        </article>
                        <article>
                          <span>项目核销</span>
                          <strong>
                            {currencyValue(
                              employeeWeeklySummary.projectWriteoff,
                            )}
                          </strong>
                        </article>
                        <article>
                          <span>现场应收</span>
                          <strong>
                            {currencyValue(
                              employeeWeeklySummary.onsiteReceivable,
                            )}
                          </strong>
                        </article>
                        <article>
                          <span>单均应收</span>
                          <strong>
                            {currencyValue(employeeWeeklySummary.averageTicket)}
                          </strong>
                        </article>
                      </div>
                      <div className="employee-weekly-report-body">
                        <div className="weekly-insight-grid employee-insight-grid">
                          <section className="weekly-insight positive">
                            <h3>{activeWeeklyTechnician} · 本周优势</h3>
                            <ul>
                              {employeeWeeklySummary.strengths.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </section>
                          <section className="weekly-insight warning">
                            <h3>{activeWeeklyTechnician} · 待改进</h3>
                            <ul>
                              {employeeWeeklySummary.improvements.map(
                                (item) => (
                                  <li key={item}>{item}</li>
                                ),
                              )}
                            </ul>
                          </section>
                        </div>
                        <div className="employee-weekly-list">
                          {employeeWeeklyAppointments.length > 0 ? (
                            employeeWeeklyAppointments.map((item) => (
                              <button
                                key={`${item.date}-${item.id}`}
                                onClick={() => openWeeklyAppointment(item)}
                              >
                                <time>
                                  {item.dateLabel} · {item.time}
                                </time>
                                <span>
                                  <span className="customer-name-membership-row">
                                    <strong>{item.name}</strong>
                                    <CustomerMembershipBadge
                                      label={appointmentMembershipLabel(
                                        item.customerAsset,
                                        item.member,
                                      )}
                                      compact
                                    />
                                  </span>
                                  <small>
                                    {item.project} · {item.amount} · {item.room}
                                    房
                                  </small>
                                </span>
                                <StatusPill status={item.status} />
                              </button>
                            ))
                          ) : (
                            <div className="weekly-empty">
                              本周暂无分配给{activeWeeklyTechnician}
                              的预约；排班同步后会自动显示。
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

              {employeeSection === 'service' &&
                (activeAppointments.length === 0 ? (
                  <section className="panel empty-day-panel">
                    <MiniIcon tone="blue">历</MiniIcon>
                    <div>
                      <h2>{appointmentSchedule.label}暂无预约</h2>
                      <p>
                        这一天没有从飞书群同步到预约记录；历史日期仍然保留，可使用上方左右箭头继续查看。
                      </p>
                    </div>
                  </section>
                ) : (
                  <div className="workspace-grid employee-workspace-grid">
                    <aside className="schedule-panel panel">
                      <div className="panel-heading">
                        <div>
                          <h2>{scheduleHeading}</h2>
                          <span>按到店时间排序</span>
                        </div>
                        <button
                          className="more-button"
                          aria-label="更多"
                          onClick={() =>
                            openDetail({
                              eyebrow: '预约总览',
                              title: '今日排班与房间状态',
                              description:
                                '帮助前台快速检查人员、房间和重点客户。',
                              items: [
                                {
                                  label: '服务技师',
                                  value: Array.from(
                                    new Set(
                                      activeAppointments.map(
                                        (item) => item.technician,
                                      ),
                                    ),
                                  ).join('、'),
                                },
                                {
                                  label: '使用房间',
                                  value: activeAppointments.every(
                                    (item) => item.room === '待安排',
                                  )
                                    ? '全部待安排'
                                    : Array.from(
                                        new Set(
                                          activeAppointments.map(
                                            (item) => item.room,
                                          ),
                                        ),
                                      ).join('、'),
                                },
                                {
                                  label: '重点关注',
                                  value: `${attentionAppointments.length} 位客户`,
                                },
                                {
                                  label: '待分配',
                                  value: activeAppointments.some(
                                    (item) => item.technician === '待分配',
                                  )
                                    ? '有新增预约待分配'
                                    : '无',
                                },
                              ],
                            })
                          }
                        >
                          •••
                        </button>
                      </div>
                      <div className="filter-row">
                        {['全部', '待服务', '服务中', '已完成'].map((item) => (
                          <button
                            key={item}
                            className={filter === item ? 'active' : ''}
                            onClick={() => setFilter(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                      <div className="appointment-list">
                        {filteredAppointments.map((item) => (
                          <button
                            key={item.id}
                            className={`appointment-card ${selectedId === item.id ? 'selected' : ''}`}
                            onClick={() => {
                              setCloudState('loading');
                              setSelectedId(item.id);
                              setSelectedPhaseIndex(0);
                              setTab('服务流程');
                            }}
                          >
                            <div className="appointment-time">
                              <strong>{item.time}</strong>
                              <span>{item.room}房</span>
                            </div>
                            <div className="appointment-main">
                              <div className="appointment-name-row">
                                <CustomerAvatar
                                  name={item.name}
                                  customerId={
                                    item.customerAsset?.assetId ||
                                    String(item.id)
                                  }
                                  avatarPreset={
                                    item.customerAsset?.avatarPreset
                                  }
                                  avatarUrl={item.customerAsset?.avatarUrl}
                                  size={20}
                                  className="small-avatar"
                                />
                                <strong>{item.name}</strong>
                                <CustomerMembershipBadge
                                  label={appointmentMembershipLabel(
                                    item.customerAsset,
                                    item.member,
                                  )}
                                  compact
                                />
                              </div>
                              <p>{item.project}</p>
                              <div className="appointment-meta">
                                <span>技师 {item.technician}</span>
                                <StatusPill status={item.status} />
                              </div>
                            </div>
                          </button>
                        ))}
                        {filteredAppointments.length === 0 && (
                          <div className="empty-state">没有找到匹配的预约</div>
                        )}
                      </div>
                    </aside>

                    <section className="client-panel panel">
                      <div className="client-hero">
                        <CustomerAvatar
                          name={selected.name}
                          customerId={
                            selected.customerAsset?.assetId ||
                            String(selected.id)
                          }
                          avatarPreset={selected.customerAsset?.avatarPreset}
                          avatarUrl={selected.customerAsset?.avatarUrl}
                          size={49}
                          className="profile-avatar"
                        />
                        <div className="profile-copy">
                          <div className="profile-title">
                            <h2>{selected.name}</h2>
                            <CustomerMembershipBadge
                              label={appointmentMembershipLabel(
                                selected.customerAsset,
                                selected.member,
                              )}
                            />
                          </div>
                          <p>
                            {selected.nickname} · {selected.project} ·{' '}
                            {appointmentSchedule.label} {selected.time} ·{' '}
                            {selected.room}房
                          </p>
                          <div className="tag-row">
                            <span
                              className={
                                selected.customerAsset
                                  ? 'tag-asset-linked'
                                  : 'tag-asset-pending'
                              }
                            >
                              {selected.customerAsset
                                ? '客户资料库已匹配'
                                : '客户资料库待匹配'}
                            </span>
                            {selected.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                            {selectedPriorityAssessment && (
                              <span className="tag-alert">重点关怀</span>
                            )}
                          </div>
                        </div>
                        <div className="profile-actions">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              openDetail({
                                eyebrow: '最近沟通',
                                title: `${selected.name} · 沟通记录`,
                                description:
                                  '预约、到店确认与服务反馈集中在这里查看。',
                                items: [
                                  {
                                    label: '今天 10:18',
                                    value: '已确认按原计划到店，仍然开车前往',
                                  },
                                  {
                                    label: '昨天 18:42',
                                    value:
                                      '客户回复：最近睡眠不足，希望护理时安静休息',
                                  },
                                  {
                                    label: '07月13日',
                                    value: '护理后反馈舒适，两颊未出现持续泛红',
                                  },
                                ],
                              })
                            }
                          >
                            沟通记录
                          </button>
                          <button
                            className="primary-button compact"
                            onClick={() => {
                              setProfileNote('');
                              setProfileEditOpen(true);
                            }}
                          >
                            更新档案
                          </button>
                        </div>
                      </div>

                      <div className="quick-facts">
                        <button
                          type="button"
                          className="quick-fact"
                          onClick={openFixedTechnicianDetail}
                        >
                          <span>固定技师</span>
                          <strong>
                            <i className="tiny-avatar">
                              {selected.fixedTechnician.slice(0, 1)}
                            </i>
                            {selected.fixedTechnician}
                          </strong>
                          <em>详情 →</em>
                        </button>
                        <button
                          type="button"
                          className="quick-fact assignment-fact"
                          onClick={
                            canEditAppointments
                              ? openTechnicianAssignment
                              : undefined
                          }
                          disabled={!canEditAppointments}
                        >
                          <span>本次技师</span>
                          <strong>{selected.technician}</strong>
                          <em>
                            {canEditAppointments ? '填写 / 更换 →' : '员工只读'}
                          </em>
                        </button>
                        <button
                          type="button"
                          className="quick-fact"
                          onClick={openArrivalMethodDetail}
                        >
                          <span>到店方式</span>
                          <strong>
                            {selected.arrivalMethod ||
                              (importedNeedsProfile
                                ? '待确认'
                                : selected.id === 1
                                  ? '开车'
                                  : '已确认')}
                          </strong>
                          <em>详情 →</em>
                        </button>
                        <button
                          type="button"
                          className="quick-fact"
                          onClick={openLastSpendDetail}
                        >
                          <span>上次消费</span>
                          <strong>
                            {selected.lastSpend ||
                              (importedNeedsProfile
                                ? '待同步'
                                : selected.amount)}
                          </strong>
                          <em>明细 →</em>
                        </button>
                        <button
                          type="button"
                          className="quick-fact"
                          onClick={openCardBalanceDetail}
                        >
                          <span>卡内余额</span>
                          <strong>{selected.cardBalance || '待同步'}</strong>
                          <em>
                            {canEditAppointments ? '余额 / 扣卡 →' : '查看 →'}
                          </em>
                        </button>
                        <button
                          type="button"
                          className="quick-fact"
                          onClick={openRemainingProjectsDetail}
                        >
                          <span>剩余项目</span>
                          <strong>
                            {selected.remainingProjects
                              ? `${selected.remainingProjects.reduce((total, item) => total + item.times, 0)} 次`
                              : importedNeedsProfile
                                ? '待同步'
                                : '3 次'}
                          </strong>
                          <em>项目清单 →</em>
                        </button>
                        <button
                          type="button"
                          className="quick-fact"
                          onClick={openLastVisitDetail}
                        >
                          <span>上次到店</span>
                          <strong>
                            {selected.lastVisit ||
                              (importedNeedsProfile
                                ? '待同步'
                                : selected.id === 1
                                  ? '07月12日'
                                  : '07月26日')}
                          </strong>
                          <em>记录 →</em>
                        </button>
                      </div>

                      <nav className="client-tabs" aria-label="客户详情">
                        {clientTabs.map((item) => (
                          <button
                            key={item}
                            className={tab === item ? 'active' : ''}
                            onClick={() => setTab(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </nav>

                      <div ref={clientContentRef} className="client-content">
                        {tab === '本次诊断' && (
                          <div className="guidance-shell">
                            <section className="guidance-hero diagnosis-hero">
                              <div className="guidance-hero-icon">诊</div>
                              <div>
                                <span>根据客户历史自动生成 · 美容护理评估</span>
                                <h3>{selected.name}｜本次到店诊断与项目建议</h3>
                                <StructuredContent
                                  value={guidance.source}
                                  compact
                                  maxItems={2}
                                />
                              </div>
                              <b>已生成</b>
                            </section>

                            <section className="history-evidence">
                              <div>
                                <span>上次项目</span>
                                <strong>{guidance.previousProject}</strong>
                              </div>
                              <div>
                                <span>上次真实反馈</span>
                                <StructuredContent
                                  value={guidance.previousResult}
                                  compact
                                />
                              </div>
                            </section>

                            <div className="guidance-summary-grid">
                              <button
                                className="guidance-card assessment"
                                onClick={() =>
                                  openDetail({
                                    eyebrow: `${selected.name} · 到店评估`,
                                    title: '今天先诊断什么',
                                    description:
                                      '历史记录只做参考，最终方案以客户今天的真实状态为准。',
                                    items: [
                                      {
                                        label: '生成依据',
                                        value: guidance.source,
                                      },
                                      {
                                        label: '今日评估',
                                        value: guidance.todayAssessment,
                                      },
                                      {
                                        label: '员工动作',
                                        value:
                                          '先问感受、再做观察、留下同光线记录，确认后才进入项目说明。',
                                      },
                                    ],
                                  })
                                }
                              >
                                <span>01</span>
                                <small>今日诊断重点</small>
                                <div className="guidance-card-copy">
                                  <StructuredContent
                                    value={guidance.todayAssessment}
                                    compact
                                    maxItems={2}
                                  />
                                </div>
                                <em>查看评估依据 →</em>
                              </button>
                              <button
                                className="guidance-card recommendation"
                                onClick={() =>
                                  openDetail({
                                    eyebrow: `${selected.name} · 项目建议`,
                                    title: '本次建议项目',
                                    description:
                                      '建议围绕客户本次目标给出，不以增加消费项目为默认答案。',
                                    items: [
                                      {
                                        label: '主建议',
                                        value: guidance.primaryRecommendation,
                                      },
                                      {
                                        label: '增强建议',
                                        value: guidance.optionalRecommendation,
                                      },
                                      {
                                        label: '确认方式',
                                        value:
                                          '说明理由、预期与注意事项，客户明确确认后执行。',
                                      },
                                    ],
                                  })
                                }
                              >
                                <span>02</span>
                                <small>本次项目建议</small>
                                <div className="guidance-card-copy">
                                  <StructuredContent
                                    value={guidance.primaryRecommendation}
                                    compact
                                    maxItems={2}
                                  />
                                </div>
                                <em>查看完整方案 →</em>
                              </button>
                              <button
                                className="guidance-card boundary"
                                onClick={() =>
                                  openDetail({
                                    eyebrow: `${selected.name} · 服务边界`,
                                    title: '暂缓项目与沟通边界',
                                    description:
                                      '避免为了成交放大效果，员工必须先守住安全与真实表达。',
                                    items: [
                                      {
                                        label: '服务边界',
                                        value: guidance.safetyBoundary,
                                      },
                                      {
                                        label: '禁止表达',
                                        value:
                                          '保证马上变白、绝不反黑、一次解决、永久改变、别人做了都有效。',
                                      },
                                      {
                                        label: '替代表达',
                                        value:
                                          '今天先看即时肤感和重点区域变化，再通过回访判断持续感受。',
                                      },
                                    ],
                                  })
                                }
                              >
                                <span>03</span>
                                <small>暂缓与安全边界</small>
                                <div className="guidance-card-copy">
                                  <StructuredContent
                                    value={guidance.safetyBoundary}
                                    compact
                                    maxItems={2}
                                  />
                                </div>
                                <em>查看禁语与替代说法 →</em>
                              </button>
                            </div>

                            <section className="guidance-section">
                              <div className="guidance-section-head">
                                <div>
                                  <span>四步沟通路径</span>
                                  <h3>到店以后怎么诊断、怎么建议、怎么确认</h3>
                                </div>
                                <button
                                  onClick={() =>
                                    copyGuidance(
                                      '诊断沟通话术',
                                      guidance.consultationSteps,
                                    )
                                  }
                                >
                                  复制整套诊断话术
                                </button>
                              </div>
                              <div className="guidance-steps">
                                {guidance.consultationSteps.map(
                                  (step, index) => (
                                    <button
                                      key={`${step.stage}-${step.title}`}
                                      className="guidance-step"
                                      onClick={() =>
                                        openGuidanceStep(
                                          '诊断沟通',
                                          step,
                                          index,
                                        )
                                      }
                                    >
                                      <span className="guidance-step-index">
                                        {String(index + 1).padStart(2, '0')}
                                      </span>
                                      <span className="guidance-step-copy">
                                        <small>{step.stage}</small>
                                        <strong>{step.title}</strong>
                                        <StructuredContent
                                          value={step.script}
                                          compact
                                          maxItems={2}
                                          quote
                                        />
                                      </span>
                                      <em>查看完整话术 →</em>
                                    </button>
                                  ),
                                )}
                              </div>
                            </section>
                            <div className="guidance-disclaimer">
                              <StructuredContent value="提示：本模块属于生活美容服务评估与沟通辅助，不替代医学诊断；出现持续不适时应停止服务并建议客户寻求专业评估。" />
                            </div>
                          </div>
                        )}

                        {tab === '服务流程' && (
                          <>
                            <section className="section-block">
                              <div className="section-title-row">
                                <div>
                                  <h3>本次服务进度</h3>
                                  <p>六阶段流程自动关联客户偏好与员工动作</p>
                                </div>
                                <span className="progress-label">
                                  {currentPhase.name} · {completion}%
                                </span>
                              </div>
                              <div className="phase-track">
                                {servicePhases.map((phase, index) => {
                                  const phaseDone = phase.tasks.every((task) =>
                                    doneTasks.includes(task.id),
                                  );
                                  return (
                                    <button
                                      key={phase.id}
                                      className={`phase ${selectedPhaseIndex === index ? 'current' : phaseDone ? 'completed' : 'upcoming'}`}
                                      onClick={() => choosePhase(index)}
                                      aria-pressed={
                                        selectedPhaseIndex === index
                                      }
                                    >
                                      <span className="phase-dot">
                                        {phaseDone ? '✓' : index + 1}
                                      </span>
                                      <strong>{phase.name}</strong>
                                      <small>{phase.label}</small>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>

                            <section className="section-block task-section">
                              <div className="section-title-row">
                                <div>
                                  <h3>当前动作 · {currentPhase.name}</h3>
                                  <p>{currentPhase.description}</p>
                                </div>
                                <div className="task-progress">
                                  <span>
                                    <b style={{ width: `${completion}%` }} />
                                  </span>
                                  <strong>
                                    {currentPhaseDoneCount}/
                                    {currentPhase.tasks.length}
                                  </strong>
                                </div>
                              </div>
                              <div className="task-list">
                                {currentPhase.tasks.map((task) => {
                                  const done = doneTasks.includes(task.id);
                                  return (
                                    <button
                                      key={task.id}
                                      className={`task-row ${done ? 'done' : ''} ${savingTask === task.id ? 'saving' : ''}`}
                                      onClick={() => toggleTask(task.id)}
                                      disabled={
                                        Boolean(savingTask) ||
                                        (done && viewerRole !== 'owner')
                                      }
                                      title={
                                        done && viewerRole !== 'owner'
                                          ? '已完成记录已锁定，仅老板可取消'
                                          : undefined
                                      }
                                    >
                                      <span className="check-box">
                                        {savingTask === task.id
                                          ? '·'
                                          : done
                                            ? '✓'
                                            : ''}
                                      </span>
                                      <span className="task-copy">
                                        <strong>{task.text}</strong>
                                        <small>{task.group}</small>
                                      </span>
                                      <span className="owner-chip">
                                        {task.owner}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="task-footer">
                                <span
                                  className={`cloud-state cloud-state-${cloudState}`}
                                >
                                  {cloudState === 'loading'
                                    ? '正在保存…'
                                    : cloudState === 'saved'
                                      ? '云端已保存'
                                      : '云端连接异常'}
                                </span>
                                <input
                                  ref={uploadRef}
                                  className="visually-hidden"
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file)
                                      flash(
                                        `${currentPhase.name}凭证“${file.name}”已选取`,
                                      );
                                    event.target.value = '';
                                  }}
                                />
                                <button
                                  className="secondary-button"
                                  onClick={() => uploadRef.current?.click()}
                                >
                                  {currentPhase.uploadLabel}
                                </button>
                                {stageSyncStatus === 'error' ? (
                                  <button
                                    className="primary-button sync-button"
                                    onClick={() => completeAndSync()}
                                  >
                                    自动同步失败，点击重试
                                  </button>
                                ) : (
                                  <div
                                    className={`auto-sync-indicator ${stageSyncStatus === 'sent' ? 'sent' : ''}`}
                                    aria-live="polite"
                                  >
                                    <i>
                                      {syncing
                                        ? '↻'
                                        : stageSyncStatus === 'sent'
                                          ? '✓'
                                          : '自动'}
                                    </i>
                                    <span>
                                      <strong>
                                        {syncing
                                          ? '正在自动同步到飞书群…'
                                          : stageSyncStatus === 'sent'
                                            ? '已自动同步并通知相关负责人'
                                            : '全部勾选后自动同步到群'}
                                      </strong>
                                      <small>
                                        自动 @ 老板/群主、当次技师和行政前台
                                      </small>
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p className="configuration-note">
                                公开链接可查看 · 员工操作按飞书登录身份验证
                                {feishuConfigured &&
                                  ' · 全部勾选后自动同步并@老板/群主、当次技师和行政前台'}
                                {!feishuConfigured &&
                                  viewerRole === 'owner' && (
                                    <>
                                      {' · '}
                                      <button
                                        type="button"
                                        onClick={() => setSetupModalOpen(true)}
                                      >
                                        连接飞书群机器人
                                      </button>
                                    </>
                                  )}
                                {!feishuConfigured &&
                                  viewerRole !== 'owner' &&
                                  ' · 群机器人需由老板在管理端配置'}
                              </p>
                            </section>
                          </>
                        )}

                        {tab === '效果增强' && (
                          <div className="guidance-shell">
                            <section className="guidance-hero effect-hero">
                              <div className="guidance-hero-icon">效</div>
                              <div>
                                <span>技师服务中可直接使用</span>
                                <h3>{selected.name}｜效果增强话术引导</h3>
                                <StructuredContent
                                  value={guidance.enhancementTheme}
                                  compact
                                  maxItems={2}
                                />
                              </div>
                              <b>4 段话术</b>
                            </section>

                            <section className="effect-bridge">
                              <div>
                                <span>上次项目</span>
                                <strong>{guidance.previousProject}</strong>
                                <StructuredContent
                                  value={guidance.previousResult}
                                  compact
                                />
                              </div>
                              <i>→</i>
                              <div>
                                <span>本次项目</span>
                                <strong>{selected.project}</strong>
                                <StructuredContent
                                  value={guidance.primaryRecommendation}
                                  compact
                                />
                              </div>
                            </section>

                            <section className="guidance-section effect-section">
                              <div className="guidance-section-head">
                                <div>
                                  <span>服务中四个时机</span>
                                  <h3>
                                    强调上次好效果，但只说真实、具体、可验证的变化
                                  </h3>
                                </div>
                                <button
                                  onClick={() =>
                                    copyGuidance(
                                      '效果增强话术',
                                      guidance.enhancementSteps,
                                    )
                                  }
                                >
                                  复制整套增强话术
                                </button>
                              </div>
                              <div className="guidance-steps effect-steps">
                                {guidance.enhancementSteps.map(
                                  (step, index) => (
                                    <button
                                      key={`${step.stage}-${step.title}`}
                                      className="guidance-step"
                                      onClick={() =>
                                        openGuidanceStep(
                                          '效果增强',
                                          step,
                                          index,
                                        )
                                      }
                                    >
                                      <span className="guidance-step-index">
                                        {String(index + 1).padStart(2, '0')}
                                      </span>
                                      <span className="guidance-step-copy">
                                        <small>{step.stage}</small>
                                        <strong>{step.title}</strong>
                                        <StructuredContent
                                          value={step.script}
                                          compact
                                          maxItems={2}
                                          quote
                                        />
                                      </span>
                                      <em>查看完整话术 →</em>
                                    </button>
                                  ),
                                )}
                              </div>
                            </section>

                            <section className="effect-language-boundary">
                              <div className="language-good">
                                <span>✓ 推荐表达</span>
                                <StructuredContent
                                  value={
                                    guidance.enhancementSteps[0]?.script || ''
                                  }
                                  compact
                                  quote
                                />
                              </div>
                              <div className="language-bad">
                                <span>× 不要这样说</span>
                                <StructuredContent
                                  value="上次效果特别神奇，这次保证马上白几个度，而且绝不会反黑。"
                                  compact
                                  quote
                                />
                              </div>
                            </section>
                            <div className="guidance-disclaimer">
                              <StructuredContent value="员工原则：先引用客户真实反馈，再说明本次增强动作，邀请客户共同确认效果，最后给出维护建议；不虚构历史、不制造焦虑、不保证结果。" />
                            </div>
                          </div>
                        )}

                        {tab === '客户档案' &&
                          (selected.tags.includes('飞书预约表同步') ? (
                            <div className="record-grid">
                              <section className="record-card">
                                <h3>预约表已识别信息</h3>
                                <dl>
                                  <div>
                                    <dt>客户姓名</dt>
                                    <dd>{selected.name}</dd>
                                  </div>
                                  <div>
                                    <dt>到店时间</dt>
                                    <dd>{selected.time}</dd>
                                  </div>
                                  <div>
                                    <dt>预约技师</dt>
                                    <dd>{selected.technician}</dd>
                                  </div>
                                  <div>
                                    <dt>会员标记</dt>
                                    <dd>{selected.member}</dd>
                                  </div>
                                </dl>
                              </section>
                              <section className="record-card alert-card">
                                <h3>需要前台补全</h3>
                                <ul>
                                  <li>确认本次服务项目与项目余次</li>
                                  <li>安排服务房间并核对当次技师</li>
                                  <li>补录卡内余额、消费历史和客户偏好</li>
                                  <li>
                                    护理前询问真实状态，不套用其他客户资料
                                  </li>
                                </ul>
                              </section>
                              <section className="record-card">
                                <h3>数据来源</h3>
                                <dl>
                                  <div>
                                    <dt>来源</dt>
                                    <dd>{appointmentSchedule.sourceName}</dd>
                                  </div>
                                  <div>
                                    <dt>预约日期</dt>
                                    <dd>
                                      {appointmentSchedule.label}{' '}
                                      {appointmentSchedule.weekday}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>同步状态</dt>
                                    <dd>已进入老板端和员工端</dd>
                                  </div>
                                  <div>
                                    <dt>资料原则</dt>
                                    <dd>缺失内容统一标记待确认</dd>
                                  </div>
                                </dl>
                              </section>
                            </div>
                          ) : (
                            <div className="record-grid">
                              <section className="record-card">
                                <h3>核心画像</h3>
                                <dl>
                                  <div>
                                    <dt>服务风格</dt>
                                    <dd>
                                      <StructuredContent
                                        value={selectedPreference.serviceStyle}
                                        compact
                                      />
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>沟通偏好</dt>
                                    <dd>
                                      <StructuredContent
                                        value={selectedPreference.communication}
                                        compact
                                      />
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>环境偏好</dt>
                                    <dd>
                                      {selectedPreference.roomTemp}、
                                      {selectedPreference.scent}、
                                      {selectedPreference.music}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>力度偏好</dt>
                                    <dd>
                                      <StructuredContent
                                        value={selectedPreference.pressure}
                                        compact
                                      />
                                    </dd>
                                  </div>
                                </dl>
                              </section>
                              <section className="record-card alert-card">
                                <h3>本次注意</h3>
                                <ul>
                                  <li>{selectedPreference.currentState}</li>
                                  <li>{guidance.todayAssessment}</li>
                                  <li>{guidance.primaryRecommendation}</li>
                                  <li>{guidance.safetyBoundary}</li>
                                </ul>
                              </section>
                              <section className="record-card">
                                <h3>消费与项目</h3>
                                <dl>
                                  <div>
                                    <dt>会员类型</dt>
                                    <dd>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDetail({
                                            eyebrow: '会员档案',
                                            title: `${selected.name}｜${selected.member}`,
                                            description:
                                              '会员身份、权益和使用规则集中展示。',
                                            items: [
                                              {
                                                label: '会员类型',
                                                value: selected.member,
                                              },
                                              {
                                                label: '储值余额',
                                                value:
                                                  selected.cardBalance ||
                                                  '待同步',
                                              },
                                              {
                                                label: '剩余项目',
                                                value: `${selected.remainingProjects?.reduce((total, item) => total + item.times, 0) ?? 3}次`,
                                              },
                                              {
                                                label: '服务权益',
                                                value:
                                                  '优先预约、客户偏好预设、护理后回访与固定技师交接',
                                              },
                                            ],
                                          })
                                        }
                                      >
                                        {selected.member} →
                                      </button>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>本次项目</dt>
                                    <dd>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDetail({
                                            eyebrow: '本次预约',
                                            title: `${selected.name}｜${selected.project}`,
                                            description:
                                              '本次预约项目仍需结合到店诊断和客户确认后执行。',
                                            items: [
                                              {
                                                label: '预约项目',
                                                value: selected.project,
                                              },
                                              {
                                                label: '本次技师',
                                                value: selected.technician,
                                              },
                                              {
                                                label: '服务房间',
                                                value: `${selected.room}房`,
                                              },
                                              {
                                                label: '安全要求',
                                                value:
                                                  '以今日真实状态和已批准SOP为准，客户确认后开始',
                                              },
                                            ],
                                          })
                                        }
                                      >
                                        {selected.project} →
                                      </button>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>卡内余额</dt>
                                    <dd>
                                      <button
                                        type="button"
                                        onClick={openCardBalanceDetail}
                                      >
                                        {selected.cardBalance || '待同步'} →
                                      </button>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>剩余项目</dt>
                                    <dd>
                                      <button
                                        type="button"
                                        onClick={openRemainingProjectsDetail}
                                      >
                                        {selected.remainingProjects?.reduce(
                                          (total, item) => total + item.times,
                                          0,
                                        ) ?? 3}
                                        次 →
                                      </button>
                                    </dd>
                                  </div>
                                </dl>
                              </section>
                              <section className="record-card">
                                <h3>生活信息</h3>
                                <dl>
                                  <div>
                                    <dt>到店方式</dt>
                                    <dd>{selected.arrivalMethod}</dd>
                                  </div>
                                  <div>
                                    <dt>近期状态</dt>
                                    <dd>
                                      <StructuredContent
                                        value={selectedPreference.currentState}
                                        compact
                                      />
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>近期兴趣</dt>
                                    <dd>
                                      <StructuredContent
                                        value={selectedPreference.interest}
                                        compact
                                      />
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>新增信息</dt>
                                    <dd>
                                      <StructuredContent
                                        value={selectedPreference.newInfo}
                                        compact
                                      />
                                    </dd>
                                  </div>
                                </dl>
                              </section>
                            </div>
                          ))}

                        {tab === '护理记录' &&
                          (selected.tags.includes('飞书预约表同步') ? (
                            <div className="history-list">
                              <article>
                                <time>待同步</time>
                                <div>
                                  <h3>暂无历史护理记录</h3>
                                  <p>
                                    当前仅从预约表识别到姓名、时间、会员标记与预约技师，请前台在到店前补全客户历史。
                                  </p>
                                  <span>
                                    数据来源 · {appointmentSchedule.sourceName}
                                  </span>
                                </div>
                                <b>待补全</b>
                              </article>
                            </div>
                          ) : (
                            <div className="history-list">
                              <article>
                                <time>{selected.lastVisit}</time>
                                <div>
                                  <h3>{guidance.previousProject}</h3>
                                  <StructuredContent
                                    value={guidance.previousResult}
                                    compact
                                  />
                                  <span>
                                    固定技师 · {selected.fixedTechnician}
                                  </span>
                                </div>
                                <b>已回访</b>
                              </article>
                              <article>
                                <time>偏好记录</time>
                                <div>
                                  <h3>服务环境与力度</h3>
                                  <StructuredContent
                                    value={`环境：${selectedPreference.roomTemp}、${selectedPreference.scent}、${selectedPreference.music}；力度：${selectedPreference.pressure}；沟通：${selectedPreference.communication}`}
                                    compact
                                  />
                                </div>
                                <b>已确认</b>
                              </article>
                              <article>
                                <time>本次依据</time>
                                <div>
                                  <h3>{selected.project}</h3>
                                  <StructuredContent
                                    value={`今日评估：${guidance.todayAssessment}；安全边界：${guidance.safetyBoundary}`}
                                    compact
                                  />
                                </div>
                                <b>可执行</b>
                              </article>
                            </div>
                          ))}

                        {tab === '跟进维护' && (
                          <div className="followup-board">
                            <button
                              type="button"
                              className={`followup-card ${isFollowupCreated('d1') ? 'created-card' : ''}`}
                              onClick={() =>
                                createFollowup('d1', 'D+1 回访任务已创建')
                              }
                            >
                              <div className="followup-head">
                                <span>D+1</span>
                                <div>
                                  <h3>舒适度回访</h3>
                                  <p>
                                    明天 {selected.time} · {selected.technician}
                                  </p>
                                </div>
                              </div>
                              <p className="followup-summary">
                                询问护理后皮肤状态、是否有泛红，以及整体舒适度。
                              </p>
                              <span
                                className={`followup-action ${isFollowupCreated('d1') ? 'created' : ''}`}
                              >
                                {isFollowupCreated('d1')
                                  ? '✓ 已创建 · 点击可查看'
                                  : '创建回访任务'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`followup-card ${isFollowupCreated('d3') ? 'created-card' : ''}`}
                              onClick={() =>
                                createFollowup('d3', 'D+3 效果关怀任务已创建')
                              }
                            >
                              <div className="followup-head">
                                <span>D+3</span>
                                <div>
                                  <h3>效果关怀</h3>
                                  <p>服务后第3天 · 数据前台</p>
                                </div>
                              </div>
                              <p className="followup-summary">
                                跟进{selected.project}
                                后的真实感受，并提醒对应居家护理注意事项。
                              </p>
                              <span
                                className={`followup-action ${isFollowupCreated('d3') ? 'created' : ''}`}
                              >
                                {isFollowupCreated('d3')
                                  ? '✓ 已创建 · 点击可查看'
                                  : '创建关怀任务'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`followup-card ${isFollowupCreated('d21') ? 'created-card' : ''}`}
                              onClick={() =>
                                createFollowup('d21', 'D+21 预约建议任务已创建')
                              }
                            >
                              <div className="followup-head">
                                <span>D+21</span>
                                <div>
                                  <h3>下次预约建议</h3>
                                  <p>
                                    服务后第21天 · {selected.fixedTechnician}
                                  </p>
                                </div>
                              </div>
                              <p className="followup-summary">
                                结合本次反馈、历史消费与项目余次，给出下一次管理建议。
                              </p>
                              <span
                                className={`followup-action ${isFollowupCreated('d21') ? 'created' : ''}`}
                              >
                                {isFollowupCreated('d21')
                                  ? '✓ 已创建 · 点击可查看'
                                  : '创建预约建议'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </section>

                    <aside className="insight-column">
                      <section className="panel reminder-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>智能提醒</h2>
                            <span>根据客户画像自动生成</span>
                          </div>
                          <span className="ai-badge">AI</span>
                        </div>
                        <button
                          type="button"
                          className="alert-box red"
                          onClick={() => openReminderDetail('nursing')}
                        >
                          <div className="alert-icon">!</div>
                          <div>
                            <strong>
                              {importedNeedsProfile
                                ? '预约资料待补全'
                                : selected.id === 1
                                  ? '哺乳期服务提醒'
                                  : `${selected.project}服务重点`}
                            </strong>
                            <p>
                              {importedNeedsProfile
                                ? '项目、房间、禁忌和历史记录待前台确认。'
                                : selected.id === 1
                                  ? '仅使用已批准SOP，护理前再次确认今天的真实皮肤状态。'
                                  : selectedPreference.currentState}
                            </p>
                            <em>查看详情 →</em>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="alert-box orange"
                          onClick={() => openReminderDetail('arrival')}
                        >
                          <div className="alert-icon">
                            {importedNeedsProfile || selected.id !== 1
                              ? '候'
                              : '温'}
                          </div>
                          <div>
                            <strong>
                              {importedNeedsProfile
                                ? '到店安排待确认'
                                : selected.id === 1
                                  ? '高温到店关怀'
                                  : '到店接待安排'}
                            </strong>
                            <p>
                              {importedNeedsProfile
                                ? '确认到店方式后发送对应路线并安排接待。'
                                : selected.id === 1
                                  ? '确认开车到店，提前发送停车路线并准备降温物品。'
                                  : `${selected.arrivalMethod}到店 · ${selected.room}房 · ${selected.technician}服务`}
                            </p>
                            <em>查看详情 →</em>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="alert-box blue"
                          onClick={() => openReminderDetail('communication')}
                        >
                          <div className="alert-icon">心</div>
                          <div>
                            <strong>沟通偏好</strong>
                            <p>
                              {importedNeedsProfile
                                ? '当前没有可靠记录，首次沟通后补录。'
                                : selectedPreference.communication}
                            </p>
                            <em>查看详情 →</em>
                          </div>
                        </button>
                      </section>

                      <section className="panel ai-plan-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>智能服务方案</h2>
                            <span>根据上次记录与本次诉求生成</span>
                          </div>
                          <span className="ai-badge">AI</span>
                        </div>
                        <button
                          className={tab === '本次诊断' ? 'active' : ''}
                          onClick={() => openGuidanceTab('本次诊断')}
                        >
                          <span className="ai-plan-icon diagnosis">诊</span>
                          <span>
                            <strong>本次到店诊断</strong>
                            <small>项目建议 · 四步沟通 · 安全边界</small>
                          </span>
                          <em>查看 →</em>
                        </button>
                        <button
                          className={tab === '效果增强' ? 'active' : ''}
                          onClick={() => openGuidanceTab('效果增强')}
                        >
                          <span className="ai-plan-icon effect">效</span>
                          <span>
                            <strong>效果增强话术</strong>
                            <small>承接上次效果 · 4 个服务时机</small>
                          </span>
                          <em>查看 →</em>
                        </button>
                      </section>

                      <section className="panel script-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>今日关怀话术</h2>
                            <span>当前阶段 · 可直接使用</span>
                          </div>
                        </div>
                        <blockquote>
                          <StructuredContent
                            value={
                              careScripts[currentPhase.id] ||
                              careScripts.preparation
                            }
                            compact
                            quote
                          />
                        </blockquote>
                        <button className="copy-button" onClick={copyScript}>
                          复制话术
                        </button>
                      </section>

                      <section className="panel preference-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>服务偏好速览</h2>
                            <span>员工到店前必看</span>
                          </div>
                        </div>
                        <div className="preference-list">
                          <button
                            type="button"
                            onClick={() => openPreferenceDetail('environment')}
                          >
                            <span>环</span>
                            <p>
                              <strong>房间环境</strong>
                              <small>
                                {importedNeedsProfile
                                  ? '待同步 · 点击补全'
                                  : `${selectedPreference.roomTemp} · ${selectedPreference.music} · ${selectedPreference.scent}`}
                              </small>
                            </p>
                            <em>详情 →</em>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPreferenceDetail('pressure')}
                          >
                            <span>力</span>
                            <p>
                              <strong>力度偏好</strong>
                              <small>
                                {importedNeedsProfile
                                  ? '待同步 · 点击补全'
                                  : selectedPreference.pressure}
                              </small>
                            </p>
                            <em>详情 →</em>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPreferenceDetail('food')}
                          >
                            <span>饮</span>
                            <p>
                              <strong>饮品餐食</strong>
                              <small>
                                {importedNeedsProfile
                                  ? '待同步 · 点击补全'
                                  : selectedPreference.food}
                              </small>
                            </p>
                            <em>详情 →</em>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPreferenceDetail('conversation')}
                          >
                            <span>聊</span>
                            <p>
                              <strong>沟通方式</strong>
                              <small>
                                {importedNeedsProfile
                                  ? '待同步 · 点击补全'
                                  : selectedPreference.communication}
                              </small>
                            </p>
                            <em>详情 →</em>
                          </button>
                        </div>
                      </section>
                    </aside>
                  </div>
                ))}
            </section>
          )}

          <CustomerCardWalletDialog
            open={cardWalletOpen}
            onOpenChange={setCardWalletOpen}
            customerId={selected.customerAsset?.assetId}
            customerName={selected.name}
            memberLevel={selected.customerAsset?.memberLevel || selected.member}
            cardNames={
              selected.customerAsset?.availableCardRights.map(
                (right) => right.cardName,
              ) || []
            }
            appointmentId={String(selected.id)}
            projectName={selected.project}
            canOperate={canEditAppointments}
            onWalletUpdated={updateSelectedWalletBalance}
          />

          <CustomerCheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
          />

          {toast && (
            <div className="toast" role="status">
              <span>✓</span>
              {toast}
            </div>
          )}

          {modalOpen && (
            <div
              className="modal-backdrop"
              onMouseDown={() => setModalOpen(false)}
            >
              <section
                className="modal appointment-modal"
                role="dialog"
                aria-modal="true"
                aria-label={editingAppointmentId ? '修改预约' : '新增预约'}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <span>{editingAppointmentId ? '预约调整' : '新预约'}</span>
                    <h2>
                      {editingAppointmentId
                        ? '修改今日预约'
                        : '添加到今日服务台'}
                    </h2>
                  </div>
                  <button onClick={() => setModalOpen(false)}>×</button>
                </div>
                <label>
                  客户姓名
                  <input
                    autoFocus
                    placeholder="输入客户姓名"
                    value={newAppointmentName}
                    onChange={(event) =>
                      setNewAppointmentName(event.target.value)
                    }
                  />
                </label>
                <div className="modal-two">
                  <label>
                    到店时间
                    <input
                      type="time"
                      value={newAppointmentTime}
                      onChange={(event) =>
                        setNewAppointmentTime(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    服务房间
                    <select
                      value={newAppointmentRoom}
                      onChange={(event) =>
                        setNewAppointmentRoom(event.target.value)
                      }
                    >
                      {!SERVICE_ROOM_OPTIONS.includes(
                        newAppointmentRoom as (typeof SERVICE_ROOM_OPTIONS)[number],
                      ) && (
                        <option value={newAppointmentRoom}>
                          原房间记录：{newAppointmentRoom}
                        </option>
                      )}
                      {SERVICE_ROOM_OPTIONS.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="modal-two appointment-staff-row">
                  <label className="appointment-technician-picker">
                    本次皮肤管理师
                    <select
                      value={newAppointmentTechnician}
                      onChange={(event) =>
                        setNewAppointmentTechnician(event.target.value)
                      }
                    >
                      {skinManagerSchedules.map((schedule) => (
                        <option
                          key={schedule.staffName}
                          value={schedule.staffName}
                        >
                          {schedule.staffName} · {schedule.roleLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="appointment-shift-picker">
                    今日班次
                    <select
                      value={newAppointmentShift}
                      onChange={(event) =>
                        setNewAppointmentShift(
                          event.target.value as ServiceStaffShift,
                        )
                      }
                    >
                      {STAFF_SHIFT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="appointment-role-grid">
                  <div className="appointment-role-card">
                    <strong>协作护士（按项目选填）</strong>
                    <div className="appointment-role-fields">
                      <label>
                        护士人员
                        <select
                          value={newAppointmentNurse}
                          onChange={(event) =>
                            setNewAppointmentNurse(event.target.value)
                          }
                        >
                          <option value="">本次无需护士</option>
                          {nurseSchedules.map((schedule) => (
                            <option
                              key={schedule.staffName}
                              value={schedule.staffName}
                            >
                              {schedule.staffName} · {schedule.roleLabel}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        护士今日班次
                        <select
                          disabled={!newAppointmentNurse}
                          value={newAppointmentNurseShift}
                          onChange={(event) =>
                            setNewAppointmentNurseShift(
                              event.target.value as ServiceStaffShift,
                            )
                          }
                        >
                          {STAFF_SHIFT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="appointment-role-card">
                    <strong>当班前台</strong>
                    <div className="appointment-role-fields">
                      <label>
                        前台人员
                        <select
                          value={newAppointmentFrontDesk}
                          onChange={(event) =>
                            setNewAppointmentFrontDesk(event.target.value)
                          }
                        >
                          <option value="" disabled>
                            请选择当班前台
                          </option>
                          {frontDeskSchedules.map((schedule) => (
                            <option
                              key={schedule.staffName}
                              value={schedule.staffName}
                            >
                              {schedule.staffName} · {schedule.roleLabel}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        前台今日班次
                        <select
                          value={newAppointmentFrontDeskShift}
                          onChange={(event) =>
                            setNewAppointmentFrontDeskShift(
                              event.target.value as ServiceStaffShift,
                            )
                          }
                        >
                          {STAFF_SHIFT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
                <div
                  className={`appointment-schedule-note ${
                    newAppointmentShift === '休息' ||
                    (newAppointmentNurse &&
                      newAppointmentNurseShift === '休息') ||
                    newAppointmentFrontDeskShift === '休息'
                      ? 'is-resting'
                      : ''
                  }`}
                >
                  <strong>通用排班规则</strong>
                  <span>早班 09:00–18:00 · 晚班 11:00–20:00 · 每人月休4天</span>
                  <small>
                    {newAppointmentShift === '休息' ||
                    (newAppointmentNurse &&
                      newAppointmentNurseShift === '休息') ||
                    newAppointmentFrontDeskShift === '休息'
                      ? '已选择的岗位中有员工休息，不能保存预约；请改选早班、晚班或更换员工。'
                      : `本次岗位：皮肤管理师${newAppointmentTechnician}（${newAppointmentShift}）、护士${
                          newAppointmentNurse
                            ? `${newAppointmentNurse}（${newAppointmentNurseShift}）`
                            : '无需'
                        }、前台${
                          newAppointmentFrontDesk
                            ? `${newAppointmentFrontDesk}（${newAppointmentFrontDeskShift}）`
                            : '待选择'
                        }。保存后会同步当天排班与预约记录。`}
                  </small>
                </div>
                <div className="service-picker">
                  <div className="service-picker-heading">
                    <div>
                      <strong>服务项目</strong>
                      <span>门店真实服务目录 · 173 项</span>
                    </div>
                    {selectedNewAppointmentService && (
                      <b>
                        已选 {selectedNewAppointmentService.name} ·{' '}
                        {currencyValue(selectedNewAppointmentService.price)}
                      </b>
                    )}
                  </div>
                  <label className="service-picker-search">
                    <span className="visually-hidden">搜索服务项目</span>
                    <input
                      type="search"
                      placeholder="搜索项目名称、分类或管理类型"
                      value={newAppointmentProjectSearch}
                      onChange={(event) =>
                        setNewAppointmentProjectSearch(event.target.value)
                      }
                    />
                  </label>
                  <div
                    className="service-category-list"
                    aria-label="服务项目分类"
                  >
                    {YOUZAN_SERVICE_CATEGORIES.map((category) => (
                      <button
                        className={
                          newAppointmentCategory === category ? 'active' : ''
                        }
                        key={category}
                        type="button"
                        onClick={() => setNewAppointmentCategory(category)}
                      >
                        {category}
                        <span>
                          {category === '全部'
                            ? YOUZAN_SERVICE_CATALOG.length
                            : YOUZAN_SERVICE_CATALOG.filter(
                                (service) => service.category === category,
                              ).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="service-result-meta">
                    当前显示 {filteredNewAppointmentServices.length} 个项目
                  </div>
                  <div
                    className="service-project-list"
                    role="listbox"
                    aria-label="选择服务项目"
                  >
                    {filteredNewAppointmentServices.map((service) => (
                      <button
                        aria-selected={service.id === newAppointmentProjectId}
                        className={
                          service.id === newAppointmentProjectId
                            ? 'selected'
                            : ''
                        }
                        key={service.id}
                        role="option"
                        type="button"
                        onClick={() => setNewAppointmentProjectId(service.id)}
                      >
                        <span>
                          <strong>{service.name}</strong>
                          <small>
                            {service.category} · {service.tag} ·{' '}
                            {service.durationMinutes} 分钟
                          </small>
                        </span>
                        <b>{currencyValue(service.price)}</b>
                        <i>
                          {service.id === newAppointmentProjectId
                            ? '已选'
                            : '选择'}
                        </i>
                      </button>
                    ))}
                    {filteredNewAppointmentServices.length === 0 && (
                      <div className="service-project-empty">
                        没有找到对应项目，请换一个关键词或分类。
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setModalOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    className="primary-button"
                    disabled={appointmentSaving}
                    onClick={() => void saveNewAppointment()}
                  >
                    {appointmentSaving
                      ? '正在保存…'
                      : editingAppointmentId
                        ? '保存修改'
                        : '保存预约'}
                  </button>
                </div>
              </section>
            </div>
          )}

          {technicianModalOpen && (
            <div
              className="modal-backdrop"
              onMouseDown={() => setTechnicianModalOpen(false)}
            >
              <form
                className="modal assignment-modal"
                role="dialog"
                aria-modal="true"
                aria-label="填写本次服务技师"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveTechnicianAssignment();
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <span>本次服务安排</span>
                    <h2>填写 {selected.name} 的本次技师</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTechnicianModalOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <p className="assignment-note">
                  固定技师仍为 <strong>{selected.fixedTechnician}</strong>
                  。这里填写本次实际服务人员，保存后会同步更新服务流程、责任人和群消息中的当次技师。
                </p>
                <label>
                  本次服务技师
                  <input
                    autoFocus
                    list="technician-options"
                    placeholder="输入技师姓名，例如：佳佳"
                    value={technicianDraft}
                    onChange={(event) => {
                      setTechnicianDraft(event.target.value);
                      setAssignmentError('');
                    }}
                  />
                  <datalist id="technician-options">
                    <option value="欣欣" />
                    <option value="小米" />
                    <option value="圆圆" />
                    <option value="佳佳" />
                    <option value="安安" />
                  </datalist>
                </label>
                {assignmentError && (
                  <div className="pin-error" role="alert">
                    {assignmentError}
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setTechnicianModalOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={assignmentSaving}
                  >
                    {assignmentSaving ? '正在保存…' : '保存本次技师'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {detailView && (
            <div
              className="modal-backdrop detail-drawer-backdrop"
              onMouseDown={() => setDetailView(null)}
            >
              <section
                className={`modal detail-modal ${
                  detailView.layout === 'customer_cards'
                    ? 'customer-detail-modal'
                    : ''
                }`}
                role="dialog"
                aria-modal="true"
                aria-label={detailView.title}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <span>{detailView.eyebrow}</span>
                    <h2>{detailView.title}</h2>
                  </div>
                  <button onClick={() => setDetailView(null)}>×</button>
                </div>
                <p className="detail-description">{detailView.description}</p>
                <dl
                  className={`detail-list ${
                    detailView.layout === 'customer_cards'
                      ? 'customer-detail-list'
                      : ''
                  }`}
                  data-ai-section-type={
                    detailView.layout === 'customer_cards'
                      ? 'card-list'
                      : undefined
                  }
                >
                  {detailView.items.map((item) => (
                    <div key={`${item.label}-${item.value}`}>
                      <dt
                        className={
                          item.customerName ? 'detail-customer-heading' : ''
                        }
                      >
                        {item.customerName ? (
                          <>
                            <div className="detail-customer-title">
                              <strong>{item.customerName}</strong>
                              {item.customerBadge && (
                                <CustomerMembershipBadge
                                  label={item.customerBadge}
                                />
                              )}
                            </div>
                            <span>{item.customerMeta}</span>
                          </>
                        ) : (
                          item.label
                        )}
                      </dt>
                      <dd>
                        <StructuredContent value={item.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="modal-actions">
                  <button
                    className="primary-button"
                    onClick={() => setDetailView(null)}
                  >
                    知道了
                  </button>
                </div>
              </section>
            </div>
          )}

          {profileEditOpen && (
            <div
              className="modal-backdrop"
              onMouseDown={() => setProfileEditOpen(false)}
            >
              <section
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-label="更新客户档案"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <span>客户画像</span>
                    <h2>更新 {selected.name} 的档案</h2>
                  </div>
                  <button onClick={() => setProfileEditOpen(false)}>×</button>
                </div>
                <label>
                  本次新增信息
                  <textarea
                    autoFocus
                    rows={4}
                    placeholder="例如：今天觉得房间稍冷，下次准备薄毯；更喜欢安静服务。"
                    value={profileNote}
                    onChange={(event) => setProfileNote(event.target.value)}
                  />
                </label>
                <label>
                  归档位置
                  <select defaultValue="服务偏好">
                    <option>服务偏好</option>
                    <option>身体与皮肤状态</option>
                    <option>生活信息</option>
                    <option>沟通记录</option>
                  </select>
                </label>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setProfileEditOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      if (!profileNote.trim()) {
                        flash('请填写需要更新的内容');
                        return;
                      }
                      setProfileEditOpen(false);
                      flash(`${selected.name}的客户档案已更新`);
                    }}
                  >
                    保存到客户档案
                  </button>
                </div>
              </section>
            </div>
          )}

          {deleteTarget && viewerRole === 'owner' && (
            <div
              className="modal-backdrop"
              onMouseDown={() => !deleteSaving && setDeleteTarget(null)}
            >
              <section
                className="modal delete-modal"
                role="dialog"
                aria-modal="true"
                aria-label="删除预约确认"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <span>老板权限</span>
                    <h2>删除 {deleteTarget.name} 的预约？</h2>
                  </div>
                  <button
                    type="button"
                    disabled={deleteSaving}
                    onClick={() => setDeleteTarget(null)}
                  >
                    ×
                  </button>
                </div>
                <p className="delete-warning">
                  该预约会从员工执行端隐藏，并移入老板管理端的回收站。之后仍可恢复，不会立即清除历史记录。
                </p>
                <dl className="delete-summary">
                  <div>
                    <dt>到店时间</dt>
                    <dd>{deleteTarget.time}</dd>
                  </div>
                  <div>
                    <dt>服务项目</dt>
                    <dd>{deleteTarget.project}</dd>
                  </div>
                  <div>
                    <dt>当次技师</dt>
                    <dd>{deleteTarget.technician}</dd>
                  </div>
                </dl>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    disabled={deleteSaving}
                    onClick={() => setDeleteTarget(null)}
                  >
                    取消
                  </button>
                  <button
                    className="danger-button"
                    disabled={deleteSaving}
                    onClick={() => void confirmDeleteAppointment()}
                  >
                    {deleteSaving ? '正在删除…' : '确认移入回收站'}
                  </button>
                </div>
              </section>
            </div>
          )}

          {setupModalOpen && viewerRole === 'owner' && (
            <div
              className="modal-backdrop"
              onMouseDown={() => setSetupModalOpen(false)}
            >
              <form
                className="modal pin-modal setup-modal"
                role="dialog"
                aria-modal="true"
                aria-label="连接飞书群机器人"
                onSubmit={submitServiceSetup}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <span>管理员设置</span>
                    <h2>连接飞书群机器人</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSetupModalOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <p>Webhook 仅保存到应用后端，不会显示给员工。</p>
                <label>
                  Webhook 地址
                  <input
                    autoFocus
                    placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                    value={webhookInput}
                    onChange={(event) => {
                      setWebhookInput(event.target.value);
                      setSetupError('');
                    }}
                  />
                </label>
                <label>
                  签名密钥
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="机器人安全设置中的签名密钥"
                    value={signSecretInput}
                    onChange={(event) => {
                      setSignSecretInput(event.target.value);
                      setSetupError('');
                    }}
                  />
                </label>
                {setupError && (
                  <div className="pin-error" role="alert">
                    {setupError}
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSetupModalOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={setupSaving}
                  >
                    {setupSaving ? '正在连接…' : '保存并连接'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
