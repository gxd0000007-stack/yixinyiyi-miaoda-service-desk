import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Cake,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRoundCheck,
} from 'lucide-react';

import {
  getCustomerAssets,
  getServiceAppointmentHistory,
} from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import CustomerAvatar from '@client/src/components/CustomerAvatar';
import CustomerMembershipBadge from '@client/src/components/CustomerMembershipBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import type {
  CustomerAssetSummary,
  CustomerPrivilegeTier,
  ServiceAppointment,
  ServiceAppointmentHistoryDay,
} from '@shared/api.interface';
import CustomerFollowupTaskBoard from './CustomerFollowupTaskBoard';
import { customerPrivilegeTier } from './customer-membership';
import '../customer-reminders.css';

type ReminderCategory =
  | 'loss'
  | 'followup'
  | 'expiry'
  | 'balance'
  | 'care'
  | 'profile';
type ReminderPriority = 'high' | 'medium' | 'normal';

function birthdayCopy(
  customer: CustomerAssetSummary,
  tier: CustomerPrivilegeTier,
): string {
  if (tier === '追光者') {
    return `亲爱的${customer.name}，提前祝您生日快乐！愿新的一岁依然明亮、自在，每一天都有好状态和好心情。壹心壹意医疗美容一直记得您，也一直在这里陪伴您。`;
  }
  if (tier === '绘光师') {
    return `亲爱的${customer.name}，提前祝您生日快乐！愿新的一岁里，您继续把生活绘成自己喜欢的样子，被温柔对待，也始终自信闪耀。感谢您一直信任壹心壹意医疗美容。`;
  }
  return `亲爱的${customer.name}，提前祝您生日快乐！愿新的一岁光芒蕴藏、万事从容，每一份热爱都得到回应。谢谢您把美丽与信任交给壹心壹意医疗美容，我们为您准备了一份专属生日仪式，期待陪您度过一段美好时光。`;
}

interface CustomerReminderCenterProps {
  onBack: () => void;
  onOpenAsset: (customer: CustomerAssetSummary) => void;
}

interface ReminderItem {
  id: string;
  category: ReminderCategory;
  customer: CustomerAssetSummary;
  priority: ReminderPriority;
  title: string;
  reason: string;
  cycle: string;
  content: string;
  action: string;
  dueLabel: string;
  lastVisit?: string;
  privilegeTier?: CustomerPrivilegeTier;
  ceremonyTasks?: string[];
  responsibleRoles?: string[];
}

interface ReminderModule {
  id: ReminderCategory;
  label: string;
  description: string;
  icon: typeof AlertTriangle;
}

const REMINDER_MODULES: ReminderModule[] = [
  {
    id: 'loss',
    label: '流失风险',
    description: '高价值且近期未到店',
    icon: ShieldAlert,
  },
  {
    id: 'followup',
    label: '回访任务',
    description: 'D+1 / D+3 / D+21',
    icon: CalendarClock,
  },
  {
    id: 'expiry',
    label: '权益到期',
    description: '会员与项目有效期',
    icon: Clock3,
  },
  {
    id: 'balance',
    label: '资产提醒',
    description: '余额不足与权益承接',
    icon: CircleDollarSign,
  },
  {
    id: 'care',
    label: '关怀节点',
    description: '生日与重要纪念日',
    icon: Cake,
  },
  {
    id: 'profile',
    label: '档案补全',
    description: '影响服务判断的缺失项',
    icon: ClipboardCheck,
  },
];

const REMINDER_PAGE_SIZE: number = 30;

function normalizeName(value: string): string {
  return value.replace(/\s+/gu, '').trim();
}

function dayStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor(
    (dayStart(later).getTime() - dayStart(earlier).getTime()) / 86_400_000,
  );
}

