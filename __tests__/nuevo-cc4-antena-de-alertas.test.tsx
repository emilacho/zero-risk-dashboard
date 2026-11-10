import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ANTENA, armarAlertas, BORDE_DE_LA_ANTENA, GASTO_RARO_EN_LA_ANTENA, MAXIMO_DE_ALERTAS, cerebroNoCorrio, colgadas, fallidas, gastosRaros, preguntasSinResponder, type EntradaDeAlertas } from "@/lib/escena-alertas"
import { AntenaDeAlertas, CSS_DE_LA_ANTENA, PanelDeLasAlertas } from "@/components/nuevo/escena/AntenaDeAlertas"

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

describe("CC4 · antena · sin alertas de dinero (Emilio 05-nov 00:13Z)", () => {
  const c = (ejecucion: string, costo: number, h = 1) => ({ ejecucion, flujo: "f1", client_id: "c1", costo, inicio: hace(h) })
  const caras = [c("a", 0.25, 30), c("b", 0.3, 31), c("d", 0.2, 32), c("e", 0.25, 33), c("x", 4.5)]
  it("una corrida cara ya no llega a la antena, aunque la lógica la siga detectando (control)", () => {
    expect(GASTO_RARO_EN_LA_ANTENA).toBe(false)
    expect(gastosRaros({ ...vacia(), corridas: caras })).toHaveLength(1)
    expect(armarAlertas({ ...vacia(), corridas: caras })).toEqual([])
  })
  it("las del Dept. Marketing siguen avisando (corrección 09-nov: el cerebro ya no entra a la antena)", () => {
    const a = armarAlertas({
      ...vacia(),
      corridas: caras,
      plan: [plan("f", "fallida", 3), plan("g", "corriendo", 5, { vence_en: hace(1) })],
      alarmasDelCerebro: [{ clave: "k", ultima_en: hace(2) }],
      preguntas: [{ id: "1", client_id: "c1", pregunta: "x", estado: "pendiente", creado_en: hace(1), oficina: "marketing" }],
    })
    expect(a.map((x) => x.tipo).sort()).toEqual(["colgada", "fallida", "pregunta"])
  })
  it("apagado, no se pide el gasto a la base", () => {
    const fuente = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(fuente).toContain('GASTO_RARO_EN_LA_ANTENA ? filas(supa.from("agent_invocations")')
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
    const p = (id: string, estado: string, h: number) => ({ id, client_id: "c1", pregunta: "¿Qué sede abre el domingo?", estado, creado_en: hace(h), oficina: "marketing" })
    const a = preguntasSinResponder({ ...vacia(), preguntas: [p("1", "pendiente", 2), p("2", "pendiente", 24 * 15), p("3", "respondida", 2)] })
    expect(a).toHaveLength(1); expect(a[0].texto).toContain("¿Qué sede abre el domingo?")
  })
})

