/**
 * DASHBOARD NUEVO · SPRINT 6.20 (1-nov · encargo «oficina del humano», capa 2): «Decisiones» con datos reales y diseño propio + títulos de las 9 pantallas
 * más grandes («que se lean de lejos»). Fuente: la ruta certificada de la plataforma `GET /api/direccion/decisiones` (CC1 #802).
 */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import {
  dondeSeDecide, haceCuanto, leerDecisiones, normalizarDecisiones, prioridadLegible, resumenDeDecisiones, tituloLimpio, TIPOS_DE_DECISION, type Decisiones,
} from "@/lib/direccion-decisiones"
import { PanelDecisiones } from "@/components/nuevo/PanelDecisiones"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { TITULO } from "@/components/nuevo/TablerosDeDireccion"

// la forma real de la respuesta (1-nov, lectura de producción, recortada)
const CRUDO = {
  ok: true, generado_en: "2026-11-01T15:32:19.302Z", completo: true, total: 3,
  decisiones: [
    { id: "f4d46f59-1d22-4780-9e40-252e74fa53b4", tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5", titulo: "Tablero financiero, versión 1: espera tu firma", desde: "2026-10-20T20:11:17.494374+00:00", vence: null, prioridad: null, decidir: { ruta: null, accion: "firmar-tablero" }, costo_usd: null, costo_nota: null, cliente: "Zero Risk Seguridad Industrial", vencida: false },
    { id: "9ccb6924-d876-4c8a-8773-a69b0ecdab76", tipo: "pieza", subtipo: "content_piece_review", fuente: "hitl_queue", client_id: "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5", titulo: "⚠️ REVISIÓN INCOMPLETA · Aprobación · Carrusel BRF-0001", desde: "2026-10-28T11:56:49.668648+00:00", vence: null, prioridad: "medium", decidir: { ruta: "/piezas", accion: null }, costo_usd: null, costo_nota: null, cliente: "Zero Risk Seguridad Industrial", vencida: false },
    { id: "0d333a57-4bb5-411b-beaf-0dc163ed5409", tipo: "plan", subtipo: "plan_con_pendientes", fuente: "hitl_queue", client_id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", titulo: "Plan de 90 días de Náufrago con pendientes", desde: "2026-10-30T23:39:50.172869+00:00", vence: null, prioridad: "high", decidir: { ruta: "/nuevo", accion: "plan-aprobar" }, costo_usd: null, costo_nota: "aprobar no gasta por sí mismo", cliente: "Náufrago", vencida: false },
  ],
  omitidas: { clientes_de_practica: 0, clientes_de_baja: 0, ensayos: 0 },
  fuentes: [{ fuente: "hitl_queue", estado: "ok", filas: 2 }, { fuente: "plan_aprobaciones", estado: "no_existe", filas: 0 }],
  sin_fuente: [{ que: "gastos por aprobar", motivo: "ninguna tabla guarda un gasto a la espera de aprobación" }],
}

describe("6.20 · la lectura de las decisiones (contrato de CC1)", () => {
  it("normaliza la respuesta real campo por campo y conserva el orden de la plataforma (lo que vence primero, luego lo más viejo)", () => {
    const d = normalizarDecisiones(CRUDO)
    expect(d.total).toBe(3); expect(d.completo).toBe(true)
    expect(d.decisiones.map((x) => x.tipo)).toEqual(["firma_de_finanzas", "pieza", "plan"])
    expect(d.decisiones[2]).toMatchObject({ cliente: "Náufrago", prioridad: "high", decidir: { ruta: "/nuevo", accion: "plan-aprobar" }, costo_nota: "aprobar no gasta por sí mismo", costo_usd: null })
    expect(d.sin_fuente).toEqual([{ que: "gastos por aprobar", motivo: "ninguna tabla guarda un gasto a la espera de aprobación" }])
    expect(d.fuentes.map((f) => f.estado)).toEqual(["ok", "no_existe"])
  })
  it("lo que no cumple el contrato se descarta y la lista queda INCOMPLETA (nunca un «estás al día» falso)", () => {
    const d = normalizarDecisiones({ ...CRUDO, decisiones: [...CRUDO.decisiones, { id: "x", tipo: "inventado", titulo: "?" }, { tipo: "plan" }] })
    expect(d.total).toBe(3); expect(d.completo).toBe(false)
    expect(normalizarDecisiones({ ...CRUDO, completo: false }).completo).toBe(false)
    expect(normalizarDecisiones(null)).toMatchObject({ total: 0, completo: false, decisiones: [] })
  })
  it("el servidor lee la ruta certificada con la llave interna (GET, sin caché) y no reenvía la llave; sin llave no llama", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(CRUDO), { status: 200 }))
    const r = await leerDecisiones({ plataformaUrl: "https://plataforma.test/", llave: "secreta", fetchImpl: f as unknown as typeof fetch })
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledWith("https://plataforma.test/api/direccion/decisiones", { method: "GET", headers: { "x-api-key": "secreta" }, cache: "no-store" })
    expect(JSON.stringify(r)).not.toContain("secreta")
    const g = vi.fn()
    expect(await leerDecisiones({ llave: "", fetchImpl: g as unknown as typeof fetch })).toMatchObject({ ok: false, status: 503 }); expect(g).not.toHaveBeenCalled()
    const h = vi.fn(async () => new Response("{}", { status: 401 }))
    expect(await leerDecisiones({ llave: "k", fetchImpl: h as unknown as typeof fetch })).toMatchObject({ ok: false, status: 502 })
  })
  it("la ruta del tablero exige administrador y no escribe nada", () => {
    const src = readFileSync("app/api/direccion/decisiones/route.ts", "utf8")
    expect(src).toContain("const puerta = await exigirAdmin()"); expect(src).toContain("export async function GET()")
    expect(src).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)|supabase/)
  })
})

