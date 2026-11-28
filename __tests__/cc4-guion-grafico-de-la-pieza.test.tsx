/**
 * 28-nov · GO Lenovo 09:54Z (Emilio aprobó el boceto `raw/evidencia/2026-11-27-boceto-ver-piezas-como-propuestas/`) · «GUION GRÁFICO · LA PIEZA».
 * La pieza de video terminada se mira como el boceto de su propuesta: las escenas del guion con fotos del video terminado y «▶ Ver el video terminado» arriba.
 * Regla para cualquier cliente: segundos ÷ 20 hacia arriba, de 1 a 6 fotos por escena. Sin fotos del video, queda lo de hoy (nunca un cuadro inventado).
 * US$ 0 · sin red: base y red falsas. Dos clientes de rubros distintos.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { etiquetaDeLaFoto } from "@/components/nuevo/GuionGraficoDeLaPieza"
import { cargarPieza, type DetalleDeLaPieza } from "@/lib/piezas-datos"
import { FOTOS_POR_ESCENA_MAX, SEGUNDOS_POR_FOTO, fotosPorEscena, guionGraficoDeLaPieza, type GuionGraficoDeLaPieza } from "@/lib/guion-grafico-de-la-pieza"
import type { VideoDeLaPieza } from "@/lib/piezas"

const BASE = "https://proyecto.supabase.co"
const CARPETA = `${BASE}/storage/v1/object/public/oficina-creativos/oficina/cli/enc-v`
const foto = (n: string) => `${CARPETA}/cuadros-9/${n}`
const PLANOS = [
  { n: 1, desde: 0, hasta: 8, rol: "captar", dice: "abre con el producto", se_ve: "el producto en la mesa", texto_en_pantalla: null },
  { n: 2, desde: 8, hasta: 15, rol: "situar", dice: null, se_ve: "el local por fuera", texto_en_pantalla: "Abierto desde las 8" },
  { n: 3, desde: 15, hasta: 30, rol: "llamado", dice: null, se_ve: "el cierre con la marca", texto_en_pantalla: "Escríbenos" },
]
// los 3 cuadros por plano de la mirada (siempre existen en un reel que pasó por la mirada)
const MIRADA = PLANOS.flatMap((p) => (["inicio", "medio", "final"] as const).map((parte, i) => ({ plano: p.n, segundo: p.desde + i, parte, url: foto(`plano-${p.n}-${parte}.jpg`) })))

describe("la regla (la misma que aplica la plataforma al sacar las fotos)", () => {
  it.each([[15, 1], [20, 1], [21, 2], [30, 2], [41, 3], [60, 3], [90, 5], [101, 6], [600, 6]])("🔴 %i s → %i por escena", (s, n) => expect(fotosPorEscena(s)).toBe(n))
  it("sin duración, 1; los números aprobados", () => {
    for (const x of [0, -1, Number.NaN, null, undefined]) expect(fotosPorEscena(x)).toBe(1)
    expect([SEGUNDOS_POR_FOTO, FOTOS_POR_ESCENA_MAX]).toEqual([20, 6])
  })
})

describe("de dónde salen las fotos", () => {
  it("🔴 las fotos del guion gráfico de la plataforma: cada escena con las suyas, en orden de segundo, con la regla que mandó la plataforma", () => {
    const gg = [{ plano: 2, segundo: 14.7, url: foto("g-2-2.jpg") }, { plano: 1, segundo: 0.3, url: foto("g-1-1.jpg") }, { plano: 2, segundo: 8.3, url: foto("g-2-1.jpg") }, { plano: 1, segundo: 7.7, url: foto("g-1-2.jpg") }]
    const g = guionGraficoDeLaPieza({ planos: PLANOS }, { guion_grafico: gg, cuadros: MIRADA, duracion_s: 30, fotos_por_escena: 2 }, BASE)!
    expect(g.fotos_por_escena).toBe(2)
    expect(g.segundos).toBe(30)
    expect(g.escenas.map((e) => e.n)).toEqual([1, 2, 3])
    expect(g.escenas[0].fotos).toEqual([{ url: foto("g-1-1.jpg"), segundo: 0.3 }, { url: foto("g-1-2.jpg"), segundo: 7.7 }])
    expect(g.escenas[1].imagenes).toEqual([foto("g-2-1.jpg"), foto("g-2-2.jpg")])
    // la escena sin foto no recibe los cuadros de la mirada (no se mezclan): queda vacía y se dibuja «qué se iba a ver»
    expect(g.escenas[2].fotos).toEqual([])
    expect(g.escenas[1]).toMatchObject({ rol: "situar", texto_en_pantalla: "Abierto desde las 8", desde: 8, hasta: 15 })
  })
  it("🔴 un reel de antes (solo los 3 cuadros de la mirada): se eligen por la regla · 15 s → el medio · 30 s → inicio y final · 60 s → los 3", () => {
    const partes = (s: number) => guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: MIRADA, duracion_s: s }, BASE)!.escenas[0].fotos.map((f) => f.url.split("/").pop())
    expect(partes(15)).toEqual(["plano-1-medio.jpg"])
    expect(partes(30)).toEqual(["plano-1-inicio.jpg", "plano-1-final.jpg"])
    expect(partes(60)).toEqual(["plano-1-inicio.jpg", "plano-1-medio.jpg", "plano-1-final.jpg"])
    expect(partes(120)).toHaveLength(3) // no hay más que los 3: no se inventan
    // la cuenta que mandó la plataforma manda sobre la del tablero (misma regla, un solo lugar que decide)
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: MIRADA, fotos_por_escena: 3 }, BASE, 15)!.escenas[0].fotos).toHaveLength(3)
    // sin duración medida, la del pedido
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: MIRADA }, BASE, 30)!.fotos_por_escena).toBe(2)
  })
  it("🔴 nunca se inventa: sin planos, sin cuadros, o con fotos fuera del almacén de la oficina → null (queda lo de hoy)", () => {
    expect(guionGraficoDeLaPieza(null, { cuadros: MIRADA }, BASE)).toBeNull()
    expect(guionGraficoDeLaPieza({ planos: [] }, { cuadros: MIRADA }, BASE)).toBeNull()
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, null, BASE)).toBeNull()
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: [], hay_cuadros: false }, BASE)).toBeNull()
    const ajenas = MIRADA.map((c) => ({ ...c, url: c.url.replace(BASE, "https://otro.test") }))
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: ajenas, guion_grafico: ajenas }, BASE)).toBeNull()
    const otroCubo = MIRADA.map((c) => ({ ...c, url: c.url.replace("oficina-creativos", "client-websites") }))
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: otroCubo }, BASE)).toBeNull()
    expect(guionGraficoDeLaPieza({ planos: PLANOS }, { cuadros: MIRADA }, null)).toBeNull()
  })
})

describe("cargar la pieza: lee el guion y los cuadros del estado de la oficina", () => {
  const MP4 = "F1-S1-ig-r1_v1.mp4"
  const MANIFIESTO = { archivos: [{ nombre: MP4, bytes: 1_200_000 }], meta: { video_generado: true, simulado: false } }
  const FILA = { id: "33333333-3333-3333-3333-333333333333", status: "pending", client_id: "c1", created_at: "2026-11-01T09:00:00Z", title: "t", type: "content_piece_review", metadata: { oficina_encargo_id: "enc-v", familia: "video_mesa", enlace_entrega: { "manifest.json": `${CARPETA}/manifest.json`, [MP4]: `${CARPETA}/${MP4}` } } }
  function base(o: { encargo?: Record<string, unknown> | null; manifiesto?: unknown } = {}) {
    const selects: Array<[string, string]> = []
    const tablas: Record<string, Array<Record<string, unknown>>> = {
      hitl_queue: [FILA], clients: [{ id: "c1", name: "Panadería de práctica" }],
      oficina_artefactos: [{ encargo_id: "enc-v", tipo: "pedido_video", version: 1, contenido: { pedido: { segundos: 30 } } }],
      oficina_mesa_aportes: [],
      oficina_encargos: o.encargo === null ? [] : [{ id: "enc-v", guion: { planos: PLANOS }, cuadros: { cuadros: MIRADA, duracion_s: 30 }, ...(o.encargo ?? {}) }],
    }
    const from = (t: string) => {
      let filas = [...(tablas[t] ?? [])]
      const b: Record<string, unknown> = {}
      b.select = (c: string) => { selects.push([t, c]); return b }
      b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
      b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
      b.order = () => b
      b.limit = (n: number) => { filas = filas.slice(0, n); return b }
      b.maybeSingle = () => Promise.resolve({ data: filas[0] ?? null, error: null })
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok)
      return b
    }
    const red = (async (url: string) => (String(url).endsWith("manifest.json") ? new Response(JSON.stringify(o.manifiesto ?? MANIFIESTO)) : new Response("x"))) as unknown as typeof fetch
    return { supa: { from } as unknown as SupabaseClient, selects, deps: { fetchImpl: red, urlBase: BASE } }
  }
  it("🔴 un reel con su mp4: el guion gráfico sale del encargo (guion + cuadros_video), con la duración del pedido", async () => {
    const b = base({ encargo: { cuadros: { cuadros: MIRADA } } })
    const d = (await cargarPieza(b.supa, FILA.id, b.deps))!
    expect(d.guion_grafico?.fotos_por_escena).toBe(2)
    expect(d.guion_grafico?.escenas.map((e) => e.fotos.length)).toEqual([2, 2, 2])
    expect(b.selects).toContainEqual(["oficina_encargos", "guion:estado_del_motor->artefactos->guion->datos, cuadros:estado_del_motor->artefactos->cuadros_video->datos"])
  })
  it("🔴 ensayo, video solo en el proveedor o sin video: no se lee nada del encargo y no hay guion gráfico", async () => {
    for (const meta of [{ video_generado: true, simulado: true }, { video_generado: true }]) {
      const b = base({ manifiesto: { archivos: meta.simulado ? [{ nombre: MP4 }] : [], meta } })
      const d = (await cargarPieza(b.supa, FILA.id, b.deps))!
      expect(d.guion_grafico ?? null).toBeNull()
      expect(b.selects.some(([t, c]) => t === "oficina_encargos" && /cuadros_video/.test(c))).toBe(false)
    }
    const b = base({ manifiesto: { archivos: [{ nombre: "01.png" }], meta: {} } })
    expect((await cargarPieza(b.supa, FILA.id, b.deps))!.guion_grafico ?? null).toBeNull()
  })
  it("sin el encargo, o sin cuadros todavía: null", async () => {
    for (const o of [{ encargo: null }, { encargo: { cuadros: null } }, { encargo: { guion: null } }]) {
      const b = base(o)
      expect((await cargarPieza(b.supa, FILA.id, b.deps))!.guion_grafico).toBeNull()
    }
  })
})

const VIDEO: VideoDeLaPieza = { nombre: "r.mp4", bytes: 1000, segundos: 30, simulado: false, solo_en_proveedor: false, vence: null, url_proveedor: null }
const GUION = (n: number): GuionGraficoDeLaPieza => ({
  fotos_por_escena: n, segundos: n * 15,
  escenas: PLANOS.map((p) => ({ ...p, producto: null, foto_propia: null, origen_de_la_foto: null, fotos: Array.from({ length: n }, (_, k) => ({ url: foto(`g-${p.n}-${k + 1}.jpg`), segundo: p.desde + k * 0.5 })), imagenes: [] })),
})
const DETALLE = (cliente: string, g: GuionGraficoDeLaPieza | null, video: VideoDeLaPieza | null = VIDEO): DetalleDeLaPieza => ({
  id: "33333333-3333-3333-3333-333333333333", estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: `Video · ${cliente}`, cliente, creada: "2026-11-28T09:00:00Z",
  familia: "video_mesa", brief_id: "b", encargo_id: "enc-v", gasto_usd: 1, laminas: [], pie: null, video, guion_grafico: g, guion: null, avisos: [], exige_casilla: false,
  jefatura: { resultado: null, desacuerdos: [], opinion_externa: null, revision_id: null }, aportes: [], version: 1, resumen_de_la_bandeja: null,
  acompana: { fila: null, productores: [], decidida_en: null, rehechura: null } as never,
})
const BANDEJA = (d: DetalleDeLaPieza) => ({ estado: "todas" as const, por_aprobar: 1, piezas: [{ id: d.id, estado: "pendiente" as const, status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: d.titulo, carpeta: "Video Instagram", archivada: false, cliente_id: "c1", cliente: d.cliente, creada: d.creada, gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true }], otras: [], clientes: [{ id: "c1", nombre: d.cliente }], leido_en: "x" })
const dibujar = (d: DetalleDeLaPieza) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA(d) as never, piezaInicialDatos: d }))

describe.each([["restaurante", "Restaurante de práctica"], ["seguridad industrial", "Seguridad de práctica"]])("el visor · %s", (_r, cliente) => {
  it("🔴 1 foto por escena: «▶ Ver el video terminado» arriba y el guion gráfico como el de la propuesta (4 a lo ancho, nombre, segundos y texto)", () => {
    const h = dibujar(DETALLE(cliente, GUION(1)))
    expect(h).toContain("data-guion-de-la-pieza")
    expect(h).toContain("▶ Ver el video terminado")
    expect(h.indexOf("Ver el video terminado")).toBeLessThan(h.indexOf("Guion gráfico · la pieza"))
    expect(h).toContain("sm:grid-cols-4")
    expect(h.match(/data-foto-del-video/g)).toHaveLength(3)
    expect(h).toContain("1 · Captar")
    expect(h).toContain("8–15 s")
    expect(h).toContain("«Abierto desde las 8»")
    expect(h).toContain("sin texto en pantalla")
    expect(h).toContain("3 escenas · 3 fotos (1 por escena, pieza de 15 s)")
    // el reproductor no se monta hasta que se pide; nada de «Sin dibujo»
    expect(h).not.toMatch(/<video/)
    expect(h).not.toContain("Sin dibujo")
  })
  it("🔴 3 fotos por escena: una fila por escena, cada foto con su lugar y su segundo", () => {
    const h = dibujar(DETALLE(cliente, GUION(3)))
    expect(h).toContain('data-fotos-por-escena="3"')
    expect(h.match(/data-escena=/g)).toHaveLength(3)
    expect(h.match(/data-foto-del-video/g)).toHaveLength(9)
    expect(h).toContain("inicio · 8 s")
    expect(h).toContain("medio · 8,5 s")
    expect(h).toContain("final · 16 s")
    // una escena a la que le falta una foto: sin «inicio/medio/final» (no se sabe cuál falta), solo el segundo
    const g = GUION(3); g.escenas[0] = { ...g.escenas[0], fotos: g.escenas[0].fotos.slice(0, 2) }
    const h2 = dibujar(DETALLE(cliente, g))
    expect(h2).toContain(">0 s<")
    expect(h2).not.toContain("inicio · 0 s")
    expect(h2).toContain("inicio · 8 s")
  })
  it("🔴 sin guion gráfico, el reel se ve como hoy (el reproductor); sin video, el aviso de hoy y ninguna foto", () => {
    const hoy = dibujar(DETALLE(cliente, null))
    expect(hoy).toMatch(/<video/)
    expect(hoy).not.toContain("data-guion-de-la-pieza")
    const sin = dibujar(DETALLE(cliente, null, null))
    expect(sin).toContain("Sin dibujo: esta pieza no tiene láminas ni video que mirar.")
    expect(sin).not.toContain("data-foto-del-video")
    // un ensayo con guion gráfico no lo muestra (no hay video de verdad)
    expect(dibujar(DETALLE(cliente, GUION(1), { ...VIDEO, simulado: true }))).not.toContain("data-guion-de-la-pieza")
  })
})

describe("la etiqueta de cada foto", () => {
  it("2 → inicio/final · 3 → inicio/medio/final · más (o incompleta) → solo el segundo", () => {
    expect([0, 1].map((k) => etiquetaDeLaFoto(2, k, 7.7))).toEqual(["inicio · 7,7 s", "final · 7,7 s"])
    expect(etiquetaDeLaFoto(3, 1, 10)).toBe("medio · 10 s")
    expect(etiquetaDeLaFoto(5, 2, 45)).toBe("45 s")
    expect(etiquetaDeLaFoto(0, 0, 3)).toBe("3 s")
  })
})
