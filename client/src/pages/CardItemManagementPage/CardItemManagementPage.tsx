'use client';

import {
  ArrowLeft,
  BadgePlus,
  ChevronRight,
  CreditCard,
  Eye,
  Layers3,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type {
  CardPackageComponent,
  CardPackageCustomerUsage,
  CardPackageTemplate,
  ServiceProjectDefinition,
} from '@shared/api.interface';
import {
  createCardPackage,
  createServiceProject,
  getCardPackageCatalog,
  getCurrentServiceRole,
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
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  YOUZAN_SERVICE_CATALOG,
  type YouzanServiceItem,
} from '../../data/youzan-service-catalog';

type PageTab = 'single' | 'package';
type SectionMode = 'existing' | 'create';

type DetailView =
  | { kind: 'single_summary' }
  | { kind: 'package_summary' }
  | { kind: 'service_summary' }
  | { kind: 'sold_summary' }
  | { kind: 'project'; project: YouzanServiceItem }
  | { kind: 'package'; package: CardPackageTemplate };

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function money(value: string | number): string {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value?: string): string {
  if (!value) return '尚未使用';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间待确认';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function CustomerPackageUsageCard({ usage }: { usage: CardPackageCustomerUsage }) {
  const usedPercent = usage.totalServiceCount > 0
    ? Math.round((usage.usedServiceCount / usage.totalServiceCount) * 100)
    : 0;
  return (
    <article className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xl font-bold text-slate-900">{usage.customerName}</h4>
            <CustomerMembershipBadge memberLevel={usage.memberLevel} compact />
            <Badge variant="secondary">购买 {usage.soldCount} 张</Badge>
            <Badge variant="outline">{usage.accountStatus}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {usage.mobile || '手机号待补充'} · 卡账户：{usage.accountName}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <b className="text-lg text-violet-700">剩余 {usage.remainingServiceCount} 次</b>
          <p className="text-sm text-slate-500">已用 {usage.usedServiceCount} / {usage.totalServiceCount} 次</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, usedPercent)}%` }} />
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p className="rounded-xl bg-blue-50 p-3"><span className="block text-slate-500">开卡 / 购买时间</span><b>{dateTime(usage.purchasedAt)}</b></p>
        <p className="rounded-xl bg-emerald-50 p-3"><span className="block text-slate-500">最近使用</span><b>{dateTime(usage.lastUsedAt)}</b></p>
      </div>
      <div className="mt-4 space-y-2">
        <h5 className="font-bold">套餐项目使用明细</h5>
        {usage.services.map((service) => (
          <div key={service.projectName} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
            <div><b>{service.projectName}</b><p className="text-sm text-slate-500">{service.category}{service.lastUsedAt ? ` · 最近 ${dateTime(service.lastUsedAt)}` : ''}</p></div>
            <span>总 {service.totalCount} 次</span>
            <span className="text-amber-700">已用 {service.usedCount} 次</span>
            <strong className="text-emerald-700">剩余 {service.remainingCount} 次</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function toComponent(project: YouzanServiceItem): CardPackageComponent {
  return {
    projectId: project.id,
    projectName: project.name,
    category: project.category,
    unitPriceExact: project.price.toFixed(2),
    quantity: 1,
  };
}

export default function CardItemManagementPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<PageTab>('package');
  const [cardMode, setCardMode] = useState<SectionMode>('existing');
  const [projectMode, setProjectMode] = useState<SectionMode>('existing');
  const [packages, setPackages] = useState<CardPackageTemplate[]>([]);
  const [customProjects, setCustomProjects] = useState<ServiceProjectDefinition[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [name, setName] = useState('');
  const [packageCategory, setPackageCategory] = useState('活动套餐');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('100');
  const [validDays, setValidDays] = useState('365');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectPrice, setProjectPrice] = useState('');
  const [projectCategory, setProjectCategory] = useState('皮肤管理');
  const [projectManagementType, setProjectManagementType] = useState('皮肤管理');
  const [projectDuration, setProjectDuration] = useState('60');
  const [components, setComponents] = useState<CardPackageComponent[]>([]);
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [detailQuery, setDetailQuery] = useState('');

  const reload = useCallback(async () => {
    const response = await getCardPackageCatalog();
    setPackages(response.packages);
    setCustomProjects(response.customProjects || []);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const role = await getCurrentServiceRole();
        if (!active) return;
        const canManage = role.permissions.manageInventory;
        setAuthorized(canManage);
        if (canManage) await reload();
      } catch (error: unknown) {
        toast.error(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  const allProjects = useMemo<YouzanServiceItem[]>(() => [
    ...customProjects.map((project) => ({
      id: project.id,
      name: project.name,
      price: Number(project.priceExact),
      category: project.category,
      tag: project.managementType,
      durationMinutes: project.durationMinutes,
    })),
    ...YOUZAN_SERVICE_CATALOG,
  ], [customProjects]);

  const allProjectCategories = useMemo(
    () => ['全部', ...new Set(allProjects.map((project) => project.category))],
    [allProjects],
  );

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allProjects.filter((project) => {
      const matchesCategory = category === '全部' || project.category === category;
      const matchesQuery =
        !normalized ||
        project.name.toLowerCase().includes(normalized) ||
        project.category.toLowerCase().includes(normalized) ||
        project.tag.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [allProjects, category, query]);

  const originalValue = components.reduce(
    (total, item) => total + Number(item.unitPriceExact) * item.quantity,
    0,
  );

  const detailProjects = useMemo(() => {
    const normalized = detailQuery.trim().toLowerCase();
    if (!normalized) return allProjects;
    return allProjects.filter((project) =>
      [project.name, project.category, project.tag]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [allProjects, detailQuery]);

  const serviceBreakdown = useMemo(() => {
    const rows = new Map<string, CardPackageComponent & { packageCount: number }>();
    packages.forEach((cardPackage) => {
      cardPackage.components.forEach((component) => {
        const current = rows.get(component.projectId);
        if (current) {
          current.quantity += component.quantity;
          current.packageCount += 1;
        } else {
          rows.set(component.projectId, { ...component, packageCount: 1 });
        }
      });
    });
    return [...rows.values()].sort((a, b) => b.quantity - a.quantity);
  }, [packages]);

  const totalSoldCount = useMemo(
    () => packages.reduce((sum, item) => sum + item.soldCount, 0),
    [packages],
  );
  const totalSoldCustomerCount = useMemo(
    () => new Set(packages.flatMap((item) => item.customerUsage.map((usage) => usage.customerId))).size,
    [packages],
  );
  const soldPackages = useMemo(() => {
    const normalized = detailQuery.trim().toLowerCase();
    if (!normalized) return packages.filter((item) => item.soldCount > 0);
    return packages.filter((item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.customerUsage.some((usage) =>
        [usage.customerName, usage.mobile || '', usage.accountName]
          .some((value) => value.toLowerCase().includes(normalized)),
      ),
    );
  }, [detailQuery, packages]);

  const openDetail = (view: DetailView): void => {
    setDetailQuery('');
    setDetailView(view);
  };

  const addProject = (project: YouzanServiceItem): void => {
    setComponents((current) => {
      const existing = current.find((item) => item.projectId === project.id);
      return existing
        ? current.map((item) =>
            item.projectId === project.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...current, toComponent(project)];
    });
  };

  const changeQuantity = (projectId: string, delta: number): void => {
    setComponents((current) =>
      current
        .map((item) =>
          item.projectId === projectId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const resetDraft = (): void => {
    setName('');
    setPackageCategory('活动套餐');
    setPrice('');
    setDiscount('100');
    setValidDays('365');
    setDescription('');
    setComponents([]);
  };

  const savePackage = async (): Promise<void> => {
    if (!name.trim() || Number(price) <= 0 || components.length === 0) {
      toast.error('请填写卡项名称、售价，并至少加入一个项目');
      return;
    }
    setSaving(true);
    try {
      const response = await createCardPackage({
        name: name.trim(),
        category: packageCategory.trim() || '活动套餐',
        retailPriceExact: Number(price).toFixed(2),
        discountPercentExact: discount || '100',
        validDays: validDays ? Number(validDays) : undefined,
        description: description.trim() || undefined,
        components,
      });
      setPackages((current) => [response.package, ...current]);
      toast.success(`套餐卡“${response.package.name}”已建立`);
      resetDraft();
    } catch (error: unknown) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async (): Promise<void> => {
    if (!projectName.trim() || Number(projectPrice) <= 0 || Number(projectDuration) <= 0) {
      toast.error('请填写项目名称、售价和服务时长');
      return;
    }
    setSaving(true);
    try {
      const response = await createServiceProject({
        name: projectName.trim(),
        priceExact: Number(projectPrice).toFixed(2),
        category: projectCategory.trim() || '未分类',
        managementType: projectManagementType.trim() || '门店服务',
        durationMinutes: Number(projectDuration),
      });
      setCustomProjects((current) => [response.project, ...current]);
      setProjectName('');
      setProjectPrice('');
      setProjectDuration('60');
      setProjectMode('existing');
      toast.success(`项目“${response.project.name}”已保存到云端`);
    } catch (error: unknown) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8 text-slate-600">正在加载卡项资料…</main>;
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <ShieldCheck className="size-12 text-slate-500" />
        <h1 className="text-3xl font-bold text-slate-900">当前账号没有卡项管理权限</h1>
        <p className="text-lg text-slate-500">卡项建立与套餐组合仅老板和前台可以操作。</p>
        <Button onClick={() => navigate('/')}>返回工作台</Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7ff] p-4 text-slate-900 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <Button variant="ghost" className="mb-4 -ml-3 text-base" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 size-5" />返回工作台
          </Button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-blue-600">老板 / 前台可操作 · 云端卡项底库</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-5xl">卡项与项目管理</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500 sm:text-lg">
                卡项和项目集中在同一个页面管理：先选择全部卡项或全部项目，再处理新增与已有内容。
              </p>
            </div>
            <Badge variant="outline" className="w-fit gap-2 px-4 py-3 text-base text-emerald-700">
              <ShieldCheck className="size-5" />妙搭云端保存
            </Badge>
          </div>
        </header>

        <nav className="grid gap-3 rounded-3xl border bg-white p-3 sm:grid-cols-2">
          <button type="button" className={`rounded-2xl p-5 text-left transition ${tab === 'package' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 hover:bg-slate-100'}`} onClick={() => setTab('package')}><CreditCard className="mb-3 size-7" /><b className="text-2xl">全部卡项</b><span className="mt-2 block opacity-80">新增卡项、已有卡项，都在这里</span></button>
          <button type="button" className={`rounded-2xl p-5 text-left transition ${tab === 'single' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 hover:bg-slate-100'}`} onClick={() => setTab('single')}><Layers3 className="mb-3 size-7" /><b className="text-2xl">全部项目</b><span className="mt-2 block opacity-80">新增项目、已有项目，都在这里</span></button>
        </nav>

        <section aria-label="卡项与项目汇总" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" className="group rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md" onClick={() => openDetail({ kind: 'single_summary' })}>
            <span className="text-slate-500">已有项目</span><strong className="mt-2 block text-4xl">{allProjects.length}</strong><small className="text-slate-500">覆盖门店全部服务项目</small><span className="mt-4 flex items-center font-semibold text-blue-600">查看全部项目详情 <ChevronRight className="size-5 transition group-hover:translate-x-1" /></span>
          </button>
          <button type="button" className="group rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md" onClick={() => openDetail({ kind: 'package_summary' })}>
            <span className="text-slate-500">已有卡项</span><strong className="mt-2 block text-4xl">{packages.length}</strong><small className="text-slate-500">单次卡项与多次套餐卡</small><span className="mt-4 flex items-center font-semibold text-violet-600">查看全部卡项详情 <ChevronRight className="size-5 transition group-hover:translate-x-1" /></span>
          </button>
          <button type="button" className="group rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md" onClick={() => openDetail({ kind: 'service_summary' })}>
            <span className="text-slate-500">卡项内服务总次</span><strong className="mt-2 block text-4xl">{packages.reduce((sum, item) => sum + item.totalServiceCount, 0)}</strong><small className="text-slate-500">所有卡项权益合计</small><span className="mt-4 flex items-center font-semibold text-emerald-600">查看次数构成明细 <ChevronRight className="size-5 transition group-hover:translate-x-1" /></span>
          </button>
          <button type="button" className="group rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md" onClick={() => openDetail({ kind: 'sold_summary' })}>
            <span className="text-amber-800">卡项售出总数</span><strong className="mt-2 block text-4xl text-amber-900">{totalSoldCount}</strong><small className="text-amber-700">对应 {totalSoldCustomerCount} 位客户</small><span className="mt-4 flex items-center font-semibold text-amber-700">查看客户与使用明细 <ChevronRight className="size-5 transition group-hover:translate-x-1" /></span>
          </button>
        </section>

        {tab === 'single' ? (
          <section className="rounded-3xl border bg-white p-5 sm:p-7">
            <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-blue-600">全部项目</p><h2 className="mt-1 text-3xl font-bold">门店服务项目库</h2><p className="mt-2 text-slate-500">新增项目与已有项目在同一界面切换，不再跳到其他页面。</p></div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <Button type="button" variant={projectMode === 'existing' ? 'default' : 'ghost'} onClick={() => setProjectMode('existing')}>已有项目</Button>
                <Button type="button" variant={projectMode === 'create' ? 'default' : 'ghost'} onClick={() => setProjectMode('create')}><Plus className="mr-1 size-4" />新增项目</Button>
              </div>
            </div>
            {projectMode === 'create' ? (
              <div className="mx-auto mt-6 max-w-4xl rounded-3xl border border-blue-200 bg-blue-50/50 p-5 sm:p-7">
                <h3 className="text-2xl font-bold">新增项目</h3><p className="mt-2 text-slate-500">保存后会进入已有项目，并同步用于预约、开单和套餐组合。</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 sm:col-span-2"><Label>项目名称</Label><Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="例如：夏日舒缓修护" /></label>
                  <label className="space-y-2"><Label>项目分类</Label><Input value={projectCategory} onChange={(event) => setProjectCategory(event.target.value)} placeholder="例如：修复" /></label>
                  <label className="space-y-2"><Label>管理类型</Label><Input value={projectManagementType} onChange={(event) => setProjectManagementType(event.target.value)} placeholder="例如：皮肤管理" /></label>
                  <label className="space-y-2"><Label>项目售价</Label><Input inputMode="decimal" value={projectPrice} onChange={(event) => setProjectPrice(event.target.value)} placeholder="0.00" /></label>
                  <label className="space-y-2"><Label>服务时长（分钟）</Label><Input inputMode="numeric" value={projectDuration} onChange={(event) => setProjectDuration(event.target.value)} /></label>
                </div>
                <Button size="lg" className="mt-6 w-full" disabled={saving} onClick={() => void saveProject()}><PackageCheck className="mr-2 size-5" />{saving ? '正在保存项目…' : '保存新增项目'}</Button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-md"><Search className="absolute left-3 top-3 size-5 text-slate-400" /><Input className="pl-10" placeholder="搜索项目名称、分类或管理类型" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Badge variant="secondary" className="w-fit px-3 py-2">已有项目 {allProjects.length} 项</Badge></div>
                <div className="mt-5 flex flex-wrap gap-2">{allProjectCategories.map((item) => <Button key={item} type="button" size="sm" variant={category === item ? 'default' : 'outline'} onClick={() => setCategory(item)}>{item}</Button>)}</div>
                <p className="mt-4 text-sm text-slate-500">当前显示 {visibleProjects.length} 个已有项目</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProjects.map((project) => (
                    <article key={project.id} className="rounded-2xl border border-slate-200 p-4 hover:border-blue-300">
                      <div className="flex items-start justify-between gap-3"><div><Badge variant="secondary">{project.category}</Badge><h3 className="mt-3 text-lg font-bold leading-6">{project.name}</h3><p className="mt-2 text-sm text-slate-500">{project.tag} · {project.durationMinutes} 分钟</p></div><strong className="whitespace-nowrap text-lg text-blue-600">{money(project.price)}</strong></div>
                      <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => openDetail({ kind: 'project', project })}><Eye className="mr-1 size-4" />查看详情</Button><Button variant="outline" onClick={() => { addProject(project); setTab('package'); setCardMode('create'); }}><Plus className="mr-1 size-4" />加入卡项</Button></div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          <section>
            <div className="mb-5 flex flex-col gap-4 rounded-3xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div><p className="font-semibold text-blue-600">全部卡项</p><h2 className="mt-1 text-3xl font-bold">门店卡项库</h2><p className="mt-2 text-slate-500">新增卡项与已有卡项在同一界面切换。</p></div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1"><Button type="button" variant={cardMode === 'existing' ? 'default' : 'ghost'} onClick={() => setCardMode('existing')}>已有卡项</Button><Button type="button" variant={cardMode === 'create' ? 'default' : 'ghost'} onClick={() => setCardMode('create')}><Plus className="mr-1 size-4" />新增卡项</Button></div>
            </div>
            <div className={cardMode === 'create' ? 'grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]' : ''}>
            {cardMode === 'create' && (
            <div className="space-y-5 rounded-3xl border bg-white p-5 sm:p-7">
              <div><p className="font-semibold text-violet-600">新增卡项</p><h2 className="mt-1 text-3xl font-bold">组合一张套餐卡</h2><p className="mt-2 text-slate-500">先填写卡项信息，再从已有项目中逐个加入并设置次数。</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2"><Label>套餐卡名称</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：夏日焕肤活动卡" /></label>
                <label className="space-y-2"><Label>套餐分类</Label><Input value={packageCategory} onChange={(event) => setPackageCategory(event.target.value)} /></label>
                <label className="space-y-2"><Label>套餐售价</Label><Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></label>
                <label className="space-y-2"><Label>销售折扣%</Label><Input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
                <label className="space-y-2"><Label>有效天数</Label><Input inputMode="numeric" value={validDays} onChange={(event) => setValidDays(event.target.value)} /></label>
                <label className="space-y-2 sm:col-span-2"><Label>活动说明</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="适用人群、活动规则、使用限制等" /></label>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">套餐已选项目</h3><p className="text-sm text-violet-700">{components.length} 个项目 · 共 {components.reduce((sum, item) => sum + item.quantity, 0)} 次 · 原价值 {money(originalValue)}</p></div><Button type="button" variant="outline" onClick={() => setComponents([])} disabled={!components.length}>清空</Button></div>
                <div className="mt-4 space-y-2">
                  {components.map((item) => (
                    <div key={item.projectId} className="grid items-center gap-3 rounded-xl bg-white p-3 sm:grid-cols-[1fr_auto_auto]">
                      <div><b>{item.projectName}</b><p className="text-sm text-slate-500">{item.category} · {money(item.unitPriceExact)}/次</p></div>
                      <div className="flex items-center gap-2"><Button size="icon" variant="outline" onClick={() => changeQuantity(item.projectId, -1)}><Minus className="size-4" /></Button><strong className="min-w-12 text-center">{item.quantity} 次</strong><Button size="icon" variant="outline" onClick={() => changeQuantity(item.projectId, 1)}><Plus className="size-4" /></Button></div>
                      <Button size="icon" variant="ghost" onClick={() => setComponents((current) => current.filter((row) => row.projectId !== item.projectId))}><Trash2 className="size-5 text-red-500" /></Button>
                    </div>
                  ))}
                  {!components.length && <p className="rounded-xl bg-white p-8 text-center text-slate-500">暂未加入项目，请从下方选择已有项目。</p>}
                </div>
              </div>

              <div>
                <div className="relative"><Search className="absolute left-3 top-3 size-5 text-slate-400" /><Input className="pl-10" placeholder="搜索并加入已有项目" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
                <div className="mt-3 grid max-h-[440px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visibleProjects.map((project) => (
                    <button type="button" key={project.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:border-violet-400 hover:bg-violet-50" onClick={() => addProject(project)}><span><b className="block">{project.name}</b><small className="text-slate-500">{project.category} · {money(project.price)}</small></span><BadgePlus className="size-5 shrink-0 text-violet-600" /></button>
                  ))}
                </div>
              </div>
              <Button size="lg" className="w-full bg-violet-600 hover:bg-violet-700" disabled={saving || !name.trim() || Number(price) <= 0 || !components.length} onClick={() => void savePackage()}><PackageCheck className="mr-2 size-5" />{saving ? '正在保存卡项…' : '保存新卡项'}</Button>
            </div>
            )}

            <aside className="rounded-3xl border bg-white p-5 sm:p-7">
              <h2 className="text-2xl font-bold">已有卡项</h2><p className="mt-1 text-slate-500">每张卡都保留完整的项目组成、次数与销售口径。</p>
              <div className="mt-5 space-y-4">
                {packages.map((item) => (
                  <article key={item.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3"><div><Badge>{item.category}</Badge><h3 className="mt-2 text-xl font-bold">{item.name}</h3><p className="mt-1 text-xs text-slate-400">{item.packageNo}</p></div><strong className="text-xl text-violet-600">{money(item.retailPriceExact)}</strong></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2"><b className="block">{item.totalProjectCount}</b><small>项目</small></div><div className="rounded-lg bg-slate-50 p-2"><b className="block">{item.totalServiceCount}</b><small>总次数</small></div><div className="rounded-lg bg-amber-50 p-2"><b className="block text-amber-800">{item.soldCount}</b><small>已售</small></div><div className="rounded-lg bg-slate-50 p-2"><b className="block">{item.validDays || '长期'}</b><small>有效天</small></div></div>
                    <div className="mt-3 space-y-1">{item.components.map((component) => <div key={component.projectId} className="flex justify-between gap-3 text-sm"><span className="truncate">{component.projectName}</span><b>{component.quantity} 次</b></div>)}</div>
                    <p className="mt-3 border-t pt-3 text-sm text-slate-500">项目原价值 {money(item.originalValueExact)} · 销售折扣 {item.discountPercentExact}%</p>
                    <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => openDetail({ kind: 'package', package: item })}><Eye className="mr-2 size-4" />查看完整套餐详情</Button>
                  </article>
                ))}
                {!packages.length && <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500"><Layers3 className="mx-auto mb-3 size-10" />还没有套餐卡，请在左侧组合第一张。</div>}
              </div>
            </aside>
            </div>
          </section>
        )}
      </div>

      <Dialog open={detailView !== null} onOpenChange={(open) => { if (!open) setDetailView(null); }}>
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,1200px)] overflow-hidden p-0">
          <DialogHeader className="border-b bg-slate-50 px-5 py-5 pr-14 sm:px-7">
            <DialogTitle className="text-2xl sm:text-3xl">
              {detailView?.kind === 'single_summary' && '全部项目明细'}
              {detailView?.kind === 'package_summary' && '全部多次卡项 / 套餐卡明细'}
              {detailView?.kind === 'service_summary' && '套餐权益次数构成明细'}
              {detailView?.kind === 'sold_summary' && '套餐卡销售客户与使用明细'}
              {detailView?.kind === 'project' && detailView.project.name}
              {detailView?.kind === 'package' && detailView.package.name}
            </DialogTitle>
            <DialogDescription className="text-base leading-6">
              {detailView?.kind === 'single_summary' && `共 ${allProjects.length} 个门店服务项目，可搜索并逐项查看价格、分类和服务时长。`}
              {detailView?.kind === 'package_summary' && `共 ${packages.length} 张套餐卡，逐张显示售价、有效期、项目组成和次数。`}
              {detailView?.kind === 'service_summary' && `所有套餐共包含 ${packages.reduce((sum, item) => sum + item.totalServiceCount, 0)} 次服务权益。`}
              {detailView?.kind === 'sold_summary' && `累计售出 ${totalSoldCount} 张套餐卡，对应 ${totalSoldCustomerCount} 位客户；撤销、冲正与作废记录已排除。`}
              {detailView?.kind === 'project' && '项目完整资料'}
              {detailView?.kind === 'package' && '套餐卡完整组成与销售口径'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-132px)] overflow-y-auto px-5 py-5 sm:px-7">
            {detailView?.kind === 'single_summary' && (
              <div className="space-y-4">
                <div className="relative"><Search className="absolute left-3 top-3 size-5 text-slate-400" /><Input className="pl-10" placeholder="搜索项目名称、分类或管理类型" value={detailQuery} onChange={(event) => setDetailQuery(event.target.value)} /></div>
                <p className="font-medium text-slate-500">当前显示 {detailProjects.length} 个项目</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {detailProjects.map((project) => (
                    <button type="button" key={project.id} className="rounded-2xl border p-4 text-left transition hover:border-blue-400 hover:bg-blue-50" onClick={() => openDetail({ kind: 'project', project })}>
                      <div className="flex items-start justify-between gap-3"><Badge variant="secondary">{project.category}</Badge><strong className="text-blue-600">{money(project.price)}</strong></div>
                      <h3 className="mt-3 text-lg font-bold">{project.name}</h3>
                      <p className="mt-2 text-sm text-slate-500">{project.tag} · {project.durationMinutes} 分钟</p>
                      <span className="mt-3 flex items-center font-semibold text-blue-600">查看完整资料 <ChevronRight className="size-4" /></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detailView?.kind === 'package_summary' && (
              <div className="grid gap-4 md:grid-cols-2">
                {packages.map((cardPackage) => (
                  <button type="button" key={cardPackage.id} className="rounded-2xl border p-5 text-left transition hover:border-violet-400 hover:bg-violet-50" onClick={() => openDetail({ kind: 'package', package: cardPackage })}>
                    <div className="flex items-start justify-between gap-3"><div><Badge>{cardPackage.category}</Badge><h3 className="mt-2 text-xl font-bold">{cardPackage.name}</h3></div><strong className="text-xl text-violet-600">{money(cardPackage.retailPriceExact)}</strong></div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><span className="rounded-lg bg-slate-50 p-2"><b className="block">{cardPackage.totalProjectCount}</b><small>项目</small></span><span className="rounded-lg bg-slate-50 p-2"><b className="block">{cardPackage.totalServiceCount}</b><small>总次数</small></span><span className="rounded-lg bg-amber-50 p-2"><b className="block text-amber-800">{cardPackage.soldCount}</b><small>已售</small></span><span className="rounded-lg bg-slate-50 p-2"><b className="block">{cardPackage.validDays || '长期'}</b><small>有效天</small></span></div>
                    <span className="mt-4 flex items-center font-semibold text-violet-600">查看项目与次数 <ChevronRight className="size-4" /></span>
                  </button>
                ))}
                {!packages.length && <p className="rounded-2xl bg-slate-50 p-10 text-center text-slate-500 md:col-span-2">目前还没有已保存的套餐卡。</p>}
              </div>
            )}

            {detailView?.kind === 'service_summary' && (
              <div className="space-y-5">
                <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-emerald-50 p-4"><span className="text-emerald-700">套餐数量</span><strong className="mt-1 block text-3xl">{packages.length}</strong></div><div className="rounded-2xl bg-blue-50 p-4"><span className="text-blue-700">不同项目</span><strong className="mt-1 block text-3xl">{serviceBreakdown.length}</strong></div><div className="rounded-2xl bg-violet-50 p-4"><span className="text-violet-700">权益总次数</span><strong className="mt-1 block text-3xl">{packages.reduce((sum, item) => sum + item.totalServiceCount, 0)}</strong></div></section>
                <section><h3 className="text-xl font-bold">按服务项目汇总</h3><div className="mt-3 space-y-2">{serviceBreakdown.map((item) => <div key={item.projectId} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><b className="text-lg">{item.projectName}</b><p className="text-sm text-slate-500">{item.category} · {money(item.unitPriceExact)}/次</p></div><Badge variant="outline">涉及 {item.packageCount} 张套餐</Badge><strong className="text-xl text-emerald-600">{item.quantity} 次</strong></div>)}{!serviceBreakdown.length && <p className="rounded-2xl bg-slate-50 p-10 text-center text-slate-500">尚无套餐权益次数。</p>}</div></section>
                <section><h3 className="text-xl font-bold">按套餐卡汇总</h3><div className="mt-3 space-y-3">{packages.map((cardPackage) => <button type="button" key={cardPackage.id} className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left hover:border-violet-400" onClick={() => openDetail({ kind: 'package', package: cardPackage })}><span><b className="block text-lg">{cardPackage.name}</b><small className="text-slate-500">{cardPackage.totalProjectCount} 个项目</small></span><span className="flex items-center font-bold text-violet-600">{cardPackage.totalServiceCount} 次 <ChevronRight className="size-4" /></span></button>)}</div></section>
              </div>
            )}

            {detailView?.kind === 'sold_summary' && (
              <div className="space-y-5">
                <section className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-amber-50 p-4"><span className="text-amber-800">套餐卡累计售出</span><strong className="mt-1 block text-3xl">{totalSoldCount} 张</strong></div>
                  <div className="rounded-2xl bg-blue-50 p-4"><span className="text-blue-700">购买客户</span><strong className="mt-1 block text-3xl">{totalSoldCustomerCount} 位</strong></div>
                  <div className="rounded-2xl bg-violet-50 p-4"><span className="text-violet-700">产生销售的套餐</span><strong className="mt-1 block text-3xl">{packages.filter((item) => item.soldCount > 0).length} 张</strong></div>
                </section>
                <div className="relative"><Search className="absolute left-3 top-3 size-5 text-slate-400" /><Input className="pl-10" placeholder="搜索套餐、客户姓名、手机号或卡账户" value={detailQuery} onChange={(event) => setDetailQuery(event.target.value)} /></div>
                <div className="space-y-4">
                  {soldPackages.map((cardPackage) => (
                    <section key={cardPackage.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
                      <button type="button" className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between" onClick={() => openDetail({ kind: 'package', package: cardPackage })}>
                        <span><Badge>{cardPackage.category}</Badge><b className="mt-2 block text-2xl">{cardPackage.name}</b><small className="text-slate-500">{cardPackage.soldCustomerCount} 位客户</small></span>
                        <span className="flex items-center text-xl font-bold text-amber-800">售出 {cardPackage.soldCount} 张 <ChevronRight className="size-5" /></span>
                      </button>
                      <div className="mt-4 space-y-3">{cardPackage.customerUsage.map((usage) => <CustomerPackageUsageCard key={`${cardPackage.id}:${usage.accountId}`} usage={usage} />)}</div>
                    </section>
                  ))}
                  {!soldPackages.length && <div className="rounded-2xl bg-slate-50 p-10 text-center text-slate-500"><Users className="mx-auto mb-3 size-10" />没有找到对应的套餐销售客户。</div>}
                </div>
              </div>
            )}

            {detailView?.kind === 'project' && (
              <div className="space-y-5">
                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-blue-50 p-4"><span className="text-slate-500">单次售价</span><strong className="mt-2 block text-2xl text-blue-700">{money(detailView.project.price)}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-slate-500">项目分类</span><strong className="mt-2 block text-xl">{detailView.project.category}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-slate-500">服务类型</span><strong className="mt-2 block text-xl">{detailView.project.tag}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-slate-500">参考时长</span><strong className="mt-2 block text-xl">{detailView.project.durationMinutes} 分钟</strong></div></section>
                <section className="rounded-2xl border p-5"><h3 className="text-xl font-bold">卡项使用说明</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><p className="rounded-xl bg-blue-50 p-4"><b className="block text-blue-700">单独售卖</b><span className="mt-1 block text-slate-600">可作为一张单次项目卡建立给客户</span></p><p className="rounded-xl bg-violet-50 p-4"><b className="block text-violet-700">组合套餐</b><span className="mt-1 block text-slate-600">可按任意次数加入多次卡项</span></p><p className="rounded-xl bg-emerald-50 p-4"><b className="block text-emerald-700">消费核销</b><span className="mt-1 block text-slate-600">客户服务完成后可按次扣除</span></p></div></section>
                <Button className="w-full" onClick={() => { addProject(detailView.project); setDetailView(null); setTab('package'); setCardMode('create'); }}><Plus className="mr-2 size-5" />将本项目加入卡项草稿</Button>
              </div>
            )}

            {detailView?.kind === 'package' && (
              <div className="space-y-5">
                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-2xl bg-violet-50 p-4"><span className="text-slate-500">套餐售价</span><strong className="mt-2 block text-2xl text-violet-700">{money(detailView.package.retailPriceExact)}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-slate-500">项目原价值</span><strong className="mt-2 block text-xl">{money(detailView.package.originalValueExact)}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-slate-500">销售折扣</span><strong className="mt-2 block text-xl">{detailView.package.discountPercentExact}%</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-slate-500">有效期</span><strong className="mt-2 block text-xl">{detailView.package.validDays ? `${detailView.package.validDays} 天` : '长期有效'}</strong></div><div className="rounded-2xl bg-amber-50 p-4"><span className="text-amber-800">套餐售出数量</span><strong className="mt-2 block text-2xl text-amber-900">{detailView.package.soldCount} 张</strong><small className="text-amber-700">{detailView.package.soldCustomerCount} 位客户</small></div></section>
                <section className="rounded-2xl border p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">套餐项目与次数</h3><p className="mt-1 text-slate-500">{detailView.package.totalProjectCount} 个项目 · 共 {detailView.package.totalServiceCount} 次</p></div><Badge>{detailView.package.category}</Badge></div><div className="mt-4 space-y-2">{detailView.package.components.map((item) => <div key={item.projectId} className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><b className="text-lg">{item.projectName}</b><p className="text-sm text-slate-500">{item.category}</p></div><span>{money(item.unitPriceExact)}/次</span><strong className="text-xl text-violet-700">{item.quantity} 次</strong></div>)}</div></section>
                <section className="rounded-2xl border p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">购买客户与套餐使用情况</h3><p className="mt-1 text-slate-500">逐位客户显示购买、已使用、剩余及最近使用时间</p></div><Badge variant="secondary">{detailView.package.soldCustomerCount} 位客户</Badge></div><div className="mt-4 space-y-3">{detailView.package.customerUsage.map((usage) => <CustomerPackageUsageCard key={usage.accountId} usage={usage} />)}{!detailView.package.customerUsage.length && <p className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">这张套餐目前还没有有效售出记录。</p>}</div></section>
                <section className="rounded-2xl bg-amber-50 p-5"><h3 className="font-bold text-amber-800">活动说明</h3><p className="mt-2 leading-7 text-slate-700">{detailView.package.description || '未填写额外活动说明。'}</p><p className="mt-3 text-sm text-slate-500">卡号：{detailView.package.packageNo}</p></section>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
