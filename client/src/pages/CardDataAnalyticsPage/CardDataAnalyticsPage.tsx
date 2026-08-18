'use client';

import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Filter,
  PackageCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type {
  CardPackageCatalogResponse,
  CardPackageTemplate,
  MembershipCardStat,
  OperatingAnalyticsDetail,
  OperatingAnalyticsRange,
  OperatingAnalyticsResponse,
} from '@shared/api.interface';
import {
  getCardPackageCatalog,
  getCurrentServiceRole,
  getOperatingAnalytics,
} from '../../api';
import { Badge } from '../../components/ui/badge';
import CustomerMembershipBadge from '../../components/CustomerMembershipBadge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import {
  YOUZAN_SERVICE_CATALOG,
  type YouzanServiceItem,
} from '../../data/youzan-service-catalog';

type AnalyticsTab = 'statistics' | 'analysis';
type StatisticsSection = 'operations' | 'items' | 'members';
type ItemTypeFilter = 'all' | 'single' | 'package';
type KpiDetailState = {
  title: string;
  description: string;
  details: OperatingAnalyticsDetail[];
};

interface SingleAnalyticsRow {
  kind: 'single';
  id: string;
  name: string;
  category: string;
  price: number;
  tag: string;
  durationMinutes: number;
  packageCount: number;
  soldRights: number;
  usedCount: number;
  remainingCount: number;
  customerCount: number;
}

interface PackageAnalyticsRow {
  kind: 'package';
  id: string;
  name: string;
  category: string;
  status: string;
  price: number;
  soldCount: number;
  customerCount: number;
  revenue: number;
  usedCount: number;
  remainingCount: number;
  package: CardPackageTemplate;
}

type AnalyticsRow = SingleAnalyticsRow | PackageAnalyticsRow;

const RANGE_OPTIONS: Array<{ value: OperatingAnalyticsRange; label: string }> =
  [
    { value: 'today', label: '今日' },
    { value: 'month', label: '本月' },
    { value: 'quarter', label: '本季度' },
    { value: 'half_year', label: '本半年' },
    { value: 'year', label: '本年度' },
    { value: 'all', label: '全部历史' },
  ];

function money(value: number | string): string {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } })
      .response;
    if (typeof response?.data?.message === 'string')
      return response.data.message;
  }
  return error instanceof Error ? error.message : '数据分析加载失败';
}

function normalizedName(value: string): string {
  return value.replace(/\s+/gu, '').toLocaleLowerCase('zh-CN');
}

