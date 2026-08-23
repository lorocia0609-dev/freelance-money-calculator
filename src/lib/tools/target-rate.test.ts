import { describe, expect, it } from 'vitest';
import {
  InvalidTargetRateInput,
  TARGET_RATE_DEFAULTS,
  type TargetRateInput,
  calculateTargetRate,
  normalizeTargetRateInput,
  retentionRate,
  validateTargetRateInput,
  warningsFor,
} from './target-rate';

/** A base with every deduction at zero, so each test turns on only what it examines. */
const CLEAN: TargetRateInput = {
  targetMonthlyNetIncome: 4000,
  daysPerWeek: 5,
  hoursPerDay: 8,
  billablePercent: 60,
  weeksPerYear: 46,
  taxPercent: 0,
  platformFeePercent: 0,
  overheadPercent: 0,
};

const withInput = (patch: Partial<TargetRateInput>): TargetRateInput => ({ ...CLEAN, ...patch });

describe('calculateTargetRate — worked example', () => {
  // Chosen so every intermediate is a round number and can be checked by hand:
  //   retention   = (1 − 0.10 − 0.10) × (1 − 0.20) = 0.64
  //   annual net  = 4000 × 12                      = 48,000
  //   annual gross= 48,000 / 0.64                  = 75,000
  //   fee         = 75,000 × 0.10                  =  7,500
  //   overhead    = 75,000 × 0.10                  =  7,500
  //   taxable     = 75,000 − 7,500 − 7,500         = 60,000
  //   tax         = 60,000 × 0.20                  = 12,000
  //   net         = 75,000 − 7,500 − 7,500 − 12,000= 48,000 ✓
  //   billable h  = 5 × 8 × 46 × 0.60              =  1,104
  //   rate        = 75,000 / 1,104                 = 67.93
  const input = withInput({ taxPercent: 20, platformFeePercent: 10, overheadPercent: 10 });

  it('produces the expected annual breakdown', () => {
    const { annual } = calculateTargetRate(input);
    expect(annual).toEqual({
      gross: 75000,
      platformFee: 7500,
      overhead: 7500,
      tax: 12000,
      net: 48000,
    });
  });

  it('produces the expected monthly breakdown', () => {
    const { monthly } = calculateTargetRate(input);
    expect(monthly).toEqual({
      gross: 6250,
      platformFee: 625,
      overhead: 625,
      tax: 1000,
      net: 4000,
    });
  });

  it('produces the expected hourly rate and hours', () => {
    const result = calculateTargetRate(input);
    expect(result.hourlyRate).toBe(67.93);
    expect(result.billableHoursPerYear).toBe(1104);
    expect(result.billableHoursPerMonth).toBe(92);
    expect(result.totalHoursPerYear).toBe(1840);
    expect(result.retentionRate).toBeCloseTo(0.64, 10);
  });
});

describe('calculateTargetRate — the deductions leave exactly the target net', () => {
  // The whole point of the tool: whatever the combination, what is left after
  // every deduction has to be the income the user asked for.
  const combinations: Array<Pick<TargetRateInput, 'taxPercent' | 'platformFeePercent' | 'overheadPercent'>> = [
    { taxPercent: 0, platformFeePercent: 0, overheadPercent: 0 },
    { taxPercent: 25, platformFeePercent: 0, overheadPercent: 0 },
    { taxPercent: 0, platformFeePercent: 20, overheadPercent: 0 },
    { taxPercent: 0, platformFeePercent: 0, overheadPercent: 15 },
    { taxPercent: 30, platformFeePercent: 10, overheadPercent: 12 },
    { taxPercent: 45, platformFeePercent: 20, overheadPercent: 25 },
    { taxPercent: 15.5, platformFeePercent: 7.3, overheadPercent: 3.9 },
    { taxPercent: 50, platformFeePercent: 40, overheadPercent: 40 },
  ];

  it.each(combinations)('tax %s%% + fee %s%% + overhead %s%% returns the target net', (deductions) => {
    const input = withInput(deductions);
    const { monthly, annual } = calculateTargetRate(input);

    // Rounding to cents can move the residual by at most one cent per period.
    expect(monthly.net).toBeCloseTo(input.targetMonthlyNetIncome, 1);
    expect(annual.net).toBeCloseTo(input.targetMonthlyNetIncome * 12, 1);
  });

  it.each(combinations)('breakdown parts sum to gross for %s', (deductions) => {
    const { monthly, annual } = calculateTargetRate(withInput(deductions));
    for (const period of [monthly, annual]) {
      expect(period.platformFee + period.overhead + period.tax + period.net).toBeCloseTo(period.gross, 2);
    }
  });

  it('taxes profit, not the full invoice', () => {
    // Fee and overhead come off first; tax applies to what is left. Taxing the
    // whole invoice would overstate the rate by taxing money never received.
    const { annual } = calculateTargetRate(
      withInput({ taxPercent: 30, platformFeePercent: 10, overheadPercent: 10 }),
    );
    const taxable = annual.gross - annual.platformFee - annual.overhead;
    expect(annual.tax).toBeCloseTo(taxable * 0.3, 2);
    expect(annual.tax).toBeLessThan(annual.gross * 0.3);
  });
});

