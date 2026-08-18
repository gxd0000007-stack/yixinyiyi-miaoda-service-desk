import '../structured-content.css';

interface StructuredContentProps {
  value: string;
  compact?: boolean;
  maxItems?: number;
  quote?: boolean;
}

interface StructuredContentItem {
  label?: string;
  text: string;
  metrics: string[];
}

function cleanText(value: string): string {
  return value
    .trim()
    .replace(/^[“”"']+/u, '')
    .replace(/[“”"']+$/u, '')
    .replace(/[；。]+$/u, '')
    .trim();
}

function parseStructuredContent(value: string): StructuredContentItem[] {
  const normalized: string = cleanText(value);
  if (!normalized) return [];
  return normalized
    .split(/[；。\n]+/u)
    .map((segment: string) => cleanText(segment))
    .filter(Boolean)
    .map((segment: string): StructuredContentItem => {
      const labelMatch: RegExpMatchArray | null = segment.match(
        /^([^：]{1,18})：\s*(.+)$/u,
      );
      const label: string | undefined = labelMatch?.[1]?.trim();
      const text: string = labelMatch?.[2]?.trim() || segment;
      const metricParts: string[] = text
        .split(/\s*[·｜|]\s*/u)
        .map((part: string) => part.trim())
        .filter(Boolean);
      return {
        label,
        text,
        metrics: metricParts.length > 1 ? metricParts : [],
      };
    });
}

function labelTone(label: string | undefined): string {
  if (!label) return 'neutral';
  if (/风险|注意|健康|禁忌|边界|雷区/u.test(label)) return 'warning';
  if (/执行|动作|建议|确认|方案/u.test(label)) return 'action';
  if (/消费|资产|数据|信息|记录|应收|卡金|核销|结算/u.test(label)) return 'data';
  if (/关注|原因|评估|状态/u.test(label)) return 'focus';
  return 'neutral';
}

function detailParts(value: string): string[] {
  const parts: string[] = value
    .split(/，+/u)
    .map((part: string) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [value];
}

export default function StructuredContent({
  value,
  compact = false,
  maxItems,
  quote = false,
}: StructuredContentProps) {
  const items: StructuredContentItem[] = parseStructuredContent(value);
  if (items.length === 0) return <span className="structured-inline">—</span>;
  const isShort: boolean =
    items.length === 1 &&
    !items[0].label &&
    items[0].metrics.length === 0 &&
    items[0].text.length <= 34;
  if (isShort) {
    return <span className="structured-inline">{items[0].text}</span>;
  }
  const visibleItems: StructuredContentItem[] = maxItems
    ? items.slice(0, maxItems)
    : items;
  const hiddenCount: number = Math.max(0, items.length - visibleItems.length);
  return (
    <div
      className={`structured-content ${compact ? 'is-compact' : ''} ${quote ? 'is-quote' : ''}`}
    >
      {visibleItems.map((item: StructuredContentItem, index: number) => {
        const parts: string[] = detailParts(item.text);
        const visibleParts: string[] = compact ? parts.slice(0, 2) : parts;
        const extraParts: number = Math.max(0, parts.length - visibleParts.length);
        return (
          <article
            key={`${item.label || 'item'}-${index}-${item.text}`}
            className={`structured-item tone-${labelTone(item.label)}`}
          >
            {item.label && <strong>{item.label}</strong>}
            {item.metrics.length > 0 ? (
              <div className="structured-metrics">
                {item.metrics.map((metric: string) => (
                  <span key={metric}>{metric}</span>
                ))}
              </div>
            ) : visibleParts.length > 1 ? (
              <ul>
                {visibleParts.map((part: string) => (
                  <li key={part}>{part}</li>
                ))}
              </ul>
            ) : (
              <p>{visibleParts[0]}</p>
            )}
            {extraParts > 0 && (
              <small>另有 {extraParts} 项</small>
            )}
          </article>
        );
      })}
      {hiddenCount > 0 && (
        <div className="structured-more">另有 {hiddenCount} 个信息模块</div>
      )}
    </div>
  );
}
