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
import { alEstudio, PISTA_DE_TEXTO, LARGO_MAXIMO_CENTRADO, claseDelCentrado, claseDelCosto, crearCentrado, alternarMovimiento, buscarMovimientos, clipsDe, cotizarAnimacion, cuerpoDeAnimacion, esAnimable, estadoDeAnimar, nombreDelMovimiento, respuestaDeAnimar, claveNueva, cuerpoDeCotizacion, cuerpoDeCreacion, cuerpoDelPedido, dolares, estadoDelBoton, piezasDelCliente, rutaDeGaleria, RUTAS_DEL_ESTUDIO, tardaMasDeLoNormal, textoListo, type Catalogo, type Pieza } from "@/lib/estudio"
import { clientesDelEstudio } from "@/lib/estudio-clientes"

const CLIENTE = "a0000000-0000-4000-8000-0000000000e1"
type Llamada = { url: string; init?: RequestInit }
const plataforma = (status = 200, cuerpo: unknown = { ok: true }, comoTexto = false) => {
  const llamadas: Llamada[] = []
  const f = (async (u: RequestInfo | URL, init?: RequestInit) => { llamadas.push({ url: String(u), init }); return new Response(comoTexto ? "<html>404</html>" : JSON.stringify(cuerpo), { status }) }) as typeof fetch
  return { f, llamadas }
}