describe('calculateTargetRate — individual deductions', () => {
  it('charges exactly the target when nothing is deducted', () => {
    const { annual, hourlyRate } = calculateTargetRate(CLEAN);
    expect(annual.gross).toBe(48000);
    expect(annual.net).toBe(48000);
    expect(hourlyRate).toBe(43.48); // 48,000 / 1,104
  });

  it('scales gross by 1/(1 − tax) when tax is the only deduction', () => {
    const { annual } = calculateTargetRate(withInput({ taxPercent: 25 }));
    expect(annual.gross).toBeCloseTo(48000 / 0.75, 2);
    expect(annual.tax).toBeCloseTo(16000, 2);
  });

  it('scales gross by 1/(1 − fee) when the platform fee is the only deduction', () => {
    const { annual } = calculateTargetRate(withInput({ platformFeePercent: 20 }));
    expect(annual.gross).toBeCloseTo(60000, 2);
    expect(annual.platformFee).toBeCloseTo(12000, 2);
  });

  it('scales gross by 1/(1 − overhead) when overhead is the only deduction', () => {
    const { annual } = calculateTargetRate(withInput({ overheadPercent: 20 }));
    expect(annual.gross).toBeCloseTo(60000, 2);
    expect(annual.overhead).toBeCloseTo(12000, 2);
  });

  it('raises the rate as deductions grow', () => {
    const light = calculateTargetRate(withInput({ taxPercent: 10 })).hourlyRate;
    const heavy = calculateTargetRate(withInput({ taxPercent: 40 })).hourlyRate;
    expect(heavy).toBeGreaterThan(light);
  });
});

describe('calculateTargetRate — hours', () => {
  it('derives billable hours from days, hours, weeks and the billable share', () => {
    const result = calculateTargetRate(withInput({ daysPerWeek: 4, hoursPerDay: 6, weeksPerYear: 48, billablePercent: 50 }));
    expect(result.totalHoursPerYear).toBe(4 * 6 * 48);
    expect(result.billableHoursPerYear).toBe(4 * 6 * 48 * 0.5);
  });

  it('spreads billable hours across twelve months, not across the weeks worked', () => {
    // 46 working weeks still has to fund 12 months of income, so the monthly
    // figure is the annual one divided by 12 — not weekly hours times 4.33.
    const result = calculateTargetRate(withInput({ weeksPerYear: 46 }));
    expect(result.billableHoursPerMonth).toBeCloseTo(result.billableHoursPerYear / 12, 2);
    expect(result.billableHoursPerMonth).not.toBeCloseTo(5 * 8 * 0.6 * 4.333, 1);
  });

  it('raises the rate when fewer hours are billable', () => {
    const optimistic = calculateTargetRate(withInput({ billablePercent: 90 })).hourlyRate;
    const realistic = calculateTargetRate(withInput({ billablePercent: 50 })).hourlyRate;
    expect(realistic).toBeGreaterThan(optimistic);
  });

  it('raises the rate when fewer weeks are worked', () => {
    const fullYear = calculateTargetRate(withInput({ weeksPerYear: 52 })).hourlyRate;
    const withHolidays = calculateTargetRate(withInput({ weeksPerYear: 44 })).hourlyRate;
    expect(withHolidays).toBeGreaterThan(fullYear);
  });

  it('keeps monthly and annual figures consistent to within the rounding of twelve months', () => {
    // Each monthly figure is rounded to the cent, so multiplying by twelve can
    // drift from the annual figure by up to 12 x 0.005 = 0.06. Both are
    // individually correct; this pins the drift down rather than leaving it
    // unbounded. The bound is 0.07 rather than 0.06 because the multiplication
    // in this assertion is itself floating-point and lands a hair over.
    const { monthly, annual } = calculateTargetRate(withInput({ taxPercent: 22, overheadPercent: 8 }));
    expect(Math.abs(monthly.gross * 12 - annual.gross)).toBeLessThanOrEqual(0.07);
    expect(Math.abs(monthly.tax * 12 - annual.tax)).toBeLessThanOrEqual(0.07);
    expect(Math.abs(monthly.net * 12 - annual.net)).toBeLessThanOrEqual(0.07);
  });
});

