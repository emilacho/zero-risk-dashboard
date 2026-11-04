/** EL BORRADOR DE «TUS CAMBIOS» (CC6 · 03-nov · corrección de Lenovo 18:13Z · contrato CC1 #872). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { borradorLeido, borradorVacio, borrarBorrador, guardarBorrador, haceCuanto, leerBorrador, pasarAlBorrador, pasoDelGuardado, queHacerAlAbrir, salirTrasGuardar, textoDelAvisoDeSalir, TOPE_DEL_BORRADOR } from "@/lib/borrador-del-dueno"
import { readFileSync } from "node:fs"
import { motivoDeNoAprobar, PanelManual } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import type { ManualDelCliente } from "@/lib/manual-datos"
import { SIN_CAMBIOS } from "@/lib/pedido-del-manual"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const ACC = { campos: { eslogan: "Del mar a tu puerta" }, como: { eslogan: "elegir" }, notas: {}, libre: "" }

describe("lo que vuelve de la plataforma, leído con cuidado", () => {
  it("un borrador con forma de «Tus cambios» (con el renglón editado de CC2); lo que no tiene forma, nada", () => {
    expect(borradorLeido({ documento_id: "b2", acciones: { ...ACC, detalle: { valores: "renglón 2" } }, revision: 3, actualizado_en: "2026-11-03T18:30:00Z" }))
      .toEqual({ documento_id: "b2", acciones: { ...ACC, detalle: { valores: "renglón 2" } }, revision: 3, actualizado_en: "2026-11-03T18:30:00Z" })
    expect(borradorLeido({ documento_id: "b2", acciones: { campos: { a: 1, b: "x" }, libre: 5 } })).toEqual({ documento_id: "b2", acciones: { campos: { b: "x" }, como: {}, notas: {}, libre: "" }, revision: null, actualizado_en: null })
    for (const malo of [null, "x", { acciones: ACC }, { documento_id: "b2", acciones: [] }]) expect(borradorLeido(malo)).toBeNull()
  })
  it("vacío = sin nada pendiente; «hace N min»", () => {
    expect(borradorVacio(SIN_CAMBIOS)).toBe(true); expect(borradorVacio({ ...SIN_CAMBIOS, libre: "  " })).toBe(true); expect(borradorVacio(ACC as never)).toBe(false)
    const ahora = new Date("2026-11-03T18:40:00Z")
    expect(haceCuanto("2026-11-03T18:39:40Z", ahora)).toBe("borrador guardado · hace un momento")
    expect(haceCuanto("2026-11-03T18:28:00Z", ahora)).toBe("borrador guardado · hace 12 min")
    expect(haceCuanto("2026-11-03T15:40:00Z", ahora)).toBe("borrador guardado · hace 3 h")
    expect(haceCuanto(null, ahora)).toBe("borrador guardado")
  })
})

describe("las decisiones del panel (puras)", () => {
  const b = (documento_id: string, acciones = ACC) => ({ documento_id, acciones: acciones as never, revision: 1, actualizado_en: null })
  it("al abrir: el de ESTA versión vuelve a «Tus cambios»; el de otra versión se pregunta; vacío o ninguno, nada", () => {
    expect(queHacerAlAbrir(b("v2"), "v2")).toEqual({ tipo: "recuperar", acciones: ACC })
    expect(queHacerAlAbrir(b("v1"), "v2")).toMatchObject({ tipo: "preguntar" })
    expect(queHacerAlAbrir(b("v2", SIN_CAMBIOS as never), "v2")).toEqual({ tipo: "nada" })
    expect(queHacerAlAbrir(null, "v2")).toEqual({ tipo: "nada" })
  })
  it("guardar: nunca antes de leer el borrador de ESTE manual (no se pisa el de otro); nada si no cambió; vacío = borrar, salvo un borrador viejo sin decidir", () => {
    const base = { leido: true, igualAlUltimo: false, vacio: false, hayViejoSinDecidir: false, hayGuardado: true }
    expect(pasoDelGuardado(base)).toBe("guardar")
    expect(pasoDelGuardado({ ...base, leido: false })).toBe("nada")
    expect(pasoDelGuardado({ ...base, igualAlUltimo: true })).toBe("nada")
    expect(pasoDelGuardado({ ...base, vacio: true })).toBe("borrar")
    expect(pasoDelGuardado({ ...base, vacio: true, hayViejoSinDecidir: true })).toBe("nada")
    expect(pasoDelGuardado({ ...base, vacio: true, hayGuardado: false })).toBe("nada") // al abrir sin borrador: no hay qué borrar
    expect(pasoDelGuardado({ ...base, hayViejoSinDecidir: true })).toBe("guardar") // empezó algo nuevo: eso manda
  })
})

describe("reservas de CC3 a #240: el aviso de salir no promete lo que no cumplió", () => {
  it("si el último guardado falló, lo dice; si no, «quedan guardados»", () => {
    expect(textoDelAvisoDeSalir(2, false)).toBe("Tienes 2 cambios sin pedir. Quedan guardados como borrador.")
    expect(textoDelAvisoDeSalir(1, true)).toBe("No pude guardar tu borrador: si sales ahora, se pierden tus 1 cambio sin pedir.")
  })
  it("«Salir» guarda primero; si no pudo, NO sale (y lo dice); si pudo, sale", async () => {
    let salio = 0
    expect(await salirTrasGuardar(async () => false, () => { salio++ })).toBe("no_se_pudo_guardar"); expect(salio).toBe(0)
    expect(await salirTrasGuardar(async () => true, () => { salio++ })).toBe("salio"); expect(salio).toBe(1)
  })
  it("el panel, cuando no pudo guardar: el aviso en rojo y «Salir sin guardar»", () => {
    const h = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" }, salirInicial: true, noSePudoGuardarInicial: true })
    expect(h).toContain("No pude guardar tu borrador: si sales ahora, se pierden tus 1 cambio sin pedir.")
    expect(h).toMatch(/data-accion="salir-igual"[^>]*>Salir sin guardar</)
    expect(panel({ cambiosIniciales: { eslogan: "x" }, salirInicial: true })).toMatch(/data-accion="salir-igual"[^>]*>Salir</)
  })
  it("reserva 2: vaciar «Tus cambios» se guarda VACÍO con la revisión (no borra a ciegas lo de otro equipo)", () => {
    const f = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
    expect(f).toContain('const lo = paso === "borrar" ? { campos: {}, como: {}, notas: {}, libre: "" } : tus')
    expect(f).toContain('let g = await apiBorrador.guardar(cliente, "manual", manualId, lo, revisionVigente.current ?? 0)') // 04-nov: la revisión al instante, no la del render
    expect(f).toMatch(/if \(paso === "borrar"\) \{\s*\/\/ reserva 2 de CC3[^\n]*\n\s*ponerTus\(otro\.acciones\)/) // vaciar con choque: se muestra lo del otro equipo, no se reintenta
    expect(f.match(/apiBorrador\.borrar\(/g)?.length).toBe(1) // borrar a secas, solo al descartar el borrador de la versión anterior
  })
})

describe("la capa del tablero hacia la plataforma (contrato CC1 #872)", () => {
  const llamadas: Array<{ url: string; metodo: string; cuerpo: unknown; llave: string | null }> = []
  const f = (status = 200, j: unknown = { ok: true, borrador: null }) => (async (u: string, i?: RequestInit) => { llamadas.push({ url: u, metodo: String(i?.method), cuerpo: i?.body ? JSON.parse(String(i.body)) : null, llave: new Headers(i?.headers).get("x-api-key") }); return new Response(JSON.stringify(j), { status }) }) as unknown as typeof fetch
  const d = (st?: number, j?: unknown) => ({ plataformaUrl: "https://p.test/", llave: "k", revisor: "emilio", fetchImpl: f(st, j) })
  it("leer y borrar van a la ruta propia (no a /api/tablero) con la llave interna y el cliente y documento en la dirección", async () => {
    llamadas.length = 0
    expect((await pasarAlBorrador("GET", { client_id: C, documento: "manual" }, d())).status).toBe(200)
    expect((await pasarAlBorrador("DELETE", { client_id: C, documento: "plan" }, d())).status).toBe(200)
    expect(llamadas.map((x) => `${x.metodo} ${x.url}`)).toEqual([`GET https://p.test/api/borradores-del-dueno?client_id=${C}&documento=manual`, `DELETE https://p.test/api/borradores-del-dueno?client_id=${C}&documento=plan`])
    expect(llamadas.every((x) => x.llave === "k")).toBe(true)
  })
  it("guardar manda TODO el borrador, la versión, la revisión base y quién", async () => {
    llamadas.length = 0
    await pasarAlBorrador("PUT", { client_id: C, documento: "manual", documento_id: "v2", acciones: ACC, revision_base: 3 }, d())
    expect(llamadas[0]).toMatchObject({ metodo: "PUT", url: "https://p.test/api/borradores-del-dueno", cuerpo: { client_id: C, documento: "manual", documento_id: "v2", acciones: ACC, revision_base: 3, reviewer: "emilio" } })
  })
  it("rechaza sin llamar: sin cliente, documento raro, sin versión, sin cambios, revisión inválida, más de 600.000; sin llave, 503", async () => {
    llamadas.length = 0
    for (const e of [{ client_id: "x", documento: "manual" }, { client_id: C, documento: "pieza" }]) expect((await pasarAlBorrador("GET", e, d())).status).toBe(400)
    for (const e of [{ client_id: C, documento: "manual", acciones: ACC }, { client_id: C, documento: "manual", documento_id: "v2" }, { client_id: C, documento: "manual", documento_id: "v2", acciones: ACC, revision_base: -1 }, { client_id: C, documento: "manual", documento_id: "v2", acciones: { ...ACC, libre: "x".repeat(TOPE_DEL_BORRADOR) } }])
      expect((await pasarAlBorrador("PUT", e, d())).status).toBe(400)
    expect(llamadas).toEqual([])
    expect((await pasarAlBorrador("GET", { client_id: C, documento: "manual" }, { ...d(), llave: "" })).status).toBe(503)
  })
  it("la plataforma sin la ruta todavía → «aún no disponible» (501); un 409 de otro equipo pasa tal cual", async () => {
    expect((await pasarAlBorrador("GET", { client_id: C, documento: "manual" }, d(404, {}))).status).toBe(501)
    const r = await pasarAlBorrador("PUT", { client_id: C, documento: "manual", documento_id: "v2", acciones: ACC }, d(409, { ok: false, error: "borrador_cambio", borrador: { documento_id: "v2", acciones: ACC, revision: 4 } }))
    expect(r).toMatchObject({ status: 409, cuerpo: { error: "borrador_cambio" } })
  })
  it("lo que llama la pantalla: leer, guardar (409 = otro equipo, con lo último), borrar", async () => {
    const con = (status: number, j: unknown) => (async () => new Response(JSON.stringify(j), { status })) as unknown as typeof fetch
    expect(await leerBorrador(C, "manual", con(200, { ok: true, borrador: { documento_id: "v2", acciones: ACC, revision: 1 } }))).toMatchObject({ ok: true, borrador: { documento_id: "v2" } })
    expect(await leerBorrador(C, "manual", con(500, { ok: false }))).toEqual({ ok: false, borrador: null })
    expect(await guardarBorrador(C, "manual", "v2", ACC as never, 1, con(409, { ok: false, error: "borrador_cambio", borrador: { documento_id: "v2", acciones: ACC, revision: 5 } }))).toMatchObject({ ok: false, otroEquipo: true, borrador: { revision: 5 } })
    expect(await guardarBorrador(C, "manual", "v2", ACC as never, 1, con(200, { ok: true, borrador: { documento_id: "v2", acciones: ACC, revision: 2 } }))).toMatchObject({ ok: true, otroEquipo: false })
    expect(await borrarBorrador(C, "manual", con(200, { ok: true }))).toBe(true)
  })
})

const manual = (): ManualDelCliente => ({ clientes: [{ id: C, nombre: "Náufrago", con_manual: true }], cliente: { id: C, nombre: "Náufrago" }, manual: { id: "v2", version: 2, versiones: 2, lector: leerManual({ client_id: C, version: 2, brand_purpose: "P", content_text: "{}" })!, fidelidad: "", origen: null, colores: [], tipografias: [], opciones_eslogan: ["Del mar a tu puerta"], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador({}), ciclo: { disponible: true, abierto: null, avance: null, que_cambio: [] } } as never, leido_en: "x" })
const panel = (p: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual(), ...p }))

describe("el panel", () => {
  it("con cambios guardados: la línea «borrador guardado · hace …» junto a «Tus cambios»", () => {
    const h = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" }, borradorInicial: { revision: 2, actualizado_en: "2026-11-03T18:30:00Z" } })
    expect(h).toMatch(/data-borrador-guardado="true"[^>]*>borrador guardado · hace/)
    expect(panel({ borradorInicial: { revision: 2, actualizado_en: "2026-11-03T18:30:00Z" } })).not.toContain("data-borrador-guardado") // sin cambios, sin línea
  })
  it("un borrador de la versión anterior: se dice, con «Seguir con él» y «Descartar» (44 px); «Aprobar» apagado hasta decidir", () => {
    const h = panel({ borradorViejoInicial: { documento_id: "v1", acciones: ACC, revision: 1, actualizado_en: null } })
    expect(h).toContain("era de la versión anterior del manual")
    expect(h).toMatch(/data-accion="seguir-con-el-borrador"[^>]*class="min-h-11/); expect(h).toMatch(/data-accion="descartar-borrador-viejo"[^>]*class="min-h-11/)
    expect(h).toMatch(/data-accion="validar-manual"[^>]*disabled=""/); expect(h).toContain("Decide qué hacer con el borrador de la versión anterior.")
  })
  it("al salir con cambios: «Tienes N cambios sin pedir. Quedan guardados como borrador.» con «Seguir aquí» y «Salir» (44 px)", () => {
    const h = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" }, notasIniciales: { voz: "más cercana" }, salirInicial: true })
    expect(h).toContain("Tienes 2 cambios sin pedir. Quedan guardados como borrador.")
    expect(h).toMatch(/data-accion="seguir-aqui"[^>]*class="min-h-11/); expect(h).toMatch(/data-accion="salir-igual"[^>]*class="min-h-11/)
  })
  it("aprobar rechazado porque queda un borrador (otro equipo, CC1 #872) se dice en palabras", () => {
    expect(motivoDeNoAprobar({ texto: "x", codigo: "borrador_pendiente", detalleCrudo: "3 cambios" })).toBe("Todavía no se puede aprobar: hay cambios sin pedir guardados como borrador. Pídelos o descártalos primero (3 cambios).")
  })
})
