/**
 * LA VENTANA DE PIEZAS (CC#1 · 29-oct). US$ 0, sin red: base y red falsas. Lo que se prueba es lo que Emilio ve y lo que sus botones pueden hacer.
 * La prueba CONTRA LA BASE VIVA (solo lectura) está en `piezas-viva.test.ts` y solo corre con ZR_PRUEBA_VIVA=1.
 */
import { describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  avisosDeLaPieza,
  direccionDeLaLamina,
  exigeCasilla,
  laminasDeLaPieza,
  resumenDiceImagenesGeneradas,
  tieneGlifosRiesgosos,
  validarDecision,
} from "@/lib/piezas"
import { cargarPieza, direccionDeLaLaminaDeUnaPieza, listarPiezas } from "@/lib/piezas-datos"
import { decidirPieza } from "@/lib/piezas-decision"
import type { HitlResolveResult } from "@/lib/hitl-resolve"

const BASE = "https://proyecto.supabase.co"
const ENLACE = `${BASE}/storage/v1/object/public/oficina-creativos/oficina/cli/enc/manifest.json`
const MANIFIESTO = { archivos: [1, 2, 3].map((k) => ({ nombre: `pieza_0${k}-de-03.png`, ancho: 1080, alto: 1350, tipo: "png" })) }
const SLIDES = [
  { eyebrow: "PARTE 01", headline: "3 cosas que revisa el Cuerpo de Bomberos", body: "¿El tuyo las cumple?", pie: "desliza", background_image_url: null },
  { eyebrow: "PARTE 02", headline: "2. MANÓMETRO", body: "Aguja en zona verde ✔ Aguja en rojo ✗", pie: "desliza", background_image_url: null },
  { eyebrow: "PARTE 03", headline: "Cierre", body: "Escríbenos", pie: null, background_image_url: null },
]
const META = {
  oficina_encargo_id: "enc-1", familia: "carrusel_ig_v1", brief_id: "BRF-0001", costo_usd: 1.84, revision_incompleta: true, jefatura_resultado: "incompleta_por_tope", con_desacuerdo: true,
  desacuerdos: ["imagen: no hay ninguna imagen que mirar", "revisión: incompleta"], imagen_generada: false, opinion_externa: { texto: "No la publicaría todavía" }, jefatura_revision_id: "rev-1",
  enlace_entrega: { "manifest.json": ENLACE, "pieza_texto.txt": `${BASE}/storage/v1/object/public/oficina-creativos/oficina/cli/enc/pieza_texto.txt` },
}
const FILA = { id: "11111111-1111-1111-1111-111111111111", status: "pending", client_id: "c1", created_at: "2026-10-28T11:56:00Z", title: "⚠️ REVISIÓN INCOMPLETA · Carrusel BRF-0001", type: "content_piece_review", agent_name: "oficina", output_preview: "🖼️ 6 imagen generada con IA · 1 lámina tipográfica de marca — ¿Tu extintor…", metadata: META }
const OTRA = { ...FILA, id: "22222222-2222-2222-2222-222222222222", type: "confirm_competitor_list", title: "Confirmar competidores", metadata: {} }

