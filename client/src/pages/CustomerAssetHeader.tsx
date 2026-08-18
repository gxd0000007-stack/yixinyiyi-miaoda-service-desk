import { ArrowLeft, Plus, ShieldCheck } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';

interface CustomerAssetHeaderProps {
  latestSyncedAt?: string;
  onBack: () => void;
  onCreate: () => void;
}

function formatSyncTime(value?: string): string {
  if (!value) return '尚未同步';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function CustomerAssetHeader({
  latestSyncedAt,
  onBack,
  onCreate,
}: CustomerAssetHeaderProps) {
  return (
    <div className="asset-page-head">
      <div className="asset-title-row">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft /> 返回工作台
        </Button>
        <div>
          <div className="asset-eyebrow">老板专属 · 客户资产管理后台</div>
          <h1>客户资料库</h1>
          <p>
            汇总客户、余额、全部卡项权益与客户画像，统一支撑预约、诊断、服务流程与跟进维护。
          </p>
        </div>
      </div>
      <div className="asset-head-actions">
        <div className="asset-source-badge">
          <ShieldCheck />
          <span>
            <strong>独立卡资产 + 客户画像</strong>
            <small>最近同步 {formatSyncTime(latestSyncedAt)}</small>
          </span>
        </div>
        <Button className="asset-create-button" onClick={onCreate}>
          <Plus /> 新增客户
        </Button>
      </div>
    </div>
  );
}
