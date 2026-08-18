import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  DatabaseZap,
  Gift,
  History,
  Search,
  ShoppingBag,
  TicketCheck,
  WalletCards,
} from 'lucide-react';

import { getCustomerLedger } from '@client/src/api';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@client/src/components/ui/accordion';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import type {
  CustomerCoupon,
  CustomerLedgerFilter,
  CustomerLedgerResponse,
  CustomerTransaction,
  CustomerTransactionItem,
} from '@shared/api.interface';

interface CustomerLedgerProps {
  customerId: string;
}

const FILTERS: Array<{ value: CustomerLedgerFilter; label: string }> = [
  { value: 'all', label: '全部记录' },
  { value: 'service', label: '项目消费' },
  { value: 'card', label: '售卡 / 升卡' },
  { value: 'recharge', label: '充值' },
  { value: 'online', label: '网店' },
];

function formatMoneyExact(value?: string): string {
  if (!value) return '—';
  const matched: RegExpMatchArray | null = value.match(/^(-?)(\d+)(?:\.(\d+))?$/u);
  if (!matched) return `¥${value}`;
  const grouped: string = matched[2].replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  const fraction: string = `${matched[3] || ''}00`.slice(0, 2);
  return `${matched[1] || ''}¥${grouped}.${fraction}`;
}

