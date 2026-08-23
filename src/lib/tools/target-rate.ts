/**
 * Target-income rate calculator.
 *
 * Answers: "what do I need to charge per hour to end up with the monthly net
 * income I actually want?"
 *
 * Pure module — no framework imports, no DOM. It takes plain numbers and
 * returns plain numbers; formatting is the caller's job (see lib/format.ts).
 */

/* ------------------------------------------------------------------- input */

export interface TargetRateInput {
  /** Take-home pay wanted every month, in major currency units, after every deduction below. */
  targetMonthlyNetIncome: number;
  /** Working days per week, 0 < d <= 7. */
  daysPerWeek: number;
  /** Working hours per working day, 0 < h <= 24. */
  hoursPerDay: number;
  /**
   * Share of working hours that can actually be invoiced, 0 < b <= 100.
   * The rest goes to admin, sales, proposals and unpaid revisions — this is the
   * input freelancers most often overestimate, and the one that moves the
   * result the most.
   */
  billablePercent: number;
  /** Weeks actually worked per year, 0 < w <= 52. Subtract holidays and time off. */
  weeksPerYear: number;
  /** Income tax and social contributions as a percentage of taxable profit, 0 <= t < 100. */
  taxPercent: number;
  /** Marketplace commission as a percentage of the invoiced amount, 0 <= p < 100. */
  platformFeePercent: number;
  /** Business running costs as a percentage of the invoiced amount, 0 <= o < 100. */
  overheadPercent: number;
}

/**
 * Defaults produce a meaningful result on first paint rather than an empty
 * state. 60% billable and 46 working weeks are deliberately realistic rather
 * than flattering: a calculator that starts at 100%/52 teaches the exact
 * mistake this tool exists to correct.
 */
export const TARGET_RATE_DEFAULTS: TargetRateInput = {
  targetMonthlyNetIncome: 5000,
  daysPerWeek: 5,
  hoursPerDay: 8,
  billablePercent: 60,
  weeksPerYear: 46,
  taxPercent: 25,
  platformFeePercent: 0,
  overheadPercent: 10,
};

/* ------------------------------------------------------------------ output */

/** Every amount in one period. The four parts always sum exactly to `gross`. */
export interface MoneyBreakdown {
  gross: number;
  platformFee: number;
  overhead: number;
  tax: number;
  net: number;
}

export interface TargetRateResult {
  /** The headline figure: what to charge per billable hour. */
  hourlyRate: number;
  monthly: MoneyBreakdown;
  annual: MoneyBreakdown;
  billableHoursPerMonth: number;
  billableHoursPerYear: number;
  /** Hours worked including non-billable time, for contrast with the billable figure. */
  totalHoursPerYear: number;
  /** Fraction of every invoiced unit that survives to net income, 0–1. */
  retentionRate: number;
  warnings: TargetRateWarning[];
}

/* -------------------------------------------------------------- validation */

export interface ValidationIssue {
  field: keyof TargetRateInput | 'deductions';
  /** Stable code, usable directly as an i18n key. */
  code: string;
}

export class InvalidTargetRateInput extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(`Invalid input: ${issues.map((i) => i.code).join(', ')}`);
    this.name = 'InvalidTargetRateInput';
  }
}

const isPositive = (value: number) => Number.isFinite(value) && value > 0;
const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

/**
 * Reports every problem at once rather than stopping at the first, so a form can
 * mark all offending fields in one pass.
 */
