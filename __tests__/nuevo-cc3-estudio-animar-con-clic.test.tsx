// @vitest-environment jsdom
/**
 * ANIMAR CON CLIC (CC3 · 06-nov · pedido CC6 #292) · las 7 pruebas que el dibujo estático no puede hacer.
 * Sin red ni base: la plataforma es falsa y el visor 3D se reemplaza por uno vacío.
 *  · al terminar de pedir la animación se abre la pieza nueva;
 *  · al cambiar de pieza el cajón de animar empieza de cero;
 *  · el visor de una animación arranca solo, no gira, tiene el botón de pausa a la vista, pausa y reanuda,
 *    y muestra el movimiento elegido.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PanelEstudio } from "@/components/nuevo/PanelEstudio"
import type { Catalogo, Pieza } from "@/lib/estudio"

// el visor real necesita WebGL (no hay en la prueba): se reemplaza por un elemento vacío que solo guarda atributos
vi.mock("@google/model-viewer", () => {
  if (!customElements.get("model-viewer")) customElements.define("model-viewer", class extends HTMLElement {})
  return {}
})
afterEach(() => { cleanup(); window.localStorage.clear() })

const CLIENTE = "a0000000-0000-4000-8000-0000000000e1"
const BIB = [[0, "Idle", "diario"], [28, "Big_Wave_Hello", "diario"], [30, "Casual_Walk", "caminar y correr"]] as const
const animar = { precio: { base: 0.2, por_movimiento: 0.12 }, maximo: 10, comunes: [{ id: 0, nombre: "Quieto" }, { id: 30, nombre: "Caminar" }, { id: 28, nombre: "Saludar" }], biblioteca: [...BIB] }
const catalogo = { listos: { imagen: true, video: true, "3d": true, almacen: true, animar: true }, imagen: { modelo: "m", formatos: ["1:1"], precio: {} }, video: { modelos: [], formatos: ["9:16"], resoluciones: ["720p"], segundos: { min: 4, max: 15 } }, "3d": { modelos: [], imagen_previa_usd: 0.0138 }, animar } satisfies Catalogo
const pieza = (x: Partial<Pieza> = {}): Pieza => ({ id: "p1", client_id: CLIENTE, tipo: "3d", estado: "lista", paso: null, prompt: "surfista", modelo: "tripo-h3.1", parametros: {}, foto_partida_url: null, costo_estimado_usd: 0.3, costo_usd: 0.3, archivo_url: "https://a/m.glb", archivo_tipo: "glb", miniatura_url: "https://a/m.png", aviso: null, error: null, creado_en: "2026-11-06T10:00:00Z", terminado_en: null, ...x })
const animada = (x: Partial<Pieza> = {}) => pieza({ id: "p9", modelo: "meshy-animar", prompt: "surfista · animado: Caminar, Saludar", parametros: { origen_pieza_id: "p1", archivos: [{ action_id: 30, nombre: "Casual_Walk", glb: "https://a/w.glb", fbx: "https://a/w.fbx" }, { action_id: 28, nombre: "Big_Wave_Hello", glb: "https://a/h.glb", fbx: "https://a/h.fbx" }] }, archivo_url: "https://a/w.glb", costo_usd: 0.44, ...x })

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
const visor = () => waitFor(() => { const v = document.querySelector("[data-visor-3d]"); if (!v) throw new Error("sin visor"); return v as HTMLElement & { play?: () => void; pause?: () => void } })
const boton = (sel: string) => { const b = document.querySelector(sel); if (!b) throw new Error(`no está ${sel}`); return b as HTMLButtonElement }

describe("Animar con clic", () => {
  it("al terminar de pedir la animación se abre la pieza nueva (y su cajón no queda abierto)", async () => {
    const nueva = animada({ estado: "lista" })
    const p = plataforma({ "/api/estudio/animar": { ok: true, pieza: nueva } })
    abrir({ piezasIniciales: [pieza()], abiertaInicial: "p1" }, p.f)
    fireEvent.click(boton("[data-animar]"))
    fireEvent.click(boton('[data-cajon-animar] [data-movimiento="30"]'))
    await waitFor(() => expect(boton("[data-animar-crear]").disabled).toBe(false))
    fireEvent.click(boton("[data-animar-crear]"))
    await waitFor(() => expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("surfista · animado: Caminar, Saludar"))
    expect(document.querySelector("[data-cajon-animar]")).toBeNull()
    const envio = p.llamadas.find((l) => l.url === "/api/estudio/animar")!
    expect(JSON.parse(String(envio.init!.body))).toMatchObject({ client_id: CLIENTE, origen_pieza_id: "p1", movimientos: [30] })
  })

  it("al cambiar de pieza el cajón empieza de cero: sin movimientos elegidos ni búsqueda", async () => {
    abrir({ piezasIniciales: [pieza(), pieza({ id: "p2", prompt: "mesero" })], abiertaInicial: "p1" })
    fireEvent.click(boton("[data-animar]"))
    fireEvent.click(boton('[data-cajon-animar] [data-movimiento="30"]'))
    fireEvent.change(document.querySelector("[data-buscar]")!, { target: { value: "wave" } })
    expect(document.querySelector("[data-elegidos]")).not.toBeNull()
    fireEvent.click(screen.getByText("← Galería"))
    fireEvent.click(boton('[data-pieza="p2"]'))
    expect(document.querySelector("[data-cajon-animar]")).toBeNull()
    fireEvent.click(boton("[data-animar]"))
    expect(document.querySelector("[data-elegidos]")).toBeNull()
    expect(boton('[data-cajon-animar] [data-movimiento="30"]').getAttribute("aria-pressed")).toBe("false")
    expect((document.querySelector("[data-buscar]") as HTMLInputElement).value).toBe("")
  })

  it("al cambiar de pieza se vuelve al primer movimiento, aunque la nueva tenga menos (menor CC6 #299)", async () => {
    // la otra animación tiene un solo movimiento y su archivo principal no es ese clip: si quedara el 2.º, el visor y las descargas no lo encontrarían
    const otra = animada({ id: "p8", prompt: "mesero · animado: Bailar", archivo_url: "https://a/principal.glb", parametros: { origen_pieza_id: "p2", archivos: [{ action_id: 591, nombre: "Hip_Hop_Dance", glb: "https://a/d.glb", fbx: "https://a/d.fbx" }] } })
    abrir({ piezasIniciales: [animada(), otra], abiertaInicial: "p9" })
    await visor()
    fireEvent.click(screen.getByText("Saludar"))
    expect(document.querySelector('[data-bajar="GLB"]')!.getAttribute("href")).toBe("https://a/h.glb")
    fireEvent.click(screen.getByText("← Galería"))
    fireEvent.click(boton('[data-pieza="p8"]'))
    const v = await visor()
    await waitFor(() => expect(v.getAttribute("src")).toBe("https://a/d.glb"))
    expect(document.querySelector('[data-bajar="GLB"]')?.getAttribute("href")).toBe("https://a/d.glb")
    expect(document.querySelector('[data-bajar="FBX"]')?.getAttribute("href")).toBe("https://a/d.fbx")
  })

  it("el visor de una animación arranca solo con el primer movimiento", async () => {
    abrir({ piezasIniciales: [animada()], abiertaInicial: "p9" })
    const v = await visor()
    await waitFor(() => expect(v.getAttribute("src")).toBe("https://a/w.glb"))
    expect(v.hasAttribute("autoplay")).toBe(true)
  })

  it("la animación no gira sola; un modelo quieto sí", async () => {
    abrir({ piezasIniciales: [animada()], abiertaInicial: "p9" })
    expect((await visor()).hasAttribute("auto-rotate")).toBe(false)
    cleanup()
    abrir({ piezasIniciales: [pieza()], abiertaInicial: "p1" })
    const quieto = await visor()
    expect(quieto.hasAttribute("auto-rotate")).toBe(true)
    expect(quieto.hasAttribute("autoplay")).toBe(false)
  })

  it("el botón de pausa se ve en una animación, y no en un modelo quieto", async () => {
    abrir({ piezasIniciales: [animada()], abiertaInicial: "p9" })
    await visor()
    expect(boton("[data-reproducir]").textContent).toBe("❚❚ Pausa")
    cleanup()
    abrir({ piezasIniciales: [pieza()], abiertaInicial: "p1" })
    await visor()
    expect(document.querySelector("[data-reproducir]")).toBeNull()
  })

  it("pausa pausa, y reproducir vuelve a reproducir", async () => {
    abrir({ piezasIniciales: [animada()], abiertaInicial: "p9" })
    const v = await visor()
    v.pause = vi.fn(); v.play = vi.fn()
    fireEvent.click(boton("[data-reproducir]"))
    expect(v.pause).toHaveBeenCalledTimes(1)
    expect(v.play).not.toHaveBeenCalled()
    expect(boton("[data-reproducir]").textContent).toBe("▶ Reproducir")
    expect(boton("[data-reproducir]").getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(boton("[data-reproducir]"))
    expect(v.play).toHaveBeenCalledTimes(1)
    expect(boton("[data-reproducir]").textContent).toBe("❚❚ Pausa")
  })

  it("al elegir otro movimiento, el visor y las descargas muestran ese, y vuelve a sonar aunque estuviera en pausa", async () => {
    abrir({ piezasIniciales: [animada()], abiertaInicial: "p9" })
    const v = await visor()
    v.pause = vi.fn(); v.play = vi.fn()
    fireEvent.click(boton("[data-reproducir]"))
    fireEvent.click(screen.getByText("Saludar"))
    await waitFor(() => expect(v.getAttribute("src")).toBe("https://a/h.glb"))
    expect(screen.getByText("Saludar").getAttribute("aria-pressed")).toBe("true")
    expect(document.querySelector('[data-bajar="GLB"]')!.getAttribute("href")).toBe("https://a/h.glb")
    expect(document.querySelector('[data-bajar="FBX"]')!.getAttribute("href")).toBe("https://a/h.fbx")
    expect(boton("[data-reproducir]").textContent).toBe("❚❚ Pausa")
  })
})
