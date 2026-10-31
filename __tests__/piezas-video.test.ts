/**
 * T8 · LA PIEZA DE VIDEO EN LA BANDEJA (CC#1 · 31-oct): Emilio VE el video. US$ 0, sin red: base y red falsas.
 * El mp4 sale del MANIFIESTO de la entrega (nunca de una dirección pegada en la fila), el guion del `_guion.md`, la duración del pedido que la oficina mandó al brazo.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
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
    expect(videoDeLaPieza(MANIFIESTO.archivos, MANIFIESTO.meta, 12)).toEqual({ nombre: MP4, bytes: 1_200_000, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-02T10:00:00Z", url_proveedor: "https://proveedor.test/v.mp4" })
    expect(videoDeLaPieza([], MANIFIESTO.meta)).toMatchObject({ nombre: null, solo_en_proveedor: true, segundos: null, url_proveedor: "https://proveedor.test/v.mp4" })
    // el enlace del proveedor solo si es https (no se ofrece un enlace raro pegado en el manifiesto)
    expect(videoDeLaPieza([], { video_generado: true, video_url_proveedor: "javascript:alert(1)" })?.url_proveedor).toBeNull()
    expect(videoDeLaPieza([], { video_generado: true, video_url_proveedor: "http://inseguro.test/v.mp4" })?.url_proveedor).toBeNull()
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
    const soloAlla = avisosDeLaPieza({ output_preview: "x", metadata: META }, [], { ...v, nombre: null, solo_en_proveedor: true }).find((x) => x.nivel === "ambar")?.texto
    expect(soloAlla).toMatch(/solo en el proveedor.*vence/)
    expect(soloAlla).toMatch(/Hay que bajarlo del proveedor antes de que venza/) // la descarga no es automática: no se promete
    expect(soloAlla).not.toMatch(/al aprobar/)
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
    expect(d.video).toEqual({ nombre: MP4, bytes: 1_200_000, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-02T10:00:00Z", url_proveedor: "https://proveedor.test/v.mp4" })
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
  // la ruta entera, con la puerta, la base y la red simuladas (reserva de CC3: C11, C12, C14, C15)
  async function ruta(o: { puerta: { ok: true; email: string | null } | { ok: false; status: 401 | 403 }; direccion: string | null; almacen: (url: string, init?: RequestInit) => Promise<Response> }) {
    vi.resetModules()
    vi.doMock("@/lib/admin-guard", () => ({ exigirAdmin: async () => o.puerta }))
    vi.doMock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => ({}) }))
    const direccion = vi.fn(async () => o.direccion)
    vi.doMock("@/lib/piezas-datos", () => ({ direccionDelVideoDeUnaPieza: direccion }))
    const llamadas: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => { llamadas.push({ url: String(url), init }); return o.almacen(String(url), init) })
    const { GET } = await import("@/app/api/piezas/[id]/video/route")
    const pedir = (id = FILA.id, h: Record<string, string> = {}) => GET(new Request(`https://t.test/api/piezas/${id}/video`, { headers: h }), { params: Promise.resolve({ id }) })
    return { pedir, direccion, llamadas }
  }
  const ADMIN = { ok: true as const, email: "emilio@x.com" }
  const almacenOk = async (_u: string, init?: RequestInit) => {
    const rango = new Headers(init?.headers).get("range")
    return rango
      ? new Response("parte", { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-4/1200000", "accept-ranges": "bytes", "content-length": "5", "set-cookie": "no-pasa" } })
      : new Response("todo", { status: 200, headers: { "content-type": "video/mp4", "content-length": "1200000" } })
  }
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock("@/lib/admin-guard"); vi.doUnmock("@/lib/supabase-server"); vi.doUnmock("@/lib/piezas-datos"); vi.resetModules() })

  it("sin sesión → 401, sin permiso → 403: no se mira la base ni se toca el almacén", async () => {
    for (const st of [401, 403] as const) {
      const { pedir, direccion, llamadas } = await ruta({ puerta: { ok: false, status: st }, direccion: `${CARPETA}/${MP4}`, almacen: almacenOk })
      const r = await pedir()
      expect(r.status).toBe(st)
      expect(await r.json()).toEqual({ error: st === 401 ? "sin_sesion" : "sin_permiso" })
      expect(direccion).not.toHaveBeenCalled()
      expect(llamadas).toHaveLength(0)
    }
  })
  it("id que no es un uuid → 400 sin mirar la base; sin mp4 → 404 sin tocar el almacén", async () => {
    const a = await ruta({ puerta: ADMIN, direccion: `${CARPETA}/${MP4}`, almacen: almacenOk })
    expect((await a.pedir("../../x")).status).toBe(400)
    expect(a.direccion).not.toHaveBeenCalled()
    const b = await ruta({ puerta: ADMIN, direccion: null, almacen: almacenOk })
    const r = await b.pedir()
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ error: "sin_video" })
    expect(b.llamadas).toHaveLength(0)
  })
  it("con sesión de administrador sirve el mp4 desde la dirección validada; con `Range` lo reenvía y devuelve 206 con las cabeceras de rango (y sin la cookie del almacén)", async () => {
    const { pedir, llamadas } = await ruta({ puerta: ADMIN, direccion: `${CARPETA}/${MP4}`, almacen: almacenOk })
    const r = await pedir()
    expect(r.status).toBe(200)
    expect(r.headers.get("content-type")).toBe("video/mp4")
    expect(r.headers.get("cache-control")).toBe("private, max-age=300")
    expect(await r.text()).toBe("todo")
    expect(llamadas[0].url).toBe(`${CARPETA}/${MP4}`)
    expect(new Headers(llamadas[0].init?.headers).get("range")).toBeNull()
    const p = await pedir(FILA.id, { range: "bytes=0-4" })
    expect(p.status).toBe(206)
    expect(p.headers.get("content-range")).toBe("bytes 0-4/1200000")
    expect(p.headers.get("accept-ranges")).toBe("bytes")
    expect(p.headers.get("set-cookie")).toBeNull()
    expect(new Headers(llamadas[1].init?.headers).get("range")).toBe("bytes=0-4")
  })
  it("si el almacén falla (404, 500 o no responde) → 502 `almacen_sin_respuesta`, nunca el error del almacén tal cual", async () => {
    for (const st of [404, 500]) {
      const { pedir } = await ruta({ puerta: ADMIN, direccion: `${CARPETA}/${MP4}`, almacen: async () => new Response("<html>error del almacén</html>", { status: st, headers: { "content-type": "text/html" } }) })
      const r = await pedir()
      expect(r.status).toBe(502)
      expect(await r.json()).toEqual({ error: "almacen_sin_respuesta" })
    }
    const { pedir } = await ruta({ puerta: ADMIN, direccion: `${CARPETA}/${MP4}`, almacen: async () => { throw new Error("sin red") } })
    expect((await pedir()).status).toBe(502)
  })
  it("al reproductor le llegan solo las cabeceras de rango/tipo/tamaño del almacén, con tipo mp4 por omisión y caché privada", () => {
    const h = cabecerasDelVideo(new Headers({ "content-type": "video/mp4", "content-length": "1200000", "accept-ranges": "bytes", "content-range": "bytes 0-999/1200000", "x-amz-id": "no-pasa", "set-cookie": "no-pasa" }))
    expect(h).toEqual({ "Cache-Control": "private, max-age=300", "content-type": "video/mp4", "content-length": "1200000", "accept-ranges": "bytes", "content-range": "bytes 0-999/1200000" })
    expect(cabecerasDelVideo(new Headers({}))).toEqual({ "Cache-Control": "private, max-age=300", "content-type": "video/mp4" })
  })
})
