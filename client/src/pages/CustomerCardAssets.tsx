import { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  Gift,
  History,
  Search,
  WalletCards,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@client/src/components/ui/accordion';
import { Input } from '@client/src/components/ui/input';
import type {
  CustomerCardAsset,
  CustomerCardAssetSummary,
  CustomerCardRight,
} from '@shared/api.interface';

interface CustomerCardAssetsProps {
  cards: CustomerCardAsset[];
  refunds: CustomerCardAsset[];
  summary: CustomerCardAssetSummary;
}

type CardStatusFilter = '全部' | '使用中' | '已过期';

function formatCurrency(value?: number): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const matched: RegExpMatchArray | null = value.match(/^\d{4}-\d{2}-\d{2}/u);
  return matched?.[0] || value;
}

function statusTone(status: string): string {
  if (status === '使用中') return 'active';
  if (status === '已过期') return 'expired';
  return 'neutral';
}

function CardRightItem({ right }: { right: CustomerCardRight }) {
  return (
    <article className="customer-card-right">
      <div>
        <strong>{right.name}</strong>
        <span>
          {right.gift === '是' ? '赠送权益' : right.type || '项目权益'}
        </span>
      </div>
      <div className="customer-card-right-counts">
        <b>{right.remaining ?? '—'}</b>
        <small>剩余 / 总计 {right.total ?? '—'} · 已用 {right.used ?? '—'}</small>
      </div>
    </article>
  );
}

function CardDetails({ card, refunded = false }: {
  card: CustomerCardAsset;
  refunded?: boolean;
}) {
  const hasBalance: boolean = [
    card.principalBalance,
    card.giftBalance,
    card.sessionBalance,
  ].some((value: number | undefined) => value !== undefined);
  return (
    <div className="customer-card-detail">
      <div className="customer-card-meta-grid">
        <article>
          <small>分类 / 类型</small>
          <strong>{card.category || '未分类'} · {card.cardType || '卡类型待确认'}</strong>
        </article>
        <article>
          <small>{refunded ? '退款关联金额' : '实付金额'}</small>
          <strong>{formatCurrency(card.paidAmount)}</strong>
        </article>
        <article>
          <small>开卡时间</small>
          <strong>{formatDate(card.acquiredAt)}</strong>
        </article>
        <article>
          <small>有效期</small>
          <strong>{card.validity || '待确认'}</strong>
        </article>
      </div>

      {hasBalance && (
        <div className="customer-card-balance-grid">
          <span><small>本金余额</small><b>{formatCurrency(card.principalBalance)}</b></span>
          <span><small>赠送余额</small><b>{formatCurrency(card.giftBalance)}</b></span>
          <span><small>次卡余额</small><b>{formatCurrency(card.sessionBalance)}</b></span>
          <span><small>剩余次数</small><b>{card.sessionRemaining ?? 0} 次</b></span>
        </div>
      )}

      {(card.cardNumber || card.accountNumber) && (
        <div className="customer-card-identifier">
          <CreditCard />
          <span>
            {card.cardNumber ? `卡号 ${card.cardNumber}` : ''}
            {card.cardNumber && card.accountNumber ? ' · ' : ''}
            {card.accountNumber ? `账户 ${card.accountNumber}` : ''}
          </span>
        </div>
      )}

      {card.rights.length > 0 ? (
        <div className="customer-card-right-list">
          <div className="customer-card-subhead">
            <strong>卡内项目权益</strong>
            <span>{card.rights.length} 项</span>
          </div>
          {card.rights.map((right: CustomerCardRight, index: number) => (
            <CardRightItem
              key={`${card.sourceKey}-${right.name}-${index}`}
              right={right}
            />
          ))}
        </div>
      ) : (
        <div className="customer-card-empty-rights">该账户没有独立项目权益</div>
      )}
    </div>
  );
}

