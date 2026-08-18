export type CustomerMembershipTier = '追光者' | '绘光师' | '蕴光主';

export interface CustomerMembershipPolicy {
  tier?: CustomerMembershipTier;
  label: string;
  productDiscountPercent: number;
  productDiscountLabel: string;
  servicePricingLabel: string;
  annualCashVoucherCount: number;
}

const TIER_LEVEL: Record<CustomerMembershipTier, string> = {
  追光者: '688',
  绘光师: '988',
  蕴光主: '1688',
};

const TIER_PRODUCT_DISCOUNT: Record<CustomerMembershipTier, number> = {
  追光者: 90,
  绘光师: 86,
  蕴光主: 80,
};

const TIER_VOUCHER_COUNT: Record<CustomerMembershipTier, number> = {
  追光者: 6,
  绘光师: 10,
  蕴光主: 18,
};

function compact(value?: string): string {
  return value?.replace(/\s+/gu, '').trim() || '';
}

export function resolveCustomerMembershipTier(
  memberLevel?: string,
  cardNames: string[] = [],
): CustomerMembershipTier | undefined {
  const candidates: string[] = [memberLevel || '', ...cardNames].map(compact);
  for (const tier of ['蕴光主', '绘光师', '追光者'] as const) {
    if (candidates.some((value: string) => value.includes(tier))) return tier;
  }
  for (const value of candidates) {
    const match: RegExpMatchArray | null = value.match(/(?:^|\D)(1688|988|688)(?:\D|$)/u);
    if (!match) continue;
    if (match[1] === '1688') return '蕴光主';
    if (match[1] === '988') return '绘光师';
    if (match[1] === '688') return '追光者';
  }
  return undefined;
}

export function getCustomerMembershipPolicy(
  memberLevel?: string,
  cardNames: string[] = [],
): CustomerMembershipPolicy {
  const tier: CustomerMembershipTier | undefined = resolveCustomerMembershipTier(
    memberLevel,
    cardNames,
  );
  if (!tier) {
    return {
      label: memberLevel?.trim() || '普通客户',
      productDiscountPercent: 100,
      productDiscountLabel: '产品原价',
      servicePricingLabel: '项目会员单次价',
      annualCashVoucherCount: 0,
    };
  }
  const percent: number = TIER_PRODUCT_DISCOUNT[tier];
  return {
    tier,
    label: `${tier}${TIER_LEVEL[tier]}`,
    productDiscountPercent: percent,
    productDiscountLabel: `产品${(percent / 10).toFixed(percent % 10 === 0 ? 0 : 1)}折`,
    servicePricingLabel: '所有项目统一按会员单次价结算',
    annualCashVoucherCount: TIER_VOUCHER_COUNT[tier],
  };
}
