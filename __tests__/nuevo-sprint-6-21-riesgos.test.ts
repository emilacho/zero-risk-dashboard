/**
 * DASHBOARD NUEVO · SPRINT 6.21 (1-nov · encargo «oficina del humano», capa 2): «Riesgos y alarmas» con datos reales y diseño propio de RADAR.
 * Fuente: la ruta certificada de la plataforma `GET /api/direccion/riesgos` (CC1).
 */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import {
  alPlano, ANILLOS, CATEGORIAS_DE_RIESGO, leerRiesgos, lugarEnElRadar, normalizarRiesgos, resumenDeRiesgos, tituloDelRiesgo, type Riesgos,
} from "@/lib/direccion-riesgos"
import { PanelRiesgos } from "@/components/nuevo/PanelRiesgos"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { TableroDeDireccionVivo } from "@/components/nuevo/TablerosDeDireccion"

// la forma real de la respuesta (1-nov, lectura de producción, recortada)
const CRUDO = {
  ok: true, generado_en: "2026-11-01T15:48:00.000Z", completo: true, total: 4,
  riesgos: [
    { id: "a1", gravedad: 1, categoria: "pausa", titulo: "🟡 Interruptor de la cadena apagado", detalle: null, client_id: null, cliente: null, desde: "2026-10-30T10:00:00Z", fuente: "cadena_config" },
    { id: "a2", gravedad: 3, categoria: "incidente", titulo: "🟠 Incidente abierto en el monitor", detalle: "El monitor marca caída", client_id: "c1", cliente: "Náufrago", desde: "2026-11-01T09:00:00Z", fuente: "uptime_incidents" },
    { id: "a3", gravedad: 2, categoria: "falla", titulo: "Trabajo de empleado en error", detalle: null, client_id: null, cliente: null, desde: "2026-11-01T12:00:00Z", fuente: "agent_dispatches" },
    { id: "a4", gravedad: 2, categoria: "falla", titulo: "Otro trabajo en error", detalle: null, client_id: null, cliente: null, desde: "2026-11-01T13:00:00Z", fuente: "agent_dispatches" },
  ],
  saldos: [{ proveedor: "Apify", plan: "STARTER", usado_usd: 14.77, credito_usd: 29, pct: 50.9, ciclo_hasta: "2026-11-24T00:00:00Z" }],
  topes: [{ client_id: "c1", cliente: "Náufrago", gastado_24h_usd: 2.62, techo_usd: 20, pct: 13.1 }],
  fuentes: [{ fuente: "n8n", estado: "ok", filas: 0, detalle: "n8n conserva pocas horas de ejecuciones" }, { fuente: "uptime_incidents", estado: "ok", filas: 1 }],
  sin_fuente: [{ que: "credenciales por vencer", motivo: "ninguna tabla guarda la fecha de vencimiento" }],
}

