interface ProfileGroupDefinition {
  id: string;
  title: string;
  description: string;
  fields: string[];
}

const PROFILE_GROUPS: ProfileGroupDefinition[] = [
  {
    id: 'identity',
    title: '基础身份与生活背景',
    description: '客户身份、职业、年龄和生活环境',
    fields: [
      '姓名', '真实姓名', '昵称', '性别', '年龄', '年龄阶段', '生日',
      '星座', '生肖', '天干地支', '居住地', '职业', '教育水平',
      '有无留学背景', 'MBTI',
    ],
  },
  {
    id: 'assets',
    title: '会员与消费资产',
    description: '会员状态、消费能力和账户资产',
    fields: [
      '会员档位', '会员到期时间', '累计消费金额', '当前剩余金额',
      '消费潜力', '消费类型', '决策速度', '储值接受度', '办卡接受度',
      '成交卡点', '对消费决策影响', '消费与资产补充',
    ],
  },
  {
    id: 'skin',
    title: '皮肤健康与项目需求',
    description: '真实肤况、项目偏好与项目边界',
    fields: [
      '肤质类型', '主要皮肤问题', '护肤习惯', '基础项目', '分层水光',
      '科技美肤', '问题肌项目', '项目偏好', '项目抗拒点',
    ],
  },
  {
    id: 'service',
    title: '服务偏好与执行标准',
    description: '房间、手法、人员、氛围与服务禁忌',
    fields: [
      '接待客户类型', '服务员工', '员工偏好', '服务风格',
      '服务氛围偏好', '房间偏好', '手法偏好', '疼痛耐受度',
      '身体敏感度', '卫生细节敏感', '服务雷区', '增值服务',
      '餐食饮品偏好', '到店方式', '沟通备注',
    ],
  },
  {
    id: 'source',
    title: '客户来源与进店需求',
    description: '获客渠道、介绍关系与本次需求来源',
    fields: ['初始来源', '进店动机', '介绍人姓名', '与介绍人关系', '姓名分组'],
  },
  {
    id: 'family',
    title: '家庭、关系与兴趣画像',
    description: '沟通中可参考的生活节奏与兴趣信息',
    fields: [
      '婚姻状态', '情感状态', '家庭角色', '家庭时间限制', '老公职业',
      '是否有孩子', '孩子数量', '孩子年纪', '是否带孩子', '兴趣爱好',
      '兴趣话题', '工作强度', '重要纪念日',
    ],
  },
  {
    id: 'health',
    title: '健康与特殊注意事项',
    description: '服务前必须确认的健康信息',
    fields: [
      '是否怀孕', '是否在哺乳期', '月经期', '心理健康程度',
      '身体敏感度', '疼痛耐受度', '健康注意补充',
    ],
  },
  {
    id: 'followup',
    title: '跟进与复购规则',
    description: '产品、项目和会员维护节奏',
    fields: ['产品购买跟进', '重要纪念日', '会员到期时间'],
  },
];

const CRITICAL_PROFILE_FIELDS: Array<{ field: string; label: string }> = [
  { field: '手机号', label: '手机号' },
  { field: '会员档位', label: '会员档位' },
  { field: '初始来源', label: '客户来源' },
  { field: '累计消费金额', label: '累计消费' },
  { field: '当前剩余金额', label: '卡内余额' },
  { field: '服务员工', label: '服务员工' },
  { field: '主要皮肤问题', label: '主要肤况' },
  { field: '项目偏好', label: '项目需求' },
  { field: '服务雷区', label: '服务雷区' },
  { field: '服务风格', label: '服务偏好' },
  { field: '疼痛耐受度', label: '疼痛耐受度' },
  { field: '是否在哺乳期', label: '特殊健康状态' },
];

function normalizeCustomerName(value: string): string {
  return value.replace(/\s+/gu, '').trim();
}

function normalizeRawProfile(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

function hasProfileValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function formatProfileValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item: unknown) => formatProfileValue(item))
      .filter(Boolean)
      .join('、');
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && value > 946684800000) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function profileList(
  profile: Record<string, unknown>,
  field: string,
): string[] {
  const value: unknown = profile[field];
  if (Array.isArray(value)) {
    return value
      .map((item: unknown) => formatProfileValue(item))
      .filter(Boolean);
  }
  if (!hasProfileValue(value)) return [];
  return [formatProfileValue(value)];
}

function healthProfileValues(
  profile: Record<string, unknown>,
  field: string,
  label: string,
): string[] {
  return profileList(profile, field)
    .filter((value: string) => !/^(否|无|没有|未|不在)/u.test(value))
    .map((value: string) => `${label}：${value}`);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);
}

export {
  CRITICAL_PROFILE_FIELDS,
  PROFILE_GROUPS,
  formatCurrency,
  formatProfileValue,
  hasProfileValue,
  healthProfileValues,
  normalizeCustomerName,
  normalizeRawProfile,
  profileList,
};
export type { ProfileGroupDefinition };