describe("6.20 · dónde se decide cada una (tablero nuevo, nunca el viejo)", () => {
  it("plan → panel del plan · gran idea → panel de la gran idea · piezas y revisiones → panel de piezas; el resto lo dice, sin botón", () => {
    expect(TIPOS_DE_DECISION.map((t) => { const x = dondeSeDecide({ tipo: t }); return [t, x.panel] })).toEqual([
      ["plan", "plan"], ["gran_idea", "gran_idea"], ["pieza", "piezas"], ["revision", "piezas"], ["pregunta_al_dueno", null], ["pregunta_de_finanzas", null], ["firma_de_finanzas", null],
    ])
    const panel = readFileSync("components/nuevo/PanelDecisiones.tsx", "utf8")
    expect(panel).not.toMatch(/href=|\/oficinas|\/piezas"|window\.location/) // nada enlaza al tablero viejo
    expect(panel).toContain("<PanelPiezas onCerrar={volver} clienteInicial={abierta.client_id} piezaInicial={abierta.id} />")
    expect(panel).toContain("<PanelPlan onCerrar={volver} clienteInicial={abierta.client_id} />")
  })
  it("palabras de negocio: prioridad, espera, título limpio", () => {
    expect(prioridadLegible("high")).toEqual({ texto: "Alta", nivel: 3 }); expect(prioridadLegible(null).texto).toBe("Sin prioridad")
    const ahora = Date.parse("2026-11-01T12:00:00Z")
    expect(haceCuanto("2026-10-30T12:00:00Z", ahora)).toBe("hace 2 días"); expect(haceCuanto("2026-11-01T09:00:00Z", ahora)).toBe("hace 3 horas"); expect(haceCuanto(null)).toBe("sin fecha")
    expect(tituloLimpio("⚠️ REVISIÓN INCOMPLETA · x")).toBe("REVISIÓN INCOMPLETA · x")
  })
})

describe("6.20 · la mesa del director (panel)", () => {
  const datos = normalizarDecisiones(CRUDO)
  it("la pila: la primera al frente con todo para decidir, las siguientes asomando detrás; índice por tipo; «sin dato» declarado", () => {
    const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('data-seccion="decisiones"'); expect(html).toContain("3 decisiones esperan tu firma")
    expect(html.match(/data-decision="([^"]+)"/)![1]).toBe("f4d46f59-1d22-4780-9e40-252e74fa53b4")
    expect((html.match(/data-detras="/g) ?? []).length).toBe(2)
    expect(html).toContain("La firma del tablero financiero todavía no está en el tablero nuevo."); expect(html).not.toContain("data-decidir=")
    expect(html).toContain('data-filtro="plan"'); expect(html).toContain('data-filtro="pieza"'); expect(html).toContain('data-filtro="firma_de_finanzas"')
    expect(html).toContain("1 de 3"); expect(html).toContain("gastos por aprobar")
  })
  it("si la lista está incompleta nunca dice «estás al día»", () => {
    const vacia: Decisiones = { ...datos, total: 0, decisiones: [], completo: false }
    const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: vacia }))
    expect(html).not.toContain("Estás al día"); expect(html).toContain("no puedo asegurarte que no haya nada pendiente")
    expect(renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: { ...vacia, completo: true } }))).toContain("Estás al día")
  })
})

