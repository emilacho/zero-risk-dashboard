import { describe, expect, it } from "vitest"
import { agruparActividad } from "@/lib/actividad"

describe("actividad de los empleados · 14 días", () => {
  it("14 días terminando hoy, cuenta bien y mal, y un día sin tareas queda en cero", () => {
    const ahora = new Date("2026-10-30T18:00:00Z")
    const r = agruparActividad([
      { created_at: "2026-10-30T15:00:00Z", status: "completed" },
      { created_at: "2026-10-30T16:00:00Z", status: "failed" },
      { created_at: "2026-10-28T10:00:00Z", status: "completed" },
      { created_at: "2026-09-01T10:00:00Z", status: "completed" },
    ], ahora)
    expect(r).toHaveLength(14)
    expect(r[13]).toEqual({ dia: "2026-10-30", ok: 1, fallo: 1 })
    expect(r.find((d) => d.dia === "2026-10-29")).toEqual({ dia: "2026-10-29", ok: 0, fallo: 0 })
    expect(r.reduce((n, d) => n + d.ok + d.fallo, 0)).toBe(3)
  })
})
