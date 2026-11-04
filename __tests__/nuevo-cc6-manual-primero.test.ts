/** MANUAL PRIMERO (CC6 · 03-nov · encargo de Lenovo 20:37Z: «el plan no se firma antes del manual», regla de Emilio 14:46Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { coberturaDelPlan, diasPrometidos, esperaLaFirma, manualAprobadoPorCliente, PLAN_ESPERA_EL_MANUAL } from "@/lib/manual-primero"
import { barraDelPlan } from "@/lib/plan-barra"
import { palabrasDeLaRespuesta } from "@/lib/plan"
import { detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import type { PlanDelCliente } from "@/lib/plan-datos"

const A = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", B = "11111111-2222-4333-8444-555555555555"
const base = (filas: Array<Record<string, unknown>>, falla = false) => ({ from: () => {
  let d = [...filas]
  const q: Record<string, unknown> = {}
  q.select = () => q; q.limit = () => q
  q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
  q.order = (c: string, o: { ascending: boolean }) => { d.sort((x, y) => (Number(x[c]) - Number(y[c])) * (o.ascending ? 1 : -1)); return q }
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve(falla ? { data: null, error: { message: "caída" } } : { data: d, error: null }).then(ok)
  return q
} }) as never

describe("¿el dueño aprobó el manual VIGENTE de cada cliente?", () => {
  it("cuenta la última versión de cada uno; lo de la jefatura no es del dueño; sin manual o con la base caída, no se sabe (null)", async () => {
    const m = await manualAprobadoPorCliente(base([
      { client_id: A, version: 1, human_validated: true, provenance_tag: { validado_por: "dueno" } },
      { client_id: A, version: 2, human_validated: false, provenance_tag: {} }, // la vigente de A: sin aprobar
      { client_id: B, version: 3, human_validated: true, provenance_tag: { validado_por: "dueno" } },
    ]), [A, B, "sin-manual"])
    expect(m.get(A)).toBe(false); expect(m.get(B)).toBe(true); expect(m.get("sin-manual")).toBeNull()
    expect((await manualAprobadoPorCliente(base([{ client_id: A, version: 1, human_validated: true, provenance_tag: { validado_por: "jefatura" } }]), [A])).get(A)).toBe(false)
    expect((await manualAprobadoPorCliente(base([], true), [A])).get(A)).toBeNull()
  })
  it("la lámpara «espera tu firma»: un plan con el manual sin aprobar no cuenta; lo demás, y lo que no se sabe, sí", () => {
    const ap = new Map<string, boolean | null>([[A, false], [B, true]])
    expect(esperaLaFirma({ documento: "plan", client_id: A }, ap)).toBe(false)
    expect(esperaLaFirma({ documento: "plan", client_id: B }, ap)).toBe(true)
    expect(esperaLaFirma({ documento: "plan", client_id: "otro" }, ap)).toBe(true) // no se supo: no se esconde
    expect(esperaLaFirma({ documento: "pieza", client_id: A }, ap)).toBe(true) // las piezas no esperan el manual
  })
  it("la escena cuenta para la lámpara SOLO lo que espera la firma (no la bandeja entera)", () => {
    const f = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(f).toContain("const bandejaQueCuenta = bandeja.filter((b) => esperaLaFirma(b, aprobado))")
    expect(f).toContain("bandeja: bandejaQueCuenta,")
  })
})

describe("el nombre del plan no cambia; lo que cubre se dice en palabras (Lenovo 20:37Z)", () => {
  it("los días prometidos salen del nombre del plan; sin número, 90", () => {
    expect(diasPrometidos("Plan de 90 dias · 2026-11-03")).toBe(90); expect(diasPrometidos("Plan de 60 días")).toBe(60); expect(diasPrometidos(null)).toBe(90)
  })
  it("«Este plan solo cubre 4 semanas (28 de los 90 días).»; si cubre todo, nada", () => {
    expect(coberturaDelPlan(28, 90)).toBe("Este plan solo cubre 4 semanas (28 de los 90 días).")
    expect(coberturaDelPlan(7, 90)).toBe("Este plan solo cubre 1 semana (7 de los 90 días).")
    expect(coberturaDelPlan(60, 90)).toBe("Este plan solo cubre 60 de los 90 días.")
    expect(coberturaDelPlan(90, 90)).toBeNull(); expect(coberturaDelPlan(0, 90)).toBeNull()
  })
})

const plan = (manual_aprobado: boolean | null): PlanDelCliente => ({
  clientes: [{ id: A, nombre: "Cliente de práctica" }], cliente: { id: A, nombre: "Cliente de práctica" }, hoy: "2026-11-03", leido_en: "x", manual_aprobado,
  campana: null, estrategia: null, fase_activa: { situacion: "sin_fecha", fase: null, dia: null, dias_para_empezar: null },
  documento: { id: "d", titulo: "Plan de 90 dias · 2026-11-03", creado_en: null, actualizado_en: null, status: "draft", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: { meta_por_semana: 80, evento: null, zonas: [], horario: null, dias_activos_por_semana: null, horizonte_dias: 28, canales: [], produccion_fraccion: null, marca_fraccion: null, no_se: [], equilibrio: null, otras_claves: [] }, prosa: null, caracteres: 0, que_cambio: null },
  revision: null, palabra_del_dueno: [], esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [],
  ciclo: { disponible: true, version: 1, con_compuerta: true, historial: [], compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, pedido: null, avance: null, avance_de: null, comparacion_fallo: false } as never,
} as never)

describe("la puerta de CC1 (#874) rechaza firmar con el manual sin aprobar: se dice en palabras y se vuelve a leer", () => {
  it("409 `plan_espera_al_manual` → el texto único, sin código crudo, y relee", () => {
    for (const accion of ["plan-aprobar", "plan-cambios"] as const) {
      const r = palabrasDeLaRespuesta(accion, 409, { ok: false, error: "conflicto", detalle: "Plan: espera que apruebes el manual. Al aprobarlo, el plan se rehace con ese manual.", plataforma: { error: "plan_espera_al_manual" } })
      expect(r).toMatchObject({ ok: false, texto: "Plan: espera que apruebes el manual. Al aprobarlo, el plan se rehace con ese manual. No se cambió nada.", releer: true })
      expect(r.texto).not.toContain("plan_espera_al_manual")
    }
  })
})

describe("el panel y la barra del Plan, con el manual SIN aprobar", () => {
  it("el panel dice «Plan: espera que apruebes el manual» y NO ofrece «Aprobar el plan así» ni «Pedir cambios al plan»", () => {
    const h = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: plan(false) }))
    expect(h).toContain("data-plan-espera-el-manual"); expect(h).toContain(PLAN_ESPERA_EL_MANUAL)
    expect(h).not.toContain('data-accion="plan-aprobar-asi"'); expect(h).not.toContain('data-accion="plan-pedir-cambios"')
    const ok = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: plan(true) }))
    expect(ok).toContain('data-accion="plan-aprobar-asi"'); expect(ok).not.toContain("data-plan-espera-el-manual")
    expect(renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: plan(null) }))).toContain('data-accion="plan-aprobar-asi"') // sin saber, como antes
  })
  it("el nombre «Plan de 90 días» y la cobertura del plan de 28 días, en palabras", () => {
    const h = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: plan(false) }))
    expect(h).toContain(">Plan de 90 días</h2>"); expect(h).toContain("Este plan solo cubre 4 semanas (28 de los 90 días).")
  })
  it("la barra dice lo mismo: estado «Espera que apruebes el manual» y en «Lo que te toca» el texto único, no «Aprobar el plan»", () => {
    const b = barraDelPlan(plan(false))
    expect(b.decision).toEqual({ titulo: PLAN_ESPERA_EL_MANUAL, estado: "espera_el_manual" })
    expect(b.te_toca).toContain(PLAN_ESPERA_EL_MANUAL); expect(b.te_toca).not.toContain("Aprobar el plan o pedir cambios")
    expect(barraDelPlan(plan(true)).te_toca).toContain("Aprobar el plan o pedir cambios")
  })
  it("el pizarrón dice EXACTAMENTE lo mismo, con o sin campaña", () => {
    const piz = (con_campana: boolean) => ({ clientes: [{ id: A, nombre: "x", con_campana }], cliente: { id: A, nombre: "x" }, manual_aprobado: false, campana: null, fases: [], fase_activa: { situacion: "sin_fecha" }, gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, hoy: "2026-11-03", leido_en: "x" }) as never
    expect(detalleDelCuadro("plan", piz(false))).toEqual({ texto: PLAN_ESPERA_EL_MANUAL, aviso: true })
    expect(detalleDelCuadro("plan", piz(true))).toEqual({ texto: PLAN_ESPERA_EL_MANUAL, aviso: true })
  })
})

describe("UNA sola función dice en qué está el plan (Lenovo 21:15Z: la línea de la escena pedía decisión con el manual sin aprobar)", () => {
  it("con el manual sin aprobar manda «plan: espera que apruebes el manual»; si no, el estado del ciclo como antes", async () => {
    const { estadoDelPlan } = await import("@/lib/manual-primero")
    expect(estadoDelPlan(plan(false))).toEqual({ clave: "espera_el_manual", texto: "plan: espera que apruebes el manual" })
    expect(estadoDelPlan(plan(true))).toEqual({ clave: "esperando_decision", texto: "plan esperando tu decisión" })
    expect(estadoDelPlan(plan(null)).clave).toBe("esperando_decision") // sin saber, no se esconde
    expect(estadoDelPlan({ ...plan(false), documento: null, campana: null } as never)).toEqual({ clave: "sin_plan", texto: "todavía sin plan" })
  })
  it("la línea de contexto de la escena (y la cabecera del Calendario) sale de esa función: «Náufrago · plan: espera que apruebes el manual»", async () => {
    const { momentoDeLaCampana } = await import("@/lib/escena-avatares")
    expect(momentoDeLaCampana({ ...plan(false), cliente: { id: A, nombre: "Náufrago" } } as never)).toEqual({ cliente: "Náufrago", momento: "plan: espera que apruebes el manual" })
  })
  it("ningún otro archivo escribe el estado del plan por su cuenta", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs")
    const { join } = require("node:path") as typeof import("node:path")
    const archivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : /\.tsx?$/.test(n) ? [p] : [] })
    const con = ["lib", "components"].flatMap(archivos).filter((p) => readFileSync(p, "utf8").split(String.fromCharCode(10)).some((l) => !/^\s*(\/\/|\/?\*)/.test(l) && /plan esperando tu decisi|espera que apruebes el manual/i.test(l.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, ""))))
    expect(con.map((p) => p.split("\\").join("/")).sort()).toEqual(["lib/manual-primero.ts", "lib/plan.ts"]) // plan.ts: solo el mensaje del rechazo 409 de la plataforma, no calcula el estado
  })
})