function parseProfileDate(value?: string): Date | null {
  if (!value) return null;
  const timestamp: number = Number(value);
  if (Number.isFinite(timestamp) && timestamp > 946_684_800_000) {
    return new Date(timestamp);
  }
  const chineseDate: RegExpMatchArray | null = value.match(
    /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/u,
  );
  if (chineseDate) {
    return new Date(
      Number(chineseDate[1] || new Date().getFullYear()),
      Number(chineseDate[2]) - 1,
      Number(chineseDate[3]),
    );
  }
  const parsed: Date = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value?: Date | null): string {
  if (!value) return '待核对';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function nextAnnualDate(value: Date, today: Date): Date {
  const candidate: Date = new Date(
    today.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
  return candidate < dayStart(today)
    ? new Date(today.getFullYear() + 1, value.getMonth(), value.getDate())
    : candidate;
}

function latestVisitsFrom(
  days: ServiceAppointmentHistoryDay[],
): Map<string, Date> {
  const result: Map<string, Date> = new Map<string, Date>();
  days.forEach((day: ServiceAppointmentHistoryDay) => {
    const visitDate: Date = new Date(`${day.date}T12:00:00+08:00`);
    day.appointments.forEach((appointment: ServiceAppointment) => {
      [appointment.name, appointment.nickname]
        .map((name: string) => normalizeName(name || ''))
        .filter(Boolean)
        .forEach((name: string) => {
          const current: Date | undefined = result.get(name);
          if (!current || visitDate > current) result.set(name, visitDate);
        });
    });
  });
  return result;
}

function reminderPriorityScore(priority: ReminderPriority): number {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

function actionableHealthFlags(flags: string[]): string[] {
  return flags.filter((flag: string) => {
    if (/^(怀孕|哺乳期)：/u.test(flag)) {
      return !/(否|无|没有|不在|不知道|不确定)/u.test(flag);
    }
    if (/^月经期：/u.test(flag)) {
      return !/(否|无|没有|不在|不知道|不确定|正常)/u.test(flag);
    }
    if (/^疼痛耐受度：/u.test(flag)) {
      return /(超低|很低|偏低|低)/u.test(flag);
    }
    if (/^身体敏感度：/u.test(flag)) {
      return !/(无|没有|正常|不知道|不确定|中等|一般)/u.test(flag);
    }
    return false;
  });
}

function buildReminders(
  customers: CustomerAssetSummary[],
  visits: Map<string, Date>,
): ReminderItem[] {
  const today: Date = new Date();
  const reminders: ReminderItem[] = [];
  customers.forEach((customer: CustomerAssetSummary) => {
    const aliases: string[] = [customer.name, customer.nickname || '']
      .map((name: string) => normalizeName(name))
      .filter(Boolean);
    const lastVisit: Date | undefined = aliases
      .map((name: string) => visits.get(name))
      .filter((value: Date | undefined): value is Date => Boolean(value))
      .sort((left: Date, right: Date) => right.getTime() - left.getTime())[0];
    const daysSinceVisit: number | undefined = lastVisit
      ? daysBetween(today, lastVisit)
      : undefined;
    const totalSpend: number = customer.totalSpend || 0;
    const balance: number | undefined = customer.currentBalance;
    const urgentHealthFlags: string[] = actionableHealthFlags(
      customer.healthFlags,
    );

    if (
      (totalSpend >= 10_000 && (daysSinceVisit === undefined || daysSinceVisit >= 45)) ||
      (totalSpend >= 3_000 && daysSinceVisit !== undefined && daysSinceVisit >= 60)
    ) {
      const noMatchedVisit: boolean = daysSinceVisit === undefined;
      reminders.push({
        id: `loss-${customer.id}`,
        category: 'loss',
        customer,
        priority: totalSpend >= 10_000 ? 'high' : 'medium',
        title: noMatchedVisit ? '高价值客户近期无预约匹配' : '客户回店间隔已超预期',
        reason: noMatchedVisit
          ? `累计消费 ¥${totalSpend.toLocaleString('zh-CN')}，现有预约历史未匹配到近期到店。`
          : `距最近一次到店已 ${daysSinceVisit} 天，累计消费 ¥${totalSpend.toLocaleString('zh-CN')}。`,
        cycle: noMatchedVisit ? '本周完成历史到店核对' : '48小时内完成唤醒',
        content: `先关心${customer.name}近期肤况和生活状态，再结合${customer.projectPreferences[0] || '历史项目偏好'}询问效果保持情况；不直接推销，先确认目前需求。`,
        action: '由固定服务员工一对一联系，记录未到店原因和下一次联系日期。',
        dueLabel: noMatchedVisit ? '待核对' : `已间隔 ${daysSinceVisit} 天`,
        lastVisit: lastVisit?.toISOString(),
      });
    }

    if (daysSinceVisit !== undefined && daysSinceVisit >= 1 && daysSinceVisit <= 30) {
      const stage: string = daysSinceVisit >= 21 ? 'D+21' : daysSinceVisit >= 3 ? 'D+3' : 'D+1';
      const stageContent: string = stage === 'D+1'
        ? '询问当晚和次日的舒适度、泛红及真实肤感，确认居家护理是否顺利。'
        : stage === 'D+3'
          ? '确认效果变化与客户感受，提醒对应居家护理重点，并记录真实反馈。'
          : '结合本次效果、皮肤周期和剩余权益，给出下一次到店建议，不制造催促感。';
      reminders.push({
        id: `followup-${customer.id}`,
        category: 'followup',
        customer,
        priority: stage === 'D+21' ? 'medium' : 'high',
        title: `${stage} 客户回访`,
        reason: `最近到店 ${formatDate(lastVisit)}，当前进入 ${stage} 维护节点。`,
        cycle: `${stage} 节点 · 今日完成`,
        content: stageContent,
        action: `回访后写入客户档案；如有不适，立即升级老板和当次技师。`,
        dueLabel: '今日应回访',
        lastVisit: lastVisit?.toISOString(),
      });
    }

    const expiryDate: Date | null = parseProfileDate(customer.memberExpiresAt);
    const expiryDays: number | undefined = expiryDate
      ? daysBetween(expiryDate, today)
      : undefined;
    if (expiryDays !== undefined && expiryDays <= 30) {
      reminders.push({
        id: `expiry-${customer.id}`,
        category: 'expiry',
        customer,
        priority: expiryDays < 0 ? 'high' : expiryDays <= 7 ? 'high' : 'medium',
        title: expiryDays < 0 ? '会员权益已到期' : '会员权益即将到期',
        reason: `会员档位：${customer.memberLevel || '待确认'}；到期时间：${formatDate(expiryDate)}。`,
        cycle: expiryDays < 0 ? `已逾期 ${Math.abs(expiryDays)} 天` : `剩余 ${expiryDays} 天`,
        content: '先核对未使用权益、卡内余额和近期需求，再说明可延续的服务，不用统一促销话术。',
        action: '生成权益清单，由老板确认方案后再联系客户。',
        dueLabel: expiryDays < 0 ? '已到期' : '30天内到期',
      });
    }

    if (balance !== undefined && balance < 500 && totalSpend >= 3_000) {
      reminders.push({
        id: `balance-${customer.id}`,
        category: 'balance',
        customer,
        priority: balance <= 0 ? 'high' : 'medium',
        title: balance <= 0 ? '卡内余额已用完' : '卡内余额偏低',
        reason: `当前余额 ¥${balance.toLocaleString('zh-CN')}，历史累计消费 ¥${totalSpend.toLocaleString('zh-CN')}。`,
        cycle: '下次预约前完成权益核对',
        content: '先说明现有余额和剩余项目如何使用，再根据真实需求给出续费或单次消费选择。',
        action: '避免临场才告知余额不足；由前台提前准备清晰结算方案。',
        dueLabel: '需提前说明',
      });
    }

    const birthday: Date | null = parseProfileDate(customer.birthday);
    const privilegeTier: CustomerPrivilegeTier | undefined =
      customerPrivilegeTier(customer.memberLevel);
    if (birthday && privilegeTier) {
      const birthdayDate: Date = nextAnnualDate(birthday, today);
      const birthdayDays: number = daysBetween(birthdayDate, today);
      if (birthdayDays <= 2) {
        reminders.push({
          id: `care-${customer.id}`,
          category: 'care',
          customer,
          priority: birthdayDays <= 3 ? 'high' : 'normal',
          title: birthdayDays === 0 ? '客户今天生日' : '客户生日关怀',
          reason: `生日节点：${formatDate(birthdayDate)}；${customer.importantDates[0] || '暂无其他纪念日记录'}。`,
          cycle: birthdayDays === 0 ? '今天完成' : `提前 ${birthdayDays} 天准备`,
          content: birthdayCopy(customer, privilegeTier),
          action: privilegeTier === '蕴光主'
            ? '美容师与前台联合准备专属包间：投影、鲜花、灯光生日布置；到店前联合复核。'
            : `由最熟悉客户的员工复制话术发送${privilegeTier}生日祝福。`,
          dueLabel: birthdayDays === 0 ? '今天' : `${birthdayDays} 天后`,
          privilegeTier,
          ceremonyTasks: privilegeTier === '蕴光主'
            ? ['投影：准备生日画面并提前试播', '鲜花：完成包间花艺摆放', '灯光：调试生日氛围灯光']
            : undefined,
          responsibleRoles: privilegeTier === '蕴光主'
            ? ['美容师', '前台']
            : undefined,
        });
      }
    }

    if (customer.profileCompleteness < 80 || urgentHealthFlags.length > 0) {
      const missingScore: number = 100 - customer.profileCompleteness;
      reminders.push({
        id: `profile-${customer.id}`,
        category: 'profile',
        customer,
        priority: urgentHealthFlags.length > 0 || missingScore >= 40
          ? 'high'
          : 'normal',
        title: urgentHealthFlags.length > 0
          ? '健康信息需到店前复核'
          : '关键档案需要补全',
        reason: urgentHealthFlags.length > 0
          ? urgentHealthFlags.join('；')
          : `当前档案完整度 ${customer.profileCompleteness}%，可能影响诊断和服务一致性。`,
        cycle: '下次预约前或到店接待时完成',
        content: '只核对本次服务必须的信息：真实肤况、健康状态、力度温度偏好、项目边界和沟通禁忌。',
        action: '进入客户档案补充，不覆盖已有真实信息。',
        dueLabel: `${customer.profileCompleteness}% 完整`,
      });
    }
  });
  return reminders.sort(
    (left: ReminderItem, right: ReminderItem) =>
      reminderPriorityScore(right.priority) - reminderPriorityScore(left.priority) ||
      (right.customer.totalSpend || 0) - (left.customer.totalSpend || 0),
  );
}

export default function CustomerReminderCenter({
  onBack,
  onOpenAsset,
}: CustomerReminderCenterProps) {
  const [customers, setCustomers] = useState<CustomerAssetSummary[]>([]);
  const [visits, setVisits] = useState<Map<string, Date>>(new Map());
  const [activeCategory, setActiveCategory] = useState<ReminderCategory | 'all'>('all');
  const [query, setQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [copyMessage, setCopyMessage] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(REMINDER_PAGE_SIZE);
  const [browserOpen, setBrowserOpen] = useState<boolean>(false);
  const [browserView, setBrowserView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    let active: boolean = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError('');
      try {
        const [firstPage, history] = await Promise.all([
          getCustomerAssets({ query: '', page: 1, pageSize: 50 }),
          getServiceAppointmentHistory(),
        ]);
        const totalPages: number = Math.ceil(firstPage.total / firstPage.pageSize);
        const remainingPages: number[] = Array.from(
          { length: Math.max(0, totalPages - 1) },
          (_value: unknown, index: number) => index + 2,
        );
        const remaining = await Promise.all(
          remainingPages.map((page: number) =>
            getCustomerAssets({ query: '', page, pageSize: 50 }),
          ),
        );
        if (!active) return;
        setCustomers([
          ...firstPage.items,
          ...remaining.flatMap((page) => page.items),
        ]);
        setVisits(latestVisitsFrom(history.days));
      } catch {
        if (active) setError('客户提醒加载失败，请刷新后重试。');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reminders: ReminderItem[] = useMemo(
    () => buildReminders(customers, visits),
    [customers, visits],
  );
  const filtered: ReminderItem[] = useMemo(() => {
    const keyword: string = query.trim().toLocaleLowerCase();
    return reminders.filter((item: ReminderItem) => {
      const categoryMatched: boolean = activeCategory === 'all' || item.category === activeCategory;
      const queryMatched: boolean = !keyword || [
        item.customer.name,
        item.customer.nickname || '',
        item.customer.mobile || '',
        item.title,
        item.reason,
      ].join(' ').toLocaleLowerCase().includes(keyword);
      return categoryMatched && queryMatched;
    });
  }, [activeCategory, query, reminders]);
  const visibleReminders: ReminderItem[] = filtered.slice(0, visibleCount);
  const selected: ReminderItem | undefined = reminders.find(
    (item: ReminderItem) => item.id === selectedId,
  );
  const highCount: number = reminders.filter(
    (item: ReminderItem) => item.priority === 'high',
  ).length;
  const customerCount: number = new Set(
    reminders.map((item: ReminderItem) => item.customer.id),
  ).size;

  const copyContent = async (item: ReminderItem): Promise<void> => {
    try {
      await navigator.clipboard.writeText(
        `${item.customer.name}｜${item.title}\n${item.content}\n执行：${item.action}`,
      );
      setCopyMessage('回访内容已复制');
    } catch {
      setCopyMessage('请长按选择右侧回访内容');
    }
  };

  const openReminderList = (category: ReminderCategory | 'all'): void => {
    setActiveCategory(category);
    setQuery('');
    setSelectedId('');
    setVisibleCount(REMINDER_PAGE_SIZE);
    setBrowserView('list');
    setBrowserOpen(true);
  };

  const openReminderDetail = (item: ReminderItem): void => {
    setSelectedId(item.id);
    setCopyMessage('');
    setBrowserView('detail');
  };

  const activeModule: ReminderModule | undefined = REMINDER_MODULES.find(
    (module: ReminderModule) => module.id === activeCategory,
  );

  return (
    <section className="reminder-page">
      <header className="reminder-page-head">
        <div>
          <Button variant="outline" size="sm" onClick={onBack}>返回工作台</Button>
          <div className="reminder-eyebrow">老板 / 前台 · 客户维护与预警中心</div>
          <h1>客户提醒中心</h1>
          <p>
            已扫描 {customers.length} 位客户；当前 {customerCount} 位客户产生
            {reminders.length} 条提醒，其中 {highCount} 条需要优先处理。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setReloadKey((value: number) => value + 1)}
        >
          <RefreshCcw /> 刷新资料
        </Button>
      </header>

      <button
        type="button"
        className="reminder-open-all"
        onClick={() => openReminderList('all')}
      >
        <span><BellRing /></span>
        <div>
          <strong>查看全部客户提醒</strong>
          <small>搜索客户，或从完整名单进入提醒详情</small>
        </div>
        <b>{reminders.length}</b>
        <ChevronRight />
      </button>

      <div className="reminder-module-grid" data-ai-section-type="card-menu">
        {REMINDER_MODULES.map((module: ReminderModule) => {
          const Icon = module.icon;
          const count: number = reminders.filter(
            (item: ReminderItem) => item.category === module.id,
          ).length;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => openReminderList(module.id)}
            >
              <span><Icon /></span>
              <div><strong>{module.label}</strong><small>{module.description}</small></div>
              <b>{count}</b>
              <ChevronRight />
            </button>
          );
        })}
      </div>

      <CustomerFollowupTaskBoard mode="store" />

      <Dialog
        open={browserOpen}
        onOpenChange={(open: boolean) => {
          setBrowserOpen(open);
          if (!open) {
            setBrowserView('list');
            setSelectedId('');
          }
        }}
      >
        <DialogContent className="reminder-browser-dialog" showCloseButton>
          {browserView === 'list' ? (
            <>
              <DialogHeader className="reminder-browser-heading">
                <DialogTitle>{activeModule?.label || '全部提醒'}</DialogTitle>
                <DialogDescription>
                  共 {filtered.length} 条提醒，点击客户直接查看处理详情。
                </DialogDescription>
              </DialogHeader>
              <div className="reminder-dialog-toolbar">
                <Search />
                <Input
                  aria-label="搜索提醒客户"
                  placeholder="搜索客户、手机号或提醒"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleCount(REMINDER_PAGE_SIZE);
                  }}
                />
              </div>
              <div className="reminder-dialog-list">
                {loading && <div className="reminder-state"><RefreshCcw /> 正在计算提醒</div>}
                {error && <div className="reminder-state error"><AlertTriangle /> {error}</div>}
                {!loading && !error && filtered.length === 0 && (
                  <div className="reminder-state"><BellRing /> 当前筛选下没有提醒</div>
                )}
                {visibleReminders.map((item: ReminderItem) => (
                  <button
                    type="button"
                    key={item.id}
                    className="reminder-person"
                    onClick={() => openReminderDetail(item)}
                  >
                    <CustomerAvatar
                      name={item.customer.name}
                      customerId={item.customer.id}
                      avatarPreset={item.customer.avatarPreset}
                      avatarUrl={item.customer.avatarUrl}
                      size={46}
                      className="reminder-avatar"
                    />
                    <span className="reminder-person-main">
                      <span className="reminder-person-name">
                        <span className="customer-name-membership-row">
                          <strong>{item.customer.name}</strong>
                          <CustomerMembershipBadge
                            memberLevel={item.customer.memberLevel}
                            compact
                          />
                        </span>
                        <i className={item.priority}>{item.dueLabel}</i>
                      </span>
                      <b>{item.title}</b>
                      <small>{item.reason}</small>
                    </span>
                    <ChevronRight />
                  </button>
                ))}
                {visibleCount < filtered.length && (
                  <button
                    type="button"
                    className="reminder-load-more"
                    onClick={() => setVisibleCount(
                      (count: number) => count + REMINDER_PAGE_SIZE,
                    )}
                  >
                    继续加载（剩余 {filtered.length - visibleCount} 条）
                  </button>
                )}
              </div>
            </>
          ) : selected ? (
            <div className="reminder-dialog-detail">
              <div className="reminder-dialog-backbar">
                <Button variant="outline" size="sm" onClick={() => setBrowserView('list')}>
                  <ArrowLeft /> 返回提醒名单
                </Button>
                <span>{activeModule?.label || '全部提醒'} · 客户详情</span>
              </div>
              <div className="reminder-detail-hero">
                <div>
                  <CustomerAvatar
                    name={selected.customer.name}
                    customerId={selected.customer.id}
                    avatarPreset={selected.customer.avatarPreset}
                    avatarUrl={selected.customer.avatarUrl}
                    size={54}
                    className="reminder-detail-avatar"
                  />
                  <div>
                    <div className="reminder-detail-name">
                      <h2>{selected.customer.name}</h2>
                      <CustomerMembershipBadge memberLevel={selected.customer.memberLevel} />
                      <i className={selected.priority}>
                        {selected.priority === 'high' ? '优先处理' : selected.priority === 'medium' ? '本周处理' : '常规维护'}
                      </i>
                    </div>
                    <p>{selected.customer.mobile || '手机号待补充'}</p>
                  </div>
                </div>
                <Button onClick={() => {
                  setBrowserOpen(false);
                  onOpenAsset(selected.customer);
                }}>
                  <UserRoundCheck /> 进入完整档案
                </Button>
              </div>

              <div className="reminder-detail-metrics" data-ai-section-type="card-stat">
                <span><small>累计消费</small><strong>¥{(selected.customer.totalSpend || 0).toLocaleString('zh-CN')}</strong></span>
                <span><small>卡内余额</small><strong>{selected.customer.currentBalance === undefined ? '待补充' : `¥${selected.customer.currentBalance.toLocaleString('zh-CN')}`}</strong></span>
                <span><small>最近到店</small><strong>{formatDate(selected.lastVisit ? new Date(selected.lastVisit) : null)}</strong></span>
                <span><small>档案完整度</small><strong>{selected.customer.profileCompleteness}%</strong></span>
              </div>

              <div className="reminder-action-grid">
                <section className="warning">
                  <span><AlertTriangle /> 为什么提醒</span>
                  <h3>{selected.title}</h3>
                  <p>{selected.reason}</p>
                </section>
                <section>
                  <span><CalendarClock /> 回访周期</span>
                  <h3>{selected.cycle}</h3>
                  <p>提醒由客户档案与现有预约历史动态计算。</p>
                </section>
                <section className="wide">
                  <span><BellRing /> 建议回访内容</span>
                  <p>{selected.content}</p>
                </section>
                <section className="wide execution">
                  <span><ClipboardCheck /> 执行动作与记录要求</span>
                  <p>{selected.action}</p>
                </section>
                {selected.ceremonyTasks && (
                  <section className="wide birthday-ceremony">
                    <span><Cake /> 蕴光主专属包间仪式任务</span>
                    <div className="birthday-ceremony-head">
                      <div>
                        <h3>生日祝福与店内仪式同时执行</h3>
                        <p>发送上方生日祝福话术，同时完成包间布置；两项都完成才算闭环。</p>
                      </div>
                      <b>联合执行：{selected.responsibleRoles?.join(' + ')}</b>
                    </div>
                    <div className="birthday-ceremony-tasks">
                      {selected.ceremonyTasks.map((task: string, index: number) => (
                        <article key={task}>
                          <i>{index + 1}</i>
                          <strong>{task}</strong>
                        </article>
                      ))}
                    </div>
                    <div className="birthday-ceremony-proof">
                      <ClipboardCheck /> 到店前由美容师与前台共同复核，并把布置结果补充回客户档案。
                    </div>
                  </section>
                )}
              </div>

              <div className="reminder-detail-footer">
                <span>{copyMessage || '完成联系后，请将结果补充回客户档案。'}</span>
                <Button variant="outline" onClick={() => void copyContent(selected)}>
                  复制回访内容
                </Button>
              </div>
            </div>
          ) : (
            <div className="reminder-detail-empty"><BellRing /> 该提醒暂时无法读取</div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
