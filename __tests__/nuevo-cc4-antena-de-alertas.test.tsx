import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { armarAlertas, MAXIMO_DE_ALERTAS, cerebroNoCorrio, colgadas, fallidas, gastosRaros, preguntasSinResponder, type EntradaDeAlertas } from "@/lib/escena-alertas"
import { AntenaDeAlertas, partirEnLineas } from "@/components/nuevo/escena/AntenaDeAlertas"

// ENCARGO de Lenovo 04-nov 14:06Z + decisiones A/B/C de 14:20Z: la antena avisa las alertas del departamento
const AHORA = new Date("2026-11-04T15:00:00Z")
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const vacia = (): EntradaDeAlertas => ({ cliente: "c1", ahora: AHORA, plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [] })
const plan = (id: string, estado: string, creado: number, extra: Record<string, unknown> = {}) => ({ id, client_id: "c1", estado, creado_en: hace(creado), actualizado_en: hace(creado - 0.5), vence_en: null, motivo: null, dry_run: false, ...extra }) as EntradaDeAlertas["plan"][number]

describe("CC4 · antena · 1 corrida fallida", () => {
  it("una corrida fallida avisa con la hora y el porqué en palabras simples; se apaga sola cuando una corrida posterior queda hecha", () => {
    const f = plan("a", "fallida", 3, { motivo: "El proceso se cerró esperando al redactor: tardó más" })
    const a = fallidas({ ...vacia(), plan: [f] })
    expect(a).toHaveLength(1); expect(a[0].texto).toMatch(/^El plan falló a las \d\d:\d\d esperando al redactor$/); expect(a[0].texto).not.toMatch(/proceso|tardó/)
    expect(fallidas({ ...vacia(), plan: [f, plan("b", "hecha", 2)] })).toEqual([]) // se resolvió: apaga sola
    expect(fallidas({ ...vacia(), plan: [plan("c", "hecha", 4), f] })).toHaveLength(1) // la buena era ANTERIOR: sigue avisando
    expect(fallidas({ ...vacia(), cliente: null, plan: [f, plan("o", "hecha", 2, { client_id: "otro" })] })).toHaveLength(1) // una «hecha» de OTRO cliente no apaga la alerta (reserva (a) de CC3)
  })
  it("los ensayos en seco y las fallas de más de 7 días no avisan; la de otro cliente tampoco", () => {
    expect(fallidas({ ...vacia(), plan: [plan("a", "fallida", 3, { dry_run: true })] })).toEqual([])
    expect(fallidas({ ...vacia(), plan: [plan("a", "fallida", 24 * 8)] })).toEqual([])
    expect(fallidas({ ...vacia(), plan: [plan("a", "fallida", 3, { client_id: "otro" })] })).toEqual([])
  })
})

describe("CC4 · antena · 2 algo colgado", () => {
  it("avisa si pasó su plazo o, sin plazo, si no se movió en 3 h; lo cerrado o reciente no", () => {
    expect(colgadas({ ...vacia(), plan: [plan("a", "corriendo", 5, { vence_en: hace(1) })] })).toHaveLength(1)
    expect(colgadas({ ...vacia(), plan: [plan("a", "corriendo", 6, { actualizado_en: hace(4) })] })).toHaveLength(1)
    expect(colgadas({ ...vacia(), plan: [plan("a", "corriendo", 1, { vence_en: hace(-2) })] })).toEqual([])
    expect(colgadas({ ...vacia(), plan: [plan("a", "corriendo", 6, { actualizado_en: hace(2) })] })).toEqual([]) // sin plazo y movido hace 2 h: aún no (reserva (c))
    expect(colgadas({ ...vacia(), plan: [plan("a", "hecha", 9), plan("b", "fallida", 9)] })).toEqual([])
  })
})

describe("CC4 · antena · 3 gasto raro (decisión A)", () => {
  const c = (ejecucion: string, costo: number, h = 1) => ({ ejecucion, flujo: "f1", client_id: "c1", costo, inicio: hace(h) })
  it("más de 3 veces la mediana de su tipo Y más de US$ 1; con muestra de al menos 5", () => {
    const normales = [c("a", 0.25, 30), c("b", 0.3, 31), c("d", 0.2, 32), c("e", 0.25, 33)]
    expect(gastosRaros({ ...vacia(), corridas: [...normales, c("x", 4.5)] })).toHaveLength(1)
    expect(gastosRaros({ ...vacia(), corridas: [...normales, c("x", 0.9)] })).toEqual([]) // bajo el piso de US$ 1
    expect(gastosRaros({ ...vacia(), corridas: [...normales, c("x", 0.6)] })).toEqual([]) // más del doble pero no 3×
    expect(gastosRaros({ ...vacia(), corridas: [...normales.slice(0, 2), c("x", 4.5)] })).toEqual([]) // muestra chica
    expect(gastosRaros({ ...vacia(), corridas: [...normales, c("x", 4.5, 30)] })).toEqual([]) // de hace más de un día
    // el hueco que halló CC3: algunas llamadas guardan como «flujo» el id de la propia ejecución; esa corrida cara igual avisa contra el conjunto
    expect(gastosRaros({ ...vacia(), corridas: [...normales, { ejecucion: "214515", flujo: "214515", client_id: "c1", costo: 3.63, inicio: hace(2) }] })).toHaveLength(1)
  })
})

