/**
 * EL VIDEO EN EL VISOR DE PIEZAS DEL CENTRO DE CAMPAÑA (CC5 · 11-nov · boceto aprobado por Emilio 15:39 · GO Lenovo 15:41). US$ 0 · sin red.
 * 1) un reel se MIRA en el visor (antes salía el recuadro rojo «Sin dibujo»); el rojo queda solo para la pieza sin láminas y sin video.
 * 2) una revisión incompleta dice POR QUÉ: «límite de gasto» solo si se cortó por el tope; si falló un paso, cuál y el motivo en palabras de negocio.
 * 3) el título lleva el día de PUBLICACIÓN de la fila del calendario, no el de creación.
 * Dos clientes de rubros distintos (restaurante y seguridad industrial): nada depende de un cliente.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import { fechasDePublicacion, listarPiezas, pasoQueFallo } from "@/lib/piezas-datos"
import { avisoDeRevisionIncompleta, avisosDeLaPieza, motivoDelFalloLegible, nombreDelPasoLegible, type VideoDeLaPieza } from "@/lib/piezas"
import { diaDeCalendario, tituloDePieza } from "@/lib/lenguaje"

const TECNICO = /content-creator|decision:|usage limits|\b400\b|incompleta_por_tope|fallida|\$\.respuestas|jefatura_pasos/

const VIDEO: VideoDeLaPieza = { nombre: "2026-11-16_1000_instagram_reel_s2_01-de-01.mp4", bytes: 11_758_598, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-18T04:28:33Z", url_proveedor: "https://proveedor.test/v.mp4" }
const REEL = "319e8a8a-812e-4573-bbdd-d1a8566f3024"
const DETALLE: DetalleDeLaPieza = {
  id: REEL, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "Video Instagram · Náufrago · publica 16 nov", cliente: "Náufrago", creada: "2026-11-11T04:32:25Z",
  familia: "video_mesa", brief_id: "s2-d1-lun_reel_gye", encargo_id: "86ae3cd3-3490-4225-9dc6-1e8e8029a615", gasto_usd: 5.74, laminas: [],
  pie: "El encebollado ya llega a la zona norte.", video: VIDEO, guion: null, avisos: [], exige_casilla: true,
  jefatura: { resultado: "fallida", desacuerdos: [], opinion_externa: null, revision_id: "r1" }, aportes: [], version: 1, resumen_de_la_bandeja: null,
  acompana: { fila: { fecha: "2026-11-16", hora: "10:00", semana: 2, red: "instagram", formato: "reel", pilar: "producto", sede: "guayaquil", tema: "Historia de origen", fase: null, idea_ref: null }, productores: [], decidida_en: null, rehechura: null },
}
// segundo cliente, otro rubro, otra red
const DETALLE_B: DetalleDeLaPieza = { ...DETALLE, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", cliente: "Zero Risk Seguridad Industrial", titulo: "Video TikTok · Zero Risk Seguridad Industrial · publica 3 dic", video: { ...VIDEO, nombre: "2026-12-03_0900_tiktok_video_x_01-de-01.mp4", segundos: 20 } }
const BANDEJA = (d: DetalleDeLaPieza) => ({ estado: "todas" as const, por_aprobar: 1, piezas: [{ id: d.id, estado: "pendiente" as const, status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: d.titulo, carpeta: "Video Instagram", archivada: false, cliente_id: "c1", cliente: d.cliente, creada: d.creada, gasto_usd: 1, incompleta: true, desacuerdos: 0, tiene_dibujo: true }], otras: [], clientes: [{ id: "c1", nombre: d.cliente }], leido_en: "x" })
const dibujar = (d: DetalleDeLaPieza) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA(d) as never, piezaInicialDatos: d }))

describe("1 · el reel se mira en el visor del Centro de campaña", () => {
  it("con el mp4 guardado: reproductor desde el tablero, chip de segundos, bloque «Video · N s»; sin el recuadro rojo", () => {
    for (const d of [DETALLE, DETALLE_B]) {
      const h = dibujar(d)
      expect(h).toContain(`src="/api/piezas/${d.id}/video"`)
      expect(h).toMatch(/<video[^>]*controls/)
      expect(h).toContain("data-video-de-la-pieza")
      expect(h).toContain(`>${d.video!.segundos} s<`)
      expect(h).toContain('data-bloque="video"')
      expect(h).toContain(`Video · ${d.video!.segundos} s`)
      expect(h).toContain(d.video!.nombre!)
      expect(h).not.toContain("Sin dibujo")
      expect(h).toContain('data-accion="pieza-aprobar"')
    }
    expect(dibujar(DETALLE)).toContain("11,8 MB")
  })
  it("ensayo o copia solo en el proveedor: no hay reproductor, se dice por qué (y el enlace al proveedor)", () => {
    const sim = dibujar({ ...DETALLE, video: { ...VIDEO, simulado: true } })
    expect(sim).not.toMatch(/<video/); expect(sim).toContain("Ensayo: el video es simulado")
    const prov = dibujar({ ...DETALLE, video: { ...VIDEO, nombre: null, bytes: null, solo_en_proveedor: true } })
    expect(prov).not.toMatch(/<video/); expect(prov).toContain("El video quedó solo en el proveedor"); expect(prov).toContain('href="https://proveedor.test/v.mp4"')
    expect(prov).toContain("Sin archivo guardado.")
  })
  it("video sin archivo guardado (ni ensayo ni solo en el proveedor): sin reproductor roto, dice «Sin archivo de video.» (CC6 · reproductor-sin-nombre)", () => {
    const h = dibujar({ ...DETALLE, video: { ...VIDEO, nombre: null, bytes: null } })
    expect(h).not.toMatch(/<video/); expect(h).not.toContain("data-video-de-la-pieza")
    expect(h).toContain("data-video-sin-reproductor"); expect(h).toContain("Sin archivo de video.")
  })
  it("el rojo queda SOLO para la pieza sin láminas y sin video", () => {
    const h = dibujar({ ...DETALLE, video: null })
    expect(h).toContain("Sin dibujo: esta pieza no tiene láminas ni video que mirar.")
    expect(h).not.toMatch(/<video/); expect(h).not.toContain('data-bloque="video"')
  })
  it("una pieza con láminas no lleva reproductor", () => {
    const h = dibujar({ ...DETALLE, video: null, laminas: [{ n: 1, nombre: "01.png", ancho: 1080, alto: 1350, origen: "propia", eyebrow: null, titular: "T", cuerpo: null, pie: null, glifos_riesgosos: false } as never] })
    expect(h).not.toMatch(/<video/); expect(h).not.toContain("Sin dibujo")
  })
})

describe("2 · la revisión incompleta dice por qué", () => {
  it("cortada por el tope: «tope de gasto de la revisión»", () => {
    expect(avisoDeRevisionIncompleta({ jefatura_resultado: "incompleta_por_tope" })).toBe("La revisión de la jefatura no terminó: se cortó por el tope de gasto de la revisión.")
  })
  it("un paso falló: cuál y el motivo legible; NUNCA «límite de gasto» ni el error crudo", () => {
    const t = avisoDeRevisionIncompleta({ jefatura_resultado: "fallida", revision_incompleta: true }, { paso: "decision:content-creator", error: "400 You have reached your specified API usage limits. You will regain access on 2026-12-01" })!
    expect(t).toBe("Falló un paso de la revisión (la decisión): la cuenta del proveedor de IA llegó a su límite de uso.")
    expect(t).not.toMatch(/límite de gasto|tope/); expect(t).not.toMatch(TECNICO)
  })
  it("sin el paso guardado se dice que no quedó el motivo; incompleta sin resultado conocido, genérica", () => {
    expect(avisoDeRevisionIncompleta({ jefatura_resultado: "fallida" })).toBe("Falló un paso de la revisión: no quedó guardado el motivo.")
    expect(avisoDeRevisionIncompleta({ revision_incompleta: true })).toBe("La revisión de la jefatura no terminó.")
    expect(avisoDeRevisionIncompleta({ jefatura_resultado: "limpia" })).toBeNull()
  })
  it("los motivos en palabras de negocio (sin el texto del proveedor)", () => {
    const casos: Array<[string, string]> = [
      ["429 rate limit", "el proveedor de IA estaba saturado y no respondió"],
      ["The operation was aborted due to timeout", "el paso tardó más de lo permitido"],
      ["resolución $.respuestas[0].razon: texto demasiado largo (máx. 600)", "la respuesta del empleado vino con un formato que no se pudo leer"],
      ["$.respuestas[0].estado: valor «tomado» fuera de [\"tomada\",\"no_tomada\"]", "la respuesta del empleado vino con un formato que no se pudo leer"],
      ["algo raro", "el paso no terminó (el detalle queda en el registro de la jefatura)"],
    ]
    for (const [e, t] of casos) { expect(motivoDelFalloLegible(e)).toBe(t); expect(motivoDelFalloLegible(e)).not.toMatch(TECNICO) }
    expect(nombreDelPasoLegible("correccion:editor")).toBe("la corrección"); expect(nombreDelPasoLegible("raro:x")).toBeNull(); expect(nombreDelPasoLegible(null)).toBeNull()
  })
  it("avisosDeLaPieza usa el motivo; el reel con video no lleva «Sin video» ni «Sin dibujo»", () => {
    const av = avisosDeLaPieza({ metadata: { familia: "video_mesa", jefatura_resultado: "fallida", revision_incompleta: true } }, [], VIDEO, { paso: "decision:content-creator", error: "usage limits" })
    const textos = av.map((a) => a.texto).join(" | ")
    expect(textos).toContain("Falló un paso de la revisión (la decisión): la cuenta del proveedor de IA llegó a su límite de uso.")
    expect(textos).not.toMatch(/límite de gasto|Sin video|Sin dibujo/)
    expect(av.find((a) => a.texto.startsWith("Falló"))?.nivel).toBe("ambar")
  })
})

describe("3 · el título lleva el día de publicación", () => {
  it("con fila: «publica 16 nov» (es un día, no se corre a la hora de Ecuador); sin fila, la creación como antes", () => {
    expect(diaDeCalendario("2026-11-16")).toBe("16 nov"); expect(diaDeCalendario("2026-12-01")).toBe("1 dic"); expect(diaDeCalendario("x")).toBeNull(); expect(diaDeCalendario(null)).toBeNull()
    expect(tituloDePieza({ familia: "video_mesa", tituloCrudo: "Video s2 · Instagram", cliente: "Náufrago", creada: "2026-11-11T04:32:25Z", publica: "2026-11-16" })).toMatch(/· Náufrago · publica 16 nov$/)
    // la creación en Ecuador era el 10-nov: ya no es lo que se ve si hay fila
    expect(tituloDePieza({ familia: "video_mesa", tituloCrudo: "Video s2 · Instagram", cliente: "Náufrago", creada: "2026-11-11T04:32:25Z", publica: "2026-11-16" })).not.toContain("10 nov")
    expect(tituloDePieza({ familia: "carrusel_mesa", tituloCrudo: "carrusel facebook", cliente: "Zero Risk Seguridad Industrial", creada: "2026-10-29T15:00:00Z" })).toBe("Carrusel Facebook · Zero Risk Seguridad Industrial · 29 oct")
    expect(tituloDePieza({ familia: "carrusel_mesa", tituloCrudo: "carrusel facebook", creada: "2026-10-29T15:00:00Z", publica: null })).toMatch(/29 oct$/)
  })
})

/** base falsa mínima: from().select().eq/in/order/limit → { data } */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, conError: string[] = []) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.is = (c: string, v: unknown) => { filas = filas.filter((f) => (f[c] ?? null) === v); return b }
    b.not = () => b
    b.neq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] !== v); return b }
    b.order = (c: string, o?: { ascending?: boolean }) => { filas.sort((x, y) => (Number(x[c]) - Number(y[c])) * (o?.ascending === false ? -1 : 1)); return b }
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(conError.includes(t) ? { data: null, error: { message: "x" } } : { data: filas, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}

describe("lectura de la base (sin red)", () => {
  const E1 = "86ae3cd3-3490-4225-9dc6-1e8e8029a615", E2 = "6d3e9086-d28f-484f-a27b-c4987a73a4dd"
  it("fechasDePublicacion: sala_ref.fila.fecha por encargo; sin fila o con error, nada (no se inventa)", async () => {
    const supa = baseFalsa({ oficina_encargos: [{ id: E1, sala_ref: { fila: { id: "s2", fecha: "2026-11-16", hora: "10:00" } } }, { id: E2, sala_ref: {} }] })
    const m = await fechasDePublicacion(supa, [E1, E2, "no-es-un-id"])
    expect(m.get(E1)).toBe("2026-11-16"); expect(m.has(E2)).toBe(false); expect(m.size).toBe(1)
    expect((await fechasDePublicacion(baseFalsa({}, ["oficina_encargos"]), [E1])).size).toBe(0)
    expect((await fechasDePublicacion(supa, [])).size).toBe(0)
  })
  it("la LISTA también titula con el día de publicación; sin fila, la creación (CC6 · lista-sin-lectura)", async () => {
    const PZ = (id: string, enc: string | null, cliente: string, title: string) => ({ id, status: "pending", client_id: cliente, created_at: "2026-11-11T04:32:25Z", title, type: "content_piece_review", agent_name: "oficina", output_preview: null, decision: {}, archivada_en: null, metadata: { familia: "video_mesa", ...(enc ? { oficina_encargo_id: enc } : {}) } })
    const tablas = {
      hitl_queue: [PZ("p1", E1, "n", "Video s2 · Instagram"), PZ("p2", null, "z", "Video x · TikTok")],
      clients: [{ id: "n", name: "Náufrago", industry: "restaurante" }, { id: "z", name: "Zero Risk Seguridad Industrial", industry: "seguridad industrial" }],
      oficina_encargos: [{ id: E1, sala_ref: { fila: { fecha: "2026-11-16" } } }],
    }
    const leidas: string[] = []
    const base = baseFalsa(tablas)
    const supa = { from: (t: string) => { leidas.push(t); return (base as unknown as { from: (t: string) => unknown }).from(t) } } as unknown as SupabaseClient
    const l = await listarPiezas(supa, { estado: "pendiente" })
    expect(leidas).toContain("oficina_encargos")
    expect(l.find((x) => x.id === "p1")?.titulo_legible).toBe("Video corto Instagram · Náufrago · publica 16 nov")
    expect(l.find((x) => x.id === "p2")?.titulo_legible).toMatch(/· Zero Risk Seguridad Industrial · 10 nov$/)
  })
  it("pasoQueFallo: el último paso en «fallo» de esa revisión", async () => {
    const supa = baseFalsa({ jefatura_pasos: [
      { revision_id: "r1", n: 2, estado: "fallo", paso: "correccion:editor", error: "timeout" },
      { revision_id: "r1", n: 4, estado: "fallo", paso: "decision:content-creator", error: "usage limits" },
      { revision_id: "r1", n: 5, estado: "hecho", paso: "cierre", error: null },
      { revision_id: "r2", n: 9, estado: "fallo", paso: "otro", error: "x" },
    ] })
    expect(await pasoQueFallo(supa, "r1")).toEqual({ paso: "decision:content-creator", error: "usage limits" })
    expect(await pasoQueFallo(supa, "r3")).toBeNull(); expect(await pasoQueFallo(supa, null)).toBeNull()
    expect(await pasoQueFallo(baseFalsa({}, ["jefatura_pasos"]), "r1")).toBeNull()
  })
})
