/** EL PIZARRÓN DEL DEPT. MARKETING (CC6 · 04-nov · encargo de Lenovo, Emilio 11:29Z): sin la franja de redes y con el aviso «Manual listo · revísalo». US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena } from "@/lib/escena-avatares"
import { avisoDelManual, leerAvisosDeFirma, TEXTO_MANUAL_LISTO } from "@/lib/escena-avisos"
import { cuadrosDelPizarron } from "@/lib/escena-metricas"
import { Avatares } from "@/components/nuevo/escena/Avatares"
import { CUADROS_DEL_PIZARRON } from "@/lib/escena-entregas"
import { MOSTRAR_LA_FRANJA_DE_REDES } from "@/components/nuevo/escena/FranjaDeLasRedes"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const metricas = { cliente: "Náufrago", cuadros: cuadrosDelPizarron(["instagram"], { estado: "sin_datos", motivo: "pronto" } as never), lectura: "sin_datos" }
const escena = (extra: Record<string, unknown> = {}) => ({ ...armarEscena({ despachos: [], invocaciones: [], directorio: [], agentes: [], clientes: [], equipos: null, ahora: new Date("2026-11-04T12:00:00Z") }), metricas, ...extra })
const MANUAL = avisoDelManual({ aprobado: false, reescribiendo: false })!

describe("1 · la franja de redes no se ve (el código queda para volver)", () => {
  it("apagada por una sola bandera; la escena no la dibuja", () => {
    expect(MOSTRAR_LA_FRANJA_DE_REDES).toBe(false)
    expect(renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena() as never }))).not.toContain("data-franja-de-redes")
    expect(readFileSync("components/nuevo/escena/FranjaDeLasRedes.tsx", "utf8")).toContain("export function FranjaDeLasRedes") // no se borró
  })
})

describe("2 · «Manual listo · revísalo» en el PRIMER recuadro del pizarrón", () => {
  it("manual listo = la versión vigente sin aprobar del dueño y sin reescritura en curso; sin saber, no se avisa", () => {
    expect(MANUAL).toEqual({ clave: "manual", texto: TEXTO_MANUAL_LISTO, abre: "manual" }); expect(TEXTO_MANUAL_LISTO).toBe("Manual listo · revísalo")
    expect(avisoDelManual({ aprobado: true, reescribiendo: false })).toBeNull() // aprobado: deja de titilar
    expect(avisoDelManual({ aprobado: false, reescribiendo: true })).toBeNull() // se está reescribiendo: todavía no está listo
    expect(avisoDelManual({ aprobado: null, reescribiendo: false })).toBeNull()
  })
  it("la lectura: libro sin aprobar + último pedido terminado → aviso; con el pedido en reescritura o con la base caída → nada", async () => {
    const supa = (pedido: string | null, falla = false) => ({ from: (t: string) => {
      const filas = t === "client_brand_books" ? [{ client_id: C, version: 3, human_validated: false, provenance_tag: {} }] : pedido ? [{ estado: pedido }] : []
      const q: Record<string, unknown> = {}
      for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q
      q.maybeSingle = () => Promise.resolve(falla ? { data: null, error: { message: "caída" } } : { data: filas[0] ?? null, error: null })
      q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok)
      return q
    } }) as never
    expect(await leerAvisosDeFirma(supa("aplicado"), C)).toEqual([MANUAL])
    expect(await leerAvisosDeFirma(supa(null), C)).toEqual([MANUAL])
    expect(await leerAvisosDeFirma(supa("en_reescritura"), C)).toEqual([])
    expect(await leerAvisosDeFirma(supa("aplicado", true), C)).toEqual([])
    expect(await leerAvisosDeFirma(supa("aplicado"), null)).toEqual([])
  })
  it("con el aviso, el primer recuadro titila y DICE «Manual listo · revísalo» (rótulo de 44 px de alto); sin aviso, el recuadro de siempre", () => {
    const con = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena({ avisos: [MANUAL] }) as never }))
    expect(con).toContain('data-aviso-firma="manual"'); expect(con).toContain("Manual listo · revísalo"); expect(con).toContain("nv-aviso-firma")
    expect(con).toMatch(/nv-aviso-rotulo[^>]*>\s*<rect[^>]*height="96"/) // 96 px de la foto = 48 px en una pantalla de 1280 (reserva 1 de CC3)
    expect(con).toMatch(/nv-aviso-rotulo[\s\S]*?font-size="30"/)
    // reserva de CC3 (mutante vivo «aviso en otro recuadro»): el recuadro del aviso es EL PRIMERO, arriba a la izquierda
    const q0 = CUADROS_DEL_PIZARRON[0].map((p) => `${p.x},${p.y}`).join(" ")
    expect(con).toMatch(new RegExp(`data-aviso-firma="manual"[^>]*>\\s*<polygon[^>]*points="${q0}"`))
    expect(con).toContain("@keyframes nvAvisoFirma"); expect(con).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*\}[^@]*nv-aviso-firma \.nv-metrica-cuadro\{animation:none/)
    // anexo 1 de CC3 (mutante «i === 3» vivo): el aviso OCUPA el primer recuadro: el recuadro «General» (el primero) no se dibuja y el aviso va antes que cualquier otro
    expect(con).not.toContain('data-metrica="general"')
    expect(con.indexOf('data-aviso-firma="manual"')).toBeLessThan(con.indexOf("data-metrica="))
    const sin = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena() as never }))
    expect(sin).not.toContain("data-aviso-firma"); expect(sin).toContain('data-metrica="general"')
  })
  it("al tocarlo abre el Centro de campaña directo en el manual", () => {
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain('detail: { panel: "aplicaciones", vista: a.abre }')
    // reserva de CC3 (mutante vivo «tocar no abre»): el recuadro del aviso llama a onAviso con el clic y con Enter/Espacio
    const fo = readFileSync("components/nuevo/escena/EntregasEnLaFoto.tsx", "utf8")
    expect(fo).toContain("onClick={() => onAviso?.(aviso)} onKeyDown={(e) => { if (e.key === \"Enter\" || e.key === \" \") { e.preventDefault(); onAviso?.(aviso) } }}")
    expect(av).toContain("aviso={datos?.avisos?.[0] ?? null} onAviso={(a) => window.dispatchEvent(")
    expect(readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")).toContain('useState<"inicio" | ClaveDeAplicacion>(vistaInicial ?? "inicio")')
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain("vistaInicial={vistaDelPizarron ?? undefined}")
  })
})
