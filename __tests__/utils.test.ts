/**
 * Sanity tests · `cn` Tailwind class merger.
 * Phase 0 ships this single test to anchor the test infra · Phase 1 adds
 * route handler + Supabase query tests as the dashboard wires data.
 */
import { describe, it, expect } from "vitest"
import { cn } from "../lib/utils"

describe("cn", () => {
  it("joins truthy classes", () => {
    expect(cn("a", "b")).toBe("a b")
  })
  it("dedupes conflicting Tailwind utilities (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
  })
  it("drops falsy entries", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b")
  })
  it("handles array + object inputs via clsx", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b")
  })
  it("returns empty string for no args", () => {
    expect(cn()).toBe("")
  })
})
