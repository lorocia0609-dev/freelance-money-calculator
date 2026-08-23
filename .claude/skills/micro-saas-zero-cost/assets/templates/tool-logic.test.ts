/**
 * TEMPLATE — tests for a tool logic module. Copy alongside the module.
 *
 * What is worth testing here is correctness of the numbers, not the rendering.
 * A wrong figure destroys the site's credibility; a misaligned button does not.
 */
import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_TOOL_DEFAULTS,
  calculateExampleTool,
  normalizeExampleToolInput,
} from './tool-logic';

describe('calculateExampleTool', () => {
  it('computes a known case correctly', () => {
    const result = calculateExampleTool({
      annualTargetAmount: 60000,
      monthlyCosts: 500,
      overheadPercent: 20,
      unavailableDaysPerYear: 65,
    });

    // 60000 + 6000 = 66000 base; +20% overhead = 79200
    expect(result.breakdown.baseAmount).toBe(66000);
    expect(result.perYear).toBe(79200);
    expect(result.perMonth).toBe(6600);
    expect(result.breakdown.availableDays).toBe(300);
    expect(result.perDay).toBe(264);
  });

  it('treats the overhead input as a percentage, not a fraction', () => {
    const result = calculateExampleTool({ ...EXAMPLE_TOOL_DEFAULTS, overheadPercent: 50 });
    const base = result.breakdown.baseAmount;
    expect(result.perYear).toBeCloseTo(base * 1.5, 2);
  });

  it('never divides by zero when no days are available', () => {
    const result = calculateExampleTool({ ...EXAMPLE_TOOL_DEFAULTS, unavailableDaysPerYear: 365 });
    expect(Number.isFinite(result.perDay)).toBe(true);
  });

  it('returns values rounded to two decimals', () => {
    const result = calculateExampleTool({ ...EXAMPLE_TOOL_DEFAULTS, annualTargetAmount: 12345.678 });
    expect(result.perYear).toBe(Math.round(result.perYear * 100) / 100);
  });
});

describe('normalizeExampleToolInput', () => {
  it('falls back to defaults for missing values', () => {
    expect(normalizeExampleToolInput({})).toEqual(EXAMPLE_TOOL_DEFAULTS);
  });

  it('recovers from malformed input instead of throwing', () => {
    // A hand-edited shared link must never render a broken page.
    const input = normalizeExampleToolInput({ annualTargetAmount: NaN, overheadPercent: 999 });
    expect(Number.isFinite(input.annualTargetAmount)).toBe(true);
    expect(input.overheadPercent).toBeLessThanOrEqual(99);
  });

  it('rejects negative values', () => {
    expect(normalizeExampleToolInput({ monthlyCosts: -100 }).monthlyCosts).toBe(0);
  });
});
