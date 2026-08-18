import {
  followupStageFor,
  isBirthdayOnDate,
  privilegeTierForText,
  shanghaiDateKey,
  shiftDateKey,
} from '../../server/modules/service-desk/customer-reminder.service';

describe('customer reminder date rules', () => {
  it('uses Asia/Shanghai when calculating the service day', () => {
    expect(shanghaiDateKey(new Date('2026-08-16T16:30:00.000Z'))).toBe(
      '2026-08-17',
    );
  });

  it('moves across month and year boundaries', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-12-31', 2)).toBe('2027-01-02');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('only recognizes the three privilege-card tiers', () => {
    expect(privilegeTierForText('蕴光主特权卡')).toBe('蕴光主');
    expect(privilegeTierForText('绘光师')).toBe('绘光师');
    expect(privilegeTierForText('1688会员')).toBeUndefined();
  });

  it('matches birthdays by month and day only', () => {
    expect(isBirthdayOnDate('1993-08-17 00:00:00', '2026-08-17')).toBe(true);
    expect(isBirthdayOnDate('1993-08-18 00:00:00', '2026-08-17')).toBe(false);
  });

  it('only creates standard D+1, D+3 and D+21 followups', () => {
    expect(followupStageFor('2026-08-15', '2026-08-16')).toBe('D+1');
    expect(followupStageFor('2026-08-13', '2026-08-16')).toBe('D+3');
    expect(followupStageFor('2026-07-26', '2026-08-16')).toBe('D+21');
    expect(followupStageFor('2026-08-12', '2026-08-16')).toBeUndefined();
  });
});
