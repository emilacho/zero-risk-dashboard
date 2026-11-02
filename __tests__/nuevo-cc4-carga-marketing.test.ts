import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("02-nov · carga de /nuevo/marketing y texto suelto", () => {
  it("en la oficina de marketing no hay texto suelto de empleados sin equipo (Portero, Account manager…)", () => {
    const f = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(f).not.toContain("data-sin-mesa"); expect(f).not.toContain("sin equipo asignado")
  })
  it("la lectura de la escena pide solo los dos campos de `metadata` que usa y no espera más de 1,2 s a la línea del cliente", () => {
    const f = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(f).toContain("step_name:metadata->>step_name"); expect(f).toContain("task_text:metadata->>task_text")
    expect(f).not.toMatch(/cost_usd, metadata"\)/)
    expect(f).toContain("ESPERA_DEL_CONTEXTO_MS = 1200"); expect(f).toContain("Promise.race")
  })
})