describe("la puerta del estudio", () => {
  it("solo 9 rutas, cada una con su método (09-nov: la papelera suma 3)", async () => {
    expect(Object.keys(RUTAS_DEL_ESTUDIO).sort()).toEqual(["animar", "catalogo", "cotizar", "crear", "mover-a-papelera", "papelera", "pieza", "piezas", "recuperar"])
    expect([RUTAS_DEL_ESTUDIO.papelera, RUTAS_DEL_ESTUDIO["mover-a-papelera"], RUTAS_DEL_ESTUDIO.recuperar]).toEqual(["GET", "POST", "POST"])
    expect(RUTAS_DEL_ESTUDIO.animar).toBe("POST")
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
  it("abre con las tres pestañas, el texto, «Subir» dentro de la caja y Crear apagado hasta cotizar", () => {
    const h = pintar({ piezasIniciales: [] })
    for (const t of ["imagen", "video", "3d"]) expect(h).toContain(`data-tab="${t}"`)
    expect(h).toContain("data-texto")
    expect(h).toMatch(/data-subir="true"[^>]*>\+ Subir</)
    expect(h).toContain("Hasta 6 imágenes · png, jpg o webp")
    expect(h).toMatch(/data-crear="true" disabled=""/)
    expect(h).toContain("Todavía no hay nada creado")
  })
  it("en escritorio «Crear» va centrado y la pista «escribe qué quieres» no se ve (en el teléfono sigue)", () => {
    const h = pintar({ piezasIniciales: [] })
    const boton = h.match(/<button[^>]*data-crear="true"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? ""
    expect(boton).toMatch(/class="[^"]*\bmd:justify-center\b/)
    const costo = boton.match(/<span data-costo="true" class="([^"]*)">([^<]*)</)
    expect(costo?.[2]).toBe("elige el cliente")
    expect(costo?.[1]).toBe(claseDelCosto("elige el cliente"))
    expect(claseDelCosto("elige el cliente").split(" ")).toEqual(expect.arrayContaining(["md:absolute", "md:right-4"]))
    expect(claseDelCosto("elige el cliente").split(" ")).not.toContain("md:hidden")
    expect(claseDelCosto(PISTA_DE_TEXTO).split(" ")).toContain("md:hidden")
    expect(claseDelCosto(PISTA_DE_TEXTO).split(" ")).not.toContain("hidden")
    expect(estadoDelBoton({ clienteId: CLIENTE, textoListo: false, listo: true, cotizacion: null, cotizando: false, sinPrecio: null, creando: false }).costo).toBe(PISTA_DE_TEXTO)
    // centrado: el botón es la referencia del costo a la derecha (sin «relative» el costo se va a otra esquina)
    expect(claseDelCentrado("≈ US$ 0,31").split(" ")).toEqual(["relative", "md:justify-center"])
  })
  it("con un aviso largo «Crear» vuelve a la izquierda y el aviso no lo tapa (CC6 #304)", () => {
    const base = { clienteId: CLIENTE, textoListo: true, cotizacion: null, cotizando: false, creando: false }
    for (const aviso of [estadoDelBoton({ ...base, listo: false, sinPrecio: null }).costo, estadoDelBoton({ ...base, listo: true, sinPrecio: "no_se_pudo_cotizar" }).costo]) {
      expect(aviso.length).toBeGreaterThan(LARGO_MAXIMO_CENTRADO)
      expect(crearCentrado(aviso)).toBe(false)
      expect(claseDelCentrado(aviso)).toBe("")
      expect(claseDelCosto(aviso).split(" ")).not.toEqual(expect.arrayContaining(["md:absolute"]))
      expect(claseDelCosto(aviso).split(" ")).not.toContain("md:hidden")
    }
    for (const corto of ["≈ US$ 0,014", "≈ US$ 12,50", "cotizando…", "elige el cliente", PISTA_DE_TEXTO]) expect(crearCentrado(corto)).toBe(true)
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

describe("lo que pidió CC6 en #289", () => {
  const P = (id: string, client_id: string): Pieza => ({ id, client_id, tipo: "imagen", estado: "lista", paso: null, prompt: "x", modelo: "m", parametros: {}, foto_partida_url: null, costo_estimado_usd: 0.01, costo_usd: 0.01, archivo_url: "https://a/x.png", archivo_tipo: "image", miniatura_url: null, aviso: null, error: null, creado_en: "2026-11-05T20:00:00Z", terminado_en: null })
  const OTRO = "b0000000-0000-4000-8000-0000000000e2"
  const panel = readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")
  it("cada clic manda su propia clave: dos creaciones nunca comparten clave", () => {
    const a = cuerpoDeCreacion({ tipo: "imagen" }), b = cuerpoDeCreacion({ tipo: "imagen" })
    expect(a.clave).toMatch(/^estudio-[A-Za-z0-9_-]{8,}$/)
    expect(a.clave).not.toBe(b.clave)
    expect(claveNueva()).not.toBe(claveNueva())
  })
  it("crear nunca sale sin clave: el panel arma el cuerpo con cuerpoDeCreacion", () => {
    expect(cuerpoDeCreacion({ tipo: "3d" }, "estudio-fija-123")).toEqual({ tipo: "3d", clave: "estudio-fija-123" })
    expect(panel).toContain('fetchImpl("/api/estudio/crear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoDeCreacion(cuerpo)) })')
    // el cuerpo es el pedido; con varias imágenes, el mismo pedido con las subidas achicadas otra vez
    expect(panel).toContain("let cuerpo = pedido")
    expect(panel).toContain("cuerpo = { ...pedido, fotos }")
  })
  it("la galería se pide siempre por cliente y solo muestra lo del cliente a la vista", () => {
    expect(rutaDeGaleria(CLIENTE)).toBe(`/api/estudio/piezas?client_id=${CLIENTE}`)
    expect(panel).toContain("fetchImpl(rutaDeGaleria(id)")
    // una respuesta tardía de otro cliente no entra; al reemplazar no queda nada del anterior
    expect(piezasDelCliente(CLIENTE, [P("a", CLIENTE)], [P("b", OTRO)], true)).toEqual([])
    expect(piezasDelCliente(CLIENTE, [P("a", CLIENTE)], [P("c", CLIENTE)], false).map((p) => p.id)).toEqual(["c", "a"])
    expect(piezasDelCliente(CLIENTE, [P("a", CLIENTE)], [P("b", OTRO)], false).map((p) => p.id)).toEqual(["a"])
    expect(piezasDelCliente(null, [], [P("a", CLIENTE)], true)).toEqual([])
    // al cambiar de cliente la galería se vacía en el acto, y la pieza creada solo entra si es del cliente a la vista
    expect(panel).toContain("setPiezas([]); setAbierta(null)")
    expect(panel).toContain("if (j.pieza.client_id !== clienteVisto.current) return")
    expect(panel).toContain("if (j?.ok && clienteVisto.current === id)")
  })
  it("un cliente dado de baja o sin nombre no aparece en la lista (no se le puede crear ni cobrar)", () => {
    expect(clientesDelEstudio([
      { id: "1", name: "Náufrago", status: "active" }, { id: "2", name: "Viejo", status: "churned" },
      { id: "3", name: "Otro", status: "Baja" }, { id: "4", name: null, status: "active" }, { id: "5", name: "Sin estado", status: null },
    ])).toEqual([{ id: "1", nombre: "Náufrago" }, { id: "5", nombre: "Sin estado" }])
    expect(readFileSync("app/api/estudio/[ruta]/route.ts", "utf8")).toContain("clientesDelEstudio((r.data ?? []) as FilaDeCliente[])")
  })
  it("una pieza que ya estaba (misma clave) no aparece dos veces: queda una, al frente y con lo último", () => {
    const vieja = { ...P("a", CLIENTE), estado: "creando" as const }
    const nueva = { ...P("a", CLIENTE), estado: "lista" as const }
    const r = piezasDelCliente(CLIENTE, [P("z", CLIENTE), vieja], [nueva], false)
    expect(r.map((p) => p.id)).toEqual(["a", "z"])
    expect(r[0].estado).toBe("lista")
    expect(panel).toContain("setPiezas((ps) => piezasDelCliente(clienteVisto.current, ps, [j.pieza], false))")
  })
  it("el tiempo normal del video y del 3D es 20 min (imagen 5): antes no avisa, después sí", () => {
    const t0 = Date.parse("2026-11-05T20:00:00Z")
    for (const tipo of ["video", "3d"] as const) {
      const p = { tipo, estado: "creando" as const, creado_en: "2026-11-05T20:00:00Z" }
      expect(tardaMasDeLoNormal(p, t0 + 19 * 60_000)).toBe(false)
      expect(tardaMasDeLoNormal(p, t0 + 21 * 60_000)).toBe(true)
    }
    const img = { tipo: "imagen" as const, estado: "creando" as const, creado_en: "2026-11-05T20:00:00Z" }
    expect(tardaMasDeLoNormal(img, t0 + 4 * 60_000)).toBe(false)
  })
  it("la vista grande de una pieza colgada dice «tarda más de lo normal», no «Creando…»", () => {
    const vieja = { ...P("v1", CLIENTE), tipo: "video" as const, estado: "creando" as const, archivo_url: null, creado_en: new Date(Date.now() - 60 * 60_000).toISOString() }
    const h = renderToStaticMarkup(createElement(PanelEstudio, { onCerrar: () => undefined, clientesIniciales: [{ id: CLIENTE, nombre: "Náufrago" }], piezasIniciales: [vieja], abiertaInicial: "v1" }))
    expect(h).toContain("data-tarda")
    expect(h).toContain("Tarda más de lo normal.")
    expect(h).not.toContain(">Creando…<")
    const reciente = { ...vieja, creado_en: new Date().toISOString() }
    const h2 = renderToStaticMarkup(createElement(PanelEstudio, { onCerrar: () => undefined, clientesIniciales: [{ id: CLIENTE, nombre: "Náufrago" }], piezasIniciales: [reciente], abiertaInicial: "v1" }))
    expect(h2).not.toContain("data-tarda")
    expect(h2).toContain(">Creando…<")
  })
  it("una pieza que tarda mucho más de lo normal lo dice, en vez de «Creando…» sin fin", () => {
    const t0 = Date.parse("2026-11-05T20:00:00Z")
    const p = { tipo: "3d" as const, estado: "creando" as const, creado_en: "2026-11-05T20:00:00Z" }
    expect(tardaMasDeLoNormal(p, t0 + 19 * 60_000)).toBe(false)
    expect(tardaMasDeLoNormal(p, t0 + 21 * 60_000)).toBe(true)
    expect(tardaMasDeLoNormal({ ...p, tipo: "imagen" }, t0 + 6 * 60_000)).toBe(true)
    expect(tardaMasDeLoNormal({ ...p, estado: "lista" }, t0 + 99 * 60_000)).toBe(false)
    expect(panel).toContain("Tarda más de lo normal.")
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
  it("GO 09-nov (boceto aprobado por Emilio): sin el óvalo naranja alrededor de la cámara, en ningún estado; quedan la luz suave y el rótulo ESTUDIO", () => {
    const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    // el grupo de la cámara, de su <g> a su </g>
    const inicio = escena.indexOf("data-zona={CAMARA.clave}")
    const grupo = escena.slice(inicio, escena.indexOf("</g>", inicio))
    expect(inicio).toBeGreaterThan(0)
    // la luz sigue (relleno suave) pero sin contorno
    const luz = /<ellipse className="nv-camara-halo"[^>]*\/>/.exec(grupo)?.[0] ?? ""
    expect(luz).toContain('fill="url(#nv-camara-luz)"')
    expect(luz).toContain('stroke="none"')
    expect(luz).not.toMatch(/strokeWidth|strokeOpacity|stroke="#/)
    // ninguna otra figura con trazo dentro del grupo: solo el rótulo lleva trazo
    const conTrazo = grupo.match(/<(ellipse|circle|rect|path|polygon|line)\b[^>]*stroke="(?!none)[^"]*"/g) ?? []
    expect(conTrazo).toEqual([])
    expect(grupo).toMatch(/<text className="nv-rotulo" x=\{CAMARA\.rotulo\.x\}[\s\S]*\{CAMARA\.rotulo\.texto\}/)
    expect(CAMARA.rotulo.texto).toBe("ESTUDIO")
    // tampoco al pasar el ratón o con el foco: la regla de la luz no tiene trazo y el grupo no tiene contorno de foco
    expect(escena).toMatch(/\.nv-camara-halo\{[^}]*stroke:none/)
    expect(escena).not.toMatch(/\.nv-tablero:(hover|focus-visible)[^{]*\.nv-camara-halo\{[^}]*stroke:(?!none)/)
    expect(escena).toMatch(/\.nv-tablero\{cursor:pointer;outline:none\}/)
  })
})

describe("animar un modelo 3D (GO 06-nov)", () => {
  const BIB = [[0, "Idle", "diario"], [28, "Big_Wave_Hello", "diario"], [30, "Casual_Walk", "caminar y correr"], [14, "Run_02", "caminar y correr"], [591, "Hip_Hop_Dance", "baile"], [22, "Jump_Over", "cuerpo"]] as const
  const animar = { precio: { base: 0.2, por_movimiento: 0.12 }, maximo: 10, comunes: [{ id: 0, nombre: "Quieto" }, { id: 30, nombre: "Caminar" }, { id: 14, nombre: "Correr" }, { id: 28, nombre: "Saludar" }, { id: 591, nombre: "Bailar" }], biblioteca: [...BIB] }
  const catalogo = { listos: { imagen: true, video: true, "3d": true, almacen: true, animar: true }, imagen: { modelo: "m", formatos: ["1:1"], precio: {} }, video: { modelos: [], formatos: ["9:16"], resoluciones: ["720p"], segundos: { min: 4, max: 15 } }, "3d": { modelos: [], imagen_previa_usd: 0.0138 }, animar } satisfies Catalogo
  const pieza = (x: Partial<Pieza>): Pieza => ({ id: "p1", client_id: CLIENTE, tipo: "3d", estado: "lista", paso: null, prompt: "surfista", modelo: "tripo-h3.1", parametros: {}, foto_partida_url: null, costo_estimado_usd: 0.3, costo_usd: 0.3, archivo_url: "https://a/m.glb", archivo_tipo: "glb", miniatura_url: "https://a/m.png", aviso: null, error: null, creado_en: "2026-11-06T10:00:00Z", terminado_en: null, ...x })
  const animada = (x: Partial<Pieza> = {}) => pieza({ id: "p9", modelo: "meshy-animar", prompt: "surfista · animado: Caminar, Saludar", parametros: { origen_pieza_id: "p1", archivos: [{ action_id: 30, nombre: "Casual_Walk", glb: "https://a/w.glb", fbx: "https://a/w.fbx" }, { action_id: 28, nombre: "Big_Wave_Hello", glb: "https://a/h.glb", fbx: "https://a/h.fbx" }] }, archivo_url: "https://a/w.glb", costo_usd: 0.44, ...x })
  const pintar = (props: Record<string, unknown>, cat: Catalogo = catalogo) => renderToStaticMarkup(createElement(PanelEstudio, { onCerrar: () => undefined, catalogoInicial: cat, clientesIniciales: [{ id: CLIENTE, nombre: "Náufrago" }], ...props }))

  it("el costo es esqueleto 0,20 + 0,12 por movimiento, igual que la plataforma", () => {
    expect(cotizarAnimacion(animar.precio, 1)).toEqual({ total_usd: 0.32, partes: [{ que: "esqueleto", usd: 0.2 }, { que: "1 movimiento", usd: 0.12 }] })
    expect(cotizarAnimacion(animar.precio, 3).total_usd).toBe(0.56)
    expect(cotizarAnimacion(animar.precio, 2).partes[1].que).toBe("2 movimientos")
  })
  it("se anima un 3D listo en GLB que no sea ya una animación", () => {
    expect(esAnimable(pieza({}))).toBe(true)
    expect(esAnimable(pieza({ estado: "creando" }))).toBe(false)
    expect(esAnimable(pieza({ archivo_tipo: "obj" }))).toBe(false)
    expect(esAnimable(pieza({ tipo: "imagen" }))).toBe(false)
    expect(esAnimable(animada())).toBe(false)
  })
  it("marcar y desmarcar un movimiento, sin pasar del máximo", () => {
    expect(alternarMovimiento([], 0, 2)).toEqual([0])
    expect(alternarMovimiento([0, 28], 0, 2)).toEqual([28])
    expect(alternarMovimiento([0, 28], 30, 2)).toEqual([0, 28])
    expect(alternarMovimiento([0], 28, 2)).toEqual([0, 28])
  })
  it("el buscador encuentra por nombre (guion bajo = espacio, sin mayúsculas ni tildes) o por grupo; menos de 2 letras no muestra nada", () => {
    expect(buscarMovimientos(BIB, "wave hello").map((m) => m[0])).toEqual([28])
    expect(buscarMovimientos(BIB, "HIP_HOP").map((m) => m[0])).toEqual([591])
    expect(buscarMovimientos(BIB, "báile").map((m) => m[0])).toEqual([591])
    expect(buscarMovimientos(BIB, " r ")).toEqual([])
    expect(buscarMovimientos(BIB, "a", 40)).toEqual([])
    expect(buscarMovimientos(BIB, "ca", 1)).toHaveLength(1)
    expect(buscarMovimientos(BIB, "ca").map((m) => m[0])).toEqual([30, 14])
  })
  it("los nombres: los comunes en español, los demás como en la biblioteca", () => {
    expect(nombreDelMovimiento(animar, 28)).toBe("Saludar")
    expect(nombreDelMovimiento(animar, 22)).toBe("Jump Over")
    expect(nombreDelMovimiento(animar, 999)).toBe("#999")
    expect(nombreDelMovimiento(undefined, 0)).toBe("#0")
  })
  it("los movimientos guardados salen solo de una animación", () => {
    expect(clipsDe(animada()).map((c) => c.action_id)).toEqual([30, 28])
    expect(clipsDe(pieza({ parametros: { archivos: [{ action_id: 1 }] } }))).toEqual([])
    expect(clipsDe(animada({ parametros: {} }))).toEqual([])
    expect(clipsDe(animada({ parametros: { archivos: [null, "x", { action_id: 5, glb: "g", fbx: null, nombre: "n" }] } })).map((c) => c.action_id)).toEqual([5])
  })
  it("el pedido lleva cliente, modelo de origen, movimientos y una clave nueva por clic", () => {
    const a = cuerpoDeAnimacion(CLIENTE, "p1", [0, 28])
    const b = cuerpoDeAnimacion(CLIENTE, "p1", [0, 28])
    expect(Object.keys(a).sort()).toEqual(["clave", "client_id", "movimientos", "origen_pieza_id"])
    expect(a).toMatchObject({ client_id: CLIENTE, origen_pieza_id: "p1", movimientos: [0, 28] })
    expect(a.clave).toMatch(/^[A-Za-z0-9_-]{8,80}$/)
    expect(a.clave).not.toBe(b.clave)
  })
  it("un modelo 3D listo muestra «Animar»; sin la función en la plataforma, no", () => {
    expect(pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1" })).toContain("data-animar=")
    const sin = { ...catalogo, listos: { ...catalogo.listos, animar: false } }
    expect(pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1" }, sin)).not.toContain("data-animar=")
    const { animar: _x, ...viejo } = catalogo
    void _x
    expect(pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1" }, viejo as Catalogo)).not.toContain("data-animar=")
    expect(pintar({ piezasIniciales: [pieza({ estado: "creando", archivo_url: null })], abiertaInicial: "p1" })).not.toContain("data-animar=")
  })
  it("el cajón: comunes primero, buscador, costo a la vista y el botón ámbar a la derecha", () => {
    const h = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1", animarInicial: [0, 28] })
    const comunes = [...h.matchAll(/data-movimiento="(\d+)"/g)].map((m) => m[1])
    expect(comunes).toEqual(["0", "30", "14", "28", "591"])
    expect(h).toMatch(/data-movimiento="0" class="es-chip" aria-pressed="true"/)
    expect(h).toMatch(/data-movimiento="30" class="es-chip" aria-pressed="false"/)
    expect(h).toContain("data-buscar")
    expect(h).toContain("6 movimientos")
    expect(h).toContain("Elegidos (2 de 10)")
    expect(h).toContain("Quieto, Saludar")
    expect(h).toMatch(/data-costo-animar="true"[^>]*>US\$ 0,44</)
    expect(h).toContain("esqueleto US$ 0,20 + 2 movimientos US$ 0,24")
    expect(h).toMatch(/class="flex items-center justify-end gap-3"><span data-desglose-animar/)
    // sin cliente elegido todavía (lo fija el navegador) el botón espera; encendido es ámbar
    expect(h).toMatch(/data-animar-crear="true" disabled=""/)
    expect(readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")).toContain("style={{ background: listoParaAnimar ? AMBAR : \"#3a2a1a\"")
    expect(h).toContain("no se cobra")
  })
  it("sin movimientos el botón está apagado y lo dice; al tope, los no elegidos se apagan", () => {
    const h = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1", animarInicial: [] })
    expect(h).toMatch(/data-animar-crear="true" disabled=""/)
    expect(h).toContain("elige un movimiento")
    const tope = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1", animarInicial: [0, 30, 14, 28, 1, 2, 3, 4, 5, 6] })
    expect(tope).toMatch(/data-movimiento="0" class="es-chip" aria-pressed="true">/)
    expect(tope).toMatch(/data-movimiento="591" class="es-chip" aria-pressed="false" disabled="">/)
    const libre = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1", animarInicial: [0, 30, 14, 28, 1, 2, 3, 4, 5] })
    expect(libre).toMatch(/data-movimiento="591" class="es-chip" aria-pressed="false">/)
  })
  it("una animación abierta: se dice animada, se elige el movimiento, se baja en GLB y FBX, y no se re-anima", () => {
    const h = pintar({ piezasIniciales: [animada()], abiertaInicial: "p9" })
    expect(h).toContain("3D · animado")
    expect(h).toContain("data-clips")
    expect(h).toMatch(/aria-pressed="true">Caminar</)
    expect(h).toMatch(/aria-pressed="false">Saludar</)
    expect(h).toMatch(/data-bajar="GLB" href="https:\/\/a\/w.glb"/)
    expect(h).toMatch(/data-bajar="FBX" href="https:\/\/a\/w.fbx"/)
    expect(h).not.toContain(">Descargar<")
    expect(h).not.toContain("data-animar=")
    expect(h).not.toContain("Crear otra versión")
    expect(h).not.toContain("Arrastra con el mouse")
    expect(h).toContain("US$ 0,44")
  })
  it("una animación de un solo movimiento no muestra el selector, pero sí las dos descargas", () => {
    const uno = animada({ parametros: { archivos: [{ action_id: 0, nombre: "Idle", glb: "https://a/i.glb", fbx: "https://a/i.fbx" }] } })
    const h = pintar({ piezasIniciales: [uno], abiertaInicial: "p9" })
    expect(h).not.toContain("data-clips")
    expect(h).toContain('data-bajar="GLB"')
    expect(h).toContain('data-bajar="FBX"')
  })
  it("en la galería una animación se marca «Animado»", () => {
    const h = pintar({ piezasIniciales: [animada(), pieza({})] })
    expect(h).toContain(">Animado<")
    expect(h).toContain(">3D<")
  })
  it("una animación en curso dice su paso, sin el de la imagen de partida", () => {
    const h = pintar({ piezasIniciales: [animada({ estado: "creando", archivo_url: null, parametros: {} })], abiertaInicial: "p9" })
    expect(h).toContain("Poniendo esqueleto y movimientos")
    expect(h).toContain("≈ 1-3 min")
    expect(h).not.toContain("Creando la imagen")
    expect(h).not.toContain("Imagen de partida lista")
  })
  it("la animación que falla por no ser figura humana muestra el aviso claro y lo cobrado (0)", () => {
    const h = pintar({ piezasIniciales: [animada({ estado: "fallida", archivo_url: null, parametros: {}, costo_usd: 0, error: "Este modelo no parece una figura humana con brazos y piernas definidos, así que no se puede animar. No se cobró." })], abiertaInicial: "p9" })
    expect(h).toContain("no parece una figura humana")
    expect(h).toContain("Costó <b class=\"text-zinc-200\">US$ 0</b>")
  })
  it("el botón Animar: se enciende solo con cliente, conectado y al menos un movimiento; sin tope", () => {
    const cot = cotizarAnimacion(animar.precio, 2)
    const listo = { clienteId: CLIENTE, conectado: true, cotizacion: cot, enviando: false }
    expect(estadoDeAnimar(listo)).toEqual({ habilitado: true, costo: "US$ 0,44" })
    expect(estadoDeAnimar({ ...listo, cotizacion: null })).toEqual({ habilitado: false, costo: "elige un movimiento" })
    expect(estadoDeAnimar({ ...listo, clienteId: null }).habilitado).toBe(false)
    expect(estadoDeAnimar({ ...listo, conectado: false }).habilitado).toBe(false)
    expect(estadoDeAnimar({ ...listo, enviando: true }).habilitado).toBe(false)
    expect(estadoDeAnimar({ ...listo, cotizacion: cotizarAnimacion(animar.precio, 10) })).toEqual({ habilitado: true, costo: "US$ 1,40" })
    const panel = readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")
    expect(panel).toContain("estadoDeAnimar({ clienteId, conectado: puedeAnimar, cotizacion: cotizacionAnimar, enviando })")
  })
  it("sobre una animación abierta el cajón de animar nunca aparece", () => {
    expect(pintar({ piezasIniciales: [animada()], abiertaInicial: "p9", animarInicial: [0] })).not.toContain("data-cajon-animar")
    expect(pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1", animarInicial: [0] })).toContain("data-cajon-animar")
  })
  it("el movimiento elegido es el que se ve, se marca y se descarga", () => {
    const h = pintar({ piezasIniciales: [animada()], abiertaInicial: "p9", clipInicial: 1 })
    expect(h).toMatch(/aria-pressed="false">Caminar</)
    expect(h).toMatch(/aria-pressed="true">Saludar</)
    expect(h).toMatch(/data-bajar="GLB" href="https:\/\/a\/h.glb"/)
    expect(h).toMatch(/data-bajar="FBX" href="https:\/\/a\/h.fbx"/)
  })
  it("un archivo guardado sin número de movimiento no cuenta como movimiento", () => {
    expect(clipsDe(animada({ parametros: { archivos: [{ glb: "g", fbx: "f", nombre: "n" }, { action_id: "3", glb: "g" }] } }))).toEqual([])
  })
  it("la respuesta de animar: la pieza de otro cliente no entra a la galería a la vista (CC6 #292)", () => {
    const suya = animada()
    expect(respuestaDeAnimar({ ok: true, pieza: suya }, 201, CLIENTE)).toEqual({ pieza: suya })
    expect(respuestaDeAnimar({ ok: true, pieza: { ...suya, client_id: "b0000000-0000-4000-8000-0000000000e2" } }, 201, CLIENTE)).toEqual({ otroCliente: true })
    expect(respuestaDeAnimar({ ok: true, pieza: suya }, 201, null)).toEqual({ otroCliente: true })
    const panel = readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")
    expect(panel).toContain("const x = respuestaDeAnimar(await leerJson<{ pieza: Pieza }>(r), r.status, clienteVisto.current)")
    expect(panel).toContain('if ("otroCliente" in x) return')
  })
  it("si la plataforma rechaza la animación, el motivo se ve (CC6 #292)", () => {
    expect(respuestaDeAnimar({ ok: false, error: "modelo_no_animable", detalle: "solo se anima un modelo 3D listo, en GLB" }, 400, CLIENTE)).toEqual({ error: "solo se anima un modelo 3D listo, en GLB" })
    expect(respuestaDeAnimar({ ok: false, error: "pedido_invalido" }, 400, CLIENTE)).toEqual({ error: "pedido_invalido" })
    expect(respuestaDeAnimar({ ok: false }, 502, CLIENTE)).toEqual({ error: "No se pudo animar (502)." })
    expect(respuestaDeAnimar({ ok: true }, 200, CLIENTE)).toEqual({ error: "No se pudo animar (200)." })
    // una respuesta con pieza pero sin ok es un error: la pieza no entra a la galería (CC6 #292 fd3e3d6)
    expect(respuestaDeAnimar({ ok: false, pieza: animada(), error: "base_fallida" }, 500, CLIENTE)).toEqual({ error: "base_fallida" })
    expect(respuestaDeAnimar({ pieza: animada() }, 200, CLIENTE)).toEqual({ error: "No se pudo animar (200)." })
    const panel = readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")
    expect(panel).toContain('if ("error" in x) { setErrorAnimar(x.error); return }')
    expect(panel).toContain('{errorAnimar && <p role="alert" className="text-[12.5px] text-red-300">{errorAnimar}</p>}')
    expect(panel).toContain('catch { setErrorAnimar("La plataforma no responde.") }')
  })
  it("con el cajón abierto, el único botón ámbar es «Animar»: «Descargar» pasa a borde (nota CC6 #292)", () => {
    const abierto = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1", animarInicial: [0] })
    expect(abierto).toMatch(/data-descargar="true" href="https:\/\/a\/m.glb" download="" target="_blank" rel="noreferrer" class="rounded-lg border/)
    const cerrado = pintar({ piezasIniciales: [pieza({})], abiertaInicial: "p1" })
    expect(cerrado).toMatch(/data-descargar="true"[^>]*style="background:#e8731a/)
  })
  it("el pedido va por la puerta del tablero a /api/estudio/animar", () => {
    const panel = readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")
    expect(panel).toContain('fetchImpl("/api/estudio/animar", { method: "POST"')
    expect(panel).toContain("JSON.stringify(cuerpoDeAnimacion(clienteId, origen.id, movimientos))")
  })
})