export function validateTargetRateInput(input: TargetRateInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const {
    targetMonthlyNetIncome, daysPerWeek, hoursPerDay, billablePercent,
    weeksPerYear, taxPercent, platformFeePercent, overheadPercent,
  } = input;

  if (!isPositive(targetMonthlyNetIncome)) {
    issues.push({ field: 'targetMonthlyNetIncome', code: 'targetMonthlyNetIncome.notPositive' });
  }
  if (!isPositive(daysPerWeek) || daysPerWeek > 7) {
    issues.push({ field: 'daysPerWeek', code: 'daysPerWeek.outOfRange' });
  }
  if (!isPositive(hoursPerDay) || hoursPerDay > 24) {
    issues.push({ field: 'hoursPerDay', code: 'hoursPerDay.outOfRange' });
  }
  // Zero billable hours means there is nothing to divide the revenue by — the
  // question has no answer rather than a large one.
  if (!isPositive(billablePercent) || billablePercent > 100) {
    issues.push({ field: 'billablePercent', code: 'billablePercent.outOfRange' });
  }
  if (!isPositive(weeksPerYear) || weeksPerYear > 52) {
    issues.push({ field: 'weeksPerYear', code: 'weeksPerYear.outOfRange' });
  }
  if (!inRange(taxPercent, 0, 100)) {
    issues.push({ field: 'taxPercent', code: 'taxPercent.outOfRange' });
  } else if (taxPercent === 100) {
    // A 100% tax rate leaves nothing behind at any price.
    issues.push({ field: 'taxPercent', code: 'taxPercent.consumesEverything' });
  }
  if (!inRange(platformFeePercent, 0, 100)) {
    issues.push({ field: 'platformFeePercent', code: 'platformFeePercent.outOfRange' });
  }
  if (!inRange(overheadPercent, 0, 100)) {
    issues.push({ field: 'overheadPercent', code: 'overheadPercent.outOfRange' });
  }

  // Platform fee and overhead both come off the invoiced amount, so together
  // they cannot reach 100%: no rate, however high, would leave taxable profit.
  // Tax is not part of this sum — it applies to what remains after these two,
  // so 40% + 40% + 50% is punishing but still solvable.
  if (
    inRange(platformFeePercent, 0, 100) &&
    inRange(overheadPercent, 0, 100) &&
    platformFeePercent + overheadPercent >= 100
  ) {
    issues.push({ field: 'deductions', code: 'deductions.exceedGross' });
  }

  return issues;
}

/* ---------------------------------------------------------------- warnings */

export interface TargetRateWarning {
  field: keyof TargetRateInput | 'workload';
  code: string;
}

/**
 * Non-blocking notes about inputs that are valid arithmetic but poor planning.
 * The result is still returned — the point is to stop someone quietly building
 * a rate on an assumption that will not survive contact with a real year.
 */
export function warningsFor(input: TargetRateInput): TargetRateWarning[] {
  const warnings: TargetRateWarning[] = [];

  if (input.billablePercent > 90) {
    warnings.push({ field: 'billablePercent', code: 'billablePercent.optimistic' });
  }
  if (input.daysPerWeek * input.hoursPerDay > 60) {
    warnings.push({ field: 'workload', code: 'workload.unsustainable' });
  }
  if (input.weeksPerYear > 50) {
    warnings.push({ field: 'weeksPerYear', code: 'weeksPerYear.noTimeOff' });
  }
  if (input.taxPercent + input.platformFeePercent + input.overheadPercent >= 70) {
    warnings.push({ field: 'workload', code: 'deductions.severe' });
  }

  return warnings;
}

/* ------------------------------------------------------------ normalization */

