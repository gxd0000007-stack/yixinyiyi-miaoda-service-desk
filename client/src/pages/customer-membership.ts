import type {
  CustomerAssetForService,
  CustomerCardAvailableRight,
  CustomerPrivilegeTier,
} from '@shared/api.interface';
import { resolveCustomerMembershipTier } from '@shared/customer-membership-policy';

const CUSTOMER_PRIVILEGE_TIERS: CustomerPrivilegeTier[] = [
  '追光者',
  '绘光师',
  '蕴光主',
];

const CUSTOMER_LEVEL_TIER_MAP: Record<string, CustomerPrivilegeTier> = {
  '688': '追光者',
  '988': '绘光师',
  '1688': '蕴光主',
};

const CUSTOMER_TIER_LEVEL_MAP: Record<CustomerPrivilegeTier, string> = {
  追光者: '688',
  绘光师: '988',
  蕴光主: '1688',
};

function compactMembershipText(value?: string): string {
  return value?.replace(/\s+/gu, '').trim() || '';
}

export function customerPrivilegeTier(
  memberLevel?: string,
  cardNames: string[] = [],
): CustomerPrivilegeTier | undefined {
  const sharedTier = resolveCustomerMembershipTier(memberLevel, cardNames);
  if (sharedTier) return sharedTier;
  const candidates: string[] = [memberLevel || '', ...cardNames].map(
    (value: string): string => compactMembershipText(value),
  );
  const namedTier: CustomerPrivilegeTier | undefined = CUSTOMER_PRIVILEGE_TIERS.find((tier: CustomerPrivilegeTier) =>
    candidates.some((value: string): boolean => value.includes(tier)),
  );
  if (namedTier) return namedTier;
  const numericLevel: string | undefined = customerNumericLevel(
    memberLevel,
    cardNames,
  );
  return numericLevel ? CUSTOMER_LEVEL_TIER_MAP[numericLevel] : undefined;
}

function customerNumericLevel(
  memberLevel?: string,
  cardNames: string[] = [],
): string | undefined {
  const candidates: string[] = [memberLevel || '', ...cardNames];
  for (const value of candidates) {
    const match: RegExpMatchArray | null = value.match(
      /(?:^|\D)(1688|988|688)(?:\D|$)/u,
    );
    if (match) return match[1];
  }
  return undefined;
}

export function customerMembershipLabel(
  memberLevel?: string,
  cardNames: string[] = [],
): string {
  const numericLevel: string | undefined = customerNumericLevel(
    memberLevel,
    cardNames,
  );
  const privilegeTier: CustomerPrivilegeTier | undefined =
    customerPrivilegeTier(memberLevel, cardNames) ||
    (numericLevel ? CUSTOMER_LEVEL_TIER_MAP[numericLevel] : undefined);
  if (privilegeTier) {
    return `${privilegeTier}${numericLevel || CUSTOMER_TIER_LEVEL_MAP[privilegeTier]}`;
  }
  return memberLevel?.trim() || '会员待识别';
}

export function appointmentMembershipLabel(
  customerAsset: CustomerAssetForService | undefined,
  fallbackMember?: string,
): string {
  const cardNames: string[] = customerAsset?.availableCardRights.map(
    (right: CustomerCardAvailableRight): string => right.cardName,
  ) || [];
  if (fallbackMember) cardNames.push(fallbackMember);
  return customerMembershipLabel(
    customerAsset?.memberLevel || fallbackMember,
    cardNames,
  );
}