describe("6.21 · la lectura de los riesgos (contrato de CC1)", () => {
  it("normaliza la respuesta real: lo más grave arriba, cuentas por gravedad, saldos, topes y «sin dato»", () => {
    const d = normalizarRiesgos(CRUDO)
    expect(d.total).toBe(4); expect(d.completo).toBe(true)
    expect(d.riesgos.map((x) => x.id)).toEqual(["a2", "a3", "a4", "a1"])
    expect(d.por_gravedad).toEqual({ 1: 1, 2: 2, 3: 1 })
    expect(d.saldos[0]).toMatchObject({ proveedor: "Apify", pct: 50.9 })
    expect(d.topes[0]).toMatchObject({ cliente: "Náufrago", techo_usd: 20 })
    expect(d.sin_fuente).toHaveLength(1)
    expect(d.fuentes[0].detalle).toContain("pocas horas")
  })
  it("lo que no cumple el contrato se descarta y la lista queda INCOMPLETA (nunca un «sin riesgos» falso)", () => {
    const d = normalizarRiesgos({ ...CRUDO, riesgos: [...CRUDO.riesgos, { id: "x", gravedad: 5, categoria: "falla", titulo: "?" }, { id: "y", gravedad: 2, categoria: "inventada", titulo: "?" }] })
    expect(d.total).toBe(4); expect(d.completo).toBe(false)
    expect(normalizarRiesgos({ ...CRUDO, completo: false }).completo).toBe(false)
    expect(normalizarRiesgos(null)).toMatchObject({ total: 0, completo: false })
  })
  it("lee la ruta certificada con la llave interna, por GET y sin caché; sin llave no llama", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(CRUDO), { status: 200 }))
    const r = await leerRiesgos({ plataformaUrl: "https://p.test/", llave: "k", fetchImpl: f as unknown as typeof fetch })
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledWith("https://p.test/api/direccion/riesgos", { method: "GET", headers: { "x-api-key": "k" }, cache: "no-store" })
    const sin = vi.fn()
    expect(await leerRiesgos({ llave: "", fetchImpl: sin as unknown as typeof fetch })).toMatchObject({ ok: false, status: 503 })
    expect(sin).not.toHaveBeenCalled()
    const mal = vi.fn(async () => new Response("{}", { status: 500 }))
    expect(await leerRiesgos({ llave: "k", fetchImpl: mal as unknown as typeof fetch })).toMatchObject({ ok: false, status: 502 })
  })
  it("la ruta del tablero exige sesión de administrador y no guarda caché", () => {
    const s = readFileSync("app/api/direccion/riesgos/route.ts", "utf8")
    expect(s).toContain("await exigirAdmin()"); expect(s).toContain("leerRiesgos"); expect(s).toContain("no-store")
    expect(s).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
  })
  it("el título pierde las marcas de color del inicio", () => {
    expect(tituloDelRiesgo("🟠 Incidente abierto")).toBe("Incidente abierto")
    expect(tituloDelRiesgo("Sin marca")).toBe("Sin marca")
  })
})

describe("6.21 · el radar: cada tipo un sector, cada gravedad un anillo", () => {
  const d = normalizarRiesgos(CRUDO)
  it("cada punto cae en el sector de su tipo y en el anillo de su gravedad (lo grave, más cerca del centro)", () => {
    const lugar = lugarEnElRadar(d.riesgos), sector = 360 / CATEGORIAS_DE_RIESGO.length
    for (const x of d.riesgos) {
      const l = lugar.get(x.id)!, i = CATEGORIAS_DE_RIESGO.indexOf(x.categoria)
      expect(l.angulo).toBeGreaterThanOrEqual(i * sector); expect(l.angulo).toBeLessThan((i + 1) * sector)
      expect(l.radio).toBeGreaterThanOrEqual(ANILLOS[x.gravedad][0]); expect(l.radio).toBeLessThanOrEqual(ANILLOS[x.gravedad][1])
    }
    expect(lugar.get("a3")!.angulo).not.toBe(lugar.get("a4")!.angulo) // dos del mismo tipo no se tapan
  })
  it("alPlano: 0° es arriba y 90° a la derecha", () => {
    const [x0, y0] = alPlano(50, 90, 40, 0, 1); expect(x0).toBeCloseTo(50); expect(y0).toBeCloseTo(50)
    const [x1, y1] = alPlano(50, 90, 40, 90, 1); expect(x1).toBeCloseTo(90); expect(y1).toBeCloseTo(90)
  })
  it("el resumen de la pantalla trae los mismos lugares que el panel", () => {
    const r = resumenDeRiesgos(d)
    expect(r).toMatchObject({ total: 4, graves: 1, completo: true })
    expect(r.puntos.find((p) => p.id === "a2")).toMatchObject({ gravedad: 3, ...lugarEnElRadar(d.riesgos).get("a2") })
  })
})