/** una base falsa con las tablas que lee la ventana; anota cada escritura (no debe haber ninguna) */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>) {
  const escrituras: string[] = []
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    const filtro = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
    b.select = () => b
    b.eq = filtro
    b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.order = (c: string, o?: { ascending?: boolean }) => { filas.sort((x, y) => (String(x[c]) < String(y[c]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return b }
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.maybeSingle = () => Promise.resolve({ data: filas[0] ?? null, error: null })
    b.update = () => { escrituras.push(`update ${t}`); return b }
    b.insert = () => { escrituras.push(`insert ${t}`); return b }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok)
    return b
  }
  return { supabase: { from } as unknown as SupabaseClient, escrituras }
}
const TABLAS = () => ({
  hitl_queue: [FILA, OTRA],
  clients: [{ id: "c1", name: "Zero Risk Seguridad Industrial" }],
  oficina_artefactos: [{ encargo_id: "enc-1", tipo: "laminas_armadas", version: 2, contenido: { slides: SLIDES } }, { encargo_id: "enc-1", tipo: "laminas_armadas", version: 1, contenido: { slides: [] } }],
  oficina_mesa_aportes: [{ encargo_id: "enc-1", n: 1, de: "creative-director-mesa", para: null, tipo: "idea", texto: "Idea rectora", costo_usd: 0.1 }],
})
const redFalsa = (): typeof fetch => (async (url: string) => {
  if (String(url).endsWith("manifest.json")) return new Response(JSON.stringify(MANIFIESTO), { status: 200 })
  if (String(url).endsWith("_texto.txt")) return new Response("Pie de la publicación", { status: 200 })
  return new Response("x", { status: 200 })
}) as unknown as typeof fetch
const deps = { fetchImpl: redFalsa(), urlBase: BASE }

describe("lo que Emilio ve: láminas, origen y avisos", () => {
  it("las láminas salen del MANIFIESTO y cada una lleva su texto de la oficina", () => {
    const l = laminasDeLaPieza(MANIFIESTO.archivos, SLIDES)
    expect(l).toHaveLength(3)
    expect(l[1]).toMatchObject({ n: 2, titular: "2. MANÓMETRO", origen: "tipografia", glifos_riesgosos: true })
    expect(l[0].glifos_riesgosos).toBe(false)
    expect(laminasDeLaPieza([{ nombre: "manifest.json" }, { nombre: "a_texto.txt" }, { nombre: "a.png" }], [])).toHaveLength(1) // solo imágenes
    expect(laminasDeLaPieza(null, SLIDES)).toEqual([])
  })
  it("una lámina con fondo de imagen se rotula con imagen; sin fondo, solo tipografía", () => {
    const l = laminasDeLaPieza(MANIFIESTO.archivos, [{ headline: "a", background_image_url: "https://x/y.png" }, { headline: "b" }])
    expect(l.map((x) => x.origen)).toEqual(["con_imagen", "tipografia", "tipografia"])
  })
  it("detecta ✔ ✗ y emojis (el dibujo los pinta como «NO GLYPH») y deja pasar el español normal", () => {
    for (const t of ["Legible ✔", "Borrada ✗", "Escríbenos 👇", "⭐"]) expect(tieneGlifosRiesgosos(t), t).toBe(true)
    for (const t of ["¿Cuánto cuesta? Años, niño, él.", "", null, undefined]) expect(tieneGlifosRiesgosos(t), String(t)).toBe(false)
  })
  it("EL RESUMEN FALSO: la bandeja decía «6 imagen generada con IA» y el manifiesto no trae ninguna → aviso ROJO", () => {
    const l = laminasDeLaPieza(MANIFIESTO.archivos, SLIDES)
    expect(resumenDiceImagenesGeneradas(FILA.output_preview)).toBe(6)
    const a = avisosDeLaPieza({ output_preview: FILA.output_preview, metadata: META }, l)
    expect(a.find((x) => x.nivel === "rojo")?.texto).toMatch(/decía «6 imágenes generadas con IA».*ninguna/)
    expect(a.map((x) => x.texto).join("|")).toMatch(/revisión de la jefatura no terminó/)
    expect(a.map((x) => x.texto).join("|")).toMatch(/2 desacuerdos/)
    expect(a.map((x) => x.texto).join("|")).toMatch(/láminas 2 llevan signos/)
  })
  it("si el resumen y el manifiesto coinciden no hay aviso rojo de imágenes; sin láminas dice «Sin dibujo»", () => {
    const con = laminasDeLaPieza(MANIFIESTO.archivos, SLIDES.map((s) => ({ ...s, background_image_url: "https://x/y.png" })))
    expect(avisosDeLaPieza({ output_preview: "3 imágenes generadas con IA", metadata: {} }, con).filter((x) => x.nivel === "rojo")).toEqual([])
    expect(avisosDeLaPieza({ output_preview: "3 imágenes generadas con IA", metadata: {} }, con.slice(0, 2)).some((x) => x.nivel === "rojo")).toBe(true) // dice 3, hay 2
    expect(avisosDeLaPieza({ output_preview: "texto", metadata: {} }, []).map((x) => x.texto).join()).toMatch(/Sin dibujo/)
  })
  it("la casilla «entiendo» se exige con revisión incompleta, desacuerdos o sin dibujar; no en una pieza limpia", () => {
    expect(exigeCasilla({ metadata: META })).toBe(true)
    expect(exigeCasilla({ metadata: { sin_dibujar: true } })).toBe(true)
    expect(exigeCasilla({ metadata: { desacuerdos: ["x"] } })).toBe(true)
    expect(exigeCasilla({ metadata: { jefatura_resultado: "aprobada" } })).toBe(false)
    expect(exigeCasilla({ metadata: null })).toBe(false)
  })
})

describe("la validación de lo que mandan los botones", () => {
  it("rechaza una acción que no existe", () => { expect(validarDecision({ accion: "borrar" }, 3, false)).toMatchObject({ ok: false, error: "accion_invalida" }); expect(validarDecision(null, 3, false)).toMatchObject({ ok: false }) })
  it("aprobar con revisión incompleta SIN la casilla se rechaza; con la casilla pasa", () => {
    expect(validarDecision({ accion: "aprobar" }, 3, true)).toMatchObject({ ok: false, error: "casilla_requerida" })
    expect(validarDecision({ accion: "aprobar", casilla: "true" }, 3, true)).toMatchObject({ ok: false, error: "casilla_requerida" }) // solo el booleano de verdad
    expect(validarDecision({ accion: "aprobar", casilla: true }, 3, true)).toMatchObject({ ok: true })
    expect(validarDecision({ accion: "aprobar" }, 3, false)).toMatchObject({ ok: true })
  })
  it("rechazar pide motivo (5 caracteres); pedir cambios pide comentario (10) y láminas dentro de la pieza", () => {
    expect(validarDecision({ accion: "rechazar", comentario: "no" }, 3, false)).toMatchObject({ ok: false, error: "motivo_requerido" })
    expect(validarDecision({ accion: "rechazar", comentario: "no sirve" }, 3, false)).toMatchObject({ ok: true })
    expect(validarDecision({ accion: "cambios", comentario: "más corto" }, 3, false)).toMatchObject({ ok: false, error: "comentario_requerido" }) // 9 caracteres
    expect(validarDecision({ accion: "cambios", comentario: "el titular es largo", laminas: [1, 4] }, 3, false)).toMatchObject({ ok: false, error: "lamina_invalida" })
    expect(validarDecision({ accion: "cambios", comentario: "el titular es largo", laminas: [0] }, 3, false)).toMatchObject({ ok: false, error: "lamina_invalida" })
    expect(validarDecision({ accion: "cambios", comentario: "el titular es largo", laminas: [1.5] }, 3, false)).toMatchObject({ ok: false, error: "lamina_invalida" })
    const ok = validarDecision({ accion: "cambios", comentario: "  el titular es largo  ", laminas: [3, 1, 3] }, 3, false)
    expect(ok).toMatchObject({ ok: true, pedido: { comentario: "el titular es largo", laminas: [1, 3] } })
    expect(validarDecision({ accion: "cambios", comentario: "x".repeat(2001) }, 3, false)).toMatchObject({ ok: false, error: "comentario_largo" })
  })
})

describe("la dirección de una lámina solo cuelga del almacén de la oficina (nadie baja otra cosa por esta ventana)", () => {
  it("válida: misma casa, cubo de la oficina; el nombre se codifica", () => {
    expect(direccionDeLaLamina(ENLACE, "pieza 01.png", BASE)).toBe(`${BASE}/storage/v1/object/public/oficina-creativos/oficina/cli/enc/pieza%2001.png`)
  })
  it("rechaza otro dominio, otro cubo, una ruta metida en el nombre y valores vacíos", () => {
    expect(direccionDeLaLamina("https://malo.example/storage/v1/object/public/oficina-creativos/a/manifest.json", "a.png", BASE)).toBeNull()
    expect(direccionDeLaLamina(`${BASE}/storage/v1/object/public/client-websites/a/manifest.json`, "a.png", BASE)).toBeNull() // el cubo de la web del cliente NO es de la oficina
    expect(direccionDeLaLamina(ENLACE, "../otro/a.png", BASE)).toBeNull()
    expect(direccionDeLaLamina(ENLACE, "a/b.png", BASE)).toBeNull()
    expect(direccionDeLaLamina(null, "a.png", BASE)).toBeNull()
    expect(direccionDeLaLamina(ENLACE, "a.png", null)).toBeNull()
    expect(direccionDeLaLamina("no es una dirección", "a.png", BASE)).toBeNull()
  })
})

describe("la lectura: lista y detalle desde la bandeja", () => {
  it("la lista trae las piezas y las de otro tipo (en solo lectura), con cliente y marcas", async () => {
    const { supabase } = baseFalsa(TABLAS())
    const l = await listarPiezas(supabase, { estado: "pendiente" })
    expect(l).toHaveLength(2)
    expect(l.find((x) => x.id === FILA.id)).toMatchObject({ es_pieza: true, cliente: "Zero Risk Seguridad Industrial", estado: "pendiente", gasto_usd: 1.84, incompleta: true, desacuerdos: 2, tiene_dibujo: true })
    expect(l.find((x) => x.id === OTRA.id)).toMatchObject({ es_pieza: false, tipo: "confirm_competitor_list", tiene_dibujo: false })
  })
  it("el filtro «pendientes» no trae las ya resueltas; «todas» sí", async () => {
    const t = TABLAS()
    t.hitl_queue.push({ ...FILA, id: "33333333-3333-3333-3333-333333333333", status: "approved" })
    const { supabase } = baseFalsa(t)
    expect((await listarPiezas(supabase, { estado: "pendiente" })).map((x) => x.status)).not.toContain("approved")
    expect((await listarPiezas(supabase, { estado: "todas" })).map((x) => x.status)).toContain("approved")
  })
  it("el detalle usa la ÚLTIMA versión de las láminas, el libro de la mesa, el pie y la jefatura", async () => {
    const { supabase } = baseFalsa(TABLAS())
    const d = (await cargarPieza(supabase, FILA.id, deps))!
    expect(d.laminas).toHaveLength(3)
    expect(d.laminas[0].titular).toBe("3 cosas que revisa el Cuerpo de Bomberos") // la v2, no la v1 vacía
    expect(d.version).toBe(2)
    expect(d.pie).toBe("Pie de la publicación")
    expect(d.aportes).toHaveLength(1)
    expect(d.aportes[0]).toMatchObject({ n: 1, de: "creative-director-mesa" })
    expect(d.jefatura).toMatchObject({ resultado: "incompleta_por_tope", opinion_externa: "No la publicaría todavía" })
    expect(d.exige_casilla).toBe(true)
    expect(d.avisos.some((a) => a.nivel === "rojo")).toBe(true)
    expect(d.cliente).toBe("Zero Risk Seguridad Industrial")
  })
  it("si el almacén no responde la pieza se ve «sin dibujo» en vez de romper; una pieza que no existe es null", async () => {
    const { supabase } = baseFalsa(TABLAS())
    const caida = (async () => { throw new Error("red caída") }) as unknown as typeof fetch
    const d = (await cargarPieza(supabase, FILA.id, { fetchImpl: caida, urlBase: BASE }))!
    expect(d.laminas).toEqual([])
    expect(d.avisos.map((a) => a.texto).join()).toMatch(/Sin dibujo/)
    expect(await cargarPieza(supabase, "99999999-9999-9999-9999-999999999999", deps)).toBeNull()
  })
  it("la dirección de la lámina n sale del manifiesto y se valida; fuera de rango es null", async () => {
    const { supabase } = baseFalsa(TABLAS())
    expect(await direccionDeLaLaminaDeUnaPieza(supabase, FILA.id, 2, deps)).toBe(`${BASE}/storage/v1/object/public/oficina-creativos/oficina/cli/enc/pieza_02-de-03.png`)
    expect(await direccionDeLaLaminaDeUnaPieza(supabase, FILA.id, 4, deps)).toBeNull()
    expect(await direccionDeLaLaminaDeUnaPieza(supabase, FILA.id, 0, deps)).toBeNull()
  })
})

describe("los botones: decidir una pieza", () => {
  const resolverOk = vi.fn(async (): Promise<HitlResolveResult> => ({ mode: "live", ok: true, hitl_id: FILA.id, decision: "approve", client_id: "c1", execution_id: null, platform_status: 200 }))
  const nuevo = (t = TABLAS(), extra: Record<string, unknown> = {}) => { const b = baseFalsa(t); return { ...b, d: { supabase: b.supabase, revisor: "emilio", ...deps, resolver: resolverOk as never, llave: "k", ...extra } } }

  it("aprobar sin la casilla (pieza con revisión incompleta) → 400 y NO llama a la plataforma", async () => {
    resolverOk.mockClear()
    const { d } = nuevo()
    const r = await decidirPieza(FILA.id, { accion: "aprobar" }, d)
    expect(r.status).toBe(400)
    expect(r.cuerpo.error).toBe("casilla_requerida")
    expect(resolverOk).not.toHaveBeenCalled()
  })
  it("aprobar con la casilla → pasa por la plataforma con el revisor; dice que NO publica todavía", async () => {
    resolverOk.mockClear()
    const { d, escrituras } = nuevo()
    const r = await decidirPieza(FILA.id, { accion: "aprobar", casilla: true, estado_visto: "pending" }, d)
    expect(r.status).toBe(200)
    expect(r.cuerpo).toMatchObject({ ok: true, accion: "aprobar", publica: false })
    expect(String(r.cuerpo.nota)).toMatch(/no se publica/i)
    expect(resolverOk).toHaveBeenCalledWith({ hitl_id: FILA.id, decision: "approve", reviewer_id: "emilio", rejection_reason: undefined }, expect.anything())
    expect(escrituras).toEqual([]) // el tablero no escribe la bandeja directo: lo hace la plataforma
  })
  it("rechazar lleva el motivo a la plataforma", async () => {
    resolverOk.mockClear()
    const { d } = nuevo()
    const r = await decidirPieza(FILA.id, { accion: "rechazar", comentario: "no vale la pena publicarla" }, d)
    expect(r.status).toBe(200)
    expect(resolverOk).toHaveBeenCalledWith(expect.objectContaining({ decision: "reject", rejection_reason: "no vale la pena publicarla" }), expect.anything())
  })
  it("DOBLE CLIC / pantalla vieja: una pieza ya resuelta, o con otro estado visto, responde 409 y no toca nada", async () => {
    resolverOk.mockClear()
    const t = TABLAS(); t.hitl_queue[0] = { ...FILA, status: "approved" }
    const a = nuevo(t)
    expect((await decidirPieza(FILA.id, { accion: "aprobar", casilla: true }, a.d)).status).toBe(409)
    const b = nuevo()
    const r = await decidirPieza(FILA.id, { accion: "aprobar", casilla: true, estado_visto: "edited" }, b.d)
    expect(r.status).toBe(409)
    expect(r.cuerpo.error).toBe("estado_cambio")
    expect(resolverOk).not.toHaveBeenCalled()
  })
  it("una fila que no es pieza (competidores) no se aprueba aquí; una que no existe da 404", async () => {
    const { d } = nuevo()
    expect((await decidirPieza(OTRA.id, { accion: "aprobar", casilla: true }, d)).cuerpo.error).toBe("no_es_pieza")
    expect((await decidirPieza("99999999-9999-9999-9999-999999999999", { accion: "aprobar" }, d)).status).toBe(404)
  })
  it("la plataforma en modo sombra o rechazando NO se muestra como «listo»", async () => {
    const sombra = nuevo(TABLAS(), { resolver: async () => ({ mode: "shadow", ok: true, hitl_id: FILA.id, decision: "approve", client_id: null, execution_id: null }) })
    const r1 = await decidirPieza(FILA.id, { accion: "aprobar", casilla: true }, sombra.d)
    expect(r1.cuerpo).toMatchObject({ ok: true, simulado: true })
    expect(String(r1.cuerpo.detalle)).toMatch(/SIMULADO/)
    const mala = nuevo(TABLAS(), { resolver: async () => ({ mode: "live", ok: false, hitl_id: FILA.id, decision: "approve", client_id: null, execution_id: null, platform_status: 401, platform_error: "Missing x-api-key" }) })
    const r2 = await decidirPieza(FILA.id, { accion: "aprobar", casilla: true }, mala.d)
    expect(r2.status).toBe(502)
    expect(r2.cuerpo).toMatchObject({ ok: false, error: "la_plataforma_no_guardo", plataforma_status: 401 })
  })
  it("pedir cambios llama a la ruta de la plataforma con el comentario y las láminas marcadas", async () => {
    const llamadas: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl = (async (url: string, init: RequestInit) => { if (String(url).endsWith("manifest.json")) return new Response(JSON.stringify(MANIFIESTO)); if (String(url).includes("/api/oficina/cambios")) { llamadas.push({ url: String(url), init }); return new Response("{}", { status: 200 }) } return new Response("x") }) as unknown as typeof fetch
    const { d } = nuevo(TABLAS(), { fetchImpl, plataformaUrl: "https://plataforma.test/" })
    const r = await decidirPieza(FILA.id, { accion: "cambios", comentario: "el titular es muy largo", laminas: [2] }, d)
    expect(r.status).toBe(200)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].url).toBe("https://plataforma.test/api/oficina/cambios")
    expect((llamadas[0].init.headers as Record<string, string>)["x-api-key"]).toBe("k")
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({ hitl_id: FILA.id, comentario: "el titular es muy largo", laminas: [2], reviewer: "emilio" })
  })
  it("mientras la plataforma no tenga la ruta de cambios (404) responde 501 con esa causa: no finge que pidió algo", async () => {
    const fetchImpl = (async (url: string) => (String(url).endsWith("manifest.json") ? new Response(JSON.stringify(MANIFIESTO)) : new Response("not found", { status: 404 }))) as unknown as typeof fetch
    const { d } = nuevo(TABLAS(), { fetchImpl })
    const r = await decidirPieza(FILA.id, { accion: "cambios", comentario: "el titular es muy largo" }, d)
    expect(r.status).toBe(501)
    expect(r.cuerpo.error).toBe("cambios_no_disponible")
  })
  it("pedir cambios sin la llave interna → 503 y no sale ninguna llamada", async () => {
    const llamadas: string[] = []
    const fetchImpl = (async (url: string) => { llamadas.push(String(url)); return String(url).endsWith("manifest.json") ? new Response(JSON.stringify(MANIFIESTO)) : new Response("{}") }) as unknown as typeof fetch
    const prev = { a: process.env.PLATFORM_INTERNAL_KEY, b: process.env.INTERNAL_API_KEY }
    delete process.env.PLATFORM_INTERNAL_KEY; delete process.env.INTERNAL_API_KEY
    try {
      const { d } = nuevo(TABLAS(), { fetchImpl, llave: undefined })
      const r = await decidirPieza(FILA.id, { accion: "cambios", comentario: "el titular es muy largo" }, d)
      expect(r.status).toBe(503)
      expect(llamadas.some((u) => u.includes("/api/oficina/cambios"))).toBe(false)
    } finally {
      if (prev.a !== undefined) process.env.PLATFORM_INTERNAL_KEY = prev.a
      if (prev.b !== undefined) process.env.INTERNAL_API_KEY = prev.b
    }
  })
})