describe("CC4 · antena · 4 el cerebro no corrió (decisión B)", () => {
  it("sin historial (nunca corrió) NO avisa: no nace roja; con historial avisa si falta ayer o si el último salió mal", () => {
    expect(cerebroNoCorrio(vacia())).toEqual([])
    const fila = (dia: string, estado = "ok") => ({ client_id: "c1", dia, estado, prueba: false })
    expect(cerebroNoCorrio({ ...vacia(), cerebroDiario: [fila("2026-11-03")] })).toEqual([]) // ayer corrió
    expect(cerebroNoCorrio({ ...vacia(), cerebroDiario: [fila("2026-11-01")] })[0].texto).toContain("desde el 01/11")
    expect(cerebroNoCorrio({ ...vacia(), cerebroDiario: [fila("2026-11-04", "fallida")] })[0].texto).toContain("salió mal")
    expect(cerebroNoCorrio({ ...vacia(), cerebroDiario: [{ ...fila("2026-10-01"), prueba: true }] })).toEqual([]) // las de prueba no cuentan
    expect(cerebroNoCorrio({ ...vacia(), alarmasDelCerebro: [{ clave: "k", ultima_en: hace(2) }] })).toHaveLength(1)
  })
})

describe("CC4 · antena · 5 pregunta sin responder (decisión C)", () => {
  it("solo las pendientes de los últimos 7 días; las viejas y las respondidas no", () => {
    const p = (id: string, estado: string, h: number) => ({ id, client_id: "c1", pregunta: "¿Qué sede abre el domingo?", estado, creado_en: hace(h) })
    const a = preguntasSinResponder({ ...vacia(), preguntas: [p("1", "pendiente", 2), p("2", "pendiente", 24 * 15), p("3", "respondida", 2)] })
    expect(a).toHaveLength(1); expect(a[0].texto).toContain("¿Qué sede abre el domingo?")
  })
})

describe("CC4 · antena · el conjunto y lo que se ve", () => {
  it("la más reciente arriba; sin alertas, lista vacía", () => {
    expect(armarAlertas(vacia())).toEqual([])
    const a = armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)], preguntas: [{ id: "1", client_id: "c1", pregunta: "x", estado: "pendiente", creado_en: hace(1) }] })
    expect(a.map((x) => x.tipo)).toEqual(["pregunta", "fallida"])
    const muchas = Array.from({ length: 9 }, (_, i) => ({ id: String(i), client_id: "c1", pregunta: `p${i}`, estado: "pendiente", creado_en: hace(i + 1) }))
    expect(armarAlertas({ ...vacia(), preguntas: muchas })).toHaveLength(MAXIMO_DE_ALERTAS) // el tope (reserva (b))
  })
  it("sin alertas no se dibuja nada; con alertas, roja fija (sin latido ni aura) y la lista queda cerrada hasta que se toque", () => {
    expect(renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: [], onAbrir: () => undefined })))).not.toContain("nv-antena")
    expect(renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: undefined, onAbrir: () => undefined })))).not.toContain("nv-antena")
    const html = renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)] }), onAbrir: () => undefined })))
    expect(html).toContain('data-alertas="1"'); expect(html).toContain("#ef4444"); expect(html).toContain('aria-label="1 alerta del departamento. Ver la lista"')
    expect(html).not.toMatch(/animation|nv-av-ambar|drop-shadow|filter/)
    expect(html).not.toContain("nv-antena-lista")
  })
  it("el texto largo se parte en renglones cortos y la antena está cableada en la escena y en la lectura (solo lectura)", () => {
    expect(partirEnLineas("Te preguntaron algo y sigue sin respuesta: ¿Qué sede abre el domingo en la mañana?").every((l) => l.length <= 36)).toBe(true)
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toContain("<AntenaDeAlertas alertas={datos?.alertas}")
    const lector = readFileSync("lib/escena-avatares-datos.ts", "utf8").split("export async function leerAlertasDeLaAntena")[1].split("/** la vitrina")[0]
    expect(lector).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})
