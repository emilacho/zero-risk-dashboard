/**
 * T8 · LA PIEZA DE VIDEO EN LA BANDEJA (CC#1 · 31-oct): Emilio VE el video. US$ 0, sin red: base y red falsas.
 * El mp4 sale del MANIFIESTO de la entrega (nunca de una dirección pegada en la fila), el guion del `_guion.md`, la duración del pedido que la oficina mandó al brazo.
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { avisosDeLaPieza, esFamiliaDeVideo, videoDeLaPieza } from "@/lib/piezas"
import { cargarPieza, direccionDelVideoDeUnaPieza, leerManifiestoCompleto } from "@/lib/piezas-datos"
import { cabecerasDelVideo } from "@/app/api/piezas/[id]/video/route"

const BASE = "https://proyecto.supabase.co"
const CARPETA = `${BASE}/storage/v1/object/public/oficina-creativos/oficina/cli/enc-v`
const MP4 = "F1-S1-ig-r1_v1.mp4"
const MANIFIESTO = {
  archivos: [{ nombre: MP4, bytes: 1_200_000, sha256: "abc", ancho: null, alto: null, tipo: null }],
  meta: { encargo_id: "enc-v", brief_id: "F1-S1-ig-r1", video_generado: true, request_id: "req-1", video_url_proveedor: "https://proveedor.test/v.mp4", video_expires_at: "2026-11-02T10:00:00Z", simulado: false },
}
const META = { oficina_encargo_id: "enc-v", familia: "video_mesa", brief_id: "F1-S1-ig-r1", costo_usd: 3.21, jefatura_resultado: "aprobada", enlace_entrega: { "manifest.json": `${CARPETA}/manifest.json`, [MP4]: `${CARPETA}/${MP4}`, "F1-S1-ig-r1_v1_texto.txt": `${CARPETA}/F1-S1-ig-r1_v1_texto.txt`, "F1-S1-ig-r1_v1_guion.md": `${CARPETA}/F1-S1-ig-r1_v1_guion.md` } }
const FILA = { id: "33333333-3333-3333-3333-333333333333", status: "pending", client_id: "c1", created_at: "2026-11-01T09:00:00Z", title: "Aprobación · Video F1-S1-ig-r1 · instagram · 12 s · versión 1 · Zero Risk", type: "content_piece_review", agent_name: "oficina", output_preview: "Hay mesa desde las siete", metadata: META }

function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
    b.neq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] !== v); return b }
    b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.order = (c: string, o?: { ascending?: boolean }) => { filas.sort((x, y) => (String(x[c]) < String(y[c]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return b }
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.maybeSingle = () => Promise.resolve({ data: filas[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}
const TABLAS = () => ({
  hitl_queue: [FILA],
  clients: [{ id: "c1", name: "Zero Risk Seguridad Industrial" }],
  oficina_artefactos: [
    { encargo_id: "enc-v", tipo: "pedido_video", version: 1, contenido: { pedido: { formato: "reel", segundos: 12, relacion: "9:16" } } },
    { encargo_id: "enc-v", tipo: "video", version: 1, contenido: { request_id: "req-1" } },
  ],
  oficina_mesa_aportes: [{ encargo_id: "enc-v", n: 1, de: "creative-director-mesa", para: null, tipo: "idea", texto: "Idea rectora: el pan sale del horno", costo_usd: 0.1 }],
})
const pedidas: string[] = []
const redFalsa = (async (url: string) => {
  pedidas.push(String(url))
  if (String(url).endsWith("manifest.json")) return new Response(JSON.stringify(MANIFIESTO), { status: 200 })
  if (String(url).endsWith("_texto.txt")) return new Response("Hay mesa desde las siete. Ven a desayunar.\n\n#desayuno #masamadre", { status: 200 })
  if (String(url).endsWith("_guion.md")) return new Response("# Guion · F1-S1-ig-r1\n## Plano 1 · 0–3 s\nSe ve: el pan sale del horno\n## Pedido enviado al modelo\nFormato reel · 12 s", { status: 200 })
  return new Response("x", { status: 200 })
}) as unknown as typeof fetch
const deps = { fetchImpl: redFalsa, urlBase: BASE }

describe("qué es un video para la ventana", () => {
  it("el mp4 del manifiesto es el video; sin mp4 pero con `video_generado` quedó solo en el proveedor; sin ninguno no hay video", () => {
    expect(videoDeLaPieza(MANIFIESTO.archivos, MANIFIESTO.meta, 12)).toEqual({ nombre: MP4, bytes: 1_200_000, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-02T10:00:00Z" })
    expect(videoDeLaPieza([], MANIFIESTO.meta)).toMatchObject({ nombre: null, solo_en_proveedor: true, segundos: null })
    expect(videoDeLaPieza([{ nombre: "a.png" }], {})).toBeNull()
    expect(videoDeLaPieza(null, null)).toBeNull()
    expect(videoDeLaPieza([{ nombre: "x.MP4" }], { simulado: true })).toMatchObject({ nombre: "x.MP4", simulado: true, solo_en_proveedor: false })
  })
  it("las familias de video se reconocen por el nombre; las de láminas no", () => {
    for (const f of ["video_mesa", "reel_ig_v1", "short_yt", "tiktok_v1"]) expect(esFamiliaDeVideo(f), f).toBe(true)
    for (const f of ["carrusel_ig_v1", "kit_mesa", "concepto", null, undefined]) expect(esFamiliaDeVideo(f), String(f)).toBe(false)
  })
  it("con video NO dice «Sin dibujo»: rotula que es generado; simulado o solo en el proveedor avisan en ámbar; una pieza de video sin archivo dice «Sin video»", () => {
    const v = videoDeLaPieza(MANIFIESTO.archivos, MANIFIESTO.meta, 12)!
    const a = avisosDeLaPieza({ output_preview: "x", metadata: META }, [], v)
    expect(a.map((x) => x.texto).join("|")).not.toMatch(/Sin dibujo/)
    expect(a.find((x) => x.nivel === "info")?.texto).toMatch(/GENERADO por un modelo/)
    expect(a.map((x) => x.texto).join("|")).toMatch(/vence 2026-11-02/)
    expect(a.some((x) => x.nivel === "rojo")).toBe(false)
    expect(avisosDeLaPieza({ output_preview: "x", metadata: META }, [], { ...v, simulado: true }).find((x) => x.nivel === "ambar")?.texto).toMatch(/simulado/)
    expect(avisosDeLaPieza({ output_preview: "x", metadata: META }, [], { ...v, nombre: null, solo_en_proveedor: true }).find((x) => x.nivel === "ambar")?.texto).toMatch(/solo en el proveedor.*vence/)
    expect(avisosDeLaPieza({ output_preview: "x", metadata: META }, [], null).find((x) => x.nivel === "rojo")?.texto).toMatch(/^Sin video/)
    // lo de siempre no cambia: una pieza de láminas sin láminas sigue diciendo «Sin dibujo»
    expect(avisosDeLaPieza({ output_preview: "x", metadata: { familia: "carrusel_ig_v1" } }, []).find((x) => x.nivel === "rojo")?.texto).toMatch(/^Sin dibujo/)
    // el resumen de la bandeja que habla de imágenes generadas no se cruza contra láminas en una pieza de video
    expect(avisosDeLaPieza({ output_preview: "3 imágenes generadas", metadata: META }, [], v).some((x) => x.nivel === "rojo")).toBe(false)
  })
})

describe("cargar una pieza de video", () => {
  it("trae el video (duración del pedido al brazo), el guion del `_guion.md`, el pie, cero láminas y los avisos de video; nada se lee fuera del almacén de la oficina", async () => {
    pedidas.length = 0
    const d = (await cargarPieza(baseFalsa(TABLAS()), FILA.id, deps))!
    expect(d.laminas).toEqual([])
    expect(d.video).toEqual({ nombre: MP4, bytes: 1_200_000, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-02T10:00:00Z" })
    expect(d.guion).toMatch(/^# Guion · F1-S1-ig-r1/)
    expect(d.guion).toContain("Se ve: el pan sale del horno")
    expect(d.pie).toMatch(/^Hay mesa desde las siete/)
    expect(d.avisos.map((a) => a.texto).join("|")).not.toMatch(/Sin dibujo|Sin video/)
    expect(d.avisos.map((a) => a.texto).join("|")).toMatch(/GENERADO por un modelo/)
    expect(d.exige_casilla).toBe(false)
    expect(d.titulo).toMatch(/^Video corto Instagram/)
    expect(d.aportes).toHaveLength(1)
    expect(pedidas.every((u) => u.startsWith(CARPETA))).toBe(true)
    expect(pedidas.some((u) => u.includes("proveedor.test"))).toBe(false)
  })
  it("sin pedido al brazo guardado la duración es null (no se inventa); un guion fuera del almacén no se baja", async () => {
    const t = TABLAS()
    t.oficina_artefactos = t.oficina_artefactos.filter((a) => a.tipo !== "pedido_video")
    t.hitl_queue = [{ ...FILA, metadata: { ...META, enlace_entrega: { ...META.enlace_entrega, "F1-S1-ig-r1_v1_guion.md": "https://otro.sitio/guion.md" } } }]
    const d = (await cargarPieza(baseFalsa(t), FILA.id, deps))!
    expect(d.video?.segundos).toBeNull()
    expect(d.guion).toBeNull()
  })
  it("una pieza de láminas sigue igual: video null, guion null (no se pide el `_guion.md` aunque exista)", async () => {
    pedidas.length = 0
    const t = TABLAS()
    const manifiestoDeLaminas = { archivos: [{ nombre: "pieza_01-de-01.png", ancho: 1080, alto: 1350, tipo: "png" }], meta: {} }
    const red = (async (url: string) => { pedidas.push(String(url)); return String(url).endsWith("manifest.json") ? new Response(JSON.stringify(manifiestoDeLaminas)) : new Response("texto") }) as unknown as typeof fetch
    t.hitl_queue = [{ ...FILA, metadata: { ...META, familia: "carrusel_ig_v1" } }]
    const d = (await cargarPieza(baseFalsa(t), FILA.id, { fetchImpl: red, urlBase: BASE }))!
    expect(d.video).toBeNull()
    expect(d.guion).toBeNull()
    expect(d.laminas).toHaveLength(1)
    expect(pedidas.some((u) => u.endsWith("_guion.md"))).toBe(false)
  })
  it("el manifiesto completo trae `meta`; sin manifiesto, nada", async () => {
    expect((await leerManifiestoCompleto(META.enlace_entrega, deps)).meta).toMatchObject({ video_generado: true, simulado: false })
    expect(await leerManifiestoCompleto(null, deps)).toEqual({ archivos: [], meta: {} })
    expect(await leerManifiestoCompleto({ "manifest.json": "https://otro.sitio/manifest.json" }, deps)).toEqual({ archivos: [], meta: {} })
  })
})

describe("la ruta del video", () => {
  it("la dirección del mp4 cuelga de la carpeta del manifiesto (nunca de la dirección pegada en la fila ni del proveedor); sin mp4, null", async () => {
    expect(await direccionDelVideoDeUnaPieza(baseFalsa(TABLAS()), FILA.id, deps)).toBe(`${CARPETA}/${MP4}`)
    const t = TABLAS()
    t.hitl_queue = [{ ...FILA, metadata: { ...META, enlace_entrega: { ...META.enlace_entrega, [MP4]: "https://proveedor.test/v.mp4" } } }]
    expect(await direccionDelVideoDeUnaPieza(baseFalsa(t), FILA.id, deps)).toBe(`${CARPETA}/${MP4}`)
    const sin = (async (url: string) => (String(url).endsWith("manifest.json") ? new Response(JSON.stringify({ archivos: [], meta: { video_generado: true } })) : new Response("x"))) as unknown as typeof fetch
    expect(await direccionDelVideoDeUnaPieza(baseFalsa(TABLAS()), FILA.id, { fetchImpl: sin, urlBase: BASE })).toBeNull()
    expect(await direccionDelVideoDeUnaPieza(baseFalsa({ hitl_queue: [] }), FILA.id, deps)).toBeNull()
  })
  it("al reproductor le llegan solo las cabeceras de rango/tipo/tamaño del almacén, con tipo mp4 por omisión y caché privada", () => {
    const h = cabecerasDelVideo(new Headers({ "content-type": "video/mp4", "content-length": "1200000", "accept-ranges": "bytes", "content-range": "bytes 0-999/1200000", "x-amz-id": "no-pasa", "set-cookie": "no-pasa" }))
    expect(h).toEqual({ "Cache-Control": "private, max-age=300", "content-type": "video/mp4", "content-length": "1200000", "accept-ranges": "bytes", "content-range": "bytes 0-999/1200000" })
    expect(cabecerasDelVideo(new Headers({}))).toEqual({ "Cache-Control": "private, max-age=300", "content-type": "video/mp4" })
  })
})