const clamp = (value: number, min: number, max: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;

/**
 * Turns untrusted input — a hand-edited query string, stale localStorage — into
 * a usable shape. Returns a valid object instead of throwing, because a
 * malformed shared link must never render a broken page.
 *
 * Clamping cannot resolve every impossibility (platform fee plus overhead may
 * still reach 100%), so callers validate before calculating.
 */
export function normalizeTargetRateInput(raw: Partial<TargetRateInput>): TargetRateInput {
  const d = TARGET_RATE_DEFAULTS;
  return {
    targetMonthlyNetIncome: clamp(Number(raw.targetMonthlyNetIncome), 0, 1e9, d.targetMonthlyNetIncome),
    daysPerWeek: clamp(Number(raw.daysPerWeek), 0, 7, d.daysPerWeek),
    hoursPerDay: clamp(Number(raw.hoursPerDay), 0, 24, d.hoursPerDay),
    billablePercent: clamp(Number(raw.billablePercent), 0, 100, d.billablePercent),
    weeksPerYear: clamp(Number(raw.weeksPerYear), 0, 52, d.weeksPerYear),
    taxPercent: clamp(Number(raw.taxPercent), 0, 100, d.taxPercent),
    platformFeePercent: clamp(Number(raw.platformFeePercent), 0, 100, d.platformFeePercent),
    overheadPercent: clamp(Number(raw.overheadPercent), 0, 100, d.overheadPercent),
  };
}

/* ------------------------------------------------------------- calculation */

/** Rounds at the boundary so floating-point drift never reaches a displayed figure. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Splits one period's gross revenue into its parts.
 *
 * Order matters and reflects how the money actually moves: the marketplace takes
 * its cut of the invoice, business costs are paid out of what arrives, and tax
 * is levied on the profit that remains — platform fees and business expenses are
 * deductible in essentially every jurisdiction. Taxing the full invoice instead
 * would overstate the required rate by taxing money the freelancer never receives.
 *
 * `net` is computed as the residual of the rounded parts, so the four figures
 * always add up to `gross` exactly; a breakdown that visibly fails to sum reads
 * as a bug even when each line is individually correct.
 */
function splitGross(grossRaw: number, input: TargetRateInput): MoneyBreakdown {
  const feeRate = input.platformFeePercent / 100;
  const overheadRate = input.overheadPercent / 100;
  const taxRate = input.taxPercent / 100;

  const gross = round2(grossRaw);
  const platformFee = round2(grossRaw * feeRate);
  const overhead = round2(grossRaw * overheadRate);
  const tax = round2(grossRaw * (1 - feeRate - overheadRate) * taxRate);
  const net = round2(gross - platformFee - overhead - tax);

  return { gross, platformFee, overhead, tax, net };
}

/**
 * Fraction of each invoiced unit that survives to net income.
 *
 *   retention = (1 − fee − overhead) × (1 − tax)
 *
 * and therefore   gross = net / retention.
 */
export function retentionRate(input: TargetRateInput): number {
  const afterCosts = 1 - input.platformFeePercent / 100 - input.overheadPercent / 100;
  return afterCosts * (1 - input.taxPercent / 100);
}

/**
 * @throws {InvalidTargetRateInput} when the input cannot produce an answer.
 *   Call {@link validateTargetRateInput} first to show field-level errors; this
 *   throw is the backstop against calculating on impossible input.
 */
export function calculateTargetRate(input: TargetRateInput): TargetRateResult {
  const issues = validateTargetRateInput(input);
  if (issues.length > 0) throw new InvalidTargetRateInput(issues);

  const retention = retentionRate(input);

  // The target is a net income every month, including months with holidays in
  // them, so the whole year's revenue must cover twelve months of it. Billable
  // hours are likewise spread across twelve months rather than across the weeks
  // actually worked — otherwise the rate silently assumes an unpaid vacation.
  const targetAnnualNet = input.targetMonthlyNetIncome * 12;
  const grossAnnualRaw = targetAnnualNet / retention;

  const totalHoursPerYear = input.daysPerWeek * input.hoursPerDay * input.weeksPerYear;
  const billableHoursPerYearRaw = totalHoursPerYear * (input.billablePercent / 100);

  return {
    hourlyRate: round2(grossAnnualRaw / billableHoursPerYearRaw),
    monthly: splitGross(grossAnnualRaw / 12, input),
    annual: splitGross(grossAnnualRaw, input),
    billableHoursPerMonth: round2(billableHoursPerYearRaw / 12),
    billableHoursPerYear: round2(billableHoursPerYearRaw),
    totalHoursPerYear: round2(totalHoursPerYear),
    retentionRate: retention,
    warnings: warningsFor(input),
  };
}
