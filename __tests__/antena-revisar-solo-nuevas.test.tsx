// @vitest-environment jsdom
/**
 * 10-nov (Lenovo 23:46Z · boceto `raw/evidencia/2026-11-10-alertas/APROBADO-alertas-un-solo-camino.png`, panel 3):
 * la antena de Dept. Marketing cuenta SOLO las Nuevas, y cada decisión lleva el «✓ Revisar» de CC4 (#316), la misma pieza.
 * Revisada = la plataforma lo dice (CC1 #965) o la marcaste en esta visita. Sin dato de la libreta (estado null) cuenta como Nueva.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import type { SupabaseClient } from "@supabase/supabase-js"
import { armarAlertas, esNuevaEnLaAntena, nuevasDeLaAntena, numeroDeLaAntena, MAXIMO_DE_ALERTAS, type AlertaDeLaAntena, type DecisionPendiente, type EntradaDeAlertas, type FilaDePlan } from "@/lib/escena-alertas"
import { normalizarDecisiones, type leerDecisiones } from "@/lib/direccion-decisiones"
import { AntenaDeAlertas, ListaDeLasAlertas } from "@/components/nuevo/escena/AntenaDeAlertas"
import { leerAlertasDeLaAntena } from "@/lib/escena-avatares-datos"

afterEach(cleanup)
const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const AHORA = new Date("2026-11-09T23:10:00Z")
const CLAVE = "decision:hitl_queue:2d3c4da1-d3d5-40e0-b18e-d90e8652e001"
const vacia = (): EntradaDeAlertas => ({ cliente: NAUFRAGO, ahora: AHORA, plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [] })
const dec = (p: Partial<DecisionPendiente>): DecisionPendiente => ({ id: "2d3c4da1", tipo: "gran_idea", fuente: "hitl_queue", client_id: NAUFRAGO, desde: "2026-11-09T22:02:15Z", oficina: "marketing", cliente: "Náufrago", ...p })
const planFallido = (id: string, fin: string): FilaDePlan => ({ id, client_id: NAUFRAGO, estado: "fallida", creado_en: fin, actualizado_en: fin, vence_en: null, motivo: null, dry_run: false })
const lista = (alertas: AlertaDeLaAntena[], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ListaDeLasAlertas, { alertas, onAbrir: () => undefined, onCerrar: () => undefined, ahora: AHORA.getTime(), ...extra }))
const numero = (h: string) => { const t = /data-numero="true"[^>]*>([^<]+)</.exec(h)?.[1]; return t === "—" ? t : Number(t) }

describe("1 · el dato: la decisión trae su alerta y la antena sabe si es Nueva", () => {
  it("la decisión lleva `revisar` con la clave y el estado de la plataforma, y el nombre del cliente", () => {
    const [a] = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: "nueva" } })] })
    expect(a.revisar).toEqual({ clave: CLAVE, estado: "nueva" }); expect(a.cliente).toBe("Náufrago")
    expect(Object.keys(a).sort()).toEqual(["abre", "clave", "cliente", "cuando", "departamento", "grupo", "revisar", "texto", "tipo"]) // nada de la ficha (ADENDA 1)
  })
  it("nueva cuenta; revisada no; sin dato de la libreta (null) cuenta; marcada en esta visita no; sin alerta (no es decisión) siempre cuenta", () => {
    const de = (estado: "nueva" | "revisada" | null) => armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado } })] })[0]
    expect(esNuevaEnLaAntena(de("nueva"))).toBe(true)
    expect(esNuevaEnLaAntena(de("revisada"))).toBe(false)
    expect(esNuevaEnLaAntena(de(null))).toBe(true)
    expect(esNuevaEnLaAntena(de("nueva"), { [CLAVE]: "2026-11-09T23:09:00Z" })).toBe(false)
    expect(esNuevaEnLaAntena(de("nueva"), { "decision:hitl_queue:otra": "x" })).toBe(true)
    const [plan] = armarAlertas({ ...vacia(), plan: [planFallido("p1", "2026-11-09T23:00:00Z")] })
    expect(plan.revisar).toBeUndefined(); expect(esNuevaEnLaAntena(plan, { [CLAVE]: "x" })).toBe(true)
  })
  it("una decisión sin alerta de la plataforma (antes de #965) cuenta como Nueva y no trae `revisar`", () => {
    const [a] = armarAlertas({ ...vacia(), decisiones: [dec({})] })
    expect(a.revisar).toBeUndefined(); expect(nuevasDeLaAntena([a])).toHaveLength(1)
  })
  it("las Nuevas van primero: una revisada más reciente nunca deja fuera del tope a una Nueva", () => {
    const planes = Array.from({ length: MAXIMO_DE_ALERTAS }, (_, i) => planFallido(`p${i}`, `2026-11-09T2${i % 3}:0${i}:00Z`))
    const a = armarAlertas({ ...vacia(), plan: planes, decisiones: [dec({ desde: "2026-11-09T23:09:00Z", alerta: { clave: CLAVE, estado: "revisada" } })] })
    expect(a).toHaveLength(MAXIMO_DE_ALERTAS); expect(a.every((x) => x.tipo !== "decision")).toBe(true)
    const b = armarAlertas({ ...vacia(), plan: [planFallido("p1", "2026-11-09T20:00:00Z")], decisiones: [dec({ desde: "2026-11-09T23:09:00Z", alerta: { clave: CLAVE, estado: "revisada" } })] })
    expect(b.map((x) => x.tipo)).toEqual(["fallida", "decision"])
  })
})

describe("2 · la antena se prende y cuenta solo con las Nuevas", () => {
  it("una decisión revisada sola deja la antena apagada; nueva la prende con 1", () => {
    const rev = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: "revisada" } })] })
    const nue = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: "nueva" } })] })
    const svg = (al: AlertaDeLaAntena[]) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: nuevasDeLaAntena(al), onAbrir: () => undefined })))
    expect(svg(rev)).not.toContain("data-numero-antena"); expect(svg(rev)).toContain("data-luces-apagadas")
    expect(svg(nue)).toMatch(/data-numero-antena[^>]*>1</)
  })
  it("la escena le pasa a la antena solo las Nuevas (contando lo que marcaste aquí) y al panel la lista entera", () => {
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain("<AntenaDeAlertas alertas={nuevasDeLaAntena(datos?.alertas, revisadasAqui)}")
    expect(av).toContain("<PanelDeLasAlertas alertas={datos?.alertas} revisadasAqui={revisadasAqui} alRevisar={(c, en) => setRevisadasAqui((m) => ({ ...m, [c]: en }))}")
  })
})

describe("2b · sin dato de la libreta (Lenovo 00:30Z): la antena se prende y el número es «—»", () => {
  const svg = (al: AlertaDeLaAntena[]) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: al, onAbrir: () => undefined })))
  const conNull = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: null } })], plan: [planFallido("p1", "2026-11-09T20:00:00Z")] })
  it("una decisión sin estado: la antena prendida con «—» (no un conteo), y la lista con «—» en su recuadro rojo", () => {
    expect(numeroDeLaAntena(nuevasDeLaAntena(conNull))).toBe("—")
    const s = svg(nuevasDeLaAntena(conNull)); expect(s).toMatch(/data-numero-antena[^>]*>—</); expect(s).not.toContain(">2<")
    const h = lista(conNull); expect(numero(h)).toBe("—"); expect(h).toMatch(/border-linea-alarma text-alarma"[^>]*>—</)
    expect(h.replace(/<[^>]+>/g, "")).not.toMatch(/sin dato/i) // solo el guion, sin texto a la vista (el lector de pantalla sí lo dice)
  })
  it("sola, sin estado, igual prende; marcada aquí deja de contar y vuelve el número", () => {
    const sola = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: null } })] })
    expect(svg(nuevasDeLaAntena(sola))).toMatch(/data-numero-antena[^>]*>—</)
    const aqui = { [CLAVE]: "2026-11-09T23:09:00Z" }
    expect(numeroDeLaAntena(nuevasDeLaAntena(conNull, aqui))).toBe(1); expect(numero(lista(conNull, { revisadasAqui: aqui }))).toBe(1)
  })
  it("con todas con estado, el número es el conteo de Nuevas", () => {
    const ok = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: "nueva" } })], plan: [planFallido("p1", "2026-11-09T20:00:00Z")] })
    expect(numeroDeLaAntena(nuevasDeLaAntena(ok))).toBe(2); expect(svg(nuevasDeLaAntena(ok))).toMatch(/data-numero-antena[^>]*>2</)
  })
})

describe("3 · la lista de la antena (boceto aprobado, panel 3)", () => {
  const nueva = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: "nueva" } })], plan: [planFallido("p1", "2026-11-09T20:00:00Z")] })
  it("el número del panel cuenta solo las Nuevas; la revisada lleva el sello y el círculo hueco", () => {
    expect(numero(lista(nueva))).toBe(2)
    const h = lista(nueva, { revisadasAqui: { [CLAVE]: "2026-11-09T23:09:00Z" } })
    expect(numero(h)).toBe(1); expect(h).toContain('aria-label="1 aviso nuevo"')
    expect(h).toContain(`data-revisada="${CLAVE}"`); expect(h).not.toContain(`data-revisar="${CLAVE}"`)
    expect(h).toMatch(/data-alerta="decision"(?![^>]*data-nueva)[\s\S]*?rounded-full border border-gris/)
    const rev = armarAlertas({ ...vacia(), decisiones: [dec({ alerta: { clave: CLAVE, estado: "revisada", revisada_en: "2026-11-09T22:30:00Z" } })] })
    expect(numero(lista(rev))).toBe(0); expect(lista(rev)).toContain(`data-revisada="${CLAVE}"`)
  })
  it("la decisión: rótulo «Decisión», «Campaña de Marketing» con su línea dorada, el cliente y «✓ Revisar»; el plan fallido no ofrece «✓ Revisar»", () => {
    const h = lista(nueva)
    expect(h).toContain(">Decisión<"); expect(h).toMatch(/data-nombre-propio="true" class="underline decoration-linea-oro[^"]*">Campaña de Marketing</)
    expect(h).toContain(">Náufrago · hace una hora · abre Decisiones<")
    expect(h).toContain(`data-revisar="${CLAVE}"`); expect((h.match(/data-revisar=/g) ?? []).length).toBe(1)
    const dom = render(createElement(ListaDeLasAlertas, { alertas: nueva, onAbrir: () => undefined, onCerrar: () => undefined, ahora: AHORA.getTime() }))
    expect(dom.container.querySelector("button [data-revisar], button button")).toBeNull(); expect(dom.container.querySelector("[data-revisar]")).not.toBeNull() // el botón no va dentro del botón del aviso
    expect(h).not.toMatch(/oro que nunca buscaste|Aprobar|Pedir cambios/) // ADENDA 1: nada de la ficha
  })
  it("tocar «✓ Revisar» en la antena guarda la clave y avisa a la escena; tocar el aviso NO marca nada", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    const alRevisar = vi.fn(), onAbrir = vi.fn()
    const r = render(createElement(ListaDeLasAlertas, { alertas: nueva, onAbrir, onCerrar: () => undefined, ahora: AHORA.getTime(), alRevisar, fetchImpl: f as unknown as typeof fetch }))
    fireEvent.click(r.container.querySelector('[data-alerta="decision"] button:not([data-revisar])')!)
    expect(onAbrir).toHaveBeenCalledTimes(1); expect(f).not.toHaveBeenCalled(); expect(alRevisar).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(r.container.querySelector(`[data-revisar="${CLAVE}"]`)!) })
    await waitFor(() => expect(alRevisar).toHaveBeenCalledWith(CLAVE, expect.any(String)))
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/alertas/visto"); expect(String(init.body)).toContain(CLAVE)
  })
})

describe("4 · el camino real: de la respuesta de la plataforma a la antena", () => {
  const baseVacia = (): SupabaseClient => {
    const q: unknown = new Proxy(function () {}, { get: (_t, k) => (k === "then" ? (ok: (v: unknown) => void) => ok({ data: null, error: null }) : () => q), apply: () => q })
    return { from: () => q } as unknown as SupabaseClient
  }
  const respuesta = (estado: unknown) => ({
    ok: true, completo: true, fuentes: [], sin_fuente: [],
    decisiones: [{ id: "2d3c4da1-d3d5-40e0-b18e-d90e8652e001", tipo: "gran_idea", fuente: "hitl_queue", client_id: NAUFRAGO, cliente: "Náufrago", titulo: "Gran idea", desde: "2026-11-09T22:02:15Z",
      decidir: {}, ficha: { departamento: { oficina: "marketing", nombre: "Departamento de Marketing", corto: "Marketing" } }, alerta: { clave: CLAVE, estado } }],
  })
  const lector = (raw: unknown) => (async () => ({ ok: true, datos: normalizarDecisiones(raw) })) as unknown as typeof leerDecisiones
  it("«revisada» llega a la antena y no cuenta; «nueva» cuenta; un estado raro se lee como sin dato y cuenta", async () => {
    const rev = await leerAlertasDeLaAntena(baseVacia(), AHORA, "c5-revisar-1", lector(respuesta("revisada")))
    expect(rev.map((a) => a.revisar)).toEqual([{ clave: CLAVE, estado: "revisada" }]); expect(nuevasDeLaAntena(rev)).toHaveLength(0)
    const nue = await leerAlertasDeLaAntena(baseVacia(), AHORA, "c5-revisar-2", lector(respuesta("nueva")))
    expect(nuevasDeLaAntena(nue)).toHaveLength(1); expect(nue[0].cliente).toBe("Náufrago")
    const raro = await leerAlertasDeLaAntena(baseVacia(), AHORA, "c5-revisar-3", lector(respuesta("vista")))
    expect(raro[0].revisar?.estado).toBeNull(); expect(nuevasDeLaAntena(raro)).toHaveLength(1)
  })
})
