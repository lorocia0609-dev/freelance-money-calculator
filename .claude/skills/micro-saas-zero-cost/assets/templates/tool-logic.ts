/**
 * TEMPLATE — pure tool logic. Copy to src/lib/tools/<tool-name>.ts and adapt.
 *
 * Rules this file demonstrates, and why they matter:
 *  - No imports from any UI framework. This module must run in plain Node so the
 *    tests stay fast and the logic can be reused by another surface later.
 *  - Units are encoded in the property names. Unit confusion (monthly vs annual,
 *    percent vs fraction) is the defect that actually ships in this domain.
 *  - Inputs are validated and clamped here, because they arrive from a URL that
 *    users edit by hand.
 *  - Returns numbers, never formatted strings. Formatting is locale-dependent
 *    and belongs in lib/format.ts.
 */

export interface ExampleToolInput {
  /** Target amount per year, in major currency units. */
  annualTargetAmount: number;
  /** Recurring costs per month, in major currency units. */
  monthlyCosts: number;
  /** Percentage 0–100, not a 0–1 fraction. */
  overheadPercent: number;
  /** Whole days per year, 0–365. */
  unavailableDaysPerYear: number;
}

export interface ExampleToolResult {
  perYear: number;
  perMonth: number;
  perDay: number;
  /** Intermediate values, so the UI can show a breakdown instead of one opaque number. */
  breakdown: {
    baseAmount: number;
    costsAmount: number;
    overheadAmount: number;
    availableDays: number;
  };
}

/** Defaults must produce a meaningful result on first paint — never an empty state. */
export const EXAMPLE_TOOL_DEFAULTS: ExampleToolInput = {
  annualTargetAmount: 60000,
  monthlyCosts: 400,
  overheadPercent: 20,
  unavailableDaysPerYear: 30,
};

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

/**
 * Normalizes untrusted input (query string, localStorage, manual typing) into a
 * usable shape. Returning a valid object rather than throwing keeps a malformed
 * shared link from rendering a broken page.
 */
export function normalizeExampleToolInput(
  raw: Partial<ExampleToolInput>,
): ExampleToolInput {
  return {
    annualTargetAmount: clamp(Number(raw.annualTargetAmount ?? EXAMPLE_TOOL_DEFAULTS.annualTargetAmount), 0, 1e9),
    monthlyCosts: clamp(Number(raw.monthlyCosts ?? EXAMPLE_TOOL_DEFAULTS.monthlyCosts), 0, 1e9),
    overheadPercent: clamp(Number(raw.overheadPercent ?? EXAMPLE_TOOL_DEFAULTS.overheadPercent), 0, 99),
    unavailableDaysPerYear: clamp(Number(raw.unavailableDaysPerYear ?? EXAMPLE_TOOL_DEFAULTS.unavailableDaysPerYear), 0, 364),
  };
}

/** Rounds to 2 decimals at the boundary so floating-point drift never reaches the UI. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

export function calculateExampleTool(input: ExampleToolInput): ExampleToolResult {
  const { annualTargetAmount, monthlyCosts, overheadPercent, unavailableDaysPerYear } = input;

  const costsAmount = monthlyCosts * 12;
  const baseAmount = annualTargetAmount + costsAmount;
  const overheadAmount = baseAmount * (overheadPercent / 100);
  const perYear = baseAmount + overheadAmount;

  const availableDays = Math.max(365 - unavailableDaysPerYear, 1);

  return {
    perYear: round2(perYear),
    perMonth: round2(perYear / 12),
    perDay: round2(perYear / availableDays),
    breakdown: {
      baseAmount: round2(baseAmount),
      costsAmount: round2(costsAmount),
      overheadAmount: round2(overheadAmount),
      availableDays,
    },
  };
}
