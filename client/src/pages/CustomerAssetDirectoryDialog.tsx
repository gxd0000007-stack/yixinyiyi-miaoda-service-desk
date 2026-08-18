import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCcw,
  Search,
  UserRound,
} from 'lucide-react';

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
  CustomerAssetsResponse,
  CustomerAssetSummary,
} from '@shared/api.interface';

interface CustomerAssetDirectoryDialogProps {
  open: boolean;
  loading: boolean;
  error: string;
  data: CustomerAssetsResponse | null;
  query: string;
  page: number;
  totalPages: number;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
}

function formatExactCurrency(value?: string, fallback?: number): string {
  if (!value) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(fallback || 0);
  }
  const matched: RegExpMatchArray | null = value.match(
    /^(-?)(\d+)(?:\.(\d+))?$/u,
  );
  if (!matched) return `¥${value}`;
  const grouped: string = matched[2].replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return `${matched[1] || ''}¥${grouped}.${`${matched[3] || ''}00`.slice(0, 2)}`;
}

export default function CustomerAssetDirectoryDialog({
  open,
  loading,
  error,
  data,
  query,
  page,
  totalPages,
  onOpenChange,
  onQueryChange,
  onPageChange,
  onRefresh,
  onSelect,
}: CustomerAssetDirectoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="asset-directory-dialog">
        <DialogHeader className="asset-directory-header">
          <div className="asset-dialog-kicker"><UserRound />客户索引</div>
          <DialogTitle>查找客户并进入独立档案</DialogTitle>
          <DialogDescription>
            按累计消费从高到低排列；搜索姓名、手机号、会员或来源后，点击客户查看对应模块。
          </DialogDescription>
        </DialogHeader>

        <div className="asset-directory-toolbar">
          <div className="asset-directory-search">
            <Search />
            <Input
              aria-label="搜索客户姓名、手机号、会员或来源"
              placeholder="搜索姓名、手机号、会员或来源"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="刷新客户资料库"
            onClick={onRefresh}
          >
            <RefreshCcw />
          </Button>
          <span>{data?.total || 0} 位客户</span>
        </div>

        <div className="asset-directory-body">
          {loading && (
            <div className="asset-dialog-state">
              <LoaderCircle className="asset-spin" /> 正在读取客户资产…
            </div>
          )}
          {!loading && error && (
            <div className="asset-dialog-state error">
              <AlertTriangle /> {error}
            </div>
          )}
          {!loading && !error && data?.items.length === 0 && (
            <div className="asset-dialog-state">没有找到匹配客户</div>
          )}
          {!loading && !error && (
            <div className="asset-directory-grid" data-ai-section-type="card-list">
              {data?.items.map((item: CustomerAssetSummary) => (
                <button
                  type="button"
                  key={item.id}
                  className="asset-directory-person"
                  onClick={() => onSelect(item.id)}
                >
                  <span className="asset-directory-person-head">
                    <CustomerAvatar
                      name={item.name}
                      customerId={item.id}
                      avatarPreset={item.avatarPreset}
                      avatarUrl={item.avatarUrl}
                      size={38}
                      className="asset-avatar"
                    />
                    <span>
                      <span className="customer-name-membership-row">
                        <strong>{item.name}</strong>
                        <CustomerMembershipBadge memberLevel={item.memberLevel} compact />
                      </span>
                      <small>{item.mobile || '手机号待补充'}</small>
                    </span>
                  </span>
                  <span className="asset-directory-tags">
                    {item.tags.slice(0, 2).map((tag: string) => (
                      <i key={`${item.id}-${tag}`}>{tag}</i>
                    ))}
                  </span>
                  <span className="asset-directory-metrics">
                    <span>
                      <small>累计消费</small>
                      <b>{formatExactCurrency(item.totalSpendExact, item.totalSpend)}</b>
                    </span>
                    <span>
                      <small>档案完整度</small>
                      <b>{item.profileCompleteness}%</b>
                    </span>
                  </span>
                  <span className="asset-directory-action">
                    查看完整档案 <ChevronRight />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="asset-directory-pagination">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span>第 {page} / {totalPages} 页</span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