export default function CustomerCardAssets({
  cards,
  refunds,
  summary,
}: CustomerCardAssetsProps) {
  const [query, setQuery] = useState<string>('');
  const [status, setStatus] = useState<CardStatusFilter>('全部');
  const normalizedQuery: string = query.trim().toLocaleLowerCase('zh-CN');
  const visibleCards: CustomerCardAsset[] = useMemo(
    () => cards.filter((card: CustomerCardAsset) => {
      if (status !== '全部' && card.status !== status) return false;
      if (!normalizedQuery) return true;
      return [
        card.cardName,
        card.category,
        card.cardType,
        card.status,
        card.cardNumber,
        card.accountNumber,
        ...card.rights.map((right: CustomerCardRight) => right.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedQuery);
    }),
    [cards, normalizedQuery, status],
  );

  if (cards.length === 0 && refunds.length === 0) return null;

  const filters: Array<{ label: CardStatusFilter; count: number }> = [
    { label: '全部', count: summary.total },
    { label: '使用中', count: summary.active },
    { label: '已过期', count: summary.expired },
  ];

  return (
    <section className="customer-card-assets">
      <div className="customer-card-assets-head">
        <div>
          <span className="asset-dialog-kicker"><WalletCards /> 门店独立卡资产</span>
          <h3>储值、次卡与全部历史卡项</h3>
          <p>真实卡名、原分类、余额和权益明细；过期卡项可继续查询。</p>
        </div>
        <div className="customer-card-summary">
          <span><b>{summary.active}</b><small>使用中</small></span>
          <span><b>{summary.expired}</b><small>已过期</small></span>
          <span><b>{summary.refunded}</b><small>退款审计</small></span>
        </div>
      </div>

      <div className="customer-card-toolbar">
        <div className="customer-card-search">
          <Search />
          <Input
            aria-label="搜索卡名、分类、卡号或项目权益"
            placeholder="搜索卡名、分类、卡号或项目权益"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="customer-card-filters">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.label}
              className={status === filter.label ? 'active' : ''}
              onClick={() => setStatus(filter.label)}
            >
              {filter.label} <span>{filter.count}</span>
            </button>
          ))}
        </div>
      </div>

      {visibleCards.length > 0 ? (
        <Accordion
          type="multiple"
          className="customer-card-accordion"
          defaultValue={visibleCards
            .filter((card: CustomerCardAsset) => card.status === '使用中')
            .slice(0, 2)
            .map((card: CustomerCardAsset) => card.sourceKey)}
        >
          {visibleCards.map((card: CustomerCardAsset) => (
            <AccordionItem key={card.sourceKey} value={card.sourceKey}>
              <AccordionTrigger className="customer-card-trigger">
                <span className="customer-card-trigger-icon"><CreditCard /></span>
                <span className="customer-card-trigger-main">
                  <strong>{card.cardName}</strong>
                  <small>
                    {card.category || '未分类'} · {card.cardType || '类型待确认'}
                    {card.validity ? ` · ${card.validity}` : ''}
                  </small>
                </span>
                <span className={`customer-card-status ${statusTone(card.status)}`}>
                  {card.status}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <CardDetails card={card} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="customer-card-no-result">没有匹配的卡项或权益</div>
      )}

      {refunds.length > 0 && (
        <div className="customer-card-refunds">
          <div className="customer-card-subhead">
            <span><History /> 退款审计记录</span>
            <b>{refunds.length} 条</b>
          </div>
          <Accordion type="multiple">
            {refunds.map((card: CustomerCardAsset) => (
              <AccordionItem
                key={`refund-${card.sourceKey}`}
                value={`refund-${card.sourceKey}`}
              >
                <AccordionTrigger className="customer-card-trigger refund">
                  <span className="customer-card-trigger-icon"><BadgeDollarSign /></span>
                  <span className="customer-card-trigger-main">
                    <strong>{card.cardName}</strong>
                    <small>{card.category || '未分类'} · {formatDate(card.acquiredAt)}</small>
                  </span>
                  <span className="customer-card-status refunded">已退款</span>
                </AccordionTrigger>
                <AccordionContent>
                  <CardDetails card={card} refunded />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      <div className="customer-card-footnote">
        <CalendarClock /> 历史卡项已作为独立卡账的期初基准完整保留
        <Gift /> 赠送权益与实付权益分开标识
      </div>
    </section>
  );
}
