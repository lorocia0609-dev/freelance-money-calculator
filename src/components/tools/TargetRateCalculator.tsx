import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SUPPORTED_CURRENCIES, isCurrency, type Currency, type Locale } from '../../lib/constants';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/format';
import { readStored, writeStored } from '../../lib/storage';
import {
  decodeNumericState,
  encodeNumericState,
  hasAnyParam,
  readEnumParam,
} from '../../lib/url-state';
import {
  TARGET_RATE_DEFAULTS,
  TARGET_RATE_PARAMS,
  type MoneyBreakdown,
  type TargetRateInput,
  calculateTargetRate,
  normalizeTargetRateInput,
  validateTargetRateInput,
} from '../../lib/tools/target-rate';

/**
 * Interactive shell around the target-rate logic module.
 *
 * It renders and delegates: every number on screen comes from
 * `calculateTargetRate`, and no formula is repeated here. Keeping it that way is
 * what lets the arithmetic be tested without a DOM.
 *
 * Strings arrive as a prop rather than being looked up here, so only the active
 * locale's text is serialized into the page instead of both catalogues being
 * bundled into the client JavaScript.
 */

type FieldName = keyof TargetRateInput;

interface FieldStrings {
  label: string;
  help: string;
}

export interface TargetRateStrings {
  question: string;
  headline: string;
  perHour: string;
  retention: string;
  prompt: string;
  recalculating: string;
  incomeLegend: string;
  timeLegend: string;
  deductionsLegend: string;
  breakdownTitle: string;
  hoursTitle: string;
  perMonth: string;
  perYear: string;
  grossLabel: string;
  platformFeeLabel: string;
  overheadLabel: string;
  taxLabel: string;
  netLabel: string;
  billableHoursLabel: string;
  totalHoursLabel: string;
  taxNote: string;
  disclaimer: string;
  copyLink: string;
  copied: string;
  shareHelp: string;
  fields: Record<FieldName | 'currency', FieldStrings>;
  errors: Record<string, Record<string, string>>;
  warnings: Record<string, Record<string, string>>;
}

interface Props {
  locale: Locale;
  defaultCurrency: Currency;
  strings: TargetRateStrings;
}

/**
 * Versioned, so a future change to the stored shape can be ignored rather than
 * crashing on a value written by an older build.
 */
const STORAGE_KEY = 'fmc:targetRate:v1';

interface StoredState {
  input: Partial<TargetRateInput>;
  currency: string;
}

/** Long enough that typing does not spam history, short enough to feel instant. */
const SYNC_DELAY_MS = 400;

/** Inputs are held as raw strings so a field can be emptied while typing. */
type RawState = Record<FieldName, string>;

const toRaw = (input: TargetRateInput): RawState =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)])) as RawState;

/**
 * An empty field becomes NaN rather than 0, so validation asks for a value
 * instead of silently treating a blank tax field as "no tax".
 */
const parseRaw = (raw: RawState): TargetRateInput =>
  Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value.trim() === '' ? Number.NaN : Number(value)]),
  ) as unknown as TargetRateInput;

/** Reads a dotted code such as "taxPercent.consumesEverything" out of a strings table. */
const lookup = (table: Record<string, Record<string, string>>, code: string): string | undefined => {
  const [group, name] = code.split('.');
  return group && name ? table[group]?.[name] : undefined;
};

const NUMERIC_BOUNDS: Record<FieldName, { min: number; max: number; step: number }> = {
  targetMonthlyNetIncome: { min: 0, max: 1_000_000_000, step: 100 },
  daysPerWeek: { min: 1, max: 7, step: 1 },
  hoursPerDay: { min: 1, max: 24, step: 1 },
  billablePercent: { min: 1, max: 100, step: 5 },
  weeksPerYear: { min: 1, max: 52, step: 1 },
  taxPercent: { min: 0, max: 100, step: 1 },
  platformFeePercent: { min: 0, max: 100, step: 1 },
  overheadPercent: { min: 0, max: 100, step: 1 },
};

