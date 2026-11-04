import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MAXIMO_DE_PUESTOS_FIJOS, MESAS, ordenDelRoster, puestoFijo, type MesaViva, type Sentado } from "@/lib/escena-avatares"
import { repartirEnLaMesa } from "@/lib/escena-movimiento"

// ENCARGO de Lenovo 04-nov (punto 9): cada agente tiene un escritorio fijo en su equipo, en el orden del roster; trabaja sentado en el suyo (punto 10, parte segura)
const sentado = (agente: string): Sentado => ({ agente, nombre: agente, mesa: "creativo", estado: "trabajando", cliente: "Náufrago", flujo: "f", paso: null, tarea: null, desde: "2026-11-04T10:00:00Z", hace: "hace 1 min", gasto_usd: null, fuente: "t", origen_de_la_mesa: "mapa" } as Sentado)
const base = MESAS.find((m) => m.clave === "creativo")!
const ROSTER = ["ana", "beto", "carla", "dani"]
const mesa = (quienes: string[], roster: string[] | undefined = ROSTER): MesaViva => ({ ...base, sentados: quienes.map(sentado), equipo: [], trabajando: quienes.length, fallando: 0, roster })

describe("CC4 · escritorio fijo por agente", () => {
  it("el puesto de cada uno es el mismo trabaje solo o con todos: no depende de cuántos haya sentados", () => {
    const solo = repartirEnLaMesa(mesa(["carla"])).puestos[0]
    const todos = repartirEnLaMesa(mesa(["dani", "carla", "ana", "beto"])).puestos.find((p) => p.s.agente === "carla")!
    expect(solo.pos).toEqual(todos.pos)
    expect(solo.pos).toEqual(puestoFijo(base, 2)) // carla es la tercera del roster
  })
  it("el primero del roster ocupa la silla de la foto y los puestos son todos distintos", () => {
    expect(puestoFijo(base, 0)).toEqual(base.silla)
    const pts = Array.from({ length: MAXIMO_DE_PUESTOS_FIJOS }, (_, i) => puestoFijo(base, i)!)
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(MAXIMO_DE_PUESTOS_FIJOS)
    expect(puestoFijo(base, MAXIMO_DE_PUESTOS_FIJOS)).toBeNull(); expect(puestoFijo(base, -1)).toBeNull()
  })
  it("todos sentados trabajando, ninguno de pie alrededor de otro; quien no cabe va a «+N»", () => {
    const r = repartirEnLaMesa(mesa(["ana", "beto", "carla", "dani"], undefined))
    expect(r.puestos.every((p) => p.postura === "sentado")).toBe(true)
    const m = repartirEnLaMesa(mesa(["a", "b", "c", "d", "e", "f", "g"], ["a", "b", "c", "d", "e", "f", "g"]))
    expect(m.puestos).toHaveLength(MAXIMO_DE_PUESTOS_FIJOS); expect(m.deMas).toBe(7 - MAXIMO_DE_PUESTOS_FIJOS)
  })
  it("sin roster el orden es por nombre (estable), y quien falta en el roster va detrás de los que sí están", () => {
    const sinRoster = repartirEnLaMesa(mesa(["dani", "ana"], undefined)).puestos
    expect(sinRoster.find((p) => p.s.agente === "ana")!.pos).toEqual(puestoFijo(base, 0))
    const conOtro = repartirEnLaMesa(mesa(["zeta", "beto"], ["ana", "beto"])).puestos
    expect(conOtro.find((p) => p.s.agente === "beto")!.pos).toEqual(puestoFijo(base, 1))
    expect(conOtro.find((p) => p.s.agente === "zeta")!.pos).toEqual(puestoFijo(base, 2))
  })
  it("el roster sigue el orden firmado en el mapa y luego el de los demás por nombre", () => {
    const r = ordenDelRoster("direccion", ["editor-en-jefe", "zzz-nuevo", "revisor-externo-gpt", "jefe-marketing", "aaa-nuevo"])
    expect(r.slice(0, 3)).toEqual(["jefe-marketing", "revisor-externo-gpt", "editor-en-jefe"].map((x) => x.replace(/_/g, "-")))
    expect(r.slice(3)).toEqual(["aaa-nuevo", "zzz-nuevo"])
  })
  it("cableado: el roster viaja en cada mesa de la escena y las entregas parten del puesto del autor", () => {
    expect(readFileSync("lib/escena-avatares.ts", "utf8")).toContain("roster: ordenDelRoster(m.clave, equipo.map((x) => x.agente))")
    expect(readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")).toContain("repartirEnLaMesa(mesa).puestos.find((q) => nombreCanonico(q.s.agente) === k)?.pos")
  })
})
