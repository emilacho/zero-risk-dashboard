/**
 * PANEL «PIEZAS» v2 (boceto `3-PROPUESTA-v2-panel-piezas.png` · aprobado por Emilio 11-nov 20:26 «aprobado, pero tiene que verse el thumbnail o la imagen» · GO Lenovo 20:27).
 * - árbol: SOLO la carpeta del cliente, cerrada al entrar (▸); al tocarla, a la derecha una fila por subcategoría, 4 a la vista y flechas;
 * - cada tarjeta con su miniatura REAL: la imagen; el video, su primer cuadro (lo saca el navegador del mismo archivo) con sello de duración; sin archivo, se dice;
 * - los 7 arreglos: carpeta cerrada · «Pieza» toma la familia del encargo · un solo número · sin frases de ayuda · sin carpetas repetidas · «Todas» lee una vez ·
 *   lo que está en producción se ve («En el estudio · paso N» / «En revisión»).
 * Dos clientes de rubros distintos (restaurante y seguridad industrial): nada depende de un cliente. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PanelPiezas, POR_FILA, duracionLegible, segundoDeLaPortada } from "@/components/nuevo/PanelPiezas"
import { filasDeSubcategorias, numeroDelCliente, arbolDeLaBandeja } from "@/lib/bandeja"
import { leerBandeja, type Bandeja } from "@/lib/bandeja-datos"
import { listarEnCurso, listarPiezas, miniaturaDeLaEntrega, type FilaDeLaLista, type PiezaEnCurso } from "@/lib/piezas-datos"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const ZR = "d0f5e6a7-1111-4222-8333-944455556666"
const E1 = "ed641cdf-77ba-4d59-8a1a-50ea75decede", E2 = "b6a60551-0000-4000-8000-000000000002", E3 = "3d63ac2f-31c5-47f3-a827-c20ac3a38154", E4 = "44d44996-0000-4000-8000-000000000004"

const fila = (p: Partial<FilaDeLaLista> & { id: string }): FilaDeLaLista => ({
  estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: `Video corto Instagram · Náufrago · ${p.id}`, carpeta: "Video corto Instagram",
  cliente_id: NAUFRAGO, cliente: "Náufrago", creada: "2026-11-11T04:32:25Z", gasto_usd: null, incompleta: false, desacuerdos: 0, tiene_dibujo: true, miniatura: "video", archivada: false, ...p,
})
const enCurso = (p: Partial<PiezaEnCurso> = {}): PiezaEnCurso => ({ encargo_id: E1, cliente_id: NAUFRAGO, familia: "video_mesa", tipo_legible: "Video corto", columna: "en_el_estudio", paso: 5, publica: "2026-11-14", creada: "2026-11-11T15:33:00Z", ...p })

const REELS = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id) => fila({ id: `${id}000000-0000-4000-8000-000000000000`.slice(0, 36) }))
const BANDEJA: Bandeja = {
  estado: "todas", por_aprobar: 7,
  piezas: [...REELS, fila({ id: "f1000000-0000-4000-8000-000000000000", carpeta: "Anuncio imagen", titulo_legible: "Anuncio imagen · Náufrago · publica 12 nov", miniatura: "imagen" }),
    fila({ id: "f2000000-0000-4000-8000-000000000000", carpeta: "Anuncio imagen", titulo_legible: "Anuncio imagen · Náufrago · sin archivo", miniatura: null, tiene_dibujo: false }),
    fila({ id: "z1000000-0000-4000-8000-000000000000", cliente_id: ZR, cliente: "Zero Risk Seguridad Industrial", carpeta: "Carrusel Facebook", titulo_legible: "Carrusel Facebook · Zero Risk Seguridad Industrial · 29 oct", miniatura: "imagen", estado: "aprobada", status: "approved" })],
  otras: [], clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }, { id: ZR, nombre: "Zero Risk Seguridad Industrial" }],
  en_curso: [enCurso(), enCurso({ encargo_id: E4, tipo_legible: "Historias", columna: "en_revision", paso: 20, publica: null }), enCurso({ encargo_id: E3, cliente_id: ZR, tipo_legible: "Carrusel" })],
  leido_en: "x",
}
const dibujar = (props: Partial<Parameters<typeof PanelPiezas>[0]> = {}) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA, clienteInicial: NAUFRAGO, ...props }))
const seccion = (html: string, nombre: string) => { const a = html.indexOf(`data-subcategoria="${nombre}"`); return a < 0 ? "" : html.slice(a, html.indexOf("</section>", a)) }

describe("Piezas v2 · el árbol y las filas", () => {
  it("al entrar: SOLO la carpeta del cliente, cerrada (▸), y la derecha vacía; sin subcarpetas en el árbol ni tarjetas de carpeta", () => {
    const h = dibujar()
    expect(h).toMatch(/data-nodo="cliente" aria-expanded="false"/); expect(h).toContain(">▸</span>")
    expect(h).not.toContain("data-subcategoria="); expect(h).not.toContain("data-pieza="); expect(h).not.toContain("data-nodo-carpeta"); expect(h).not.toContain("data-carpeta=")
  })
  it("abierta: una fila por subcategoría, las piezas lado a lado; 4 a la vista y la flecha › (no la ‹ al empezar)", () => {
    const h = dibujar({ carpetaInicial: "Video corto Instagram" })
    expect(h).toMatch(/data-nodo="cliente" aria-expanded="true"/); expect(h).toContain(">▾</span>")
    expect([...h.matchAll(/data-subcategoria="([^"]+)"/g)].map((m) => m[1])).toEqual(["Anuncio imagen", "Historias", "Video corto Instagram"])
    const video = seccion(h, "Video corto Instagram")
    expect(POR_FILA).toBe(4)
    expect((video.match(/data-pieza="|data-en-curso="/g) ?? []).length).toBe(4)
    expect(video).toContain('data-flecha="derecha"'); expect(video).not.toContain('data-flecha="izquierda"')
    expect(seccion(h, "Anuncio imagen")).not.toContain("data-flecha=") // 2 piezas: caben, sin flechas
    // las del otro cliente no se mezclan
    expect(h).not.toContain("Zero Risk Seguridad Industrial · 29 oct"); expect(h).not.toContain(`data-en-curso="${E3}"`)
  })
  it("fuera la línea gris de la cabecera y las frases de ayuda de la lista", () => {
    const h = dibujar({ carpetaInicial: "Video corto Instagram" })
    expect(h).not.toContain("Lo que la oficina creativa entregó"); expect(h).not.toContain("Entra a una carpeta"); expect(h).not.toContain("Abre una para verla lámina por lámina")
  })
})

describe("Piezas v2 · la miniatura real (condición de Emilio)", () => {
  const h = dibujar({ carpetaInicial: "Video corto Instagram" })
  it("video: su primer cuadro sale del mismo archivo, por el tablero, sin sonido ni controles, con el sello ▶; nunca «sin dibujo»", () => {
    const v = seccion(h, "Video corto Instagram")
    expect(v).toMatch(new RegExp(`<video data-miniatura="video" src="/api/piezas/${REELS[0].id}/video#t=0\\.1" preload="metadata"[^>]*muted`))
    expect(v).not.toMatch(/<video[^>]*controls/); expect(v).toContain("data-sello-video"); expect(v).toContain(">▶</span>") // sin duración hasta que el archivo la dice
    expect(h).not.toContain("sin dibujo")
  })
  it("imagen: la primera lámina; sin archivo, lo dice («sin archivo todavía»)", () => {
    const a = seccion(h, "Anuncio imagen")
    expect(a).toContain('<img data-miniatura="imagen" src="/api/piezas/f1000000-0000-4000-8000-000000000000/lamina/1"')
    expect(a).toContain('data-miniatura="ninguna"'); expect(a).toContain("sin archivo todavía")
  })
  it("la portada se toma al 20 % del video, nunca después de 2 s (el primer cuadro suele ser negro); sin duración, el comienzo", () => {
    expect(segundoDeLaPortada(8)).toBeCloseTo(1.6); expect(segundoDeLaPortada(30)).toBe(2); expect(segundoDeLaPortada(Number.NaN)).toBe(0); expect(segundoDeLaPortada(0)).toBe(0)
  })
  it("el sello dice la duración que da el archivo: «12 s» · «1:05»; sin dato, nada", () => {
    expect(duracionLegible(12.04)).toBe("12 s"); expect(duracionLegible(65)).toBe("1:05"); expect(duracionLegible(null)).toBeNull(); expect(duracionLegible(Number.NaN)).toBeNull(); expect(duracionLegible(0)).toBeNull()
  })
  it("la miniatura sale de los archivos de la entrega: imagen si hay png/jpg/webp, video si hay mp4, nada sin manifiesto", () => {
    expect(miniaturaDeLaEntrega({ "manifest.json": "u", "a_01-de-07.png": "u" })).toBe("imagen")
    expect(miniaturaDeLaEntrega({ "manifest.json": "u", "reel_01-de-01.mp4": "u", "reel_guion.md": "u" })).toBe("video")
    expect(miniaturaDeLaEntrega({ "reel.mp4": "u" })).toBeNull(); expect(miniaturaDeLaEntrega({ "manifest.json": "u", "x_texto.txt": "u" })).toBeNull(); expect(miniaturaDeLaEntrega(null)).toBeNull()
  })
})

describe("Piezas v2 · lo que está en producción (arreglo 7)", () => {
  it("con «Todas» se ve en la fila de su tipo, primero: «En el estudio · paso 5» / «En revisión»; un tipo sin fila abre la suya", () => {
    const h = dibujar({ carpetaInicial: "Video corto Instagram" })
    const v = seccion(h, "Video corto Instagram")
    expect(v.indexOf(`data-en-curso="${E1}"`)).toBeGreaterThan(-1); expect(v.indexOf(`data-en-curso="${E1}"`)).toBeLessThan(v.indexOf("data-pieza="))
    expect(v).toContain("En el estudio · paso 5"); expect(v).toContain("Video corto · Náufrago · publica 14 nov"); expect(v).toContain("todavía no llega a tu bandeja")
    expect(seccion(h, "Historias")).toContain("En revisión")
  })
  it("las filas: lo en curso va a la carpeta que empieza con su tipo; con «Por aprobar» no se suma; UN número por fila (por aprobar o el total)", () => {
    const [cliente] = arbolDeLaBandeja(BANDEJA.piezas.filter((p) => p.cliente_id === NAUFRAGO), [])
    const todas = filasDeSubcategorias(cliente, BANDEJA.en_curso!, "todas")
    expect(todas.map((f) => [f.nombre, f.numero])).toEqual([["Anuncio imagen", 2], ["Historias", 1], ["Video corto Instagram", 7]])
    expect(todas[2].elementos[0]).toMatchObject({ tipo: "en_curso" })
    expect(numeroDelCliente(todas)).toBe(10)
    const pend = filasDeSubcategorias(cliente, BANDEJA.en_curso!, "pendiente")
    expect(pend.map((f) => [f.nombre, f.numero])).toEqual([["Anuncio imagen", 2], ["Video corto Instagram", 6]])
    expect(numeroDelCliente(pend)).toBe(8)
    expect(filasDeSubcategorias(null, BANDEJA.en_curso!, "todas")).toEqual([])
  })
  it("una pieza sin la red en su título («Video corto», el reel sin dibujar) va con la ÚNICA fila de su tipo; con dos redes no se adivina", () => {
    const sinRed = fila({ id: "s1000000-0000-4000-8000-000000000000", carpeta: "Video corto", miniatura: null })
    const [c1] = arbolDeLaBandeja([REELS[0], sinRed], [])
    expect(filasDeSubcategorias(c1, [], "pendiente").map((f) => [f.nombre, f.numero])).toEqual([["Video corto Instagram", 2]])
    const tiktok = fila({ id: "t1000000-0000-4000-8000-000000000000", carpeta: "Video corto TikTok" })
    const [c2] = arbolDeLaBandeja([REELS[0], sinRed, tiktok], [])
    expect(filasDeSubcategorias(c2, [], "pendiente").map((f) => f.nombre)).toEqual(["Video corto", "Video corto Instagram", "Video corto TikTok"])
    // lo en curso, igual: con dos redes abre su propia fila
    expect(filasDeSubcategorias(c2, [enCurso()], "todas").find((f) => f.elementos.some((x) => x.tipo === "en_curso"))!.nombre).toBe("Video corto")
  })
  it("el número del cliente en el árbol sigue la misma regla (con «Todas», el total con lo que está en producción)", () => {
    expect(dibujar()).toMatch(/data-numero-cliente="true" class="[^"]*">10</)
    expect(dibujar({ bandejaInicial: { ...BANDEJA, estado: "pendiente", en_curso: undefined } })).toMatch(/data-numero-cliente="true" class="[^"]*bg-ambar[^"]*">8</)
  })
})

describe("Piezas v2 · «Todas» lee la bandeja UNA sola vez (arreglo 6)", () => {
  it("el botón solo cambia el filtro; la lectura la hace el efecto del filtro", () => {
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain("onClick={() => setFiltro(f)}"); expect(c).toContain('const verTodas = () => setFiltro("todas")')
    expect(c.match(/leerLaBandeja\(filtro\)/g)!.length).toBeGreaterThanOrEqual(1); expect(c).not.toContain('leerLaBandeja("todas")')
  })
})

/** base falsa mínima: from().select().eq/in/is/order/limit → { data } · anota cada tabla y cada filtro */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, conError: string[] = [], log: string[] = []) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = (cols: string) => { log.push(`${t}:select ${cols}`); return b }
    b.eq = (c: string, v: unknown) => { log.push(`${t}:eq ${c}=${String(v)}`); filas = filas.filter((f) => f[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { log.push(`${t}:in ${c}`); filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.is = (c: string, v: unknown) => { log.push(`${t}:is ${c}`); filas = filas.filter((f) => (f[c] ?? null) === v); return b }
    b.not = () => b
    b.neq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] !== v); return b }
    b.order = () => b
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(conError.includes(t) ? { data: null, error: { message: "x" } } : { data: filas, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}

const ENC = (id: string, p: Record<string, unknown>) => ({ id, client_id: NAUFRAGO, familia: "video_mesa", estado: "en_paso", dry_run: false, prueba: false, archivada_en: null, hitl_queue_id: null, creado_en: "2026-11-11T15:33:00Z", fila: { id: "s1-d6", fecha: "2026-11-14" }, rehace: null, paso: 5, ...p })

describe("Piezas v2 · la lectura (sin red)", () => {
  it("listarEnCurso: la mesa → «En el estudio» con su paso; entregado con la revisión abierta → «En revisión»; lo que no es para una publicación, fuera", async () => {
    const log: string[] = []
    const supa = baseFalsa({
      oficina_encargos: [
        ENC(E1, {}),
        ENC(E2, { estado: "cerrado", paso: 22, fila: null, rehace: { desde_hitl: "h" } }), // rehace una pieza: cuenta
        ENC(E3, { estado: "en_paso", familia: "brief_mesa", fila: null }), // un brief: no es una publicación
        ENC(E4, { estado: "cerrado", client_id: ZR, familia: "carrusel_mesa", fila: { fecha: "2026-12-03" } }), // la jefatura ya terminó
      ],
      jefatura_revisiones: [{ artifact_type: "pieza", artifact_id: E2, estado: "en_curso", creado_en: "2" }, { artifact_type: "pieza", artifact_id: E4, estado: "cerrada", creado_en: "2" }],
    }, [], log)
    const l = await listarEnCurso(supa)
    expect(l).toEqual([
      { encargo_id: E1, cliente_id: NAUFRAGO, familia: "video_mesa", tipo_legible: "Video corto", columna: "en_el_estudio", paso: 5, publica: "2026-11-14", creada: "2026-11-11T15:33:00Z" },
      { encargo_id: E2, cliente_id: NAUFRAGO, familia: "video_mesa", tipo_legible: "Video corto", columna: "en_revision", paso: 22, publica: null, creada: "2026-11-11T15:33:00Z" },
    ])
    // nunca ensayos, pruebas, archivados ni lo que ya está en la bandeja
    for (const x of ["oficina_encargos:eq dry_run=false", "oficina_encargos:eq prueba=false", "oficina_encargos:is archivada_en", "oficina_encargos:is hitl_queue_id", "jefatura_revisiones:eq artifact_type=pieza"]) expect(log).toContain(x)
    expect(log.find((x) => x.startsWith("oficina_encargos:select"))).toContain("paso:estado_del_motor->pasos_ejecutados")
  })
  it("listarEnCurso: paso desconocido → null (no se inventa); un error de la base lanza (nunca «nada en producción»)", async () => {
    expect((await listarEnCurso(baseFalsa({ oficina_encargos: [ENC(E1, { paso: null })] })))[0].paso).toBeNull()
    await expect(listarEnCurso(baseFalsa({}, ["oficina_encargos"]))).rejects.toThrow(/encargos en curso/)
    await expect(listarEnCurso(baseFalsa({ oficina_encargos: [ENC(E2, { estado: "cerrado" })] }, ["jefatura_revisiones"]))).rejects.toThrow(/jefatura/)
  })
  it("arreglo 2: una pieza de la bandeja sin familia toma la de su encargo (antes caía en la carpeta «Pieza»), en dos clientes", async () => {
    const PZ = (id: string, enc: string, cliente: string, meta: Record<string, unknown>) => ({ id, status: "pending", client_id: cliente, created_at: "2026-11-11T04:32:25Z", title: "Reel · Instagram", type: "content_piece_review", agent_name: "oficina", output_preview: null, decision: {}, archivada_en: null, metadata: { oficina_encargo_id: enc, ...meta } })
    const supa = baseFalsa({
      hitl_queue: [PZ("h1", E2, NAUFRAGO, {}), PZ("h2", E4, ZR, { familia: "carrusel_mesa", enlace_entrega: { "manifest.json": "u", "c_01-de-06.png": "u" } })],
      clients: [{ id: NAUFRAGO, name: "Náufrago", industry: "restaurante" }, { id: ZR, name: "Zero Risk Seguridad Industrial", industry: "seguridad industrial" }],
      oficina_encargos: [{ id: E2, familia: "video_mesa", sala_ref: { fila: { fecha: "2026-11-14" } } }, { id: E4, familia: "post_img", sala_ref: {} }],
    })
    const l = await listarPiezas(supa, { estado: "pendiente" })
    expect(l.find((x) => x.id === "h1")).toMatchObject({ carpeta: "Video corto Instagram", titulo_legible: "Video corto Instagram · Náufrago · publica 14 nov", miniatura: null })
    expect(l.find((x) => x.id === "h2")).toMatchObject({ miniatura: "imagen" }) // la familia de la bandeja manda sobre la del encargo
    expect(l.find((x) => x.id === "h2")!.carpeta).toMatch(/^Carrusel/)
  })
  it("leerBandeja: con «Por aprobar» no lee lo en curso; con «Todas» sí, solo de los clientes de la lista (sin práctica ni bajas)", async () => {
    const log: string[] = []
    const tablas = { clients: [{ id: NAUFRAGO, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }], oficina_encargos: [ENC(E1, {}), ENC(E3, { client_id: "ffffffff-0000-4000-8000-000000000000" })] }
    const pend = await leerBandeja(baseFalsa(tablas, [], log), {})
    expect(pend).not.toHaveProperty("en_curso"); expect(log.some((x) => x.includes("pasos_ejecutados"))).toBe(false)
    const todas = await leerBandeja(baseFalsa(tablas), { estado: "todas" })
    expect(todas.en_curso!.map((e) => e.encargo_id)).toEqual([E1])
  })
})
