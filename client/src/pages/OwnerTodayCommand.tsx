import type { FC } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ChevronDown,
  CircleDollarSign,
  Database,
  Minus,
} from 'lucide-react';
import type {
  OwnerDailyMetrics,
  OwnerDailyMetricType,
} from './OwnerDailyDataPanel';
import type {
  OwnerAnalysisModuleType,
  OwnerRealtimeAnalysis,
} from './OwnerRealtimeAnalysisPanel';

interface OwnerTodayCommandProps {
  dateLabel: string;
  updatedAt?: string;
  current: OwnerDailyMetrics;
  previous: OwnerDailyMetrics;
  analysis: OwnerRealtimeAnalysis;
  onSelectDaily: (metric: OwnerDailyMetricType) => void;
  onSelectAnalysis: (module: OwnerAnalysisModuleType) => void;
}

interface DailyMetricDefinition {
  key: OwnerDailyMetricType;
  label: string;
  valueKey: keyof OwnerDailyMetrics;
  format: 'currency' | 'count';
}

interface AnalysisMetricDefinition {
  key: Exclude<OwnerAnalysisModuleType, 'all'>;
  label: string;
  value: string;
  hint: string;
}

interface PriorityTask {
  key: string;
  title: string;
  description: string;
  module: Exclude<OwnerAnalysisModuleType, 'all'>;
  tone: 'blue' | 'orange' | 'red';
}

const DAILY_METRICS: DailyMetricDefinition[] = [
  {
    key: 'total_receivable',
    label: '总应收金额',
    valueKey: 'totalReceivable',
    format: 'currency',
  },
  {
    key: 'card_consumption',
    label: '卡金消耗',
    valueKey: 'cardConsumption',
    format: 'currency',
  },
  {
    key: 'project_writeoff',
    label: '项目／次卡核销',
    valueKey: 'projectWriteoff',
    format: 'currency',
  },
  {
    key: 'onsite_receivable',
    label: '现场应收',
    valueKey: 'onsiteReceivable',
    format: 'currency',
  },
  {
    key: 'settled_receivable',
    label: '已结算金额',
    valueKey: 'settledReceivable',
    format: 'currency',
  },
  {
    key: 'pending_settlement',
    label: '待结算金额',
    valueKey: 'pendingSettlement',
    format: 'currency',
  },
  {
    key: 'completed_count',
    label: '成交客户数',
    valueKey: 'completedCount',
    format: 'count',
  },
  {
    key: 'average_ticket',
    label: '客单价',
    valueKey: 'averageTicket',
    format: 'currency',
  },
];

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function formatValue(
  value: number,
  format: DailyMetricDefinition['format'],
): string {
  return format === 'count'
    ? `${value.toLocaleString('zh-CN')} 位`
    : formatCurrency(value);
}