describe("CC4 · antena · el conjunto y lo que se ve", () => {
  it("la más reciente arriba; sin alertas, lista vacía", () => {
    expect(armarAlertas(vacia())).toEqual([])
    const a = armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)], preguntas: [{ id: "1", client_id: "c1", pregunta: "x", estado: "pendiente", creado_en: hace(1), oficina: "marketing" }] })
    expect(a.map((x) => x.tipo)).toEqual(["pregunta", "fallida"])
    const muchas = Array.from({ length: 9 }, (_, i) => ({ id: String(i), client_id: "c1", pregunta: `p${i}`, estado: "pendiente", creado_en: hace(i + 1), oficina: "marketing" }))
    expect(armarAlertas({ ...vacia(), preguntas: muchas })).toHaveLength(MAXIMO_DE_ALERTAS) // el tope (reserva (b))
  })
  it("sin alertas no se dibuja nada; con alertas: aura roja en la punta mayor y luz que corre por el borde, sin formas planas; la lista queda en un panel", () => {
    expect(renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: [], onAbrir: () => undefined })))).not.toContain("nv-antena")
    expect(renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: undefined, onAbrir: () => undefined })))).not.toContain("nv-antena")
    const html = renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas: armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)] }), onAbrir: () => undefined })))
    expect(html).toContain('data-alertas="1"'); expect(html).toContain('aria-label="1 alerta del departamento. Ver la lista"')
    expect(html).toContain("nv-antena-pulso"); expect(html).toContain("nv-antena-corre")
    expect(html).not.toMatch(/#ffd2c8|#fff1ee"[^>]*stroke/) // el tramo blanco desapareció (Emilio 15:34Z)
    const trazos = [...html.matchAll(/<path[^>]*stroke-width="([\d.]+)"/g)].map((m) => m[1])
    expect(trazos).toHaveLength(1) // un solo trazo: el tramo que viaja; el borde NO se enciende (Emilio 15:49Z)
    expect(html).not.toContain("nv-antena-borde")
    expect(html).toContain('stroke-dasharray="5 95"') // tramo corto
    expect(html).toContain(`<circle cx="${ANTENA.punta2.x}" cy="${ANTENA.punta2.y}" r="28"`) // el aura va centrada en la luz de la punta
    expect(html).toContain(`<circle cx="${ANTENA.punta2.x}" cy="${ANTENA.punta2.y}" r="4"`)
    expect([ANTENA.punta2.x, ANTENA.punta2.y]).toEqual([505, 257]) // medido en la foto de 2560 px (pico de luz 505,257)
    expect(html).not.toMatch(/style="[^"]*animation/) // la animación NO va inline: ganaría a «reducir movimiento»
    expect(CSS_DE_LA_ANTENA).toMatch(/\.nv-antena-pulso\{animation:nvAntPulso 2\.2s/)
    expect(html).toContain(`d="${BORDE_DE_LA_ANTENA}"`) // la luz y la línea comparten el mismo trazo: no se sale del canal
    expect(html).not.toMatch(/<ellipse[^>]*fill-opacity|stroke-width="3"[^>]*fill-opacity/) // ningún plato plano translúcido (#273)
    expect(html).not.toContain("nv-antena-lista")
  })
  it("el borde se recorre en sentido del reloj (derecha → abajo → izquierda); respeta «reducir movimiento»", () => {
    const n = BORDE_DE_LA_ANTENA.match(/\d+/g)!.map(Number)
    expect(n[0]).toBeGreaterThan(n[4]) // empieza a la derecha y termina a la izquierda
    expect(n[3]).toBeGreaterThan(n[1]) // pasa por abajo (y mayor)
    const [normal, reducido] = CSS_DE_LA_ANTENA.split("@media (prefers-reduced-motion:reduce)")
    expect(normal).toContain("animation:nvAntCorre"); expect(reducido).toMatch(/nv-antena-pulso[^}]*nv-antena-corre\{animation:none\}/) // en la hoja, tras el movimiento normal: la regla de reducir gana por orden
  })
  it("el panel de la lista: una fila por alerta con su texto; solo es botón activo si hay dónde resolverla; la lectura de datos sigue siendo solo lectura", () => {
    const alertas = armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)] })
    const html = renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas, onAbrir: () => undefined, onCerrar: () => undefined }))
    expect(html).toContain("data-panel-alertas"); expect(html).toMatch(/data-numero="true" aria-label="1 aviso nuevo"[^>]*>1</); expect(html).toContain("El plan falló") // 06-nov · estilo base: el número en su recuadro
    expect(renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [], onAbrir: () => undefined, onCerrar: () => undefined }))).toContain("Todo en orden")
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain("<AntenaDeAlertas alertas={nuevasDeLaAntena(datos?.alertas, revisadasAqui)}"); expect(av).toContain("<PanelDeLasAlertas")
    expect(readFileSync("lib/escena-avatares-datos.ts", "utf8")).toContain("alertas: await leerAlertasDeLaAntena")
    const lector = readFileSync("lib/escena-avatares-datos.ts", "utf8").split("export async function leerAlertasDeLaAntena")[1].split("/** la vitrina")[0]
    expect(lector).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})
