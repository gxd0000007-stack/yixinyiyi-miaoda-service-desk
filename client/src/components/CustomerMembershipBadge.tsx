import { customerMembershipLabel, customerPrivilegeTier } from '../pages/customer-membership';
import './customer-membership-badge.css';

interface CustomerMembershipBadgeProps {
  memberLevel?: string;
  cardNames?: string[];
  label?: string;
  compact?: boolean;
  className?: string;
}
const HIDDEN_LABELS: RegExp = /^(普通客户|会员待识别|会员档位待补充|待确认|新客待建档)$/u;

export default function CustomerMembershipBadge({
  memberLevel,
  cardNames = [],
  label,
  compact = false,
  className = '',
}: CustomerMembershipBadgeProps) {
  const tier = customerPrivilegeTier(memberLevel, cardNames);
  const resolved: string = (label || customerMembershipLabel(memberLevel, cardNames)).trim();
  if ((!tier && !memberLevel?.trim() && !label?.trim()) || HIDDEN_LABELS.test(resolved)) {
    return null;
  }

  return (
    <span
      className={`customer-membership-badge-unified${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      title={`会员级别：${resolved}`}
    >
      {resolved}
    </span>
  );
}