describe('calculateTargetRate — boundary values', () => {
  it('accepts 100% billable hours', () => {
    const result = calculateTargetRate(withInput({ billablePercent: 100 }));
    expect(result.billableHoursPerYear).toBe(result.totalHoursPerYear);
    expect(result.hourlyRate).toBeGreaterThan(0);
  });

  it('accepts a single billable percent without producing a non-finite rate', () => {
    const result = calculateTargetRate(withInput({ billablePercent: 1 }));
    expect(Number.isFinite(result.hourlyRate)).toBe(true);
    expect(result.hourlyRate).toBeGreaterThan(0);
  });

  it('accepts the maximum working schedule', () => {
    const result = calculateTargetRate(withInput({ daysPerWeek: 7, hoursPerDay: 24, weeksPerYear: 52 }));
    expect(result.totalHoursPerYear).toBe(8736);
  });

  it('accepts a single working week', () => {
    const result = calculateTargetRate(withInput({ weeksPerYear: 1 }));
    expect(result.billableHoursPerYear).toBeCloseTo(24, 2);
    expect(result.hourlyRate).toBeGreaterThan(0);
  });

  it('accepts a tax rate just under 100%', () => {
    const result = calculateTargetRate(withInput({ taxPercent: 99 }));
    expect(result.annual.net).toBeCloseTo(48000, 1);
    expect(result.annual.gross).toBeCloseTo(4800000, 0);
  });

  it('accepts fee plus overhead just under 100%', () => {
    const result = calculateTargetRate(withInput({ platformFeePercent: 50, overheadPercent: 49 }));
    expect(Number.isFinite(result.hourlyRate)).toBe(true);
    expect(result.annual.net).toBeCloseTo(48000, 1);
  });

  it('treats fee plus overhead above 100% as impossible even when tax is zero', () => {
    expect(() => calculateTargetRate(withInput({ platformFeePercent: 60, overheadPercent: 45 }))).toThrow(
      InvalidTargetRateInput,
    );
  });

  it('allows the three percentages to exceed 100% together, because tax applies later', () => {
    // 40 + 40 + 50 = 130%, yet solvable: tax is levied on the 20% that remains.
    const result = calculateTargetRate(
      withInput({ platformFeePercent: 40, overheadPercent: 40, taxPercent: 50 }),
    );
    expect(result.retentionRate).toBeCloseTo(0.1, 10);
    expect(result.annual.net).toBeCloseTo(48000, 1);
  });
});

describe('validateTargetRateInput', () => {
  const expectIssue = (patch: Partial<TargetRateInput>, code: string) => {
    const codes = validateTargetRateInput(withInput(patch)).map((issue) => issue.code);
    expect(codes).toContain(code);
  };

  it('accepts valid input', () => {
    expect(validateTargetRateInput(CLEAN)).toEqual([]);
    expect(validateTargetRateInput(TARGET_RATE_DEFAULTS)).toEqual([]);
  });

  it('rejects a non-positive target income', () => {
    expectIssue({ targetMonthlyNetIncome: 0 }, 'targetMonthlyNetIncome.notPositive');
    expectIssue({ targetMonthlyNetIncome: -100 }, 'targetMonthlyNetIncome.notPositive');
  });

  it('rejects impossible schedules', () => {
    expectIssue({ daysPerWeek: 0 }, 'daysPerWeek.outOfRange');
    expectIssue({ daysPerWeek: 8 }, 'daysPerWeek.outOfRange');
    expectIssue({ hoursPerDay: 25 }, 'hoursPerDay.outOfRange');
    expectIssue({ hoursPerDay: 0 }, 'hoursPerDay.outOfRange');
    expectIssue({ weeksPerYear: 53 }, 'weeksPerYear.outOfRange');
    expectIssue({ weeksPerYear: 0 }, 'weeksPerYear.outOfRange');
  });

  it('rejects a billable share of zero, which leaves nothing to invoice', () => {
    expectIssue({ billablePercent: 0 }, 'billablePercent.outOfRange');
    expectIssue({ billablePercent: 101 }, 'billablePercent.outOfRange');
  });

  it('rejects percentages outside 0–100', () => {
    expectIssue({ taxPercent: -1 }, 'taxPercent.outOfRange');
    expectIssue({ taxPercent: 101 }, 'taxPercent.outOfRange');
    expectIssue({ platformFeePercent: -5 }, 'platformFeePercent.outOfRange');
    expectIssue({ overheadPercent: 120 }, 'overheadPercent.outOfRange');
  });

  it('rejects a 100% tax rate, which no rate can outrun', () => {
    expectIssue({ taxPercent: 100 }, 'taxPercent.consumesEverything');
  });

  it('rejects fee and overhead that together consume the invoice', () => {
    expectIssue({ platformFeePercent: 70, overheadPercent: 30 }, 'deductions.exceedGross');
    expectIssue({ platformFeePercent: 100, overheadPercent: 0 }, 'deductions.exceedGross');
  });

  it('rejects non-finite numbers', () => {
    expectIssue({ targetMonthlyNetIncome: Number.NaN }, 'targetMonthlyNetIncome.notPositive');
    expectIssue({ hoursPerDay: Number.POSITIVE_INFINITY }, 'hoursPerDay.outOfRange');
    expectIssue({ taxPercent: Number.NaN }, 'taxPercent.outOfRange');
  });

  it('reports every problem at once so a form can mark all fields in one pass', () => {
    const issues = validateTargetRateInput(withInput({ targetMonthlyNetIncome: -1, daysPerWeek: 9, taxPercent: 200 }));
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(new Set(issues.map((issue) => issue.field)).size).toBe(issues.length);
  });

  it('throws from calculate rather than returning nonsense', () => {
    expect(() => calculateTargetRate(withInput({ billablePercent: 0 }))).toThrow(InvalidTargetRateInput);
    try {
      calculateTargetRate(withInput({ billablePercent: 0 }));
    } catch (error) {
      expect((error as InvalidTargetRateInput).issues[0]?.code).toBe('billablePercent.outOfRange');
    }
  });
});

