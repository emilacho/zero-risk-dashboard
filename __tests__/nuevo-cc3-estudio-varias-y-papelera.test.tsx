// @vitest-environment jsdom
/**
 * VARIAS IMÁGENES + LA ✕ CON PAPELERA (CC3 · GO de Lenovo 09-nov 22:45Z · boceto aprobado por Emilio + los 4 puntos de CC6).
 * Sin red ni base: la plataforma es falsa.
 *  · punto 1: los números quedan fijos (quitar una no renumera) y el pedido sale en el orden de los números;
 *  · punto 2: Video y 3D usan la imagen de número más bajo, sin borrar las demás, y una línea lo dice;
 *  · punto 3: lo que no sube (formato, cupo) se dice en una línea;
 *  · punto 4: con 2 o más se cotiza el modelo de varias (el costo antes de crear);
 *  · la ✕ de la galería manda a la papelera (nunca borra), con «Deshacer»; desde la papelera se recupera.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { PanelEstudio } from "@/components/nuevo/PanelEstudio"
import { agregarImagenes, avisoDeUnaSola, cuerpoDeCotizacion, cuerpoDelPedido, diasQueQuedan, enOrden, lineaDeLoQueNoSubio, lineaDeReferencias, quitarImagen, revisarArchivos, sePuedeQuitar, textoDeDias, MAXIMO_DE_IMAGENES, type Catalogo, type Pieza } from "@/lib/estudio"

vi.mock("@google/model-viewer", () => ({}))
afterEach(() => { cleanup(); window.localStorage.clear() })

const CLIENTE = "a0000000-0000-4000-8000-0000000000e1"
const catalogo = { listos: { imagen: true, video: true, "3d": true, almacen: true, varias: true }, imagen: { modelo: "m", formatos: ["1:1", "9:16"], precio: {} }, video: { modelos: [{ id: "bytedance/seedance-2.5", nombre: "Seedance 2.5" }], formatos: ["9:16"], resoluciones: ["720p"], segundos: { min: 4, max: 15 } }, "3d": { modelos: [{ id: "tripo-h3.1", nombre: "Tripo H3.1", nota: "rápido", precio: { normal: 0.3, alta: 0.4 } }], imagen_previa_usd: 0.0138 } } satisfies Catalogo
const pieza = (x: Partial<Pieza> = {}): Pieza => ({ id: "p1", client_id: CLIENTE, tipo: "imagen", estado: "lista", paso: null, prompt: "playa", modelo: "m", parametros: {}, foto_partida_url: null, costo_estimado_usd: 0.014, costo_usd: 0.014, archivo_url: "https://a/p1.png", archivo_tipo: "image", miniatura_url: "https://a/p1.png", aviso: null, error: null, creado_en: "2026-11-09T10:00:00Z", terminado_en: null, en_papelera_desde: null, ...x })
const O = { formato: "1:1", modelo3d: "tripo-h3.1", calidad: "normal" as const, modeloVideo: "bytedance/seedance-2.5", segundos: 5, resolucion: "720p" }

type Llamada = { url: string; init?: RequestInit }
function plataforma(respuestas: Record<string, unknown> = {}) {
  const llamadas: Llamada[] = []
  const f = (async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u)
    llamadas.push({ url, init })
    const clave = Object.keys(respuestas).find((k) => url.startsWith(k))
    return new Response(JSON.stringify(clave ? respuestas[clave] : { ok: false, error: "no_esperada" }), { status: clave ? 200 : 500 })
  }) as typeof fetch
  return { f, llamadas }
}
const abrir = (props: Record<string, unknown>, f = plataforma().f) =>
  render(<PanelEstudio onCerrar={() => undefined} fetchImpl={f} catalogoInicial={catalogo} clientesIniciales={[{ id: CLIENTE, nombre: "Náufrago" }]} {...props} />)
const el = <T extends Element = HTMLButtonElement>(sel: string) => { const b = document.querySelector(sel); if (!b) throw new Error(`no está ${sel}`); return b as unknown as T }
const numeros = () => [...document.querySelectorAll("[data-adjunta]")].map((x) => Number(x.getAttribute("data-adjunta")))
const deGaleria = (id: string, numero: number) => ({ numero, pieza: pieza({ id, archivo_url: `https://a/${id}.png` }) })
const cuerpo = (l: Llamada) => JSON.parse(String(l.init!.body)) as Record<string, unknown>

describe("las reglas (lib)", () => {
  it("punto 1 · cada imagen nueva toma el número libre más bajo; quitar una no renumera las otras", () => {
    const a = agregarImagenes<{ numero: number; n: string }>([], [{ n: "a" }, { n: "b" }, { n: "c" }]).lista
    expect(a.map((x) => [x.numero, x.n])).toEqual([[1, "a"], [2, "b"], [3, "c"]])
    const sin1 = quitarImagen(a, 1)
    expect(sin1.map((x) => x.numero)).toEqual([2, 3])
    const otra = agregarImagenes(sin1, [{ n: "d" }]).lista
    expect(enOrden(otra).map((x) => [x.numero, x.n])).toEqual([[1, "d"], [2, "b"], [3, "c"]])
  })
  it("punto 3 · más de 6 no caben y se cuentan; un formato que no sirve se nombra", () => {
    const seis = agregarImagenes<{ numero: number }>([], Array.from({ length: 6 }, () => ({}))).lista
    expect(agregarImagenes(seis, [{}, {}]).fuera).toBe(2)
    const r = revisarArchivos([{ name: "a.png", type: "image/png" }, { name: "b.gif", type: "image/gif" }, { name: "c.jpg", type: "image/jpeg" }, { name: "d.webp", type: "image/webp" }], 2)
    expect(r.suben.map((x) => x.name)).toEqual(["a.png", "c.jpg"])
    expect(r.formato).toEqual(["b.gif"])
    expect(r.sinCupo).toEqual(["d.webp"])
    expect(lineaDeLoQueNoSubio(r)).toBe("No cupieron (máximo 6): d.webp. No son png, jpg ni webp: b.gif.")
    expect(lineaDeLoQueNoSubio({ formato: [], sinCupo: [] })).toBeNull()
    expect(MAXIMO_DE_IMAGENES).toBe(6)
  })
  it("el pedido: imagen con 2 o más → `fotos` en el orden de los números; con una o en Video/3D → la de número más bajo", () => {
    const l = [{ numero: 3, pieza_id: "p3" }, { numero: 2, b64: "QUJD" }]
    expect(cuerpoDelPedido(CLIENTE, "imagen", "x", O, l).fotos).toEqual([{ numero: 2, b64: "QUJD" }, { numero: 3, pieza_id: "p3" }])
    expect(cuerpoDelPedido(CLIENTE, "imagen", "x", O, l)).not.toHaveProperty("foto_b64")
    const v = cuerpoDelPedido(CLIENTE, "video", "x", O, l)
    expect(v.foto_b64).toBe("QUJD")
    expect(v).not.toHaveProperty("fotos")
    expect(cuerpoDelPedido(CLIENTE, "imagen", "x", O, [{ numero: 4, pieza_id: "p4" }])).toMatchObject({ foto_pieza_id: "p4" })
    expect(cuerpoDelPedido(CLIENTE, "imagen", "x", O, [])).not.toHaveProperty("foto_b64")
  })
  it("punto 4 · para cotizar no viajan las imágenes, solo cuántas son", () => {
    const c = cuerpoDeCotizacion(cuerpoDelPedido(CLIENTE, "imagen", "x", O, [{ numero: 1, b64: "QUJD" }, { numero: 2, pieza_id: "p2" }]))
    expect(c).not.toHaveProperty("fotos")
    expect(c).toMatchObject({ n_fotos: 2, con_foto: true })
    expect(cuerpoDeCotizacion(cuerpoDelPedido(CLIENTE, "imagen", "x", O, null))).not.toHaveProperty("n_fotos")
    expect(lineaDeReferencias({ total_usd: 0.15, partes: [{ que: "imagen con 3 referencias", usd: 0.15 }] })).toBe("Imagen con 3 referencias · US$ 0,15")
    expect(lineaDeReferencias({ total_usd: 0.0138, partes: [{ que: "imagen", usd: 0.0138 }] })).toBeNull()
  })
  it("punto 2 · Video y 3D dicen qué imagen usan", () => {
    expect(avisoDeUnaSola("video", [{ numero: 3 }, { numero: 2 }])).toBe("Video usa solo la imagen 2; las demás quedan guardadas para Imagen.")
    expect(avisoDeUnaSola("3d", [{ numero: 1 }, { numero: 5 }])).toMatch(/^3D usa solo la imagen 1/)
    expect(avisoDeUnaSola("imagen", [{ numero: 1 }, { numero: 2 }])).toBeNull()
    expect(avisoDeUnaSola("video", [{ numero: 1 }])).toBeNull()
  })
  it("la papelera: 30 días, y lo que se está creando no se quita", () => {
    const ahora = Date.parse("2026-11-10T12:00:00Z")
    expect(diasQueQuedan("2026-11-10T11:00:00Z", ahora)).toBe(30)
    expect(diasQueQuedan("2026-10-12T12:00:00Z", ahora)).toBe(1)
    expect(diasQueQuedan("2026-10-01T00:00:00Z", ahora)).toBe(0)
    expect([textoDeDias(0), textoDeDias(1), textoDeDias(12)]).toEqual(["se borra hoy", "se borra mañana", "se borra en 12 días"])
    expect(sePuedeQuitar({ estado: "creando" })).toBe(false)
    expect(sePuedeQuitar({ estado: "fallida" })).toBe(true)
  })
})

describe("varias imágenes en el panel", () => {
  it("las miniaturas van numeradas sobre el texto, con el contador «N de 6»; quitar la 1 deja la 2 y la 3", () => {
    abrir({ piezasIniciales: [], adjuntasIniciales: [deGaleria("g1", 1), deGaleria("g2", 2), deGaleria("g3", 3)] })
    expect(numeros()).toEqual([1, 2, 3])
    expect(el("[data-cupo]").textContent).toBe("3 de 6 imágenes · png, jpg o webp")
    // las miniaturas van dentro de la caja, antes del texto
    const caja = el<HTMLElement>("[data-caja-pedido]")
    expect(caja.firstElementChild?.hasAttribute("data-adjuntas")).toBe(true)
    fireEvent.click(el('[data-quitar-adjunta="1"]'))
    expect(numeros()).toEqual([2, 3])
    expect(el("[data-cupo]").textContent).toBe("2 de 6 imágenes · png, jpg o webp")
  })
  it("con 2 o más se cotiza con `n_fotos` y bajo «Crear» se lee el modelo de varias; el pedido sale en el orden de los números", async () => {
    const creada = pieza({ id: "n1", estado: "creando", modelo: "nano-banana-pro" })
    const p = plataforma({ "/api/estudio/cotizar": { ok: true, total_usd: 0.15, partes: [{ que: "imagen con 2 referencias", usd: 0.15 }] }, "/api/estudio/crear": { ok: true, pieza: creada }, "/api/estudio/pieza": { ok: true, pieza: creada } })
    abrir({ piezasIniciales: [], textoInicial: "el personaje de la imagen 4 en la playa de la 2", adjuntasIniciales: [deGaleria("g4", 4), deGaleria("g2", 2)] }, p.f)
    await waitFor(() => expect(el("[data-crear]").disabled).toBe(false))
    const cot = p.llamadas.find((l) => l.url === "/api/estudio/cotizar")!
    expect(cuerpo(cot)).toMatchObject({ n_fotos: 2, con_foto: true, tipo: "imagen" })
    expect(cuerpo(cot)).not.toHaveProperty("fotos")
    expect(el("[data-referencias]").textContent).toBe("Imagen con 2 referencias · US$ 0,15")
    expect(el("[data-costo]").textContent).toBe("≈ US$ 0,15")
    fireEvent.click(el("[data-crear]"))
    await waitFor(() => expect(p.llamadas.some((l) => l.url === "/api/estudio/crear")).toBe(true))
    const env = cuerpo(p.llamadas.find((l) => l.url === "/api/estudio/crear")!)
    expect(env.fotos).toEqual([{ numero: 2, pieza_id: "g2" }, { numero: 4, pieza_id: "g4" }])
    expect(typeof env.clave).toBe("string")
  })
  it("al pasar de 1 a 2 imágenes se vuelve a cotizar (cambia el modelo y el precio antes de crear)", async () => {
    const p = plataforma({ "/api/estudio/cotizar": { ok: true, total_usd: 0.026, partes: [{ que: "imagen", usd: 0.026 }] } })
    abrir({ piezasIniciales: [pieza({ id: "p9" })], abiertaInicial: "p9", textoInicial: "la playa", adjuntasIniciales: [deGaleria("g2", 2)] }, p.f)
    await waitFor(() => expect(p.llamadas.filter((l) => l.url === "/api/estudio/cotizar")).toHaveLength(1))
    expect(cuerpo(p.llamadas.find((l) => l.url === "/api/estudio/cotizar")!)).not.toHaveProperty("n_fotos")
    fireEvent.click([...document.querySelectorAll("button")].find((b) => b.textContent === "Usar como imagen de partida")!)
    await waitFor(() => expect(p.llamadas.filter((l) => l.url === "/api/estudio/cotizar")).toHaveLength(2))
    expect(cuerpo(p.llamadas.filter((l) => l.url === "/api/estudio/cotizar")[1])).toMatchObject({ n_fotos: 2 })
  })
  it("al pasar a Video no se borra nada: se usa la de número más bajo y una línea lo dice", () => {
    abrir({ piezasIniciales: [], adjuntasIniciales: [deGaleria("g3", 3), deGaleria("g2", 2)] })
    fireEvent.click(el('[data-tab="video"]'))
    expect(numeros()).toEqual([2, 3])
    expect(el("[data-una-sola]").textContent).toBe("Video usa solo la imagen 2; las demás quedan guardadas para Imagen.")
    fireEvent.click(el('[data-tab="imagen"]'))
    expect(document.querySelector("[data-una-sola]")).toBeNull()
  })
  it("un archivo que no es png, jpg ni webp no sube y se dice; con 6 «Subir» se apaga", async () => {
    abrir({ piezasIniciales: [] })
    const input = el<HTMLInputElement>('input[type="file"]')
    expect(input.multiple).toBe(true)
    fireEvent.change(input, { target: { files: [new File(["x"], "animado.gif", { type: "image/gif" })] } })
    await waitFor(() => expect(el("[data-no-subio]").textContent).toBe("No son png, jpg ni webp: animado.gif."))
    cleanup()
    abrir({ piezasIniciales: [], adjuntasIniciales: [1, 2, 3, 4, 5, 6].map((n) => deGaleria(`g${n}`, n)) })
    expect(el("[data-subir]").disabled).toBe(true)
  })
  it("«Usar como imagen de partida» suma la imagen con el número libre más bajo (no reemplaza)", () => {
    abrir({ piezasIniciales: [pieza({ id: "p9" })], abiertaInicial: "p9", adjuntasIniciales: [deGaleria("g2", 2)] })
    fireEvent.click([...document.querySelectorAll("button")].find((b) => b.textContent === "Usar como imagen de partida")!)
    expect(numeros()).toEqual([1, 2])
  })
})

describe("la ✕ de la galería y la papelera", () => {
  it("la ✕ manda a la papelera (no borra): la pieza sale de la galería y aparece «Deshacer», que la devuelve", async () => {
    const enTacho = pieza({ id: "p1", en_papelera_desde: "2026-11-10T00:00:00Z" })
    const p = plataforma({ "/api/estudio/mover-a-papelera": { ok: true, pieza: enTacho }, "/api/estudio/recuperar": { ok: true, pieza: pieza({ id: "p1" }) } })
    abrir({ piezasIniciales: [pieza({ id: "p1" }), pieza({ id: "p2", creado_en: "2026-11-08T10:00:00Z" })] }, p.f)
    fireEvent.click(el('[data-quitar="p1"]'))
    await waitFor(() => expect(document.querySelector('[data-tarjeta="p1"]')).toBeNull())
    expect(cuerpo(p.llamadas.find((l) => l.url === "/api/estudio/mover-a-papelera")!)).toEqual({ client_id: CLIENTE, id: "p1" })
    expect(el("[data-movida]").textContent).toMatch(/^Se movió a la papelera por 30 días/)
    fireEvent.click(el("[data-deshacer]"))
    await waitFor(() => expect(document.querySelector('[data-tarjeta="p1"]')).not.toBeNull())
    expect(cuerpo(p.llamadas.find((l) => l.url === "/api/estudio/recuperar")!)).toEqual({ client_id: CLIENTE, id: "p1" })
    expect(document.querySelector("[data-movida]")).toBeNull()
    // vuelve en su lugar (lo más nuevo primero)
    expect([...document.querySelectorAll("[data-tarjeta]")].map((x) => x.getAttribute("data-tarjeta"))).toEqual(["p1", "p2"])
  })
  it("lo que se está creando no tiene ✕; si la plataforma no deja, se dice y la pieza se queda", async () => {
    const p = plataforma({})
    abrir({ piezasIniciales: [pieza({ id: "c1", estado: "creando" }), pieza({ id: "p2" })] }, p.f)
    expect(document.querySelector('[data-quitar="c1"]')).toBeNull()
    fireEvent.click(el('[data-quitar="p2"]'))
    await waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/No se pudo quitar/))
    expect(document.querySelector('[data-tarjeta="p2"]')).not.toBeNull()
  })
  it("la papelera muestra los días que quedan y «Recuperar» la devuelve a la galería", async () => {
    const t = pieza({ id: "t1", en_papelera_desde: new Date(Date.now() - 20 * 86_400_000).toISOString() })
    const p = plataforma({ "/api/estudio/papelera": { ok: true, piezas: [t] }, "/api/estudio/recuperar": { ok: true, pieza: pieza({ id: "t1" }) } })
    abrir({ piezasIniciales: [pieza({ id: "p2" })] }, p.f)
    fireEvent.click(el("[data-ver-papelera]"))
    await waitFor(() => expect(document.querySelector('[data-tarjeta="t1"]')).not.toBeNull())
    expect(p.llamadas.some((l) => l.url === `/api/estudio/papelera?client_id=${CLIENTE}`)).toBe(true)
    expect(el('[data-tarjeta="t1"]').textContent).toContain("se borra en 10 días")
    expect(document.querySelector('[data-quitar="t1"]')).toBeNull()
    fireEvent.click(el('[data-recuperar="t1"]'))
    await waitFor(() => expect(document.querySelector('[data-tarjeta="t1"]')).toBeNull())
    fireEvent.click([...document.querySelectorAll("button")].find((b) => b.textContent === "Todo")!)
    expect([...document.querySelectorAll("[data-tarjeta]")].map((x) => x.getAttribute("data-tarjeta")).sort()).toEqual(["p2", "t1"])
  })
})
