# Phase 4.1 · AnimatedNumber + format-prop audit

**Status:** complete · deployed 2026-05-17
**Branch:** dashboard-lumen-v3
**Commit:** `b437786`
**Preview:** https://zero-risk-dashboard-h8w5cdkg6-zero-risk1.vercel.app

## Why this exists

Digest `3406040795` crashed the dashboard three separate times in
phases 1, 2 and 4. Root cause every time was the same: a server
component was passing a `format: (v) => string` callback prop to a
client component (`<AnimatedNumber>` and `<OpsKpiCell>`). React 19 +
Next 15 reject function props at the server→client boundary as
non-serializable. The page would render an "Application error · a
server-side exception has occurred" screen.

Phase 4.1 closes this off permanently.

## What changed

### `components/AnimatedNumber.tsx`
- New props: `formatType: 'integer'|'currency'|'percent'|'decimal'|'compact'|'duration'` + `formatOptions: { locale, currency, decimals }`.
- Internal dispatcher · `formatValue(v, formatType, options)` · uses `Intl.NumberFormat` for locale-aware currency/decimal · custom compact (k/M) and duration formatters.
- Deprecated `format?: (v) => string` prop still accepted with a one-time `console.warn`. Falls back to `formatType="integer"` if the callback fails.
- Exported `formatValue()` helper so non-animated server-side renders can use the same dispatcher.

### `components/OpsKpiCell.tsx`
- Removed local `fmtUsd` + `fmtCompact` callbacks.
- `format: "currency" | "number" | "percent"` prop maps via `mapOpsFormat()` to the new `formatType` string · no callback ever crosses a boundary.

### `lib/dashboard-components/components/KpiCard.tsx`
- Removed local `fmt(value, kind)` callback.
- Same `format` string prop · maps via `mapFormat()` to `formatType`.

## Audit results

| File | Status | Notes |
|---|---|---|
| `components/AnimatedNumber.tsx` | refactored | new string API + Intl dispatcher |
| `components/OpsKpiCell.tsx` | refactored | `format` prop → `formatType` |
| `lib/dashboard-components/components/KpiCard.tsx` | refactored | `format` prop → `formatType` |
| `app/system/roadmap/page.tsx` | reads `AnimatedNumber` via no consumers · grep clean | n/a |
| All other files | grep for `format={(v)` → **0 matches** | clean |

## Code review checklist

Before passing **any** prop across the server→client boundary, ask:

1. Is it a **primitive** (`string` / `number` / `boolean` / `null`)? → OK.
2. Is it a **serializable object/array** of primitives? → OK.
3. Is it a **ReactNode** pre-rendered server-side? → OK.
4. Is it a **function**? → **NEVER**. Use a string identifier + a dispatcher that lives in the client component.

If you absolutely need behavior parameterization, define the function inside the client component file and pick which one via a string prop. Server components MUST only pass plain data.

## Backwards compatibility

`format` callback is still accepted on `AnimatedNumber`. It will:
- Log a one-time `console.warn` telling the caller to migrate.
- Fall through to the dispatcher result (no crash) if the callback is somehow valid in a client-only path.

This means legacy callers that lived inside the client tree (e.g. older `KpiCard` users) still work · just produce a warning until migrated.

## Followups

- ~~Add ESLint rule that flags `format={anything-that-looks-like-a-function}` on `AnimatedNumber` imports~~ → **shipped in Phase 4.2** (2026-05-17). See:
  - `eslint-plugin-local/rules/no-function-format-prop.js` · AST visitor on JSXOpeningElement scoped to `AnimatedNumber` + `OpsKpiCell` · catches `ArrowFunctionExpression`, `FunctionExpression`, and fn-shaped bare Identifiers (`fmtUsd`, `formatX`, `*Fn`).
  - `scripts/audit-format-prop.mjs` · zero-dep regex audit · run via `pnpm audit:format-prop` · also wired into `pnpm verify` and the husky `pre-commit` hook.
  - Three-layer defense · TypeScript (catches OpsKpiCell) + ESLint local rule (catches both) + grep audit (catches both, runs faster than tsc).
- Apply the same string-identifier pattern proactively to any new component that accepts behavior props.