describe("cada razón por sí sola exige la casilla (y una pieza limpia no)", () => {
  const resolverOk = vi.fn(async (): Promise<HitlResolveResult> => ({ mode: "live", ok: true, hitl_id: FILA.id, decision: "approve", client_id: "c1", execution_id: null, platform_status: 200 }))
  const conMeta = (meta: Record<string, unknown>) => {
    const t = TABLAS(); t.hitl_queue = [{ ...FILA, metadata: { ...META, revision_incompleta: false, jefatura_resultado: "aprobada", con_desacuerdo: false, desacuerdos: [], ...meta } }, OTRA]
    const b = baseFalsa(t); return { supabase: b.supabase, revisor: "emilio", ...deps, resolver: resolverOk as never, llave: "k" }
  }
  const razones: Array<[string, Record<string, unknown>]> = [
    ["revision_incompleta", { revision_incompleta: true }],
    ["incompleta_por_tope", { jefatura_resultado: "incompleta_por_tope" }],
    ["con_desacuerdo", { con_desacuerdo: true }],
    ["desacuerdos", { desacuerdos: ["imagen: falta"] }],
    ["sin_dibujar", { sin_dibujar: true }],
  ]
  for (const [nombre, meta] of razones) {
    it(`sola, ${nombre} exige la casilla: aprobar sin ella → 400`, async () => {
      resolverOk.mockClear()
      const r = await decidirPieza(FILA.id, { accion: "aprobar" }, conMeta(meta))
      expect(r.status).toBe(400)
      expect(r.cuerpo.error).toBe("casilla_requerida")
      expect(resolverOk).not.toHaveBeenCalled()
    })
  }
  it("una pieza limpia se aprueba sin casilla", async () => {
    resolverOk.mockClear()
    const r = await decidirPieza(FILA.id, { accion: "aprobar" }, conMeta({}))
    expect(r.status).toBe(200)
    expect(resolverOk).toHaveBeenCalledTimes(1)
  })
})

