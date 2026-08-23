import { describe, expect, it } from 'vitest';
import { SUPPORTED_CURRENCIES } from './constants';
import {
  decodeNumericState,
  encodeNumericState,
  hasAnyParam,
  readEnumParam,
} from './url-state';
import {
  TARGET_RATE_DEFAULTS,
  TARGET_RATE_PARAMS,
  type TargetRateInput,
  calculateTargetRate,
  normalizeTargetRateInput,
  validateTargetRateInput,
} from './tools/target-rate';

const SAMPLE: TargetRateInput = {
  targetMonthlyNetIncome: 4000,
  daysPerWeek: 5,
  hoursPerDay: 8,
  billablePercent: 60,
  weeksPerYear: 46,
  taxPercent: 20,
  platformFeePercent: 10,
  overheadPercent: 10,
};

describe('parameter names are a frozen public interface', () => {
  // Published links outlive the code. This test exists so that renaming a
  // parameter is a deliberate act with a visible diff, never a refactor
  // side-effect that silently changes what every shared link means.
  it('matches the published names exactly', () => {
    expect(TARGET_RATE_PARAMS).toEqual({
      targetMonthlyNetIncome: 'income',
      daysPerWeek: 'days',
      hoursPerDay: 'hours',
      billablePercent: 'billable',
      weeksPerYear: 'weeks',
      taxPercent: 'tax',
      platformFeePercent: 'fee',
      overheadPercent: 'expenses',
    });
  });

  it('covers every input field, so no input is lost when sharing', () => {
    expect(Object.keys(TARGET_RATE_PARAMS).sort()).toEqual(Object.keys(TARGET_RATE_DEFAULTS).sort());
  });

  it('uses a distinct name per field', () => {
    const names = Object.values(TARGET_RATE_PARAMS);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps names readable: lowercase, no punctuation, nothing encoded', () => {
    for (const name of Object.values(TARGET_RATE_PARAMS)) {
      expect(name).toMatch(/^[a-z]+$/);
      expect(encodeURIComponent(name)).toBe(name);
    }
  });
});

describe('encodeNumericState', () => {
  it('writes every field under its short name', () => {
    const params = encodeNumericState(SAMPLE, TARGET_RATE_PARAMS);
    expect(params.toString()).toBe(
      'income=4000&days=5&hours=8&billable=60&weeks=46&tax=20&fee=10&expenses=10',
    );
  });

  it('writes values that equal a default too', () => {
    // An omitted parameter would be re-read as whatever the default is at that
    // moment, so an old link would change meaning if a default were adjusted.
    const params = encodeNumericState(TARGET_RATE_DEFAULTS, TARGET_RATE_PARAMS);
    for (const alias of Object.values(TARGET_RATE_PARAMS)) {
      expect(params.has(alias)).toBe(true);
    }
  });

  it('skips values that are not finite rather than writing "NaN"', () => {
    const params = encodeNumericState({ ...SAMPLE, taxPercent: Number.NaN }, TARGET_RATE_PARAMS);
    expect(params.has('tax')).toBe(false);
    expect(params.has('income')).toBe(true);
  });

  it('produces a query string that needs no escaping', () => {
    const query = encodeNumericState(SAMPLE, TARGET_RATE_PARAMS).toString();
    expect(query).not.toContain('%');
  });
});

describe('decodeNumericState', () => {
  it('reads a well-formed query string', () => {
    const decoded = decodeNumericState('?income=7000&tax=30', TARGET_RATE_PARAMS);
    expect(decoded).toEqual({ targetMonthlyNetIncome: 7000, taxPercent: 30 });
  });

  it('works with or without the leading question mark', () => {
    expect(decodeNumericState('income=100', TARGET_RATE_PARAMS)).toEqual(
      decodeNumericState('?income=100', TARGET_RATE_PARAMS),
    );
  });

  it('reports nothing for an empty query string', () => {
    expect(decodeNumericState('', TARGET_RATE_PARAMS)).toEqual({});
    expect(decodeNumericState('?', TARGET_RATE_PARAMS)).toEqual({});
  });

  it('ignores parameters it does not own', () => {
    const decoded = decodeNumericState('?income=5000&utm_source=twitter&ref=abc', TARGET_RATE_PARAMS);
    expect(decoded).toEqual({ targetMonthlyNetIncome: 5000 });
  });

  it('ignores values that are not numbers', () => {
    const decoded = decodeNumericState('?income=lots&tax=30', TARGET_RATE_PARAMS);
    expect(decoded).toEqual({ taxPercent: 30 });
  });

  it('ignores empty and whitespace-only values', () => {
    expect(decodeNumericState('?income=&tax=%20', TARGET_RATE_PARAMS)).toEqual({});
  });

  it('ignores an injected payload instead of carrying it into state', () => {
    const decoded = decodeNumericState(
      '?income=<script>alert(1)</script>&tax=javascript:alert(1)',
      TARGET_RATE_PARAMS,
    );
    expect(decoded).toEqual({});
  });

  it('ignores Infinity and NaN spelled out', () => {
    expect(decodeNumericState('?income=Infinity&tax=NaN', TARGET_RATE_PARAMS)).toEqual({});
  });

  it('round-trips every field without loss', () => {
    const query = encodeNumericState(SAMPLE, TARGET_RATE_PARAMS).toString();
    expect(decodeNumericState(query, TARGET_RATE_PARAMS)).toEqual(SAMPLE);
  });
});

