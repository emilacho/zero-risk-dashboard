/** 18-nov · G1c «nada se recorta» (CC5): el asistente del tablero responde hasta el techo del modelo y su ruta espera el máximo del plan */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const t = fs.readFileSync(path.join(process.cwd(), "app/api/cowork/prompt/route.ts"), "utf8")

describe("el asistente del tablero no se corta", () => {
  it("🔴 pide el techo del modelo (128.000 en Sonnet 4.6), no 1.600", () => {
    expect(t).toMatch(/model: "claude-sonnet-4-6"/)
    expect(t).toMatch(/const TECHO_DE_RESPUESTA = 128000\b/)
    expect(t).toMatch(/max_tokens: TECHO_DE_RESPUESTA,/)
    expect(t).not.toMatch(/max_tokens: \d+/)
  })
  it("🔴 va por flujo continuo (sin él, una respuesta tan larga no cabe en una sola espera)", () => {
    expect(t).toMatch(/stream: true,/)
  })
  it("🔴 la ruta espera 800 s, el máximo del plan (60 cortaba el flujo a mitad)", () => {
    expect(t).toMatch(/export const maxDuration = 800\b/)
  })
})

// 19-nov · las otras 6 rutas del tablero (Lenovo 22:06Z): reenvían a la plataforma y no la cortan antes. `maxDuration` es una exportación que lee Next: se mira el archivo
const RUTAS = ["app/api/acciones/[accion]/route.ts", "app/api/flujo/route.ts", "app/api/hitl/resolve/route.ts", "app/api/piezas/[id]/decidir/route.ts", "app/api/piezas/[id]/gran-idea/route.ts", "app/api/piezas/[id]/gran-idea/banco/route.ts"]
describe("las 6 rutas que reenvían a la plataforma esperan el máximo", () => {
  for (const r of RUTAS) it(`🔴 ${r} · 800 s`, () => {
    const s = fs.readFileSync(path.join(process.cwd(), r), "utf8")
    expect(s).toMatch(/^export const maxDuration = 800$/m)
    expect(s.match(/export const maxDuration/g)).toHaveLength(1)
  })
  it("🔴 la espera interna a la plataforma al resolver ya no corta a los 30 s (790 s, bajo los 800 de la ruta)", () => {
    const s = fs.readFileSync(path.join(process.cwd(), "lib/hitl-resolve.ts"), "utf8")
    expect(s).toMatch(/const timeoutMs = deps\.timeoutMs \?\? 790_000/)
  })
})