describe("pedir cambios: la plataforma que falla nunca se lee como éxito", () => {
  const nuevo = (fetchImpl: typeof fetch) => { const b = baseFalsa(TABLAS()); return { supabase: b.supabase, revisor: "emilio", ...deps, fetchImpl, llave: "k" } }
  const red = (cambios: () => Response | Promise<Response>) => (async (url: string) => (String(url).endsWith("manifest.json") ? new Response(JSON.stringify(MANIFIESTO)) : cambios())) as unknown as typeof fetch
  for (const codigo of [401, 500]) {
    it(`la plataforma contesta ${codigo} → 502 ok:false`, async () => {
      const r = await decidirPieza(FILA.id, { accion: "cambios", comentario: "el titular es muy largo" }, nuevo(red(() => new Response("no", { status: codigo }))))
      expect(r.status).toBe(502)
      expect(r.cuerpo).toMatchObject({ ok: false, error: "la_plataforma_rechazo", plataforma_status: codigo })
    })
  }
  it("la llamada lanza (red caída) → 502 ok:false", async () => {
    const r = await decidirPieza(FILA.id, { accion: "cambios", comentario: "el titular es muy largo" }, nuevo(red(() => { throw new Error("ECONNRESET") })))
    expect(r.status).toBe(502)
    expect(r.cuerpo).toMatchObject({ ok: false, error: "plataforma_sin_respuesta" })
  })
})

