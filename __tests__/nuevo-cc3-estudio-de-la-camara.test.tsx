// @vitest-environment node
/**
 * EL ESTUDIO DE LA CÁMARA (CC3 · 05-nov · GO de Lenovo) · la puerta del tablero y el panel. US$ 0, sin red, sin base.
 *  · la puerta solo deja pasar 5 rutas, pone la llave interna en el servidor y no reenvía parámetros ajenos;
 *  · el botón Crear solo se enciende con cliente, texto, proveedor conectado y COTIZACIÓN; sin precio no crea; sin tope;
 *  · el pedido lleva solo los campos de su tipo; la foto no viaja para cotizar;
 *  · la cámara es una zona de la escena de marketing que abre el estudio.
 */
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PanelEstudio } from "@/components/nuevo/PanelEstudio"
import { CAMARA } from "@/components/nuevo/EscenaViva"
import { alEstudio, cuerpoDeCotizacion, cuerpoDelPedido, dolares, estadoDelBoton, RUTAS_DEL_ESTUDIO, textoListo, type Catalogo, type Pieza } from "@/lib/estudio"

const CLIENTE = "a0000000-0000-4000-8000-0000000000e1"
type Llamada = { url: string; init?: RequestInit }
const plataforma = (status = 200, cuerpo: unknown = { ok: true }, comoTexto = false) => {
  const llamadas: Llamada[] = []
  const f = (async (u: RequestInfo | URL, init?: RequestInit) => { llamadas.push({ url: String(u), init }); return new Response(comoTexto ? "<html>404</html>" : JSON.stringify(cuerpo), { status }) }) as typeof fetch
  return { f, llamadas }
}

describe("la puerta del estudio", () => {
  it("solo 5 rutas, cada una con su método", async () => {
    expect(Object.keys(RUTAS_DEL_ESTUDIO).sort()).toEqual(["catalogo", "cotizar", "crear", "pieza", "piezas"])
    const p = plataforma()
    expect((await alEstudio("../agents/run-sdk", "POST", "", "{}", { fetch: p.f, llave: "k" })).status).toBe(404)
    expect((await alEstudio("crear", "GET", "", null, { fetch: p.f, llave: "k" })).status).toBe(404)
    expect(p.llamadas).toHaveLength(0)
  })
  it("pone la llave interna en el servidor y no reenvía parámetros ajenos", async () => {
    const p = plataforma()
    await alEstudio("piezas", "GET", `?client_id=${CLIENTE}&tipo=3d&url=https://ataque.com`, null, { fetch: p.f, llave: "k-interna", base: "https://plataforma.test/" })
    expect(p.llamadas[0].url).toBe(`https://plataforma.test/api/estudio/piezas?client_id=${CLIENTE}&tipo=3d`)
    expect((p.llamadas[0].init!.headers as Record<string, string>)["x-api-key"]).toBe("k-interna")
  })
  it("sin llave no llama; ruta no publicada en la plataforma = «todavía no disponible», nunca simulada", async () => {
    const p = plataforma()
    expect((await alEstudio("catalogo", "GET", "", null, { fetch: p.f, llave: "" })).status).toBe(500)
    expect(p.llamadas).toHaveLength(0)
    const q = plataforma(404, null, true)
    const r = await alEstudio("catalogo", "GET", "", null, { fetch: q.f, llave: "k" })
    expect(r.status).toBe(501)
    expect((r.cuerpo as { error: string }).error).toBe("todavia_no_disponible")
  })
  it("los errores de la plataforma se pasan tal cual (p. ej. un 409)", async () => {
    const p = plataforma(409, { error: "x" })
    expect((await alEstudio("crear", "POST", "", "{}", { fetch: p.f, llave: "k" })).status).toBe(409)
  })
  it("la puerta exige la sesión del administrador", () => {
    const ruta = readFileSync("app/api/estudio/[ruta]/route.ts", "utf8")
    expect(ruta.match(/await exigirAdmin\(\)/g)).toHaveLength(2)
  })
})

describe("el botón Crear", () => {
  const listo = { clienteId: CLIENTE, textoListo: true, listo: true, cotizacion: { total_usd: 0.3138, partes: [] }, cotizando: false, sinPrecio: null, creando: false }
  it("con todo listo se enciende y muestra el costo antes de crear", () => {
    expect(estadoDelBoton(listo)).toEqual({ habilitado: true, costo: "≈ US$ 0,31" })
  })
  it("sin cotización, sin precio, sin cliente, sin texto o sin proveedor, no se enciende", () => {
    expect(estadoDelBoton({ ...listo, cotizacion: null }).habilitado).toBe(false)
    expect(estadoDelBoton({ ...listo, cotizacion: null, sinPrecio: "no_se_pudo_cotizar" })).toEqual({ habilitado: false, costo: "sin precio: no se puede crear" })
    expect(estadoDelBoton({ ...listo, clienteId: null }).habilitado).toBe(false)
    expect(estadoDelBoton({ ...listo, textoListo: false }).habilitado).toBe(false)
    expect(estadoDelBoton({ ...listo, listo: false })).toEqual({ habilitado: false, costo: "proveedor no conectado todavía" })
    expect(estadoDelBoton({ ...listo, listo: null }).habilitado).toBe(false)
    expect(estadoDelBoton({ ...listo, cotizando: true }).habilitado).toBe(false)
    expect(estadoDelBoton({ ...listo, creando: true }).habilitado).toBe(false)
  })
  it("sin tope: un costo alto no apaga el botón (firma de Emilio)", () => {
    expect(estadoDelBoton({ ...listo, cotizacion: { total_usd: 250, partes: [] } }).habilitado).toBe(true)
  })
  it("en 3D con foto el texto sobra; en lo demás hace falta", () => {
    expect(textoListo("3d", "", true)).toBe(true)
    expect(textoListo("imagen", "", true)).toBe(false)
    expect(textoListo("video", "ol", false)).toBe(false)
  })
  it("los centavos de una imagen se ven", () => {
    expect(dolares(0.0138)).toBe("US$ 0,014")
    expect(dolares(0.4)).toBe("US$ 0,40")
  })
})

