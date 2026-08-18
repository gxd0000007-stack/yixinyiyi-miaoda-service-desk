import {
  getCustomerMembershipPolicy,
  resolveCustomerMembershipTier,
} from '../../shared/customer-membership-policy';

describe('customer membership policy', () => {
  it.each([
    ['追光者688', '追光者', 90, 6],
    ['绘光师988', '绘光师', 86, 10],
    ['蕴光主1688', '蕴光主', 80, 18],
  ] as const)(
    'applies the product discount and voucher allowance for %s',
    (rawLevel, tier, productDiscountPercent, annualCashVoucherCount) => {
      const policy = getCustomerMembershipPolicy(rawLevel);
      expect(policy.tier).toBe(tier);
      expect(policy.productDiscountPercent).toBe(productDiscountPercent);
      expect(policy.annualCashVoucherCount).toBe(annualCashVoucherCount);
      expect(policy.servicePricingLabel).toBe('所有项目统一按会员单次价结算');
    },
  );

  it('resolves membership from card names when the customer level is empty', () => {
    expect(resolveCustomerMembershipTier(undefined, ['2026四季追光特权卡·绘光师988']))
      .toBe('绘光师');
  });

  it('uses the highest tier when multiple historic tier cards exist', () => {
    expect(resolveCustomerMembershipTier(undefined, ['追光者688', '蕴光主1688']))
      .toBe('蕴光主');
  });

  it('does not discount products for an ordinary customer', () => {
    const policy = getCustomerMembershipPolicy('普通会员');
    expect(policy.productDiscountPercent).toBe(100);
    expect(policy.annualCashVoucherCount).toBe(0);
  });
});