describe("las puertas: solo el administrador con sesión", () => {
  const RAIZ = path.join(__dirname, "..")
  const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), "utf8")
  it("las dos rutas nuevas llaman a exigirAdmin ANTES de leer nada, y la página redirige sin sesión", () => {
    for (const ruta of ["app/api/piezas/[id]/lamina/[n]/route.ts", "app/api/piezas/[id]/decidir/route.ts"]) {
      const t = leer(ruta)
      expect(t, ruta).toMatch(/exigirAdmin\(\)/)
      expect(t.indexOf("exigirAdmin()"), ruta).toBeLessThan(t.indexOf("getServiceRoleClient()"))
      expect(t, ruta).toMatch(/401/)
    }
    expect(leer("app/piezas/page.tsx")).toMatch(/exigirAdmin\(\)[\s\S]*redirect\(/)
  })
  it("/piezas es solo de administrador en el middleware (un cliente con sesión rebota)", () => {
    expect(leer("middleware.ts")).toMatch(/ADMIN_ONLY_PREFIXES = \[[^\]]*"\/piezas"/)
  })
  it("exigirAdmin: sin sesión 401, con sesión pero sin rol 403, admin pasa, y un error no deja pasar", async () => {
    vi.resetModules()
    const casos: Array<[unknown, unknown]> = [[{ userId: null, email: null, role: null }, { ok: false, status: 401 }], [{ userId: "u", email: "a@b", role: "client_viewer" }, { ok: false, status: 403 }], [{ userId: "u", email: "a@b", role: null }, { ok: false, status: 403 }], [{ userId: "u", email: "a@b", role: "admin" }, { ok: true, email: "a@b" }]]
    for (const [rol, esperado] of casos) {
      vi.doMock("@/lib/supabase-session", () => ({ getCurrentRole: async () => rol }))
      const { exigirAdmin } = await import("@/lib/admin-guard")
      expect(await exigirAdmin()).toEqual(esperado)
      vi.resetModules()
    }
    vi.doMock("@/lib/supabase-session", () => ({ getCurrentRole: async () => { throw new Error("sin cookies") } }))
    const { exigirAdmin } = await import("@/lib/admin-guard")
    expect(await exigirAdmin()).toEqual({ ok: false, status: 401 })
    vi.doUnmock("@/lib/supabase-session")
  })
})