describe("el pedido", () => {
  const o = { formato: "4:5", modelo3d: "meshy-6", calidad: "alta" as const, modeloVideo: "bytedance/seedance-2.0", segundos: 8, resolucion: "1080p" }
  it("lleva solo los campos de su tipo", () => {
    expect(cuerpoDelPedido(CLIENTE, "3d", "taza", o, null)).toEqual({ client_id: CLIENTE, tipo: "3d", prompt: "taza", modelo: "meshy-6", calidad: "alta" })
    expect(cuerpoDelPedido(CLIENTE, "video", "ola", o, null)).toEqual({ client_id: CLIENTE, tipo: "video", prompt: "ola", modelo: "bytedance/seedance-2.0", formato: "9:16", segundos: 8, resolucion: "1080p" })
    expect(cuerpoDelPedido(CLIENTE, "imagen", "x", { ...o, formato: "16:9" }, { pieza_id: CLIENTE })).toEqual({ client_id: CLIENTE, tipo: "imagen", prompt: "x", formato: "16:9", foto_pieza_id: CLIENTE })
  })
  it("la foto no viaja para cotizar, pero se dice que la hay", () => {
    const c = cuerpoDeCotizacion(cuerpoDelPedido(CLIENTE, "3d", "", o, { b64: "AAAA" }))
    expect(c).not.toHaveProperty("foto_b64")
    expect(c.con_foto).toBe(true)
    expect(c.prompt).toBe("cotización")
  })
})

describe("el panel", () => {
  const catalogo = { listos: { imagen: true, video: true, "3d": true, almacen: true }, imagen: { modelo: "m", formatos: ["1:1", "9:16", "16:9"], precio: {} }, video: { modelos: [{ id: "bytedance/seedance-2.5", nombre: "Seedance 2.5" }], formatos: ["9:16"], resoluciones: ["720p"], segundos: { min: 4, max: 15 } }, "3d": { modelos: [{ id: "tripo-h3.1", nombre: "Tripo H3.1", nota: "rápido", precio: { normal: 0.3, alta: 0.4 } }], imagen_previa_usd: 0.0138 } } satisfies Catalogo
  const pieza = (x: Partial<Pieza>): Pieza => ({ id: "p1", client_id: CLIENTE, tipo: "3d", estado: "lista", paso: null, prompt: "termo", modelo: "tripo-h3.1", parametros: {}, foto_partida_url: "https://a/p.png", costo_estimado_usd: 0.3138, costo_usd: 0.31327, archivo_url: "https://a/m.glb", archivo_tipo: "glb", miniatura_url: null, aviso: null, error: null, creado_en: "2026-11-05T20:00:00Z", terminado_en: null, ...x })
  const pintar = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(PanelEstudio, { onCerrar: () => undefined, catalogoInicial: catalogo, clientesIniciales: [{ id: CLIENTE, nombre: "Náufrago" }], ...props }))
  it("abre con las tres pestañas, el texto, la imagen de partida y Crear apagado hasta cotizar", () => {
    const h = pintar({ piezasIniciales: [] })
    for (const t of ["imagen", "video", "3d"]) expect(h).toContain(`data-tab="${t}"`)
    expect(h).toContain("data-texto")
    expect(h).toContain("Imagen de partida")
    expect(h).toMatch(/data-crear="true" disabled=""/)
    expect(h).toContain("Todavía no hay nada creado")
  })
  it("la galería muestra cada pieza con su tipo y su costo", () => {
    const h = pintar({ piezasIniciales: [pieza({}), pieza({ id: "p2", tipo: "video", estado: "creando", archivo_url: null })] })
    expect(h).toContain('data-pieza="p1"')
    expect(h).toContain('data-estado="creando"')
    expect(h).toContain("US$ 0,31")
  })
  it("una pieza 3D abierta: visor que gira con mouse o dedo, descargar, y lo que costó", () => {
    const h = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1" })
    expect(h).toContain("Arrastra con el mouse o el dedo para girarlo")
    expect(h).toContain("Descargar")
    expect(h).toContain("anotado en el libro")
    expect(h).not.toContain("Usar en una pieza")
  })
})

describe("la cámara en la escena", () => {
  it("es una zona de la oficina de marketing que abre el estudio", () => {
    expect(CAMARA.clave).toBe("camara")
    expect(CAMARA.forma.split(" ").length).toBeGreaterThanOrEqual(6)
    const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(escena).toMatch(/data-zona=\{CAMARA\.clave\}[^>]*\n\s*onClick=\{\(e\) => \{ e\.stopPropagation\(\); setEstudio\(true\) \}\}/)
    expect(escena).toMatch(/estudio && montado && fase !== "cerrado" && depto === "marketing" && createPortal\(<PanelEstudio/)
  })
})
