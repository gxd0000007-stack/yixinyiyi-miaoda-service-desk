import type { FC } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CircleDollarSign,
  Database,
} from 'lucide-react';

export type OwnerAnalysisModuleType =
  | 'all'
  | 'appointment_overview'
  | 'pending_service'
  | 'in_service'
  | 'service_progress'
  | 'total_receivable'
  | 'pending_settlement'
  | 'card_consumption'
  | 'project_writeoff'
  | 'onsite_receivable'
  | 'priority_clients'
  | 'matched_profiles'
  | 'data_quality'
  | 'remaining_projects';

export interface OwnerRealtimeAnalysis {
  summary: string;
  issueCount: number;
  appointmentCount: number;
  pendingCount: number;
  inServiceCount: number;
  completedCount: number;
  serviceCompletionRate: number;
  totalReceivable: number;
  pendingSettlement: number;
  pendingSettlementRate: number;
  cardConsumption: number;
  cardConsumptionRate: number;
  projectWriteoff: number;
  onsiteReceivable: number;
  dailyReceivableChange: number | null;
  priorityClientCount: number;
  matchedProfileCount: number;
  missingProfileCount: number;
  remainingProjectCount: number;
}

interface OwnerRealtimeAnalysisPanelProps {
  analysis: OwnerRealtimeAnalysis;
  onSelect: (module: OwnerAnalysisModuleType) => void;
}

interface AnalysisModuleDefinition {
  key: Exclude<OwnerAnalysisModuleType, 'all'>;
  label: string;
  value: string;
  hint: string;
}

interface AnalysisGroupDefinition {
  key: string;
  label: string;
  description: string;
  tone: 'blue' | 'green' | 'orange';
  icon: typeof Activity;
  modules: AnalysisModuleDefinition[];
}

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

const OwnerRealtimeAnalysisPanel: FC<OwnerRealtimeAnalysisPanelProps> = ({
  analysis,
  onSelect,
}) => {
  const groups: AnalysisGroupDefinition[] = [
    {
      key: 'service',
      label: '到店执行',
      description: '预约与服务进度',
      tone: 'blue',
      icon: CalendarCheck,
      modules: [
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
      ],
    },
    {
      key: 'settlement',
      label: '结算消耗',
      description: '应收与账户结构',
      tone: 'green',
      icon: CircleDollarSign,
      modules: [
        {
          key: 'total_receivable',
          label: '总应收',
          value: formatCurrency(analysis.totalReceivable),
          hint: '查看逐位构成',
        },
        {
          key: 'pending_settlement',
          label: '待结算',
          value: formatCurrency(analysis.pendingSettlement),
          hint: `占总应收 ${analysis.pendingSettlementRate}%`,
        },
        {
          key: 'card_consumption',
          label: '卡金消耗',
          value: formatCurrency(analysis.cardConsumption),
          hint: `占总应收 ${analysis.cardConsumptionRate}%`,
        },
        {
          key: 'project_writeoff',
          label: '项目／次卡核销',
          value: formatCurrency(analysis.projectWriteoff),
          hint: '查看核销客户',
        },
        {
          key: 'onsite_receivable',
          label: '现场应收',
          value: formatCurrency(analysis.onsiteReceivable),
          hint: '查看收款客户',
        },
      ],
    },
    {
      key: 'customer',
      label: '客户资产',
      description: '档案与重点维护',
      tone: 'orange',
      icon: Database,
      modules: [
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
      ],
    },
  ];

  return (
    <section className="panel owner-realtime-analysis">
      <button
        type="button"
        className="owner-analysis-summary"
        onClick={() => onSelect('all')}
      >
        <span className="owner-analysis-pulse">
          <Activity />
        </span>
        <span className="owner-analysis-copy">
          <span className="eyebrow">实时数据分析 · 今日经营汇总</span>
          <strong>{analysis.summary}</strong>
          <small>点击进入完整问题清单、涉及客户和处理建议</small>
        </span>
        <b className={analysis.issueCount > 0 ? 'attention' : 'healthy'}>
          {analysis.issueCount > 0
            ? `${analysis.issueCount} 类事项需跟进`
            : '今日运行正常'}
          <ArrowRight />
        </b>
      </button>

      <div className="owner-analysis-groups" data-ai-section-type="card-menu">
        {groups.map((group: AnalysisGroupDefinition) => {
          const GroupIcon = group.icon;
          const columnClass = group.modules.length === 5 ? 'five' : 'four';
          return (
            <section className="owner-analysis-group" key={group.key}>
              <div className={`owner-analysis-group-label ${group.tone}`}>
                <i>
                  <GroupIcon />
                </i>
                <strong>{group.label}</strong>
                <small>{group.description}</small>
              </div>
              <div className={`owner-analysis-group-metrics ${columnClass}`}>
                {group.modules.map((module: AnalysisModuleDefinition) => (
                  <button
                    type="button"
                    key={module.key}
                    className="owner-analysis-module"
                    onClick={() => onSelect(module.key)}
                  >
                    <small>{module.label}</small>
                    <strong>{module.value}</strong>
                    <em>{module.hint} →</em>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
};

export default OwnerRealtimeAnalysisPanel;