function formatUpdatedAt(value?: string): string {
  if (!value) return '随预约、服务与结算状态实时更新';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '随预约、服务与结算状态实时更新';
  }
  return `更新于 ${new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
}

const OwnerTodayCommand: FC<OwnerTodayCommandProps> = ({
  dateLabel,
  updatedAt,
  current,
  previous,
  analysis,
  onSelectDaily,
  onSelectAnalysis,
}) => {
  const priorityTasks: PriorityTask[] = [
    analysis.pendingCount > 0
      ? {
          key: 'pending-service',
          title: `确认 ${analysis.pendingCount} 位待服务客户`,
          description: '核对到店时间、房间、项目与当次服务人员',
          module: 'pending_service',
          tone: 'blue',
        }
      : null,
    analysis.priorityClientCount > 0
      ? {
          key: 'priority-clients',
          title: `复核 ${analysis.priorityClientCount} 位重点客户`,
          description: '先看历史消费、项目资产和本次服务风险',
          module: 'priority_clients',
          tone: 'red',
        }
      : null,
    analysis.pendingSettlement > 0
      ? {
          key: 'pending-settlement',
          title: `跟进 ${formatCurrency(analysis.pendingSettlement)} 待结算`,
          description: '逐位核对卡金、项目核销和现场应收',
          module: 'pending_settlement',
          tone: 'orange',
        }
      : null,
    analysis.missingProfileCount > 0
      ? {
          key: 'missing-profile',
          title: `补齐 ${analysis.missingProfileCount} 位客户资料`,
          description: '补充健康肤况、历史消费、偏好和项目资产',
          module: 'data_quality',
          tone: 'orange',
        }
      : null,
    analysis.inServiceCount > 0
      ? {
          key: 'in-service',
          title: `查看 ${analysis.inServiceCount} 位服务中客户`,
          description: '确认现场流程、服务进度和下一步交接',
          module: 'in_service',
          tone: 'blue',
        }
      : null,
  ].filter((task): task is PriorityTask => task !== null).slice(0, 3);

  const serviceMetrics: AnalysisMetricDefinition[] = [
    {
      key: 'appointment_overview',
      label: '今日预约',
      value: `${analysis.appointmentCount} 位`,
      hint: '查看全部客户',
    },
    {
      key: 'pending_service',
      label: '待服务',
      value: `${analysis.pendingCount} 位`,
      hint: '查看待执行客户',
    },
    {
      key: 'in_service',
      label: '服务中',
      value: `${analysis.inServiceCount} 位`,
      hint: '查看实时进度',
    },
    {
      key: 'service_progress',
      label: '服务闭环率',
      value: `${analysis.serviceCompletionRate}%`,
      hint: `${analysis.completedCount} 位已完成`,
    },
  ];

  const customerMetrics: AnalysisMetricDefinition[] = [
    {
      key: 'priority_clients',
      label: '特权卡重点客户',
      value: `${analysis.priorityClientCount} 位`,
      hint: '查看关注原因',
    },
    {
      key: 'matched_profiles',
      label: '资料已匹配',
      value: `${analysis.matchedProfileCount} 位`,
      hint: '查看客户档案',
    },
    {
      key: 'data_quality',
      label: '资料待补',
      value: `${analysis.missingProfileCount} 位`,
      hint: '查看缺失内容',
    },
    {
      key: 'remaining_projects',
      label: '有剩余项目客户',
      value: `${analysis.remainingProjectCount} 位`,
      hint: '查看项目与余次',
    },
  ];

  return (
    <section className="panel owner-command-center">
      <div className="owner-command-heading">
        <div>
          <span className="eyebrow">老板今日经营指挥台</span>
          <h2>{dateLabel}先看结论，再处理事项</h2>
          <p>{formatUpdatedAt(updatedAt)}</p>
        </div>
        <b>{analysis.issueCount > 0 ? `${analysis.issueCount} 类事项需跟进` : '今日运行正常'}</b>
      </div>

      <button
        type="button"
        className="owner-command-summary"
        onClick={() => onSelectAnalysis('all')}
      >
        <span className="owner-command-summary-icon">
          <Activity />
        </span>
        <span>
          <small>一句话经营结论</small>
          <strong>{analysis.summary}</strong>
          <em>点击查看完整问题清单、涉及客户和处理建议</em>
        </span>
        <ArrowRight />
      </button>

      <div className="owner-command-primary" data-ai-section-type="card-menu">
        <button type="button" onClick={() => onSelectDaily('total_receivable')}>
          <CircleDollarSign />
          <span>今日总应收</span>
          <strong>{formatCurrency(current.totalReceivable)}</strong>
          <small>查看逐位构成 →</small>
        </button>
        <button type="button" onClick={() => onSelectDaily('pending_settlement')}>
          <CircleDollarSign />
          <span>待结算金额</span>
          <strong>{formatCurrency(current.pendingSettlement)}</strong>
          <small>查看待结算客户 →</small>
        </button>
        <button type="button" onClick={() => onSelectAnalysis('service_progress')}>
          <CalendarCheck />
          <span>服务闭环</span>
          <strong>{analysis.serviceCompletionRate}%</strong>
          <small>{analysis.completedCount} 位已完成 →</small>
        </button>
        <button type="button" onClick={() => onSelectAnalysis('priority_clients')}>
          <Database />
          <span>特权卡重点客户</span>
          <strong>{analysis.priorityClientCount} 位</strong>
          <small>查看关注原因 →</small>
        </button>
      </div>

      <section className="owner-command-tasks">
        <div className="owner-command-section-title">
          <div>
            <span>今天优先处理</span>
            <strong>按业务紧急程度排序</strong>
          </div>
          <small>点击事项直接进入对应客户明细</small>
        </div>
        {priorityTasks.length > 0 ? (
          <div className="owner-command-task-list">
            {priorityTasks.map((task: PriorityTask, index: number) => (
              <button
                type="button"
                key={task.key}
                className={task.tone}
                onClick={() => onSelectAnalysis(task.module)}
              >
                <i>{index + 1}</i>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.description}</small>
                </span>
                <ArrowRight />
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="owner-command-all-clear"
            onClick={() => onSelectAnalysis('all')}
          >
            <strong>今日关键事项已全部闭环</strong>
            <span>点击查看完整经营结果与客户明细</span>
            <ArrowRight />
          </button>
        )}
      </section>

      <details className="owner-command-details">
        <summary>
          <span>
            <strong>查看全部经营明细</strong>
            <small>服务、金额、结算和客户资产均保留点击入口</small>
          </span>
          <ChevronDown className="owner-command-expand-chevron" />
        </summary>

        <section className="owner-command-detail-group">
          <div className="owner-command-detail-label service">
            <CalendarCheck />
            <span>
              <strong>到店执行</strong>
              <small>预约与服务进度</small>
            </span>
          </div>
          <div className="owner-command-detail-grid four">
            {serviceMetrics.map((metric: AnalysisMetricDefinition) => (
              <button
                type="button"
                key={metric.key}
                onClick={() => onSelectAnalysis(metric.key)}
              >
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
                <em>{metric.hint} →</em>
              </button>
            ))}
          </div>
        </section>

        <section className="owner-command-detail-group">
          <div className="owner-command-detail-label settlement">
            <CircleDollarSign />
            <span>
              <strong>金额与结算</strong>
              <small>昨日对比与逐位构成</small>
            </span>
          </div>
          <div className="owner-command-detail-grid four">
            {DAILY_METRICS.map((metric: DailyMetricDefinition) => {
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
                  onClick={() => onSelectDaily(metric.key)}
                >
                  <small>{metric.label}</small>
                  <strong>{formatValue(currentValue, metric.format)}</strong>
                  <em className={difference > 0 ? 'up' : difference < 0 ? 'down' : ''}>
                    <TrendIcon /> 昨日 {formatValue(previousValue, metric.format)}
                  </em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="owner-command-detail-group">
          <div className="owner-command-detail-label customer">
            <Database />
            <span>
              <strong>客户资产</strong>
              <small>档案与重点维护</small>
            </span>
          </div>
          <div className="owner-command-detail-grid four">
            {customerMetrics.map((metric: AnalysisMetricDefinition) => (
              <button
                type="button"
                key={metric.key}
                onClick={() => onSelectAnalysis(metric.key)}
              >
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
                <em>{metric.hint} →</em>
              </button>
            ))}
          </div>
        </section>
      </details>
    </section>
  );
};

export default OwnerTodayCommand;