describe('hasAnyParam', () => {
  it('detects a link that carries tool state', () => {
    expect(hasAnyParam('?income=5000', TARGET_RATE_PARAMS)).toBe(true);
  });

  it('is false for an unrelated query string, so stored values still win', () => {
    expect(hasAnyParam('?utm_source=newsletter', TARGET_RATE_PARAMS)).toBe(false);
    expect(hasAnyParam('', TARGET_RATE_PARAMS)).toBe(false);
  });
});

describe('readEnumParam', () => {
  it('reads a supported currency', () => {
    expect(readEnumParam('?currency=EUR', 'currency', SUPPORTED_CURRENCIES, 'USD')).toBe('EUR');
  });

  it('falls back when the currency is missing', () => {
    expect(readEnumParam('?income=100', 'currency', SUPPORTED_CURRENCIES, 'USD')).toBe('USD');
  });

  it('falls back for an unsupported or malformed code', () => {
    // An invalid ISO code reaching Intl.NumberFormat would throw at render time.
    expect(readEnumParam('?currency=XYZ', 'currency', SUPPORTED_CURRENCIES, 'USD')).toBe('USD');
    expect(readEnumParam('?currency=', 'currency', SUPPORTED_CURRENCIES, 'USD')).toBe('USD');
    expect(readEnumParam('?currency=usd', 'currency', SUPPORTED_CURRENCIES, 'USD')).toBe('USD');
  });
});

describe('a shared link always produces a usable page', () => {
  const load = (search: string): TargetRateInput =>
    normalizeTargetRateInput(decodeNumericState(search, TARGET_RATE_PARAMS));

  it('reproduces the exact configuration it was built from', () => {
    const query = encodeNumericState(SAMPLE, TARGET_RATE_PARAMS).toString();
    const restored = load(query);
    expect(restored).toEqual(SAMPLE);
    expect(calculateTargetRate(restored).hourlyRate).toBe(calculateTargetRate(SAMPLE).hourlyRate);
  });

  it('fills a partial link with defaults', () => {
    const restored = load('?income=9000');
    expect(restored.targetMonthlyNetIncome).toBe(9000);
    expect(restored.taxPercent).toBe(TARGET_RATE_DEFAULTS.taxPercent);
    expect(validateTargetRateInput(restored)).toEqual([]);
  });

  it('clamps out-of-range values rather than rejecting the link', () => {
    const restored = load('?days=99&hours=-4&tax=500&billable=1000');
    expect(restored.daysPerWeek).toBe(7);
    expect(restored.hoursPerDay).toBe(0);
    expect(restored.taxPercent).toBe(100);
    expect(restored.billablePercent).toBe(100);
  });

  it.each([
    '',
    '?',
    '?income=',
    '?income=abc&days=xyz',
    '?income=-5000',
    '?income=1e400',
    '?days=0&hours=0&billable=0',
    '?fee=80&expenses=80',
    '?income=5000&income=6000',
    '?' + 'x'.repeat(2000),
  ])('never throws on %s', (search) => {
    expect(() => load(search)).not.toThrow();
    const restored = load(search);
    for (const value of Object.values(restored)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('leaves an impossible-but-well-formed link for the form to explain', () => {
    // Clamping cannot fix fee + expenses >= 100%: no rate exists. The values
    // stay as given so the interface can say why, rather than being silently
    // rewritten into something the visitor did not ask for.
    const restored = load('?fee=60&expenses=45');
    expect(restored.platformFeePercent).toBe(60);
    expect(restored.overheadPercent).toBe(45);
    expect(validateTargetRateInput(restored).map((i) => i.code)).toContain('deductions.exceedGross');
  });
});
