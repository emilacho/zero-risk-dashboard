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