export default function TargetRateCalculator({ locale, defaultCurrency, strings }: Props) {
  // Initialized from the defaults so the first client render matches the HTML
  // Astro rendered at build time. Reading the URL or localStorage here instead
  // would make the two disagree and corrupt hydration.
  const [raw, setRaw] = useState<RawState>(() => toRaw(TARGET_RATE_DEFAULTS));
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [copied, setCopied] = useState(false);

  // Nothing is written back until the visitor actually changes something, so
  // simply opening the page never rewrites the address bar or storage.
  const touched = useRef(false);

  /**
   * Restores state once, on mount.
   *
   * A link wins over stored values: someone opening a shared configuration must
   * see that configuration, not whatever they last typed here themselves.
   */
  useEffect(() => {
    const search = window.location.search;

    if (hasAnyParam(search, TARGET_RATE_PARAMS)) {
      setRaw(toRaw(normalizeTargetRateInput(decodeNumericState(search, TARGET_RATE_PARAMS))));
      setCurrency(readEnumParam(search, 'currency', SUPPORTED_CURRENCIES, defaultCurrency));
      return;
    }

    const stored = readStored<StoredState>(STORAGE_KEY);
    if (!stored) return;
    // Anything could be under that key — a value from an older build, or edited
    // by hand. Normalizing it is the same guarantee a shared link gets.
    setRaw(toRaw(normalizeTargetRateInput(stored.input ?? {})));
    if (typeof stored.currency === 'string' && isCurrency(stored.currency)) {
      setCurrency(stored.currency);
    }
  }, []);

  // Derived during render, not in an effect, so the server-rendered HTML already
  // carries a full result. The page is meaningful with JavaScript disabled.
  const input = useMemo(() => parseRaw(raw), [raw]);
  const issues = useMemo(() => validateTargetRateInput(input), [input]);
  const result = useMemo(
    () => (issues.length === 0 ? calculateTargetRate(input) : null),
    [input, issues],
  );

  /**
   * Mirrors valid state into the address bar and localStorage.
   *
   * Only complete, valid input is written: persisting a half-typed value would
   * hand out a link that reproduces a broken form. replaceState rather than
   * pushState, so editing does not fill the back button with history entries.
   */
  useEffect(() => {
    if (!touched.current || issues.length > 0) return;

    const timer = window.setTimeout(() => {
      const params = encodeNumericState(input, TARGET_RATE_PARAMS);
      params.set('currency', currency);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      writeStored(STORAGE_KEY, { input, currency } satisfies StoredState);
    }, SYNC_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [input, currency, issues.length]);

  const shareableUrl = (): string => {
    const params = encodeNumericState(input, TARGET_RATE_PARAMS);
    params.set('currency', currency);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked or unavailable over plain HTTP. The
      // address bar already holds the same URL, so there is nothing to recover.
    }
  };

  const errorFor = (field: FieldName): string | undefined => {
    const issue = issues.find((candidate) => candidate.field === field);
    return issue ? lookup(strings.errors, issue.code) : undefined;
  };
  const globalError = (() => {
    const issue = issues.find((candidate) => candidate.field === 'deductions');
    return issue ? lookup(strings.errors, issue.code) : undefined;
  })();

  const money = (value: number) => formatCurrency(value, locale, currency);

  const update = (field: FieldName) => (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    touched.current = true;
    setRaw((previous) => ({ ...previous, [field]: target.value }));
  };

  const numberField = (field: FieldName, suffix?: string) => {
    const bounds = NUMERIC_BOUNDS[field];
    const text = strings.fields[field];
    const error = errorFor(field);
    const helpId = `${field}-help`;
    const errorId = `${field}-error`;

    return (
      <div class="grid gap-1.5">
        <label for={field} class="text-sm font-medium">
          {text.label}
          {suffix ? <span class="font-normal opacity-70"> ({suffix})</span> : null}
        </label>
        <input
          id={field}
          name={field}
          type="number"
          inputMode="decimal"
          value={raw[field]}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          onInput={update(field)}
          aria-describedby={error ? `${errorId} ${helpId}` : helpId}
          aria-invalid={error ? 'true' : undefined}
          class="w-full rounded-lg border px-3 py-2.5 text-base"
          style={`border-color: var(--color-border); background: var(--color-surface); color: var(--color-ink); ${
            error ? 'border-width:2px; border-color: var(--color-danger);' : ''
          }`}
        />
        {/* Errors are text, not colour alone, and are tied to the field for screen readers. */}
        {error ? (
          <p id={errorId} class="text-sm font-medium" style="color: var(--color-danger)">
            {error}
          </p>
        ) : null}
        <p id={helpId} class="text-xs" style="color: var(--color-ink-muted)">
          {text.help}
        </p>
      </div>
    );
  };

  const breakdownRows = (period: MoneyBreakdown) => (
    <table class="w-full text-sm">
      <tbody>
        <tr class="border-b" style="border-color: var(--color-border)">
          <th scope="row" class="py-2 text-left font-normal">{strings.grossLabel}</th>
          <td class="py-2 text-right font-medium tabular-nums">{money(period.gross)}</td>
        </tr>
        {period.platformFee > 0 ? (
          <tr class="border-b" style="border-color: var(--color-border)">
            <th scope="row" class="py-2 text-left font-normal" style="color: var(--color-ink-muted)">
              − {strings.platformFeeLabel}
            </th>
            <td class="py-2 text-right tabular-nums" style="color: var(--color-ink-muted)">
              {money(period.platformFee)}
            </td>
          </tr>
        ) : null}
        {period.overhead > 0 ? (
          <tr class="border-b" style="border-color: var(--color-border)">
            <th scope="row" class="py-2 text-left font-normal" style="color: var(--color-ink-muted)">
              − {strings.overheadLabel}
            </th>
            <td class="py-2 text-right tabular-nums" style="color: var(--color-ink-muted)">
              {money(period.overhead)}
            </td>
          </tr>
        ) : null}
        {period.tax > 0 ? (
          <tr class="border-b" style="border-color: var(--color-border)">
            <th scope="row" class="py-2 text-left font-normal" style="color: var(--color-ink-muted)">
              − {strings.taxLabel}
            </th>
            <td class="py-2 text-right tabular-nums" style="color: var(--color-ink-muted)">
              {money(period.tax)}
            </td>
          </tr>
        ) : null}
        <tr>
          <th scope="row" class="pt-2 text-left font-semibold">{strings.netLabel}</th>
          <td class="pt-2 text-right font-semibold tabular-nums">{money(period.net)}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div class="mt-8 grid gap-6">
      {/* Headline first: the page answers its own question on load, before any input. */}
      <section
        class="rounded-xl border p-5 sm:p-6"
        style="border-color: var(--color-border); background: var(--color-surface-raised)"
      >
        <h2 class="text-sm font-medium" style="color: var(--color-ink-muted)">
          {strings.headline}
        </h2>
        <p aria-live="polite" class="mt-1">
          {result ? (
            <>
              <span class="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                {money(result.hourlyRate)}
              </span>
              <span class="ml-2 text-sm" style="color: var(--color-ink-muted)">
                {strings.perHour}
              </span>
            </>
          ) : (
            <span class="text-lg" style="color: var(--color-ink-muted)">
              {globalError ?? strings.prompt}
            </span>
          )}
        </p>
        {result ? (
          <p class="mt-3 text-sm" style="color: var(--color-ink-muted)">
            {strings.retention.replace('{percent}', formatPercent(result.retentionRate * 100, locale))}
          </p>
        ) : null}

        {result ? (
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyLink}
              class="rounded-lg border px-3 py-2 text-sm font-medium"
              style="border-color: var(--color-border); color: var(--color-ink)"
            >
              {copied ? strings.copied : strings.copyLink}
            </button>
            {/* The confirmation is announced, not just shown, and is text rather than a colour change. */}
            <span aria-live="polite" class="text-xs" style="color: var(--color-ink-muted)">
              {copied ? strings.copied : strings.shareHelp}
            </span>
          </div>
        ) : null}
      </section>

      <div class="grid gap-6 md:grid-cols-5 md:items-start">
        <form class="grid gap-6 md:col-span-3" onSubmit={(event) => event.preventDefault()}>
          <fieldset class="grid gap-4">
            <legend class="mb-2 text-base font-semibold">{strings.incomeLegend}</legend>
            {numberField('targetMonthlyNetIncome', currency)}
            <div class="grid gap-1.5">
              <label for="currency" class="text-sm font-medium">
                {strings.fields.currency.label}
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(event) => {
                  touched.current = true;
                  setCurrency((event.currentTarget as HTMLSelectElement).value as Currency);
                }}
                aria-describedby="currency-help"
                class="w-full rounded-lg border px-3 py-2.5 text-base"
                style="border-color: var(--color-border); background: var(--color-surface); color: var(--color-ink)"
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code} — {currencyName(locale, code)}
                  </option>
                ))}
              </select>
              <p id="currency-help" class="text-xs" style="color: var(--color-ink-muted)">
                {strings.fields.currency.help}
              </p>
            </div>
          </fieldset>

          <fieldset class="grid gap-4">
            <legend class="mb-2 text-base font-semibold">{strings.timeLegend}</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              {numberField('daysPerWeek')}
              {numberField('hoursPerDay')}
            </div>
            {numberField('weeksPerYear')}
            {numberField('billablePercent', '%')}
          </fieldset>

          <fieldset class="grid gap-4">
            <legend class="mb-2 text-base font-semibold">{strings.deductionsLegend}</legend>
            {numberField('taxPercent', '%')}
            {numberField('platformFeePercent', '%')}
            {numberField('overheadPercent', '%')}
            <p class="text-xs" style="color: var(--color-ink-muted)">
              {strings.taxNote}
            </p>
            {globalError ? (
              <p class="text-sm font-medium" style="color: var(--color-danger)">
                {globalError}
              </p>
            ) : null}
          </fieldset>
        </form>

        <div class="grid gap-6 md:sticky md:top-6 md:col-span-2">
          {result ? (
            <>
              <section class="rounded-xl border p-5" style="border-color: var(--color-border)">
                <h2 class="text-base font-semibold">{strings.breakdownTitle}</h2>
                <h3 class="mt-4 text-xs font-medium uppercase tracking-wide" style="color: var(--color-ink-muted)">
                  {strings.perMonth}
                </h3>
                {breakdownRows(result.monthly)}
                <h3 class="mt-6 text-xs font-medium uppercase tracking-wide" style="color: var(--color-ink-muted)">
                  {strings.perYear}
                </h3>
                {breakdownRows(result.annual)}
              </section>

              <section class="rounded-xl border p-5" style="border-color: var(--color-border)">
                <h2 class="text-base font-semibold">{strings.hoursTitle}</h2>
                <dl class="mt-3 grid gap-2 text-sm">
                  <div class="flex justify-between gap-4">
                    <dt style="color: var(--color-ink-muted)">
                      {strings.billableHoursLabel} — {strings.perMonth.toLowerCase()}
                    </dt>
                    <dd class="font-medium tabular-nums">{formatNumber(result.billableHoursPerMonth, locale)}</dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt style="color: var(--color-ink-muted)">
                      {strings.billableHoursLabel} — {strings.perYear.toLowerCase()}
                    </dt>
                    <dd class="font-medium tabular-nums">{formatNumber(result.billableHoursPerYear, locale)}</dd>
                  </div>
                  <div class="flex justify-between gap-4 border-t pt-2" style="border-color: var(--color-border)">
                    <dt style="color: var(--color-ink-muted)">{strings.totalHoursLabel}</dt>
                    <dd class="font-medium tabular-nums">{formatNumber(result.totalHoursPerYear, locale)}</dd>
                  </div>
                </dl>
              </section>

              {result.warnings.length > 0 ? (
                <section class="rounded-xl border p-5" style="border-color: var(--color-border)">
                  <ul class="grid gap-2 text-sm" style="color: var(--color-ink-muted)">
                    {result.warnings.map((warning) => (
                      <li key={warning.code}>{lookup(strings.warnings, warning.code)}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <p class="text-xs leading-relaxed" style="color: var(--color-ink-muted)">
        {strings.disclaimer}
      </p>
    </div>
  );
}

/** Currency names come from Intl rather than a hand-maintained list per locale. */
function currencyName(locale: Locale, code: Currency): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}
