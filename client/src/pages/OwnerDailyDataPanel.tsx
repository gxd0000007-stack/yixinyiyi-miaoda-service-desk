import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from 'lucide-react';

export type OwnerDailyMetricType =
  | 'total_receivable'
  | 'card_consumption'
  | 'project_writeoff'
  | 'onsite_receivable'
  | 'settled_receivable'
  | 'pending_settlement'
  | 'completed_count'
  | 'average_ticket';

export interface OwnerDailyMetrics {
  totalReceivable: number;
  cardConsumption: number;
  projectWriteoff: number;
  onsiteReceivable: number;
  settledReceivable: number;
  pendingSettlement: number;
  completedCount: number;
  averageTicket: number;
}

interface OwnerDailyDataPanelProps {
  dateLabel: string;
  updatedAt?: string;
  current: OwnerDailyMetrics;
  previous: OwnerDailyMetrics;
  onSelect: (metric: OwnerDailyMetricType) => void;
}

interface MetricDefinition {
  key: OwnerDailyMetricType;
  label: string;
  valueKey: keyof OwnerDailyMetrics;
  format: 'currency' | 'count';
  detailLabel: string;
}

const METRICS: MetricDefinition[] = [
  {
    key: 'total_receivable',
    label: '总应收金额',
    valueKey: 'totalReceivable',
    format: 'currency',
    detailLabel: '逐位总应收明细',
  },
  {
    key: 'card_consumption',
    label: '卡金消耗',
    valueKey: 'cardConsumption',
    format: 'currency',
    detailLabel: '卡金抵扣客户',
  },
  {
    key: 'project_writeoff',
    label: '项目／次卡核销',
    valueKey: 'projectWriteoff',
    format: 'currency',
    detailLabel: '核销客户明细',
  },
  {
    key: 'onsite_receivable',
    label: '现场应收',
    valueKey: 'onsiteReceivable',
    format: 'currency',
    detailLabel: '现场收款明细',
  },
  {
    key: 'settled_receivable',
    label: '已结算金额',
    valueKey: 'settledReceivable',
    format: 'currency',
    detailLabel: '已完成客户',
  },
  {
    key: 'pending_settlement',
    label: '待结算金额',
    valueKey: 'pendingSettlement',
    format: 'currency',
    detailLabel: '待完成客户',
  },
  {
    key: 'completed_count',
    label: '成交客户数',
    valueKey: 'completedCount',
    format: 'count',
    detailLabel: '成交客户名单',
  },
  {
    key: 'average_ticket',
    label: '客单价',
    valueKey: 'averageTicket',
    format: 'currency',
    detailLabel: '客单构成明细',
  },
];

function formatValue(value: number, format: MetricDefinition['format']): string {
  if (format === 'count') return `${value.toLocaleString('zh-CN')} 位`;
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function formatUpdatedAt(value?: string): string {
  if (!value) return '随预约和服务状态实时更新';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '随预约和服务状态实时更新';
  return `更新时间：${new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
}

export default function OwnerDailyDataPanel({
  dateLabel,
  updatedAt,
  current,
  previous,
  onSelect,
}: OwnerDailyDataPanelProps) {
  return (
    <section className="panel owner-daily-data">
      <div className="owner-daily-heading">
        <div>
          <span className="eyebrow">老板经营看板 · 每日结算口径</span>
          <h2>{dateLabel}经营数据</h2>
          <p>{formatUpdatedAt(updatedAt)}</p>
        </div>
        <b>8 项均可点击查看明细</b>
      </div>
      <div className="owner-daily-grid" data-ai-section-type="card-menu">
        {METRICS.map((metric: MetricDefinition) => {
          const currentValue: number = current[metric.valueKey];
          const previousValue: number = previous[metric.valueKey];
          const difference: number = currentValue - previousValue;
          const TrendIcon = difference > 0
            ? ArrowUpRight
            : difference < 0
              ? ArrowDownRight
              : Minus;
          return (
            <button
              type="button"
              key={metric.key}
              className="owner-daily-metric"
              onClick={() => onSelect(metric.key)}
            >
              <span>{metric.label}</span>
              <strong>{formatValue(currentValue, metric.format)}</strong>
              <small className={difference > 0 ? 'up' : difference < 0 ? 'down' : ''}>
                <TrendIcon /> 昨日 {formatValue(previousValue, metric.format)}
              </small>
              <em>{metric.detailLabel} →</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
