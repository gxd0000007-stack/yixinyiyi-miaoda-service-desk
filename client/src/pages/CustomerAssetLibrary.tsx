import { useEffect, useState } from 'react';
import {
  Database,
  FolderSearch,
  Plus,
  Sparkles,
  UserRoundPlus,
  Users,
  WalletCards,
} from 'lucide-react';

import {
  createCustomerAsset,
  getCustomerAssetDetail,
  getCustomerAssetSegments,
  getCustomerAssets,
  updateCustomerAssetSupplement,
} from '@client/src/api';
import type {
  CreateCustomerAssetRequest,
  CustomerAssetDetail,
  CustomerAssetSegmentsResponse,
  CustomerAssetsResponse,
  UpdateCustomerAssetSupplementRequest,
} from '@shared/api.interface';
import CustomerAssetDetailDialog from './CustomerAssetDetailDialog';
import CustomerAssetDirectoryDialog from './CustomerAssetDirectoryDialog';
import {
  CustomerSegmentDialog,
  CustomerSupplementDialog,
  type CustomerSegmentMode,
} from './CustomerAssetDialogs';
import CustomerAssetHeader from './CustomerAssetHeader';
import CustomerCreateDialog from './CustomerCreateDialog';
import '../customer-assets.css';

interface CustomerAssetLibraryProps {
  onBack: () => void;
  initialQuery?: string;
}

const DIRECTORY_PAGE_SIZE = 12;

