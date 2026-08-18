import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Database,
  FolderOpen,
  HeartPulse,
  LoaderCircle,
  PencilLine,
  ReceiptText,
  UserRound,
  WalletCards,
} from 'lucide-react';

import StructuredContent from '@client/src/components/StructuredContent';
import CustomerAvatar from '@client/src/components/CustomerAvatar';
import CustomerMembershipBadge from '@client/src/components/CustomerMembershipBadge';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import type {
  CustomerAssetDetail,
  CustomerAssetProfileGroup,
} from '@shared/api.interface';
import CustomerCardAssets from './CustomerCardAssets';
import CustomerLedger from './CustomerLedger';

type DetailModule = 'overview' | 'ledger' | 'cards' | 'service' | 'profile';

interface CustomerAssetDetailDialogProps {
  open: boolean;
  loading: boolean;
  detail: CustomerAssetDetail | null;
  onOpenChange: (open: boolean) => void;
  onSupplement: (id: string) => void;
}

interface ModuleDefinition {
  id: Exclude<DetailModule, 'overview'>;
  title: string;
  description: string;
  icon: typeof ReceiptText;
  tone: string;
}

const DETAIL_MODULES: ModuleDefinition[] = [
  {
    id: 'ledger',
    title: '消费账本',
    description: '每一笔消费、项目核销、金额组成和优惠券',
    icon: ReceiptText,
    tone: 'blue',
  },
  {
    id: 'cards',
    title: '卡项与权益',
    description: '卡金余额、套餐项目、剩余次数和过期卡项',
    icon: WalletCards,
    tone: 'purple',
  },
  {
    id: 'service',
    title: '服务画像',
    description: '肤况、项目偏好、沟通偏好和服务风险',
    icon: HeartPulse,
    tone: 'orange',
  },
  {
    id: 'profile',
    title: '完整客户档案',
    description: '基础资料、健康信息、来源与全部真实字段',
    icon: FolderOpen,
    tone: 'green',
  },
];

