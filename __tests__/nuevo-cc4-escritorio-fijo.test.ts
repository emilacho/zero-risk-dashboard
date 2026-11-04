import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MESAS, type MesaViva, type Sentado } from "@/lib/escena-avatares"
import { DE_PIE, MAXIMO_EN_LA_MESA, repartirEnLaMesa } from "@/lib/escena-movimiento"

// ADENDA 2 de Lenovo 04-nov (Emilio aprobó el video de turnos): el escritorio es del departamento; uno sentado y los demás de pie, por orden de inicio
const sentado = (agente: string, desde: string | null): Sentado => ({ agente, nombre: agente, mesa: "creativo", estado: "trabajando", cliente: "Náufrago", flujo: "f", paso: null, tarea: null, desde, hace: "hace 1 min", gasto_usd: null, fuente: "t", origen_de_la_mesa: "mapa" } as Sentado)
const base = MESAS.find((m) => m.clave === "creativo")!
const min = (n: number) => `2026-11-04T11:${String(n).padStart(2, "0")}:00Z`
const mesa = (s: Sentado[]): MesaViva => ({ ...base, sentados: s, equipo: [], trabajando: s.length, fallando: 0 })

describe("CC4 · escritorio por turnos", () => {
  it("el que empezó primero se sienta en la silla; los demás esperan de pie, por orden de inicio, cada uno en su lugar", () => {
    const { puestos } = repartirEnLaMesa(mesa([sentado("c", min(3)), sentado("a", min(1)), sentado("b", min(2))]))
    expect(puestos.map((p) => p.s.agente)).toEqual(["a", "b", "c"])
    expect(puestos.map((p) => p.postura)).toEqual(["sentado", "de_pie", "de_pie"])
    expect(puestos[0].pos).toEqual({ x: base.silla.x, y: base.silla.y })
    expect(new Set(puestos.map((p) => `${p.pos.x},${p.pos.y}`)).size).toBe(3)
  })
  it("cuando el sentado termina, se sienta quien esperaba hace más tiempo y los de la fila avanzan un lugar", () => {
    const antes = repartirEnLaMesa(mesa([sentado("a", min(1)), sentado("b", min(2)), sentado("c", min(3))])).puestos
    const despues = repartirEnLaMesa(mesa([sentado("b", min(2)), sentado("c", min(3))])).puestos
    expect(despues[0]).toMatchObject({ postura: "sentado", pos: antes[0].pos })
    expect(despues[0].s.agente).toBe("b")
    expect(despues[1].pos).toEqual(antes[1].pos) // c ocupa el primer lugar de pie
  })
  it("a igual hora decide el nombre; sin hora van al final", () => {
    const { puestos } = repartirEnLaMesa(mesa([sentado("z", null), sentado("m", min(1)), sentado("b", min(1))]))
    expect(puestos.map((p) => p.s.agente)).toEqual(["b", "m", "z"])
  })
  it("máximo a la vista y el resto se dice «+N»; los lugares de pie son todos distintos y NO se agranda el escritorio", () => {
    const doce = Array.from({ length: 12 }, (_, i) => sentado(`a${String(i).padStart(2, "0")}`, min(i)))
    const { puestos, deMas } = repartirEnLaMesa(mesa(doce))
    expect(puestos).toHaveLength(MAXIMO_EN_LA_MESA); expect(deMas).toBe(12 - MAXIMO_EN_LA_MESA)
    expect(MAXIMO_EN_LA_MESA).toBe(1 + DE_PIE.length)
    expect(new Set(puestos.map((p) => `${p.pos.x},${p.pos.y}`)).size).toBe(MAXIMO_EN_LA_MESA)
  })
})

describe("CC4 · sin aura propia en las siluetas (Emilio 04-nov: «muy exagerada la luz anaranjada»)", () => {
  const sil = readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")
  it("ni resplandor ni parpadeo en el holograma de la silueta", () => {
    expect(sil).not.toContain("nvHoloFlicker"); expect(sil).not.toMatch(/\.nv-av \.nv-holo\{filter:drop-shadow/)
  })
})
