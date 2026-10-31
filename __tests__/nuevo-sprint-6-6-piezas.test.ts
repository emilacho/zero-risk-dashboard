/**
 * DASHBOARD NUEVO · SPRINT 6.6 · LAS PIEZAS EN EL ESTILO NUEVO (Emilio, 31-oct: «ya no uses el dashboard viejo… así con todo»). El cuadro «Piezas» del Dept.
 * Marketing abre encima la bandeja completa: la lista (por aprobar / todas · por cliente · las otras revisiones aparte), el visor de láminas (una, todas juntas
 * con marcas, zoom, ← →), lo que acompaña a la pieza (textos por lámina · pie · avisos · jefatura · la mesa · ficha) y la decisión: Aprobar (con la casilla
 * «entiendo» cuando la jefatura no terminó o hay desacuerdos) · Pedir cambios (≥10 letras · por láminas marcadas o toda) · Rechazar (≥5 letras), por LA MISMA
 * puerta de siempre (`POST /api/piezas/{id}/decidir`, validada con la misma regla); las otras revisiones por `revision-resolver`; rehacer una rechazada por
 * `rehacer-pieza` con el gasto confirmado. El calendario abre la pieza encima en vez de mandar a la ventana vieja. Lo que no existe se dice.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ESTADO_DE_PIEZA_LEGIBLE, alcanceDeLosCambios, avisoTrasDecidir, avisosDeLaFila, cuerpoDeDecisionDePieza, cuerpoDeRehacer, errorTrasDecidir, filtrarBandeja, proporcionDeLaLamina, resumenDeLaBandeja, siguientePendiente, textoDelBotonDeCambios, tonoDelEstado } from "@/lib/bandeja"
import { leerBandeja, type Bandeja } from "@/lib/bandeja-datos"
import type { DetalleDeLaPieza, FilaDeLaLista } from "@/lib/piezas-datos"
import { validarDecision } from "@/lib/piezas"
import { ACCIONES } from "@/lib/tablero-acciones"
import { APLICACIONES } from "@/lib/aplicaciones-marketing"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { faseActiva, semanasDelTablero, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import { GRAN_IDEA_SIN_TABLA, type Pizarron } from "@/lib/pizarron-datos"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const PEREZ = "5a2a0b8e-6c0e-4d4f-9f2a-1b2c3d4e5f60"
const PIEZA = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
const OTRA = "9ccb6924-1111-4111-8111-111111111111"
const PLAN = "0d333a57-4bb5-411b-beaf-0dc163ed5409"

/** filas con la forma REAL de la bandeja (lectura 31-oct) */
const fila = (x: Partial<FilaDeLaLista> & Pick<FilaDeLaLista, "id" | "estado" | "status">): FilaDeLaLista => ({
  tipo: "content_piece_review", es_pieza: true, titulo: "crudo", titulo_legible: "Historias Instagram · Náufrago · 31 oct", cliente_id: NAUFRAGO, cliente: "Náufrago", creada: "2026-10-31T13:38:01.926Z",
  gasto_usd: 1.02988, incompleta: false, desacuerdos: 2, tiene_dibujo: true, ...x,
})
const PIEZAS: FilaDeLaLista[] = [
  fila({ id: PIEZA, estado: "pendiente", status: "pending" }),
  fila({ id: "aa677fad-2222-4222-8222-222222222222", estado: "aprobada", status: "approved", titulo_legible: "Carrusel Facebook · Zero Risk Seguridad Industrial · 30 oct", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial", desacuerdos: 0, gasto_usd: 2.051572 }),
  fila({ id: OTRA, estado: "pendiente", status: "pending", titulo_legible: "Carrusel Instagram · Zero Risk Seguridad Industrial · 28 oct", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial", desacuerdos: 9, incompleta: true, gasto_usd: 1.840811 }),
  fila({ id: "353067d1-3333-4333-8333-333333333333", estado: "superada", status: "rejected", titulo_legible: "Carrusel Facebook · Zero Risk Seguridad Industrial · 29 oct", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial", desacuerdos: 3, incompleta: true }),
]
const OTRAS: FilaDeLaLista[] = [
  fila({ id: PLAN, estado: "pendiente", status: "pending", tipo: "plan_con_pendientes", es_pieza: false, titulo_legible: "Plan con puntos por resolver · Náufrago", gasto_usd: null, desacuerdos: 0, tiene_dibujo: false }),
  fila({ id: "81f97487-4444-4444-8444-444444444444", estado: "archivada", status: "rejected", tipo: "editor_escalation", es_pieza: false, titulo_legible: "Revisión del editor · Zero Risk Seguridad Industrial", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial", gasto_usd: null, desacuerdos: 0, tiene_dibujo: false }),
]
const BANDEJA: Bandeja = { estado: "todas", por_aprobar: 2, piezas: PIEZAS, otras: OTRAS, clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }, { id: PEREZ, nombre: "Zero Risk Seguridad Industrial" }], leido_en: "2026-10-31T21:11:00.000Z" }

/** el detalle con la forma REAL (pieza 70b922a5 · 31-oct): dos historias 9:16 con foto, 2 desacuerdos de la jefatura, pie con hashtags */
const DETALLE: DetalleDeLaPieza = {
  id: PIEZA, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "Historias Instagram · Náufrago · 31 oct", cliente: "Náufrago", creada: "2026-10-31T13:38:01.926Z",
  familia: "kit_historias", brief_id: "BRF-0002", encargo_id: "db7c2d8b-773b-4a49-82d0-602e39da8706", gasto_usd: 1.02988,
  laminas: [
    { n: 1, nombre: "01-de-02.png", ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: "¿Sabes la respuesta?", titular: "¿Qué lleva el encebollado?", cuerpo: "Responde y descubre si eres un experto del mar", pie: null, glifos_riesgosos: false },
    { n: 2, nombre: "02-de-02.png", ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: "Tú decides", titular: "¿Encebollado o ceviche hoy?", cuerpo: "Los dos son frescos.", pie: null, glifos_riesgosos: false },
  ],
  pie: "Tú dices. Nosotros lo servimos fresco en Olón\n\n#encebollado #mariscos",
  avisos: [{ nivel: "ambar", texto: "2 desacuerdos abiertos en la revisión." }],
  exige_casilla: true,
  jefatura: { resultado: "limpia", desacuerdos: ["imagen: la foto real elegida para «e01» no cumple el brief", "imagen: la foto real elegida para «e02» no cumple el brief"], opinion_externa: "**Mantendría la idea de interacción, pero no publicaría estas versiones tal como están.**", revision_id: "5c019899-25d0-4289-af06-8103ced212ef" },
  aportes: [], version: 1, resumen_de_la_bandeja: "🖼️ 2 foto propia del cliente — ¿Qué lleva el encebollado?",
}

const dibujar = (props: Partial<Parameters<typeof PanelPiezas>[0]> = {}) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA, piezaInicialDatos: DETALLE, ...props }))

/** una base de mentira que solo anota qué tablas y filtros se piden */
function baseFalsa(respuestas: Record<string, unknown[]>, cuentas: Record<string, number> = {}) {
  const pedidos: Array<{ tabla: string; filtros: string[] }> = []
  const from = (tabla: string) => {
    const p = { tabla, filtros: [] as string[], cuenta: false }; pedidos.push(p)
    const q: Record<string, unknown> = {}
    const enc = (nombre: string) => (...a: unknown[]) => { p.filtros.push(`${nombre}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q }
    for (const m of ["eq", "neq", "in", "order", "limit"]) q[m] = enc(m)
    q.select = (cols: string, o?: { head?: boolean }) => { p.filtros.push(`select(${cols})`); if (o?.head) p.cuenta = true; return q }
    q.maybeSingle = () => Promise.resolve({ data: (respuestas[tabla] ?? [])[0] ?? null, error: null })
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(p.cuenta ? { count: cuentas[tabla] ?? 0, error: null } : { data: respuestas[tabla] ?? [], error: null }).then(res)
    return q
  }
  return { supa: { from } as never, pedidos }
}

describe("sprint 6.6 · la lógica pura de la bandeja", () => {
  it("los estados se dicen en palabras y cada uno tiene su tono; la fila avisa lo que importa en una línea", () => {
    expect(ESTADO_DE_PIEZA_LEGIBLE.pendiente).toBe("por aprobar"); expect(ESTADO_DE_PIEZA_LEGIBLE.superada).toContain("la reemplazó otra pieza")
    expect([tonoDelEstado("pendiente"), tonoDelEstado("aprobada"), tonoDelEstado("con_cambios"), tonoDelEstado("rechazada"), tonoDelEstado("superada")]).toEqual(["ambar", "verde", "azul", "rojo", "neutro"])
    expect(avisosDeLaFila({ tiene_dibujo: true, incompleta: false, desacuerdos: 0 })).toBeNull()
    expect(avisosDeLaFila({ tiene_dibujo: false, incompleta: true, desacuerdos: 1 })).toBe("sin dibujo · revisión de la jefatura incompleta · 1 desacuerdo")
    expect(avisosDeLaFila({ tiene_dibujo: true, incompleta: false, desacuerdos: 9 })).toBe("9 desacuerdos")
    expect(resumenDeLaBandeja({ por_aprobar: 2, otras_pendientes: 1 })).toBe("2 por aprobar · 1 otra revisión espera")
    expect(resumenDeLaBandeja({ por_aprobar: 0, otras_pendientes: 0 })).toBe("Nada por aprobar")
    expect(proporcionDeLaLamina(DETALLE.laminas[0])).toBe("1080/1920"); expect(proporcionDeLaLamina(undefined)).toBe("1080/1350")
  })
  it("filtrar por cliente deja las pendientes primero; la siguiente pendiente salta la actual", () => {
    expect(filtrarBandeja(PIEZAS, PEREZ).map((p) => p.estado)).toEqual(["pendiente", "aprobada", "superada"])
    expect(filtrarBandeja(PIEZAS, null).map((p) => p.id)).toEqual([PIEZA, OTRA, PIEZAS[1].id, PIEZAS[3].id])
    expect(filtrarBandeja(PIEZAS, "99999999-9999-4999-8999-999999999999")).toEqual([])
    expect(siguientePendiente(filtrarBandeja(PIEZAS, null), PIEZA)).toBe(OTRA)
    expect(siguientePendiente(filtrarBandeja(PIEZAS, NAUFRAGO), PIEZA)).toBeNull()
  })
  it("el cuerpo de la decisión pasa por LA MISMA regla del servidor: casilla exigida, mínimos, láminas válidas, estado visto", () => {
    const base = { comentario: "", laminas: [] as number[], casilla: false, total: 2, exige_casilla: true, estado_visto: "pending" }
    expect(cuerpoDeDecisionDePieza({ ...base, accion: "aprobar" })).toEqual({ error: expect.stringContaining("marca «entiendo»") })
    expect(cuerpoDeDecisionDePieza({ ...base, accion: "aprobar", casilla: true })).toEqual({ cuerpo: { accion: "aprobar", casilla: true, estado_visto: "pending" } })
    expect(cuerpoDeDecisionDePieza({ ...base, accion: "cambios", comentario: "corto" })).toEqual({ error: expect.stringContaining("al menos 10") })
    const cambios = cuerpoDeDecisionDePieza({ ...base, accion: "cambios", comentario: "La foto de la lámina 1 no muestra el plato.", laminas: [2, 1, 1] })
    expect(cambios).toEqual({ cuerpo: { accion: "cambios", comentario: "La foto de la lámina 1 no muestra el plato.", laminas: [1, 2], estado_visto: "pending" } })
    expect(cuerpoDeDecisionDePieza({ ...base, accion: "cambios", comentario: "La foto no muestra el plato.", laminas: [3] })).toEqual({ error: expect.stringContaining("entre 1 y 2") })
    expect(cuerpoDeDecisionDePieza({ ...base, accion: "rechazar", comentario: "mal" })).toEqual({ error: expect.stringContaining("al menos 5") })
    expect(cuerpoDeDecisionDePieza({ ...base, accion: "rechazar", comentario: "No va con la marca." })).toEqual({ cuerpo: { accion: "rechazar", comentario: "No va con la marca.", estado_visto: "pending" } })
    // y lo que el panel arma es exactamente lo que `validarDecision` (la del servidor) vuelve a aceptar
    if ("cuerpo" in cambios) expect(validarDecision(cambios.cuerpo, 2, true)).toEqual({ ok: true, pedido: cambios.cuerpo })
  })
  it("los textos de la decisión dicen lo que pasa de verdad: aprobar no publica, cambios gasta, 409 recarga, 501 no cambió nada", () => {
    expect(textoDelBotonDeCambios([])).toBe("Pedir cambios"); expect(textoDelBotonDeCambios([1, 3])).toBe("Pedir cambios en 2 láminas"); expect(textoDelBotonDeCambios([2])).toBe("Pedir cambios en 1 lámina")
    expect(alcanceDeLosCambios([1, 3], 1.02988)).toBe("Láminas 1, 3 · vuelve a gastar ≈ US$ 1,03"); expect(alcanceDeLosCambios([2], 1)).toBe("Lámina 2 · vuelve a gastar ≈ US$ 1,00"); expect(alcanceDeLosCambios([], null)).toBe("Toda la pieza · vuelve a gastar")
    expect(avisoTrasDecidir("aprobar", { ok: true, nota: "Aprobada. Todavía no se publica en redes: es un paso aparte." })).toContain("Todavía no se publica")
    expect(avisoTrasDecidir("aprobar", { ok: true, simulado: true, detalle: "SIMULADO: el tablero está en modo sombra y no guardó nada" })).toContain("SIMULADO")
    expect(avisoTrasDecidir("cambios", { ok: true })).toContain("rehace la pieza"); expect(avisoTrasDecidir("rechazar", { ok: true })).toContain("Rechazada")
    expect(errorTrasDecidir(409, { detalle: "la pieza cambió mientras la mirabas: recarga" })).toBe("la pieza cambió mientras la mirabas: recarga Se actualizó la pantalla.")
    expect(errorTrasDecidir(501, { detalle: "la plataforma todavía no tiene la ruta «pedir cambios»" })).toContain("No se cambió nada")
    expect(errorTrasDecidir(401, {})).toContain("sesión"); expect(errorTrasDecidir(502, { error: "la_plataforma_no_guardo" })).toBe("No se pudo: la_plataforma_no_guardo.")
  })
  it("rehacer lleva la confirmación del gasto y el cuerpo es el que la acción del tablero acepta; esa acción GASTA (tope por pieza)", () => {
    const c = cuerpoDeRehacer("db7c2d8b-773b-4a49-82d0-602e39da8706", "  Que la foto muestre el plato.  ")
    expect(c).toEqual({ encargo_id: "db7c2d8b-773b-4a49-82d0-602e39da8706", comentario: "Que la foto muestre el plato.", confirmo_gasto: true })
    expect(ACCIONES["rehacer-pieza"].validar(c)).toEqual({ ok: true, cuerpo: { encargo_id: "db7c2d8b-773b-4a49-82d0-602e39da8706", comentario: "Que la foto muestre el plato." } })
    expect(ACCIONES["rehacer-pieza"].gasta).toEqual({ tope_usd: 5 })
    expect(cuerpoDeRehacer("db7c2d8b-773b-4a49-82d0-602e39da8706", "")).toEqual({ encargo_id: "db7c2d8b-773b-4a49-82d0-602e39da8706", confirmo_gasto: true })
  })
})

describe("sprint 6.6 · la lectura de la bandeja", () => {
  it("pide piezas, otras revisiones, la cuenta y los clientes de una vez, con los filtros de la lectura de siempre", async () => {
    const { supa, pedidos } = baseFalsa({ hitl_queue: [], clients: [] }, { hitl_queue: 2 })
    const b = await leerBandeja(supa, { estado: "todas", ahora: new Date("2026-10-31T21:00:00Z") })
    expect(b).toEqual({ estado: "todas", por_aprobar: 2, piezas: [], otras: [], clientes: [], leido_en: "2026-10-31T21:00:00.000Z" })
    const hitl = pedidos.filter((p) => p.tabla === "hitl_queue").map((p) => p.filtros.join(" "))
    expect(hitl.some((f) => f.includes('eq("type","content_piece_review")') && !f.includes('eq("status","pending")'))).toBe(true) // todas las piezas
    expect(hitl.some((f) => f.includes('neq("type","content_piece_review")'))).toBe(true) // las otras
    const pend = await leerBandeja(supa, {})
    expect(pend.estado).toBe("pendiente")
    expect(pedidos.filter((p) => p.tabla === "hitl_queue").slice(-3).some((p) => p.filtros.join(" ").includes('eq("status","pending")'))).toBe(true)
  })
  it("las dos puertas nuevas exigen administrador y no escriben; el visor sigue usando la lámina y la decisión de siempre", () => {
    for (const ruta of ["app/api/bandeja/route.ts", "app/api/piezas/[id]/route.ts"]) {
      const r = readFileSync(ruta, "utf8")
      expect(r).toContain("exigirAdmin()"); expect(r).toContain("export async function GET"); expect(r).not.toMatch(/export async function (POST|PATCH|DELETE)/)
      expect(r).not.toMatch(/\.(insert|update|upsert|delete)\(/)
    }
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain("`/api/piezas/${encodeURIComponent(pieza.id)}/decidir`"); expect(c).toContain("`/api/piezas/${pieza?.id}/lamina/${k}`")
    expect(c).toContain('accion("revision-resolver", cuerpo)'); expect(c).toContain('accion("rehacer-pieza", cuerpoDeRehacer(pieza.encargo_id, comentario))')
    expect(c).not.toMatch(/supabase|from\(/); expect(c).toContain('window.addEventListener("keydown", tecla, true)'); expect(c).toContain("@media (prefers-reduced-motion:reduce)")
  })
})

describe("sprint 6.6 · el panel", () => {
  it("dibuja la lista (pendientes primero, estado en palabras, avisos de la fila), las otras revisiones aparte y el visor de la pieza elegida", () => {
    const html = dibujar()
    expect(html).toContain('role="dialog"'); expect(html).toContain('data-seccion="piezas"'); expect(html).toContain("2 por aprobar · 1 otra revisión espera")
    const filas = [...html.matchAll(/data-pieza="([^"]+)" data-estado="([^"]+)"/g)].map((m) => [m[1], m[2]])
    expect(filas).toEqual([[PIEZA, "pendiente"], [OTRA, "pendiente"], [PIEZAS[1].id, "aprobada"], [PIEZAS[3].id, "superada"]])
    expect(html).toContain('aria-current="true"'); expect(html).toContain("· por aprobar"); expect(html).toContain("· superada (la reemplazó otra pieza)")
    expect(html).toContain("revisión de la jefatura incompleta · 9 desacuerdos"); expect(html).toContain("US$ 1,03")
    expect(html).toContain("Otras revisiones, no son piezas (2 · 1 por decidir)"); expect(html).toContain(`data-revision="${PLAN}"`)
    // el visor: título, estado, láminas, lo que acompaña
    expect(html).toContain("Historias Instagram · Náufrago · 31 oct"); expect(html).toContain("versión 1"); expect(html).toContain("jefatura sin observaciones")
    expect(html).toContain(`src="/api/piezas/${PIEZA}/lamina/1"`); expect(html).toContain('alt="Lámina 1 de 2"'); expect(html).toContain("aspect-ratio:1080/1920"); expect(html).toContain("Ver las 2 juntas")
    expect(html).toContain("Lámina 1 · con imagen de fondo"); expect(html).toContain("¿Qué lleva el encebollado?"); expect(html).toContain("#encebollado #mariscos")
    expect(html).toContain("Desacuerdos (2)"); expect(html).toContain("Opinión externa (otro modelo, no vota)"); expect(html).toContain("La mesa no dejó aportes guardados")
    expect(html).toContain("2 desacuerdos abiertos en la revisión."); expect(html).toContain("Entró a la bandeja")
    // nada crudo de la base
    expect(html).not.toMatch(/content_piece_review|con_imagen|kit_historias|pending"?>/)
  })
  it("una pieza pendiente ofrece Aprobar · Pedir cambios · Rechazar; la casilla «entiendo» se exige cuando la jefatura dejó desacuerdos; ninguna decisión sale al dibujar", () => {
    const html = dibujar()
    expect(html).toContain('data-accion="pieza-aprobar"'); expect(html).toContain('data-accion="pieza-pedir-cambios"'); expect(html).toContain('data-accion="pieza-rechazar"')
    expect(html).toContain("Aprobar no publica todavía"); expect(html).toContain('data-decision="quieto"')
    expect(html).not.toContain('data-editor="pieza-aprobar"') // la confirmación (con la casilla) aparece solo al pulsar
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain('data-casilla="entiendo"'); expect(c).toContain("disabled={enviando || (pieza.exige_casilla && !casilla)}")
    expect(c).toContain("cuerpoDeDecisionDePieza({ accion: a, comentario, laminas: marcadas, casilla, total, exige_casilla: pieza.exige_casilla, estado_visto: pieza.status })")
    expect(c).toContain("siguientePendiente(piezasVisibles, pieza.id)") // tras decidir, pasa a la siguiente pendiente
  })
  it("una pieza ya resuelta no ofrece decidir; si fue rechazada y tiene encargo, ofrece rehacerla con el gasto a la vista", () => {
    const aprobada = dibujar({ piezaInicialDatos: { ...DETALLE, id: PIEZAS[1].id, estado: "aprobada", status: "approved" } })
    expect(aprobada).not.toContain('data-accion="pieza-aprobar"'); expect(aprobada).toContain("Esta pieza está aprobada."); expect(aprobada).not.toContain('data-accion="pieza-rehacer"')
    const rechazada = dibujar({ piezaInicialDatos: { ...DETALLE, estado: "rechazada", status: "rejected" } })
    expect(rechazada).toContain('data-accion="pieza-rehacer"'); expect(rechazada).toContain("Esta pieza está rechazada.")
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain('data-casilla="gasto"'); expect(c).toContain("hasta {usdES(TOPE_POR_PIEZA_USD)}")
  })
  it("una revisión que no es pieza lleva sus botones en palabras de negocio y va por `revision-resolver`; resuelta, solo se dice", () => {
    const plan = dibujar({ piezaInicialDatos: { ...DETALLE, id: PLAN, tipo: "plan_con_pendientes", es_pieza: false, titulo: "Plan con puntos por resolver · Náufrago", laminas: [], pie: null, avisos: [], exige_casilla: false, encargo_id: null, gasto_usd: null, version: null, jefatura: { resultado: null, desacuerdos: [], opinion_externa: null, revision_id: null } } })
    expect(plan).toContain("Aprobar el plan así"); expect(plan).toContain("Pedir cambios al plan…"); expect(plan).toContain("También la ves en el Plan de 90 días.")
    expect(plan).toContain('data-accion="revision-aprobar"'); expect(plan).not.toContain('data-accion="pieza-aprobar"'); expect(plan).toContain("Esta revisión no lleva láminas"); expect(plan).not.toContain("Sin dibujo"); expect(plan).not.toContain('data-bloque="jefatura"'); expect(plan).toContain("Lo que dice la bandeja")
    expect(plan).toContain('<details data-grupo="otras" open=""') // la lista abre el grupo donde está la elegida
    const resuelta = dibujar({ piezaInicialDatos: { ...DETALLE, id: OTRAS[1].id, tipo: "editor_escalation", es_pieza: false, estado: "archivada", status: "rejected", laminas: [], avisos: [], exige_casilla: false } })
    expect(resuelta).toContain("Revisión del editor · ya resuelta (archivada)."); expect(resuelta).not.toContain('data-accion="revision-aprobar"')
  })
  it("filtrar por cliente: con Náufrago elegido se ven solo sus filas y, si no queda nada por aprobar, se ofrece ver todos los clientes", () => {
    const html = dibujar({ clienteInicial: NAUFRAGO })
    expect([...html.matchAll(/data-pieza="([^"]+)"/g)].map((m) => m[1])).toEqual([PIEZA])
    expect(html).toContain(`<option value="${NAUFRAGO}" selected="">`); expect(html).toContain("Todos los clientes")
    const sinNada = dibujar({ bandejaInicial: { ...BANDEJA, estado: "pendiente", piezas: PIEZAS.filter((p) => p.cliente_id === PEREZ) }, piezaInicialDatos: null, clienteInicial: NAUFRAGO })
    expect(sinNada).toContain("No hay piezas por aprobar de Náufrago."); expect(sinNada).toContain("Ver las de todos los clientes (3)")
  })
  it("el cuadro «Piezas» abre encima (ya no enlaza a la ventana vieja) y el calendario abre la pieza encima cuando le dan cómo", () => {
    expect(APLICACIONES.find((a) => a.clave === "piezas")!.enlace(NAUFRAGO)).toBeNull()
    const filas: FilaDelTablero[] = [{ id: "s1-d1-lun_historia", fecha: "2026-11-02", hora: "11:00", red: "instagram", formato: "historia", pilar: "producto", tema: "Encebollado", sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "briefeada", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: { id: PIEZA, status: "pending", estado: "pendiente", expires_at: null, created_at: "x" }, tablero: "emilio", motivo: "la pieza está en tu bandeja" }]
    const datos: Pizarron = { clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, campana: { id: "c", estado: "pausada", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1 }, fases: [], fase_activa: faseActiva([], "2026-11-02", "2026-11-05"), gran_idea: GRAN_IDEA_SIN_TABLA, esperas: [], filas, semanas: semanasDelTablero(filas), totales: totalesDelTablero(filas), hoy: "2026-11-05", leido_en: "x" }
    const c = readFileSync("components/nuevo/PanelPizarron.tsx", "utf8")
    expect(c).toContain('<button type="button" onClick={() => onAbrirPieza(f.pieza!.id)} data-accion="abrir-pieza" aria-haspopup="dialog"')
    expect(c).toContain("Se abre encima, en esta misma oficina")
    // sin la función (la página vieja no la pasa) sigue enlazando a la ventana de siempre: nada se rompe
    const solo = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos }))
    expect(solo).not.toContain("decidir")
  })
})