describe('normalizeTargetRateInput', () => {
  it('falls back to defaults when nothing is supplied', () => {
    expect(normalizeTargetRateInput({})).toEqual(TARGET_RATE_DEFAULTS);
  });

  it('keeps values that are already valid', () => {
    expect(normalizeTargetRateInput({ taxPercent: 33 }).taxPercent).toBe(33);
  });

  it('clamps out-of-range values instead of throwing', () => {
    const input = normalizeTargetRateInput({ daysPerWeek: 99, hoursPerDay: -4, taxPercent: 500 });
    expect(input.daysPerWeek).toBe(7);
    expect(input.hoursPerDay).toBe(0);
    expect(input.taxPercent).toBe(100);
  });

  it('recovers from a hand-edited link rather than rendering a broken page', () => {
    const input = normalizeTargetRateInput({
      targetMonthlyNetIncome: Number.NaN,
      weeksPerYear: Number.POSITIVE_INFINITY,
    } as Partial<import('./target-rate').TargetRateInput>);
    expect(input.targetMonthlyNetIncome).toBe(TARGET_RATE_DEFAULTS.targetMonthlyNetIncome);
    expect(input.weeksPerYear).toBe(TARGET_RATE_DEFAULTS.weeksPerYear);
  });

  it('produces input the calculator accepts, for every default', () => {
    expect(validateTargetRateInput(normalizeTargetRateInput({}))).toEqual([]);
  });
});

describe('warningsFor', () => {
  it('stays quiet on realistic input', () => {
    expect(warningsFor(TARGET_RATE_DEFAULTS)).toEqual([]);
  });

  it('flags an optimistic billable share', () => {
    expect(warningsFor(withInput({ billablePercent: 95 })).map((w) => w.code)).toContain(
      'billablePercent.optimistic',
    );
  });

  it('flags an unsustainable workload', () => {
    expect(warningsFor(withInput({ daysPerWeek: 7, hoursPerDay: 10 })).map((w) => w.code)).toContain(
      'workload.unsustainable',
    );
  });

  it('flags a year with no time off', () => {
    expect(warningsFor(withInput({ weeksPerYear: 52 })).map((w) => w.code)).toContain('weeksPerYear.noTimeOff');
  });

  it('flags severe combined deductions', () => {
    expect(
      warningsFor(withInput({ taxPercent: 40, platformFeePercent: 20, overheadPercent: 15 })).map((w) => w.code),
    ).toContain('deductions.severe');
  });

  it('rides along with the result rather than blocking it', () => {
    const result = calculateTargetRate(withInput({ billablePercent: 100 }));
    expect(result.warnings.map((w) => w.code)).toContain('billablePercent.optimistic');
    expect(result.hourlyRate).toBeGreaterThan(0);
  });
});

describe('retentionRate', () => {
  it('is the product of surviving costs and surviving tax', () => {
    expect(retentionRate(withInput({ platformFeePercent: 10, overheadPercent: 10, taxPercent: 20 }))).toBeCloseTo(0.64, 10);
  });

  it('is 1 when nothing is deducted', () => {
    expect(retentionRate(CLEAN)).toBe(1);
  });

  it('inverts to the gross multiplier', () => {
    const input = withInput({ platformFeePercent: 15, overheadPercent: 5, taxPercent: 30 });
    const { annual } = calculateTargetRate(input);
    expect(annual.gross).toBeCloseTo((input.targetMonthlyNetIncome * 12) / retentionRate(input), 2);
  });
});