function formatQuantity(value?: string): string {
  if (!value) return '—';
  return value.replace(/\.0+$/u, '').replace(/(\.\d*?)0+$/u, '$1');
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function orderTone(type?: string): string {
  if (type?.includes('品项')) return 'service';
  if (type?.includes('充值')) return 'recharge';
  if (type?.includes('售卡') || type?.includes('升卡')) return 'card';
  return 'online';
}

function ItemDetail({ item }: { item: CustomerTransactionItem }) {
  const deductions: Array<[string, string]> = Object.entries(item.deductions);
  return (
    <article className="ledger-item-card">
      <div className="ledger-item-name">
        <span>{item.lineNo}</span>
        <div>
          <strong>{item.itemName}</strong>
          <small>{item.itemCategory || '项目类型待识别'}</small>
        </div>
      </div>
      <div className="ledger-item-metrics">
        <span><small>项目单价</small><b>{formatMoneyExact(item.unitPriceExact)}</b></span>
        <span><small>数量</small><b>{formatQuantity(item.quantityExact)}</b></span>
        <span><small>实际金额</small><b>{formatMoneyExact(item.actualAmountExact)}</b></span>
        <span><small>服务技师</small><b>{item.artisan || '—'}</b></span>
        <span><small>销售员工</small><b>{item.salesperson || '—'}</b></span>
        <span><small>状态</small><b>{item.status || '—'}</b></span>
      </div>
      {(item.paymentMethod || deductions.length > 0) && (
        <div className="ledger-item-payment">
          {item.paymentMethod && <span>支付：{item.paymentMethod}</span>}
          {deductions.map(([name, amount]: [string, string]) => (
            <span key={name}>{name}：{formatMoneyExact(amount)}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function TransactionDetail({ transaction }: { transaction: CustomerTransaction }) {
  const deductions: Array<[string, string]> = Object.entries(transaction.deductions);
  return (
    <div className="ledger-order-detail">
      <div className="ledger-order-payment-grid">
        <article>
          <small>支付方式</small>
          <strong>{transaction.paymentMethod || '未单独标注'}</strong>
        </article>
        <article>
          <small>金额组成</small>
          <strong>{transaction.amountDetail || formatMoneyExact(transaction.actualAmountExact)}</strong>
        </article>
        <article>
          <small>发生门店</small>
          <strong>{transaction.store || '门店待识别'}</strong>
        </article>
        <article>
          <small>订单状态</small>
          <strong>{transaction.status || '状态待识别'}</strong>
        </article>
      </div>

      {deductions.length > 0 && (
        <div className="ledger-deduction-row">
          <span>本单权益核销</span>
          {deductions.map(([name, amount]: [string, string]) => (
            <b key={name}>{name} {formatMoneyExact(amount)}</b>
          ))}
        </div>
      )}

      <div className="ledger-item-list">
        <div className="ledger-subhead">
          <span><ShoppingBag /> 本单项目明细</span>
          <b>{transaction.items.length} 项</b>
        </div>
        {transaction.items.map((item: CustomerTransactionItem) => (
          <ItemDetail key={item.id} item={item} />
        ))}
      </div>

      {transaction.remark && (
        <div className="ledger-order-remark">
          <strong>订单备注</strong>
          <p>{transaction.remark}</p>
        </div>
      )}
    </div>
  );
}

export default function CustomerLedger({ customerId }: CustomerLedgerProps) {
  const [draftQuery, setDraftQuery] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<CustomerLedgerFilter>('all');
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<CustomerLedgerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(draftQuery.trim());
      setPage(1);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  useEffect(() => {
    setDraftQuery('');
    setQuery('');
    setFilter('all');
    setPage(1);
  }, [customerId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getCustomerLedger({ id: customerId, query, filter, page, pageSize: 12 })
      .then((response: CustomerLedgerResponse) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) setError('逐笔消费账本加载失败，请刷新后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId, filter, page, query]);

  const totalPages: number = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  const verified: boolean = Boolean(
    data?.audit &&
    data.audit.balanceErrorCount === 0 &&
    data.audit.identityErrorCount === 0 &&
    data.audit.duplicateOrderCount === 0 &&
    data.audit.precisionErrorCount === 0,
  );
  const coupons: CustomerCoupon[] = useMemo(() => data?.coupons || [], [data]);

  return (
    <section className="customer-ledger">
      <div className="customer-ledger-head">
        <div>
          <span className="asset-dialog-kicker"><History /> 客户全生命周期账本</span>
          <h3>每一笔消费、项目核销与优惠券</h3>
          <p>订单号、时间、项目、技师、金额组成和卡项消耗均可查询。</p>
        </div>
        <div className={`ledger-verified ${verified ? 'verified' : ''}`}>
          <BadgeCheck />
          <span>
            <strong>{verified ? '四项对账通过' : '等待对账'}</strong>
            <small>{data?.audit ? `同步于 ${formatDateTime(data.audit.importedAt)}` : '尚无导入审计'}</small>
          </span>
        </div>
      </div>

      {data && (
        <div className="ledger-summary-grid">
          <article><WalletCards /><span><small>当前卡金余额</small><strong>{formatMoneyExact(data.summary.currentBalanceExact)}</strong></span></article>
          <article><CircleDollarSign /><span><small>累计消费</small><strong>{formatMoneyExact(data.summary.totalSpendExact)}</strong></span></article>
          <article><Banknote /><span><small>历史交易实付</small><strong>{formatMoneyExact(data.summary.actualAmountTotalExact)}</strong></span></article>
          <article><DatabaseZap /><span><small>项目 / 权益核销</small><strong>{formatMoneyExact(data.summary.benefitDeductionTotalExact)}</strong></span></article>
          <article><ShoppingBag /><span><small>订单 / 项目明细</small><strong>{data.summary.orderCount} / {data.summary.itemCount}</strong></span></article>
          <article><TicketCheck /><span><small>优惠券资产</small><strong>{data.summary.couponCount} 张</strong></span></article>
        </div>
      )}

      <div className="ledger-toolbar">
        <div className="ledger-search">
          <Search />
          <Input
            aria-label="搜索订单号、项目、技师或支付方式"
            placeholder="搜索订单号、项目、技师、备注或支付方式"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
          />
        </div>
        <div className="ledger-filters">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={filter === item.value ? 'active' : ''}
              onClick={() => {
                setFilter(item.value);
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="ledger-state">正在读取逐笔消费账本…</div>}
      {!loading && error && <div className="ledger-state error">{error}</div>}
      {!loading && !error && data?.transactions.length === 0 && (
        <div className="ledger-state">没有找到匹配的消费记录</div>
      )}
      {!loading && !error && data && data.transactions.length > 0 && (
        <Accordion
          type="single"
          collapsible
          className="ledger-order-list"
          defaultValue={data.transactions[0]?.id}
        >
          {data.transactions.map((transaction: CustomerTransaction) => (
            <AccordionItem key={transaction.id} value={transaction.id}>
              <AccordionTrigger className="ledger-order-trigger">
                <span className={`ledger-order-type ${orderTone(transaction.orderType)}`}>
                  {transaction.orderType || '交易'}
                </span>
                <span className="ledger-order-main">
                  <strong>{formatDateTime(transaction.orderedAt)}</strong>
                  <small>订单号 {transaction.orderNo} · {transaction.items.map((item) => item.itemName).join('、')}</small>
                </span>
                <span className="ledger-order-amount">
                  <strong>{formatMoneyExact(transaction.actualAmountExact)}</strong>
                  <small>{transaction.paymentMethod || transaction.status || '查看金额组成'}</small>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <TransactionDetail transaction={transaction} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {data && data.total > 0 && (
        <div className="ledger-pagination">
          <span>共 {data.total} 笔匹配记录</span>
          <div>
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft /></Button>
            <b>{page} / {totalPages}</b>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight /></Button>
          </div>
        </div>
      )}

      {coupons.length > 0 && (
        <section className="ledger-coupons">
          <div className="ledger-subhead">
            <span><Gift /> 优惠券资产</span>
            <b>{coupons.length} 张 · 面值合计 {formatMoneyExact(data?.summary.couponFaceValueTotalExact)}</b>
          </div>
          <div className="ledger-coupon-grid">
            {coupons.map((coupon: CustomerCoupon) => (
              <article key={coupon.id}>
                <TicketCheck />
                <div>
                  <strong>{coupon.couponName}</strong>
                  <small>{coupon.threshold || '使用门槛待确认'}</small>
                  <span>{coupon.validFrom || '开始时间待确认'} 至 {coupon.validTo || '结束时间待确认'}</span>
                </div>
                <b>{formatMoneyExact(coupon.faceValueExact)}</b>
                <em>{coupon.status}</em>
              </article>
            ))}
          </div>
        </section>
      )}

      {data?.audit && (
        <div className="ledger-audit-strip">
          <BadgeCheck />
          <span>
            <strong>有赞全量账本校验</strong>
            <small>
              {data.audit.customerCount} 位客户 · {data.audit.transactionCount} 笔订单 · {data.audit.itemCount} 条项目 · {data.audit.couponCount} 张优惠券
            </small>
          </span>
          <b>余额误差 {data.audit.balanceErrorCount} · 身份误差 {data.audit.identityErrorCount} · 重复订单 {data.audit.duplicateOrderCount} · 精度误差 {data.audit.precisionErrorCount}</b>
        </div>
      )}
    </section>
  );
}
