// Synthetic file used by `node scripts/lint-rule-selftest.mjs` to
// confirm the local rule fires. Excluded from the actual codebase by
// .eslintignore. DO NOT import this from real code.

import { AnimatedNumber } from "@/components/AnimatedNumber"
import { OpsKpiCell } from "@/components/OpsKpiCell"

export function ViolationA() {
  return <AnimatedNumber value={1} format={(v: number) => `$${v}`} />
}
export function ViolationB() {
  return <AnimatedNumber value={1} format={function (v: number) { return `${v}` }} />
}
export function ViolationC() {
  const fmtUsd = (v: number) => `$${v}`
  return <AnimatedNumber value={1} format={fmtUsd} />
}
export function ViolationD() {
  return <OpsKpiCell label="x" icon={null} value={1} format={(v: number) => `${v}`} />
}
export function SafeA() {
  return <AnimatedNumber value={1} formatType="currency" />
}
export function SafeB() {
  const kind = "compact" as const
  return <AnimatedNumber value={1} formatType={kind} />
}