describe("6.21 · la pantalla 6 del arco", () => {
  const html = (riesgos: ReturnType<typeof resumenDeRiesgos> | null) => renderToStaticMarkup(createElement("svg", null, createElement(TableroDeDireccionVivo, { tablero: "riesgos", titulo: ["RIESGOS"], quieto: true, riesgos })))
  it("sin lectura dibuja el boceto (5 puntos) y no dice nada que no sabe", () => {
    const h = html(null)
    expect(h).toContain('data-riesgos="sin-lectura"'); expect(h.match(/data-anima="detecta"/g)).toHaveLength(5); expect(h).not.toContain("data-graves")
  })
  it("con datos: un punto por riesgo y la cuenta de graves; «+?» si la lista está incompleta", () => {
    const r = resumenDeRiesgos(normalizarRiesgos(CRUDO))
    const h = html(r)
    expect(h).toContain('data-riesgos="4"'); expect(h.match(/data-anima="detecta"/g)).toHaveLength(4); expect(h).toMatch(/data-graves[^>]*>1 grave</)
    expect(html({ ...r, completo: false })).toMatch(/1 grave(<!-- -->)? \+\?/)
    expect(html({ ...r, graves: 0 })).toContain("4 abiertos")
  })
  it("«sin riesgos» solo con la lista completa", () => {
    expect(html({ total: 0, graves: 0, completo: true, puntos: [] })).toContain("sin riesgos")
    const inc = html({ total: 0, graves: 0, completo: false, puntos: [] })
    expect(inc).not.toContain("sin riesgos"); expect(inc).not.toContain("data-graves")
  })
  it("la pantalla 6 se abre al tocarla (clic o Enter) y la 5 sigue abriendo Decisiones", () => {
    const h = renderToStaticMarkup(createElement(PantallasDelArco, { alAbrirDecisiones: () => {}, alAbrirRiesgos: () => {} }))
    expect(h).toMatch(/data-id="arco-6"[^>]*data-abre="riesgos"[^>]*aria-label="Abrir los riesgos y alarmas"/)
    expect(h).toMatch(/data-id="arco-5"[^>]*data-abre="decisiones"/)
    expect(renderToStaticMarkup(createElement(PantallasDelArco, {}))).not.toContain('data-abre="')
  })
  it("la escena lee los riesgos con la misma regla que las decisiones y abre el panel en un portal", () => {
    const e = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(e).toContain('fetch("/api/direccion/riesgos", { cache: "no-store" })')
    expect(e).toContain("createPortal(<PanelRiesgos onCerrar={cerrarRadar} />, document.body)")
  })
})

describe("6.21 · el panel del radar", () => {
  const d = normalizarRiesgos(CRUDO)
  const html = (datos: Riesgos) => renderToStaticMarkup(createElement(PanelRiesgos, { onCerrar: () => {}, datosIniciales: datos }))
  it("muestra el radar con un punto por riesgo, la ficha del más grave, la lista, los medidores y el «sin dato»", () => {
    const h = html(d)
    expect(h).toContain('data-seccion="riesgos"')
    expect(h.match(/class="ri-punto"/g)).toHaveLength(4)
    expect(h).toContain('data-ficha="a2"'); expect(h).toContain("Incidente abierto en el monitor"); expect(h).toContain("Monitor de servicios")
    expect(h.match(/data-fila=/g)).toHaveLength(4)
    expect(h).toContain('data-medidor="Apify · starter"'); expect(h).toContain('data-medidor="Náufrago"')
    expect(h).toContain("credenciales por vencer"); expect(h).toContain("pocas horas")
    expect(h).toContain("4 riesgos · 1 graves"); expect(h).toContain("el ciclo cierra el 23 nov") // 24-nov 00:00Z = 23-nov en Ecuador
    expect(h).not.toContain("🟠")
  })
  it("nunca dice «sin riesgos» con la lista incompleta", () => {
    const vacio: Riesgos = { ...d, riesgos: [], total: 0, por_gravedad: { 1: 0, 2: 0, 3: 0 } }
    expect(html({ ...vacio, completo: true })).toContain("Sin riesgos abiertos ahora")
    const inc = html({ ...vacio, completo: false })
    expect(inc).not.toContain("Sin riesgos abiertos ahora"); expect(inc).toContain("no puedo asegurarte")
  })
  it("es solo lectura: no hace ningún POST ni enlaza al tablero viejo", () => {
    const s = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
    expect(s).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/); expect(s).not.toContain("href=")
  })
})