export default function CustomerAssetLibrary({
  onBack,
  initialQuery = '',
}: CustomerAssetLibraryProps) {
  const [draftQuery, setDraftQuery] = useState<string>(initialQuery);
  const [query, setQuery] = useState<string>(initialQuery);
  const [page, setPage] = useState<number>(1);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [data, setData] = useState<CustomerAssetsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [directoryOpen, setDirectoryOpen] = useState<boolean>(Boolean(initialQuery));

  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<CustomerAssetDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const [segmentOpen, setSegmentOpen] = useState<boolean>(false);
  const [segmentMode, setSegmentMode] =
    useState<CustomerSegmentMode>('highValue');
  const [segments, setSegments] =
    useState<CustomerAssetSegmentsResponse | null>(null);
  const [segmentLoading, setSegmentLoading] = useState<boolean>(false);
  const [segmentError, setSegmentError] = useState<string>('');

  const [supplementOpen, setSupplementOpen] = useState<boolean>(false);
  const [supplementAsset, setSupplementAsset] =
    useState<CustomerAssetDetail | null>(null);
  const [supplementSaving, setSupplementSaving] = useState<boolean>(false);
  const [supplementError, setSupplementError] = useState<string>('');

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [createSaving, setCreateSaving] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(draftQuery.trim());
      setPage(1);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getCustomerAssets({ query, page, pageSize: DIRECTORY_PAGE_SIZE })
      .then((response: CustomerAssetsResponse) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) setError('客户资料库加载失败，请刷新后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, reloadKey]);

  useEffect(() => {
    if (!selectedId || !detailOpen) return;
    let active = true;
    setDetailLoading(true);
    getCustomerAssetDetail(selectedId)
      .then((response) => {
        if (active) setDetail(response.asset);
      })
      .catch(() => {
        if (active) setError('客户详情加载失败，请重新选择客户。');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detailOpen, selectedId]);

  const totalPages: number = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  const openCustomerDetail = (id: string): void => {
    if (detail?.id !== id) setDetail(null);
    setSelectedId(id);
    setDirectoryOpen(false);
    setSegmentOpen(false);
    setDetailOpen(true);
  };

  const openSegment = (mode: CustomerSegmentMode): void => {
    setSegmentMode(mode);
    setSegmentOpen(true);
    if (segments || segmentLoading) return;
    setSegmentError('');
    setSegmentLoading(true);
    getCustomerAssetSegments()
      .then((response: CustomerAssetSegmentsResponse) => setSegments(response))
      .catch(() => setSegmentError('客户名单加载失败，请刷新后重试。'))
      .finally(() => setSegmentLoading(false));
  };

  const openSupplement = (id: string): void => {
    setSupplementOpen(true);
    setSupplementError('');
    if (detail?.id === id) {
      setSupplementAsset(detail);
      return;
    }
    setSupplementAsset(null);
    getCustomerAssetDetail(id)
      .then((response) => setSupplementAsset(response.asset))
      .catch(() => setSupplementError('客户详情加载失败，请稍后重试。'));
  };

  const saveSupplement = async (
    request: UpdateCustomerAssetSupplementRequest,
  ): Promise<void> => {
    if (!supplementAsset) return;
    setSupplementSaving(true);
    setSupplementError('');
    try {
      const response = await updateCustomerAssetSupplement(
        supplementAsset.id,
        request,
      );
      setSupplementAsset(response.asset);
      if (selectedId === response.asset.id) setDetail(response.asset);
      setSegments(null);
      setReloadKey((current: number) => current + 1);
      setSupplementOpen(false);
    } catch {
      setSupplementError('保存失败，请检查网络后重试。');
    } finally {
      setSupplementSaving(false);
    }
  };

  const saveNewCustomer = async (
    request: CreateCustomerAssetRequest,
  ): Promise<void> => {
    setCreateSaving(true);
    setCreateError('');
    try {
      const response = await createCustomerAsset(request);
      setDraftQuery(response.asset.name);
      setQuery(response.asset.name);
      setPage(1);
      setSelectedId(response.asset.id);
      setDetail(response.asset);
      setSegments(null);
      setReloadKey((current: number) => current + 1);
      setCreateOpen(false);
      setDetailOpen(true);
    } catch {
      setCreateError('保存失败；如果手机号已存在，请搜索原客户后补充档案。');
    } finally {
      setCreateSaving(false);
    }
  };

  const showCreateDialog = (): void => {
    setCreateError('');
    setCreateOpen(true);
  };

  return (
    <section className="customer-library-page customer-library-compact">
      <CustomerAssetHeader
        latestSyncedAt={data?.stats.latestSyncedAt}
        onBack={onBack}
        onCreate={showCreateDialog}
      />

      <div className="asset-stat-grid" data-ai-section-type="card-stat">
        <button
          type="button"
          className="asset-stat-card interactive"
          onClick={() => setDirectoryOpen(true)}
        >
          <span className="asset-stat-icon blue"><Users /></span>
          <div><small>客户资产总量</small><strong>{data?.stats.total ?? 0}</strong></div>
          <em>点击查找客户</em>
        </button>
        <button
          type="button"
          className="asset-stat-card interactive"
          onClick={() => setDirectoryOpen(true)}
        >
          <span className="asset-stat-icon purple"><WalletCards /></span>
          <div><small>已识别会员</small><strong>{data?.stats.memberCount ?? 0}</strong></div>
          <em>点击查看会员档案</em>
        </button>
        <button
          type="button"
          className="asset-stat-card interactive"
          onClick={() => openSegment('highValue')}
        >
          <span className="asset-stat-icon orange"><Sparkles /></span>
          <div><small>高价值客户</small><strong>{data?.stats.highValueCount ?? 0}</strong></div>
          <em>点击查看独立名单</em>
        </button>
        <button
          type="button"
          className="asset-stat-card interactive"
          onClick={() => openSegment('incomplete')}
        >
          <span className="asset-stat-icon green"><Database /></span>
          <div>
            <small>平均档案完整度</small>
            <strong>{data?.stats.averageCompleteness ?? 0}%</strong>
          </div>
          <em>点击查看待补资料</em>
        </button>
      </div>

      <section className="asset-home-menu">
        <div className="asset-home-menu-head">
          <div>
            <span>客户资料库 · 一级入口</span>
            <h2>选择要处理的客户工作</h2>
            <p>首页不再连续展开长内容；每个入口都会打开独立窗口。</p>
          </div>
          <strong>4 个清晰入口</strong>
        </div>
        <div className="asset-home-menu-grid" data-ai-section-type="card-menu">
          <button type="button" onClick={() => setDirectoryOpen(true)}>
            <span className="blue"><FolderSearch /></span>
            <div><strong>查找客户</strong><small>搜索客户并查看完整档案</small></div>
          </button>
          <button type="button" onClick={() => openSegment('highValue')}>
            <span className="orange"><Sparkles /></span>
            <div><strong>高价值客户</strong><small>进入按消费排序的客户名单</small></div>
          </button>
          <button type="button" onClick={() => openSegment('incomplete')}>
            <span className="green"><Database /></span>
            <div><strong>档案待完善</strong><small>查看缺失字段并直接补充</small></div>
          </button>
          <button type="button" onClick={showCreateDialog}>
            <span className="purple"><UserRoundPlus /></span>
            <div><strong>新增客户</strong><small>建立新的客户资产档案</small></div>
            <Plus />
          </button>
        </div>
      </section>

      <CustomerAssetDirectoryDialog
        open={directoryOpen}
        loading={loading}
        error={error}
        data={data}
        query={draftQuery}
        page={page}
        totalPages={totalPages}
        onOpenChange={setDirectoryOpen}
        onQueryChange={setDraftQuery}
        onPageChange={setPage}
        onRefresh={() => setReloadKey((current: number) => current + 1)}
        onSelect={openCustomerDetail}
      />
      <CustomerAssetDetailDialog
        open={detailOpen}
        loading={detailLoading}
        detail={detail}
        onOpenChange={setDetailOpen}
        onSupplement={openSupplement}
      />
      <CustomerSegmentDialog
        open={segmentOpen}
        mode={segmentMode}
        loading={segmentLoading}
        error={segmentError}
        data={segments}
        onOpenChange={setSegmentOpen}
        onSelect={openCustomerDetail}
        onSupplement={(id: string) => {
          setSegmentOpen(false);
          openSupplement(id);
        }}
      />
      <CustomerSupplementDialog
        open={supplementOpen}
        asset={supplementAsset}
        saving={supplementSaving}
        error={supplementError}
        onOpenChange={setSupplementOpen}
        onSave={saveSupplement}
      />
      <CustomerCreateDialog
        open={createOpen}
        saving={createSaving}
        error={createError}
        onOpenChange={setCreateOpen}
        onSave={saveNewCustomer}
      />
    </section>
  );
}
