/**
 * Sprint 5 D1 · Pipeline refactor to client_journey_state · 2026-05-21.
 *
 * Tests the column-mapping logic exported from the journeys route +
 * the move handler's column→journey mapping. Decision doc ·
 * `pipeline-canonical-table-client-journey-state` 2026-05-21.
 */
import { describe, it, expect } from "vitest"
import { mapToColumn, KANBAN_COLUMNS } from "../app/api/pipeline/journeys/route"
import { KANBAN_COLUMNS as UI_COLUMNS, COLUMN_LABEL } from "../app/dashboard/pipeline/types"

describe("mapToColumn", () => {
  it("ONBOARD + no stage → discovery", () => {
    expect(mapToColumn("ONBOARD", null)).toBe("discovery")
  })
  it("ONBOARD + 'discovery' stage → discovery", () => {
    expect(mapToColumn("ONBOARD", "discovery_done")).toBe("discovery")
  })
  it("ONBOARD + 'auto_discovery_complete' → discovery", () => {
    expect(mapToColumn("ONBOARD", "auto_discovery_complete")).toBe("discovery")
  })
  it("ONBOARD + 'send_intake_form' → onboarding", () => {
    expect(mapToColumn("ONBOARD", "send_intake_form")).toBe("onboarding")
  })
  it("CONTENT → content", () => {
    expect(mapToColumn("CONTENT", null)).toBe("content")
  })
  it("OPTIMIZE → optimizing", () => {
    expect(mapToColumn("OPTIMIZE", null)).toBe("optimizing")
  })
  it("OPTIMIZING (legacy alias) → optimizing", () => {
    expect(mapToColumn("OPTIMIZING", null)).toBe("optimizing")
  })
  it("REPORT → reporting", () => {
    expect(mapToColumn("REPORT", null)).toBe("reporting")
  })
  it("RENEWAL → renewal", () => {
    expect(mapToColumn("RENEWAL", null)).toBe("renewal")
  })
  it("unknown journey → fallback onboarding (catch-all)", () => {
    expect(mapToColumn("MYSTERY_JOURNEY", "something")).toBe("onboarding")
  })
  it("case-insensitive journey matching", () => {
    expect(mapToColumn("onboard", null)).toBe("discovery")
    expect(mapToColumn("content", null)).toBe("content")
  })
})

describe("KANBAN_COLUMNS · canon set", () => {
  it("UI and route share the same column list", () => {
    expect(Array.from(KANBAN_COLUMNS)).toEqual(Array.from(UI_COLUMNS))
  })
  it("every column has a UI label", () => {
    for (const c of KANBAN_COLUMNS) {
      expect(COLUMN_LABEL[c]).toBeTruthy()
    }
  })
  it("6 columns total (no 'churned' · IN-FLIGHT only)", () => {
    expect(KANBAN_COLUMNS).toHaveLength(6)
  })
})