function dateTime(value?: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function CardDataAnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [catalog, setCatalog] = useState<CardPackageCatalogResponse | null>(
    null,
  );
  const [operating, setOperating] = useState<OperatingAnalyticsResponse | null>(
    null,
  );
  const [tab, setTab] = useState<AnalyticsTab>('statistics');
  const [section, setSection] = useState<StatisticsSection>('operations');
  const [range, setRange] = useState<OperatingAnalyticsRange>('month');
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('all');
  const [category, setCategory] = useState<string>('全部');
  const [query, setQuery] = useState<string>('');
  const [memberQuery, setMemberQuery] = useState<string>('');
  const [selected, setSelected] = useState<AnalyticsRow | null>(null);
  const [selectedMember, setSelectedMember] =
    useState<MembershipCardStat | null>(null);
  const [kpiDetail, setKpiDetail] = useState<KpiDetailState | null>(null);

  useEffect(() => {
    let active: boolean = true;
    void (async () => {
      setLoading(true);
      try {
        const role = await getCurrentServiceRole();
        if (!active) return;
        const isOwner: boolean = role.role === 'owner';
        setAuthorized(isOwner);
        if (!isOwner) return;
        const [cardData, operatingData] = await Promise.all([
          getCardPackageCatalog(),
          getOperatingAnalytics(range),
        ]);
        if (active) {
          setCatalog(cardData);
          setOperating(operatingData);
        }
      } catch (error: unknown) {
        toast.error(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [range]);

  const packages: CardPackageTemplate[] = catalog?.packages || [];
  const singleRows: SingleAnalyticsRow[] = useMemo(
    () =>
      YOUZAN_SERVICE_CATALOG.map((project: YouzanServiceItem) => {
        const name: string = normalizedName(project.name);
        const related: CardPackageTemplate[] = packages.filter(
          (card: CardPackageTemplate) =>
            card.components.some(
              (item) =>
                item.projectId === project.id ||
                normalizedName(item.projectName) === name,
            ),
        );
        const customerIds: Set<string> = new Set<string>();
        let soldRights: number = 0;
        let usedCount: number = 0;
        let remainingCount: number = 0;
        related.forEach((card: CardPackageTemplate) => {
          const component = card.components.find(
            (item) =>
              item.projectId === project.id ||
              normalizedName(item.projectName) === name,
          );
          soldRights += (component?.quantity || 0) * card.soldCount;
          card.customerUsage.forEach((usage) => {
            const service = usage.services.find(
              (item) => normalizedName(item.projectName) === name,
            );
            if (!service) return;
            customerIds.add(usage.customerId);
            usedCount += service.usedCount;
            remainingCount += service.remainingCount;
          });
        });
        return {
          kind: 'single',
          id: project.id,
          name: project.name,
          category: project.category,
          price: project.price,
          tag: project.tag,
          durationMinutes: project.durationMinutes,
          packageCount: related.length,
          soldRights,
          usedCount,
          remainingCount,
          customerCount: customerIds.size,
        };
      }),
    [packages],
  );
  const packageRows: PackageAnalyticsRow[] = useMemo(
    () =>
      packages.map((card: CardPackageTemplate) => ({
        kind: 'package',
        id: card.id,
        name: card.name,
        category: card.category,
        status: card.status,
        price: Number(card.retailPriceExact),
        soldCount: card.soldCount,
        customerCount: card.soldCustomerCount,
        revenue: Number(card.retailPriceExact) * card.soldCount,
        usedCount: card.customerUsage.reduce(
          (sum, usage) => sum + usage.usedServiceCount,
          0,
        ),
        remainingCount: card.customerUsage.reduce(
          (sum, usage) => sum + usage.remainingServiceCount,
          0,
        ),
        package: card,
      })),
    [packages],
  );
  const categories: string[] = useMemo(
    () => [
      '全部',
      ...Array.from(
        new Set<string>([
          ...singleRows.map((row) => row.category),
          ...packageRows.map((row) => row.category),
        ]),
      ).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    ],
    [packageRows, singleRows],
  );
  const filteredRows: AnalyticsRow[] = useMemo(() => {
    const keyword: string = query.trim().toLocaleLowerCase('zh-CN');
    return [...singleRows, ...packageRows]
      .filter((row) => typeFilter === 'all' || row.kind === typeFilter)
      .filter((row) => category === '全部' || row.category === category)
      .filter((row) =>
        !keyword
          ? true
          : [
              row.name,
              row.category,
              row.kind === 'single' ? row.tag : row.package.packageNo,
            ]
              .join(' ')
              .toLocaleLowerCase('zh-CN')
              .includes(keyword),
      )
      .sort((left, right) => {
        const leftVolume: number =
          left.kind === 'single' ? left.soldRights : left.soldCount;
        const rightVolume: number =
          right.kind === 'single' ? right.soldRights : right.soldCount;
        return rightVolume - leftVolume;
      });
  }, [category, packageRows, query, singleRows, typeFilter]);
  const filteredSold: number = filteredRows.reduce(
    (sum, row) =>
      sum + (row.kind === 'single' ? row.soldRights : row.soldCount),
    0,
  );
  const filteredCustomers: number = filteredRows.reduce(
    (sum, row) => sum + row.customerCount,
    0,
  );
  const filteredValue: number = filteredRows.reduce(
    (sum, row) =>
      sum + (row.kind === 'package' ? row.revenue : row.price * row.soldRights),
    0,
  );
  const membershipCards: MembershipCardStat[] = useMemo(() => {
    const keyword: string = memberQuery.trim().toLocaleLowerCase('zh-CN');
    return (operating?.membershipCards || []).filter(
      (card: MembershipCardStat) =>
        !keyword ||
        [card.cardName, card.category, card.cardType]
          .join(' ')
          .toLocaleLowerCase('zh-CN')
          .includes(keyword),
    );
  }, [memberQuery, operating]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-lg text-slate-600">
        正在汇总门店经营数据…
      </main>
    );
  }
  if (!authorized) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <ShieldCheck className="size-12 text-slate-500" />
        <h1 className="text-3xl font-bold">该数据板块仅老板可见</h1>
        <p className="text-lg text-slate-500">
          员工、前台和其他角色均不能查看经营金额、成本、负债与毛利。
        </p>
        <Button onClick={() => navigate('/')}>返回工作台</Button>
      </main>
    );
  }

  const summary = operating?.summary;
  const showDetails = (
    title: string,
    description: string,
    details: OperatingAnalyticsDetail[],
  ): void => setKpiDetail({ title, description, details });
  const showItemMetric = (title: string, description: string): void =>
    showDetails(
      title,
      description,
      filteredRows.map(
        (row): OperatingAnalyticsDetail => ({
          id: `${row.kind}:${row.id}`,
          title: row.name,
          subtitle: `${row.kind === 'package' ? '套餐卡' : '单次卡项'} · ${row.category}`,
          amountExact: String(
            row.kind === 'package' ? row.revenue : row.price * row.soldRights,
          ),
          customerName: `${row.customerCount} 位客户`,
          source:
            row.kind === 'package'
              ? `已售 ${row.soldCount} 张 · 剩余 ${row.remainingCount} 次`
              : `已售权益 ${row.soldRights} · 剩余 ${row.remainingCount} 次`,
        }),
      ),
    );

  return (
    <main className="min-h-screen bg-[#f4f7ff] p-4 text-slate-900 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1760px] space-y-6">
        <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <Button
            variant="ghost"
            className="mb-4 -ml-3 text-base"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 size-5" />
            返回工作台
          </Button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-blue-600">
                老板专属 · 全店经营数据
              </p>
              <h1 className="mt-2 text-3xl font-bold sm:text-5xl">数据分析</h1>
              <p className="mt-3 max-w-5xl text-base leading-7 text-slate-500 sm:text-lg">
                现金、耗卡、卡金负债、会员卡、产品和已录成本毛利统一汇总；每个数字都可以点击回查明细。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                className="h-11 rounded-xl border bg-white px-4 font-semibold"
                value={range}
                onChange={(event) =>
                  setRange(event.target.value as OperatingAnalyticsRange)
                }
              >
                {RANGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Badge
                variant="outline"
                className="gap-2 px-4 py-3 text-base text-emerald-700"
              >
                <ShieldCheck className="size-5" />
                老板权限 · 云端实时
              </Badge>
            </div>
          </div>
        </header>

        <nav className="grid gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-2">
          <button
            type="button"
            className={`rounded-xl p-4 text-left ${tab === 'statistics' ? 'bg-blue-600 text-white' : 'bg-slate-50'}`}
            onClick={() => setTab('statistics')}
          >
            <BarChart3 className="mb-2 size-6" />
            <b className="text-xl">统计</b>
            <span className="mt-1 block opacity-80">
              经营、项目套餐卡和会员卡汇总
            </span>
          </button>
          <button
            type="button"
            className={`rounded-xl p-4 text-left ${tab === 'analysis' ? 'bg-violet-600 text-white' : 'bg-slate-50'}`}
            onClick={() => setTab('analysis')}
          >
            <Sparkles className="mb-2 size-6" />
            <b className="text-xl">分析</b>
            <span className="mt-1 block opacity-80">
              经营结构、风险与优化建议
            </span>
          </button>
        </nav>

        {tab === 'statistics' ? (
          <>
            <nav className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3">
              <Button
                size="lg"
                variant={section === 'operations' ? 'default' : 'outline'}
                onClick={() => setSection('operations')}
              >
                <TrendingUp />
                门店经营统计
              </Button>
              <Button
                size="lg"
                variant={section === 'items' ? 'default' : 'outline'}
                onClick={() => setSection('items')}
              >
                <ClipboardList />
                项目 / 套餐卡统计
              </Button>
              <Button
                size="lg"
                variant={section === 'members' ? 'default' : 'outline'}
                onClick={() => setSection('members')}
              >
                <WalletCards />
                会员卡统计
              </Button>
            </nav>
            {section === 'operations' && (
              <OperationsSection
                operating={operating}
                onDetails={showDetails}
                onMembers={() => setSection('members')}
                onInventory={() => navigate('/inventory')}
              />
            )}
            {section === 'items' && (
              <ItemsSection
                rows={filteredRows}
                categories={categories}
                query={query}
                category={category}
                typeFilter={typeFilter}
                sold={filteredSold}
                customers={filteredCustomers}
                value={filteredValue}
                onQuery={setQuery}
                onCategory={setCategory}
                onType={setTypeFilter}
                onMemberStats={() => setSection('members')}
                onMetric={showItemMetric}
                onSelect={setSelected}
              />
            )}
            {section === 'members' && (
              <MembershipSection
                cards={membershipCards}
                query={memberQuery}
                onQuery={setMemberQuery}
                onSelect={setSelectedMember}
              />
            )}
          </>
        ) : (
          <AnalysisSection operating={operating} />
        )}
      </div>
      <DetailsDialog state={kpiDetail} onClose={() => setKpiDetail(null)} />
      <MembershipDialog
        card={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
      <ItemDialog row={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function OperationsSection({
  operating,
  onDetails,
  onMembers,
  onInventory,
}: {
  operating: OperatingAnalyticsResponse | null;
  onDetails: (
    title: string,
    description: string,
    details: OperatingAnalyticsDetail[],
  ) => void;
  onMembers: () => void;
  onInventory: () => void;
}) {
  const summary = operating?.summary;
  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="emerald"
          label="现金业绩"
          value={money(summary?.cashPerformanceExact || 0)}
          note={`${summary?.cashTransactionCount || 0} 笔 · 点击查看流水`}
          icon={<CircleDollarSign />}
          onClick={() =>
            onDetails(
              '现金业绩明细',
              '实际收款和独立产品现金开单。',
              operating?.cashDetails || [],
            )
          }
        />
        <KpiCard
          tone="blue"
          label="耗卡业绩"
          value={money(summary?.cardConsumptionExact || 0)}
          note={`${summary?.cardConsumptionCount || 0} 笔 · 点击查看项目`}
          icon={<PackageCheck />}
          onClick={() =>
            onDetails(
              '耗卡业绩明细',
              '本金、赠送金与项目权益扣卡价值。',
              operating?.cardConsumptionDetails || [],
            )
          }
        />
        <KpiCard
          tone="rose"
          label="卡金未消耗 · 经营负债"
          value={money(summary?.cardLiabilityExact || 0)}
          note="点击查看会员卡和具体客户"
          icon={<ShieldAlert />}
          onClick={onMembers}
        />
        <KpiCard
          tone="violet"
          label="产品销售"
          value={money(summary?.productSalesExact || 0)}
          note={`${summary?.productSaleCount || 0} 笔 · 点击查看产品`}
          icon={<TrendingUp />}
          onClick={() =>
            onDetails(
              '产品销售明细',
              '产品销售、退单、客户与实收。',
              operating?.productSalesDetails || [],
            )
          }
        />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="slate"
          label="产品销售成本"
          value={money(summary?.productCostExact || 0)}
          note="点击核对销售成本"
          onClick={() =>
            onDetails(
              '产品销售成本',
              '售出数量乘以对应成本，退单同步冲回。',
              operating?.productCostDetails || [],
            )
          }
        />
        <KpiCard
          tone="slate"
          label="内部领用成本"
          value={money(summary?.internalUseCostExact || 0)}
          note="点击核对领用人和用途"
          onClick={() =>
            onDetails(
              '内部领用成本',
              '内部消耗不产生收入，但计入经营成本。',
              operating?.internalUseCostDetails || [],
            )
          }
        />
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <span className="text-slate-500">已录成本毛利</span>
          <strong className="mt-2 block text-3xl">
            {money(summary?.grossProfitExact || 0)}
          </strong>
          <small>毛利率 {summary?.grossMarginPercentExact || '0.00'}%</small>
        </article>
        <KpiCard
          tone="slate"
          label="库存成本 / 成本完整度"
          value={money(summary?.inventoryCostExact || 0)}
          note={`${summary?.productCostCoveragePercent || 0}% 已录成本 · 去维护`}
          onClick={onInventory}
        />
      </section>
      <p className="rounded-2xl border bg-white p-5 text-slate-600">
        {operating?.sourceNote}
      </p>
    </div>
  );
}

function KpiCard({
  tone,
  label,
  value,
  note,
  icon,
  onClick,
}: {
  tone: 'emerald' | 'blue' | 'rose' | 'violet' | 'slate';
  label: string;
  value: string;
  note: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const colors: Record<typeof tone, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    rose: 'border-rose-300 bg-rose-50 text-rose-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    slate: 'border-slate-200 bg-white text-slate-900',
  };
  return (
    <button
      type="button"
      className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg ${colors[tone]}`}
      onClick={onClick}
    >
      {icon && <span className="block [&>svg]:size-7">{icon}</span>}
      <span className="mt-4 block text-slate-500">{label}</span>
      <strong className="mt-1 block text-3xl">{value}</strong>
      <small>{note}</small>
    </button>
  );
}

function ItemsSection({
  rows,
  categories,
  query,
  category,
  typeFilter,
  sold,
  customers,
  value,
  onQuery,
  onCategory,
  onType,
  onMemberStats,
  onMetric,
  onSelect,
}: {
  rows: AnalyticsRow[];
  categories: string[];
  query: string;
  category: string;
  typeFilter: ItemTypeFilter;
  sold: number;
  customers: number;
  value: number;
  onQuery: (value: string) => void;
  onCategory: (value: string) => void;
  onType: (value: ItemTypeFilter) => void;
  onMemberStats: () => void;
  onMetric: (title: string, description: string) => void;
  onSelect: (row: AnalyticsRow) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="blue"
          label="筛选卡项"
          value={String(rows.length)}
          note="点击查看完整清单"
          icon={<ClipboardList />}
          onClick={() =>
            onMetric('筛选卡项明细', '当前筛选下的全部项目和套餐卡。')
          }
        />
        <KpiCard
          tone="violet"
          label="售出 / 带出权益"
          value={String(sold)}
          note="点击查看来源"
          icon={<PackageCheck />}
          onClick={() =>
            onMetric('售出与权益明细', '逐卡项查看售出张数与权益。')
          }
        />
        <KpiCard
          tone="emerald"
          label="关联客户次数"
          value={String(customers)}
          note="点击查看关联"
          icon={<Users />}
          onClick={() =>
            onMetric('关联客户明细', '逐卡项显示关联客户和剩余情况。')
          }
        />
        <KpiCard
          tone="slate"
          label="销售 / 权益价值"
          value={money(value)}
          note="点击查看价值构成"
          icon={<CircleDollarSign />}
          onClick={() =>
            onMetric('销售与权益价值明细', '项目标价与套餐售价的筛选对比口径。')
          }
        />
      </section>
      <section className="rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-blue-600" />
            <h2 className="text-2xl font-bold">项目与套餐卡筛选</h2>
          </div>
          <Button variant="outline" onClick={onMemberStats}>
            <WalletCards />
            会员卡统计
          </Button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-5 text-slate-400" />
            <Input
              className="pl-10"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="搜索项目、分类、编号或管理类型"
            />
          </div>
          <select
            className="h-10 rounded-md border bg-white px-3"
            value={category}
            onChange={(event) => onCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['all', '全部卡项'],
              ['single', '单次卡项'],
              ['package', '套餐卡'],
            ] as Array<[ItemTypeFilter, string]>
          ).map(([valueKey, label]) => (
            <Button
              key={valueKey}
              variant={typeFilter === valueKey ? 'default' : 'outline'}
              onClick={() => onType(valueKey)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="text-2xl font-bold">卡项明细与汇总</h2>
        <p className="mt-1 text-slate-500">
          按销量从高到低；点击任一卡项查看详情。
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <button
              type="button"
              key={`${row.kind}:${row.id}`}
              className="rounded-2xl border p-4 text-left hover:border-blue-400 hover:shadow-md"
              onClick={() => onSelect(row)}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <Badge>
                    {row.kind === 'package' ? '套餐卡' : '单次卡项'}
                  </Badge>
                  <h3 className="mt-3 text-xl font-bold">{row.name}</h3>
                  <p className="text-slate-500">{row.category}</p>
                </div>
                <b className="text-blue-700">{money(row.price)}</b>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <span className="rounded-lg bg-slate-50 p-2">
                  <b className="block">
                    {row.kind === 'package' ? row.soldCount : row.soldRights}
                  </b>
                  <small>售出/权益</small>
                </span>
                <span className="rounded-lg bg-slate-50 p-2">
                  <b className="block">{row.customerCount}</b>
                  <small>客户</small>
                </span>
                <span className="rounded-lg bg-slate-50 p-2">
                  <b className="block">{row.remainingCount}</b>
                  <small>剩余</small>
                </span>
              </div>
              <span className="mt-4 flex font-semibold text-blue-600">
                查看完整明细 <ChevronRight className="size-5" />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function MembershipSection({
  cards,
  query,
  onQuery,
  onSelect,
}: {
  cards: MembershipCardStat[];
  query: string;
  onQuery: (value: string) => void;
  onSelect: (card: MembershipCardStat) => void;
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-semibold text-blue-600">会员卡统计</p>
          <h2 className="mt-1 text-3xl font-bold">
            各类会员卡、余额负债与客户
          </h2>
          <p className="mt-2 text-slate-500">
            按真实卡名聚合，点击查看持卡客户和本期耗卡。
          </p>
        </div>
        <div className="relative min-w-[280px]">
          <Search className="absolute left-3 top-3 size-5 text-slate-400" />
          <Input
            className="pl-10"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索会员卡名称、分类或类型"
          />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            type="button"
            key={card.id}
            className="rounded-2xl border p-5 text-left hover:border-rose-300 hover:shadow-lg"
            onClick={() => onSelect(card)}
          >
            <div className="flex justify-between gap-3">
              <div>
                <Badge>{card.cardType}</Badge>
                <h3 className="mt-3 text-xl font-bold">{card.cardName}</h3>
                <p className="text-slate-500">
                  {card.category} · {card.status}
                </p>
              </div>
              <b className="h-fit rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                负债 {money(card.totalLiabilityExact)}
              </b>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <span className="rounded-lg bg-slate-50 p-2">
                <b className="block">{card.accountCount}</b>
                <small>卡账户</small>
              </span>
              <span className="rounded-lg bg-slate-50 p-2">
                <b className="block">{card.customerCount}</b>
                <small>客户</small>
              </span>
              <span className="rounded-lg bg-slate-50 p-2">
                <b className="block">{money(card.consumptionExact)}</b>
                <small>本期耗卡</small>
              </span>
            </div>
            <span className="mt-4 flex font-semibold text-blue-600">
              查看持卡客户 <ChevronRight className="size-5" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AnalysisSection({
  operating,
}: {
  operating: OperatingAnalyticsResponse | null;
}) {
  const summary = operating?.summary;
  return (
    <section className="space-y-5">
      <article className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-6 sm:p-8">
        <p className="font-semibold text-violet-700">
          {operating?.rangeLabel}经营结论
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-9">
          经营收入 {money(summary?.totalOperatingRevenueExact || 0)}，其中现金{' '}
          {money(summary?.cashPerformanceExact || 0)}、耗卡{' '}
          {money(summary?.cardConsumptionExact || 0)}；当前卡金负债{' '}
          {money(summary?.cardLiabilityExact || 0)}，已录成本毛利{' '}
          {money(summary?.grossProfitExact || 0)}。
        </h2>
      </article>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border bg-white p-6">
          <h3 className="text-xl font-bold">收入与负债结构</h3>
          <p className="mt-4 rounded-xl bg-emerald-50 p-4">
            现金业绩 <b>{money(summary?.cashPerformanceExact || 0)}</b>
          </p>
          <p className="mt-3 rounded-xl bg-blue-50 p-4">
            耗卡业绩 <b>{money(summary?.cardConsumptionExact || 0)}</b>
          </p>
          <p className="mt-3 rounded-xl bg-rose-50 p-4 text-rose-800">
            未消耗卡金负债 <b>{money(summary?.cardLiabilityExact || 0)}</b>
          </p>
        </article>
        <article className="rounded-3xl border bg-white p-6">
          <h3 className="text-xl font-bold">产品与毛利结构</h3>
          <p className="mt-4 rounded-xl bg-violet-50 p-4">
            产品销售 {money(summary?.productSalesExact || 0)} · 成本{' '}
            {money(summary?.productCostExact || 0)}
          </p>
          <p className="mt-3 rounded-xl bg-amber-50 p-4">
            内部领用成本 {money(summary?.internalUseCostExact || 0)}
          </p>
          <p className="mt-3 rounded-xl bg-slate-50 p-4">
            成本完整度 {summary?.productCostCoveragePercent || 0}% · 毛利率{' '}
            {summary?.grossMarginPercentExact || '0.00'}%
          </p>
        </article>
      </div>
      <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="text-2xl font-bold">数据分析与优化建议</h3>
        <ol className="mt-5 grid gap-3 lg:grid-cols-2">
          {(operating?.recommendations || []).map((item, index) => (
            <li key={item} className="rounded-xl bg-white p-4">
              <b className="mr-2 text-blue-600">{index + 1}.</b>
              {item}
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}

function DetailsDialog({
  state,
  onClose,
}: {
  state: KpiDetailState | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,1080px)] overflow-hidden p-0">
        <DialogHeader className="border-b bg-slate-50 px-6 py-5 pr-14">
          <DialogTitle className="text-2xl">{state?.title}</DialogTitle>
          <DialogDescription className="text-base">
            {state?.description}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-120px)] space-y-3 overflow-y-auto p-5">
          {state?.details.map((detail) => (
            <article
              key={detail.id}
              className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <h3 className="text-lg font-bold">{detail.title}</h3>
                <p className="text-slate-500">
                  {detail.customerName ? `${detail.customerName} · ` : ''}
                  {detail.subtitle}
                </p>
                <small>
                  {detail.source}
                  {detail.occurredAt ? ` · ${dateTime(detail.occurredAt)}` : ''}
                </small>
              </div>
              <b className="text-xl text-blue-700">
                {money(detail.amountExact)}
              </b>
            </article>
          ))}
          {!state?.details.length && (
            <p className="rounded-xl bg-slate-50 p-10 text-center text-slate-500">
              当前周期暂无对应流水。
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MembershipDialog({
  card,
  onClose,
}: {
  card: MembershipCardStat | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={card !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,1120px)] overflow-hidden p-0">
        <DialogHeader className="border-b bg-slate-50 px-6 py-5 pr-14">
          <DialogTitle className="text-2xl">{card?.cardName}</DialogTitle>
          <DialogDescription>
            会员卡余额负债、本期充值、耗卡与持卡客户
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-120px)] overflow-y-auto p-5">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-rose-50 p-4">
              <span>卡金负债</span>
              <b className="mt-2 block text-2xl text-rose-700">
                {money(card?.totalLiabilityExact || 0)}
              </b>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <span>本金余额</span>
              <b className="mt-2 block text-2xl">
                {money(card?.principalBalanceExact || 0)}
              </b>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4">
              <span>赠送金余额</span>
              <b className="mt-2 block text-2xl">
                {money(card?.giftBalanceExact || 0)}
              </b>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <span>本期耗卡</span>
              <b className="mt-2 block text-2xl">
                {money(card?.consumptionExact || 0)}
              </b>
            </div>
          </section>
          <h3 className="mb-3 mt-6 text-xl font-bold">持卡客户明细</h3>
          <div className="space-y-3">
            {card?.customers.map((customer) => (
              <article
                key={customer.customerId}
                className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <div className="customer-name-membership-row">
                    <h4 className="text-lg font-bold">{customer.customerName}</h4>
                    <CustomerMembershipBadge memberLevel={customer.memberLevel} compact />
                  </div>
                  <p className="text-slate-500">
                    {customer.mobile || '手机号待补充'} ·{' '}
                    {customer.accountCount} 张同类卡
                  </p>
                </div>
                <span>
                  <small className="block">当前余额</small>
                  <b>{money(customer.totalBalanceExact)}</b>
                </span>
                <span>
                  <small className="block">本期耗卡</small>
                  <b>{money(customer.consumptionExact)}</b>
                </span>
              </article>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  row,
  onClose,
}: {
  row: AnalyticsRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,1100px)] overflow-hidden p-0">
        <DialogHeader className="border-b bg-slate-50 px-6 py-5 pr-14">
          <DialogTitle className="text-2xl">{row?.name}</DialogTitle>
          <DialogDescription>卡项销售、组成、客户与使用明细</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-120px)] overflow-y-auto p-5">
          {row && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-blue-50 p-4">
                售价<b className="mt-2 block text-2xl">{money(row.price)}</b>
              </div>
              <div className="rounded-2xl bg-violet-50 p-4">
                售出 / 权益
                <b className="mt-2 block text-2xl">
                  {row.kind === 'package' ? row.soldCount : row.soldRights}
                </b>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                关联客户
                <b className="mt-2 block text-2xl">{row.customerCount} 位</b>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                剩余次数
                <b className="mt-2 block text-2xl">{row.remainingCount}</b>
              </div>
            </section>
          )}
          {row?.kind === 'package' && (
            <>
              <h3 className="mb-3 mt-6 text-xl font-bold">套餐项目与次数</h3>
              <div className="space-y-2">
                {row.package.components.map((item) => (
                  <div
                    key={`${item.projectId}-${item.projectName}`}
                    className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <b>{item.projectName}</b>
                      <p>{item.category}</p>
                    </div>
                    <span>{money(item.unitPriceExact)}/次</span>
                    <b>{item.quantity} 次</b>
                  </div>
                ))}
              </div>
              <h3 className="mb-3 mt-6 text-xl font-bold">
                购买客户与使用情况
              </h3>
              <div className="space-y-3">
                {row.package.customerUsage.map((usage) => (
                  <article
                    key={usage.accountId}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex justify-between">
                      <div>
                        <span className="customer-name-membership-row">
                          <b className="text-lg">{usage.customerName}</b>
                          <CustomerMembershipBadge memberLevel={usage.memberLevel} compact />
                        </span>
                        <p className="text-slate-500">
                          {usage.mobile || '手机号待补充'} · {usage.accountName}
                        </p>
                      </div>
                      <b>剩余 {usage.remainingServiceCount} 次</b>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