describe("6.20 · la pantalla 5 del arco con datos y los títulos más grandes", () => {
  it("dice cuántas esperan (con «+?» si la lista está incompleta), late si alguna apremia, y se abre al tocarla", () => {
    const r = resumenDeDecisiones(normalizarDecisiones(CRUDO))
    expect(r).toEqual({ total: 3, apremia: true, completo: true })
    const html = renderToStaticMarkup(createElement(PantallasDelArco, { decisiones: r, alAbrirDecisiones: () => {} }))
    expect(html).toContain('data-decisiones="3"'); expect(html).toMatch(/<text data-cuantas[^>]*>3<\/text>/)
    expect(html).toContain('data-abre="decisiones" role="button" tabindex="0" aria-label="Abrir tus decisiones"')
    expect(renderToStaticMarkup(createElement(PantallasDelArco, { decisiones: { ...r, completo: false } }))).toMatch(/<text data-cuantas[^>]*>3\+\?<\/text>/)
    expect(renderToStaticMarkup(createElement(PantallasDelArco, { decisiones: { total: 0, apremia: false, completo: true } }))).toContain(">al día</text>")
    const sinLectura = renderToStaticMarkup(createElement(PantallasDelArco))
    expect(sinLectura).toContain('data-decisiones="sin-lectura"'); expect(sinLectura).not.toContain("data-abre=") // sin lectura: el dibujo, y sin toque si no hay quien abra
  })
  it("los títulos de las 9 pasan de 8,5 a 13 en negrita y los largos se ajustan al ancho del vidrio", () => {
    expect(TITULO.tamano).toBe(13)
    const html = renderToStaticMarkup(createElement(PantallasDelArco))
    const titulos = [...html.matchAll(/<g class="nv-titulo"[^>]*>(.*?)<\/g>/g)].map((m) => m[1])
    expect(titulos.length).toBe(9)
    for (const t of titulos) expect(t).toMatch(/font-size="13" font-weight="700"/)
    expect(titulos.find((t) => t.includes("OBSERVABILIDAD"))).toContain('textLength="92"')
    expect(titulos.find((t) => t.includes("DINERO"))).not.toContain("textLength")
  })
  it("la escena lee las decisiones solo con la oficina abierta y la pestaña visible, cada minuto", () => {
    const e = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(e).toContain('fetch("/api/direccion/decisiones", { cache: "no-store" })'); expect(e).toContain("if (!document.hidden) { void leerDecisiones(); void leerRiesgos(); void leerCorridas() }"); expect(e).toContain("60_000")
    expect(e).toContain('const oficinaAbierta = depto === "oficina" && fase !== "cerrado"')
  })
})