function formatCurrency(value?: string, fallback?: number): string {
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

export default function CustomerAssetDetailDialog({
  open,
  loading,
  detail,
  onOpenChange,
  onSupplement,
}: CustomerAssetDetailDialogProps) {
  const [activeModule, setActiveModule] = useState<DetailModule>('overview');

  useEffect(() => {
    if (open) setActiveModule('overview');
  }, [detail?.id, open]);

  const activeDefinition: ModuleDefinition | undefined = DETAIL_MODULES.find(
    (item: ModuleDefinition) => item.id === activeModule,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="asset-detail-dialog">
        {loading && (
          <div className="asset-detail-loading">
            <LoaderCircle className="asset-spin" /> 正在加载完整客户档案…
          </div>
        )}

        {!loading && !detail && (
          <div className="asset-detail-loading">
            <UserRound /> 暂未读取到客户档案
          </div>
        )}

        {!loading && detail && (
          <>
            <DialogHeader className="asset-detail-dialog-head">
              <div className="asset-profile-title">
                <CustomerAvatar
                  name={detail.name}
                  customerId={detail.id}
                  avatarPreset={detail.avatarPreset}
                  avatarUrl={detail.avatarUrl}
                  size={54}
                  className="asset-avatar large"
                />
                <div>
                  <div className="asset-profile-name">
                    <DialogTitle>{detail.name}</DialogTitle>
                    <CustomerMembershipBadge
                      memberLevel={detail.memberLevel}
                      cardNames={detail.cardAssets.map((card): string => card.cardName)}
                    />
                  </div>
                  <DialogDescription>
                    {detail.nickname ? `昵称 ${detail.nickname} · ` : ''}
                    {detail.mobile || '手机号待补充'} · 来源 {detail.initialSource || '待补充'}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSupplement(detail.id)}
              >
                <PencilLine /> 补充档案
              </Button>
            </DialogHeader>

            <div className="asset-detail-dialog-body">
              {activeModule === 'overview' ? (
                <>
                  <section className="asset-finance-strip asset-detail-finance">
                    <article>
                      <small>累计消费</small>
                      <strong>{formatCurrency(detail.totalSpendExact, detail.totalSpend)}</strong>
                    </article>
                    <article>
                      <small>当前卡金余额</small>
                      <strong>{formatCurrency(detail.currentBalanceExact, detail.currentBalance)}</strong>
                    </article>
                    <article>
                      <small>服务员工</small>
                      <strong>{detail.serviceStaff.join('、') || '待分配'}</strong>
                    </article>
                    <article>
                      <small>档案完整度</small>
                      <strong>{detail.profileCompleteness}%</strong>
                    </article>
                  </section>

                  <section className="asset-detail-source">
                    <Database />
                    <div>
                      <strong>客户资产与画像已统一关联</strong>
                      <small>消费、卡项、服务画像和完整档案分别进入对应窗口查看。</small>
                    </div>
                  </section>

                  <section className="asset-detail-module-grid" data-ai-section-type="card-menu">
                    {DETAIL_MODULES.map((module: ModuleDefinition) => {
                      const Icon = module.icon;
                      return (
                        <button
                          key={module.id}
                          type="button"
                          className={`asset-detail-module ${module.tone}`}
                          onClick={() => setActiveModule(module.id)}
                        >
                          <span><Icon /></span>
                          <div>
                            <strong>{module.title}</strong>
                            <small>{module.description}</small>
                          </div>
                          <ChevronRight />
                        </button>
                      );
                    })}
                  </section>
                </>
              ) : (
                <section className="asset-detail-module-view">
                  <div className="asset-detail-module-head">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveModule('overview')}
                    >
                      <ArrowLeft /> 返回资料概览
                    </Button>
                    <div>
                      <h2>{activeDefinition?.title}</h2>
                      <p>{activeDefinition?.description}</p>
                    </div>
                  </div>

                  {activeModule === 'ledger' && (
                    <CustomerLedger customerId={detail.id} />
                  )}
                  {activeModule === 'cards' && (
                    <CustomerCardAssets
                      cards={detail.cardAssets}
                      refunds={detail.refundRecords}
                      summary={detail.cardAssetSummary}
                    />
                  )}
                  {activeModule === 'service' && (
                    <section className="asset-service-intelligence asset-detail-service">
                      <div className="asset-intelligence-head">
                        <Activity />
                        <div>
                          <h3>前端服务调用摘要</h3>
                          <p>预约和服务流程优先读取以下真实信息</p>
                        </div>
                      </div>
                      <div className="asset-intelligence-grid">
                        <article>
                          <small>主要肤况</small>
                          <StructuredContent
                            value={detail.primarySkinConcerns.join('、') || '暂无记录'}
                            compact
                          />
                        </article>
                        <article>
                          <small>项目需求</small>
                          <StructuredContent
                            value={detail.projectPreferences.join('、') || '暂无记录'}
                            compact
                          />
                        </article>
                        <article className={detail.serviceRisks.length > 0 ? 'warning' : ''}>
                          <small>服务雷区</small>
                          <StructuredContent
                            value={detail.serviceRisks.join('、') || '暂无特殊雷区'}
                            compact
                          />
                        </article>
                      </div>
                    </section>
                  )}
                  {activeModule === 'profile' && (
                    <div className="asset-profile-groups asset-detail-profile-groups">
                      {detail.profileGroups.map((group: CustomerAssetProfileGroup) => (
                        <section key={group.id} className="asset-profile-group">
                          <div className="asset-group-head">
                            <div>
                              <h3>{group.title}</h3>
                              <p>{group.description}</p>
                            </div>
                            <span>{group.items.length} 项</span>
                          </div>
                          <dl>
                            {group.items.map((item) => (
                              <div key={`${group.id}-${item.label}`}>
                                <dt>{item.label}</dt>
                                <dd>
                                  <StructuredContent
                                    value={item.value}
                                    compact={item.value.length < 80}
                                  />
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
