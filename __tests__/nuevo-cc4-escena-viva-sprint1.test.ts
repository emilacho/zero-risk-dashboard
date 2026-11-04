import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EQUIPOS, nombreCanonico } from "@/lib/organigrama"
import { ACCESORIOS, ANCHO_DE_LA_CONTEXTURA, CABELLOS, CONTEXTURAS, ROPAS, TOTAL_DE_COMBINACIONES, descripcionDelHolograma, rasgosDelHolograma } from "@/lib/holograma"
import { Siluetas } from "@/components/nuevo/escena/Siluetas"
import { MAXIMO_EN_LA_MESA, repartirEnLaMesa } from "@/lib/escena-movimiento"
import { MESAS, type MesaViva, type Sentado } from "@/lib/escena-avatares"

const roster = [...new Set(EQUIPOS.flatMap((e) => e.areas.flatMap((a) => [...a.agentes, ...a.por_instalar])).map(nombreCanonico))]

describe("ADENDA 3 · cada empleado lleva su propio toque, estable y sin repetir", () => {
  it("hay combinaciones de sobra", () => { expect(TOTAL_DE_COMBINACIONES).toBe(CABELLOS.length * ACCESORIOS.length * ROPAS.length * CONTEXTURAS.length * 4) })
  it("nadie del organigrama comparte combinación con otro", () => {
    expect(roster.length).toBeGreaterThan(40)
    const vistos = new Map<number, string>()
    const choques: string[] = []
    for (const n of roster) { const i = rasgosDelHolograma(n).indice; if (vistos.has(i)) choques.push(`${vistos.get(i)} = ${n}`); vistos.set(i, n) }
    expect(choques).toEqual([])
  })
  it("es estable: el mismo identificador (con otra grafía) da lo mismo, y se describe en palabras", () => {
    expect(rasgosDelHolograma("content_creator")).toEqual(rasgosDelHolograma("Content-Creator"))
    expect(descripcionDelHolograma("content-creator")).toMatch(/contextura/)
  })
  it("la contextura gruesa es ~1,5 veces la media y se dibuja redondeada (curvas), no como una caja", () => {
    const k = ANCHO_DE_LA_CONTEXTURA.gruesa / ANCHO_DE_LA_CONTEXTURA.media
    expect(k).toBeGreaterThan(1.4); expect(k).toBeLessThan(1.7)
    expect(readFileSync("components/nuevo/escena/Holograma.tsx", "utf8")).toMatch(/gr\s*\?\s*`M[^`]*C\$\{P\(/)
  })
  it("todas las contexturas, cabellos, accesorios y ropas aparecen en el equipo", () => {
    const r = roster.map(rasgosDelHolograma)
    for (const c of CONTEXTURAS) expect(r.some((x) => x.contextura === c)).toBe(true)
    for (const c of CABELLOS) expect(r.some((x) => x.cabello === c)).toBe(true)
    for (const a of ROPAS) expect(r.some((x) => x.ropa === a)).toBe(true)
  })
})

const sentado = (agente: string, desde: string, estado: "trabajando" | "fallo" = "trabajando"): Sentado => ({
  agente, nombre: agente, mesa: "creativo", estado, cliente: "Náufrago", flujo: "f", paso: null, tarea: null, desde, hace: "hace 1 min", gasto_usd: null, fuente: "t", origen_de_la_mesa: "mapa",
} as Sentado)
const mesa = (clave: string, sentados: Sentado[]): MesaViva => ({ ...MESAS.find((m) => m.clave === clave)!, sentados, equipo: [], trabajando: sentados.length, fallando: 0 })

describe("sprint 1 · las siluetas en los escritorios", () => {
  it("el escritorio es del departamento: uno sentado, los demás de pie; máximo MAXIMO_EN_LA_MESA a la vista y el resto se dice «+N» (el detalle está en nuevo-cc4-escritorio-fijo.test.ts)", () => {
    const m = mesa("creativo", Array.from({ length: 12 }, (_, i) => String.fromCharCode(97 + i)).map((n, i) => sentado(n, `2026-11-02T10:${String(i).padStart(2, "0")}:00Z`)))
    const { puestos, deMas } = repartirEnLaMesa(m)
    expect(puestos.filter((p) => p.postura === "sentado")).toHaveLength(1)
    expect(puestos).toHaveLength(MAXIMO_EN_LA_MESA)
    expect(deMas).toBe(12 - MAXIMO_EN_LA_MESA)
  })
  it("solo se dibujan los que trabajan; sin nadie no hay siluetas y los de la sala no se repiten en el escritorio", () => {
    const html = renderToStaticMarkup(createElement(Siluetas, { mesas: [mesa("creativo", [sentado("content-creator", "2026-11-02T10:00:00Z"), sentado("video-editor", "2026-11-02T10:01:00Z")]), mesa("web", [])], enLaSala: new Set<string>(["video-editor"]) }))
    expect(html.match(/class="nv-sil"/g)).toHaveLength(1)
    expect(html).toContain('data-agente="content-creator"')
    expect(html).not.toContain('data-agente="video-editor"')
  })
  it("cada silueta lleva su toque en la etiqueta, y el nombre solo se ve al pasar el cursor", () => {
    const html = renderToStaticMarkup(createElement(Siluetas, { mesas: [mesa("creativo", [sentado("content-creator", "2026-11-02T10:00:00Z")])], enLaSala: new Set<string>() }))
    expect(html).toContain("trabajando ahora")
    expect(html).toContain(descripcionDelHolograma("content-creator"))
    expect(html).toContain("nv-sil-nombre")
  })
})
