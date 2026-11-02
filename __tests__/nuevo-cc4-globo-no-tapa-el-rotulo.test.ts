import { describe, expect, it } from "vitest"
import { subidaDelRotulo, type Globo } from "@/components/nuevo/escena/SalaDeReuniones"
import { SALA, SILLAS_DE_LA_SALA } from "@/lib/escena-sala"
import { posBurbuja } from "@/components/nuevo/escena/SalaDeReuniones"

const globo = (silla: { x: number; y: number }, lineas: string[]): Globo => ({ tipo: "resultado", ancla: posBurbuja(silla), lineas })

describe("el globo del que habla no tapa el título de la sala (03-nov)", () => {
  it("sin globo el rótulo no se mueve", () => {
    expect(subidaDelRotulo(null, 3)).toBe(0)
  })
  it("con el globo de una silla del fondo el rótulo sube lo justo para quedar encima del globo", () => {
    const g = globo(SILLAS_DE_LA_SALA[2], ["Jefe de marketing · dirige · redacción", "escribiendo el resultado…", "hablando ahora"])
    const sube = subidaDelRotulo(g, 3)
    expect(sube).toBeGreaterThan(0)
    expect(sube).toBeLessThanOrEqual(130)
  })
  it("un globo que queda por debajo del rótulo no lo mueve", () => {
    const g = { tipo: "resultado" as const, ancla: { x: SALA.mesa.x, y: SALA.rotulo.y + 400 }, lineas: ["hola"] }
    expect(subidaDelRotulo(g, 3)).toBe(0)
  })
})
