// @vitest-environment jsdom
/**
 * LA PREGUNTA «POSE» DEL 3D (CC3 · GO de Lenovo 10-nov, firma de Emilio · boceto `APROBADO-estudio-pose-3d.png`).
 * Sin red ni base: la plataforma es falsa.
 *  · solo en la pestaña 3D y con Meshy 6 (el único que sabe pedir la pose A);
 *  · «Como en la imagen» marcada por defecto → `pose: "imagen"`; «Lista para animar» → `pose: "animar"`;
 *  · mismo estilo que «Formato» (chips) y el mismo precio.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { PanelEstudio } from "@/components/nuevo/PanelEstudio"
import { cuerpoDeCotizacion, cuerpoDelPedido, MODELO_CON_POSE, modeloInicialDe3D, NOMBRE_DE_LA_POSE, preguntaLaPose, type Catalogo } from "@/lib/estudio"

const CLIENTE = "a0000000-0000-4000-8000-0000000000e1"
const catalogo = {
  listos: { imagen: true, video: true, "3d": true, almacen: true, varias: true },
  imagen: { modelo: "m", formatos: ["1:1", "9:16"], precio: {} },
  video: { modelos: [{ id: "bytedance/seedance-2.5", nombre: "Seedance 2.5" }], formatos: ["9:16"], resoluciones: ["720p"], segundos: { min: 4, max: 15 } },
  "3d": { modelos: [{ id: "tripo-h3.1", nombre: "Tripo H3.1", nota: "rápido", precio: { normal: 0.3, alta: 0.4 } }, { id: "meshy-6", nombre: "Meshy 6", nota: "el más detallado", precio: { normal: 0.8, alta: 0.8 } }], imagen_previa_usd: 0.0138 },
} satisfies Catalogo
const O = { formato: "1:1", modelo3d: "meshy-6", calidad: "normal" as const, modeloVideo: "bytedance/seedance-2.5", segundos: 5, resolucion: "720p" }
type Llamada = { url: string; init?: RequestInit }
function plataforma() {
  const llamadas: Llamada[] = []
  const f = (async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u)
    llamadas.push({ url, init })
    if (url.startsWith("/api/estudio/cotizar")) return new Response(JSON.stringify({ ok: true, total_usd: 0.8138, partes: [{ que: "imagen", usd: 0.0138 }, { que: "3D · Meshy 6", usd: 0.8 }] }), { status: 200 })
    return new Response(JSON.stringify({ ok: true, piezas: [] }), { status: 200 })
  }) as typeof fetch
  return { f, llamadas }
}
const abrir = (f: typeof fetch) => render(<PanelEstudio onCerrar={() => undefined} fetchImpl={f} catalogoInicial={catalogo} clientesIniciales={[{ id: CLIENTE, nombre: "Náufrago" }]} piezasIniciales={[]} textoInicial="El náufrago con su tabla" />)
const boton = (texto: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === texto || b.textContent?.startsWith(texto))!
const chipsDePose = () => [...document.querySelectorAll("[data-pose] button")].map((b) => ({ texto: b.textContent, marcado: b.getAttribute("aria-pressed") === "true" }))
const cotizaciones = (l: Llamada[]) => l.filter((x) => x.url.startsWith("/api/estudio/cotizar")).map((x) => JSON.parse(String(x.init!.body)) as Record<string, unknown>)

afterEach(cleanup)

describe("el pedido", () => {
  it("con Meshy 6 en 3D la pose viaja; por defecto «como en la imagen»", () => {
    expect(cuerpoDelPedido(CLIENTE, "3d", "x", O, null).pose).toBe("imagen")
    expect(cuerpoDelPedido(CLIENTE, "3d", "x", { ...O, pose: "animar" }, null).pose).toBe("animar")
    // la cotización la conserva (no cambia el precio, pero la plataforma la valida)
    expect(cuerpoDeCotizacion(cuerpoDelPedido(CLIENTE, "3d", "x", { ...O, pose: "animar" }, { b64: "QUJD" })).pose).toBe("animar")
  })
  it("con otro modelo 3D, en Imagen o en Video no se manda pose", () => {
    expect(cuerpoDelPedido(CLIENTE, "3d", "x", { ...O, modelo3d: "tripo-h3.1", pose: "animar" }, null)).not.toHaveProperty("pose")
    expect(cuerpoDelPedido(CLIENTE, "imagen", "x", { ...O, pose: "animar" }, null)).not.toHaveProperty("pose")
    expect(cuerpoDelPedido(CLIENTE, "video", "x", { ...O, pose: "animar" }, null)).not.toHaveProperty("pose")
    expect(MODELO_CON_POSE).toBe("meshy-6")
    expect(preguntaLaPose("3d", "meshy-6")).toBe(true)
    expect(preguntaLaPose("3d", "hunyuan-3d-v3.1-pro")).toBe(false)
  })
  it("al abrir 3D viene Meshy 6; si el catálogo no lo trae, el primero que sí trae", () => {
    expect(modeloInicialDe3D(catalogo["3d"].modelos)).toBe("meshy-6")
    expect(modeloInicialDe3D([{ id: "tripo-h3.1" }, { id: "hunyuan-3d-v3.1-pro" }])).toBe("tripo-h3.1")
    expect(modeloInicialDe3D(null)).toBe("meshy-6")
    expect(modeloInicialDe3D([])).toBe("meshy-6")
  })
  it("los nombres son los del boceto", () => {
    expect(NOMBRE_DE_LA_POSE).toEqual({ imagen: "Como en la imagen", animar: "Lista para animar" })
  })
})

describe("la pantalla", () => {
  it("«Pose» sale solo en 3D con Meshy 6, con «Como en la imagen» marcada; «Lista para animar» manda pose animar", async () => {
    const p = plataforma()
    abrir(p.f)
    expect(document.querySelector("[data-pose]")).toBeNull()
    fireEvent.click(document.querySelector('[data-tab="3d"]')!)
    // opción (b) de Lenovo: al abrir 3D ya viene Meshy 6 marcado y la pregunta se ve, como en el boceto
    expect(document.querySelector("[data-pose] .es-eti")?.textContent).toBe("Pose")
    // con Tripo no se pregunta; al volver a Meshy 6 vuelve
    fireEvent.click(boton("Tripo H3.1"))
    expect(document.querySelector("[data-pose]")).toBeNull()
    fireEvent.click(boton("Meshy 6"))
    expect(document.querySelector("[data-pose] .es-eti")?.textContent).toBe("Pose")
    expect(chipsDePose()).toEqual([{ texto: "Como en la imagen", marcado: true }, { texto: "Lista para animar", marcado: false }])
    await waitFor(() => expect(cotizaciones(p.llamadas).some((c) => c.modelo === "meshy-6" && c.pose === "imagen")).toBe(true))
    fireEvent.click(boton("Lista para animar"))
    expect(chipsDePose()).toEqual([{ texto: "Como en la imagen", marcado: false }, { texto: "Lista para animar", marcado: true }])
    // la pose no cambia el precio: no se vuelve a cotizar, pero el pedido que se crea la lleva
    await waitFor(() => expect((document.querySelector("[data-crear]") as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(document.querySelector("[data-crear]")!)
    await waitFor(() => expect(p.llamadas.some((l) => l.url === "/api/estudio/crear")).toBe(true))
    const creado = JSON.parse(String(p.llamadas.find((l) => l.url === "/api/estudio/crear")!.init!.body)) as Record<string, unknown>
    expect(creado).toMatchObject({ tipo: "3d", modelo: "meshy-6", pose: "animar" })
    // los chips son los mismos que «Formato» de Imagen
    expect([...document.querySelectorAll("[data-pose] button")].every((b) => b.classList.contains("es-chip"))).toBe(true)
    // volver a Imagen la esconde
    fireEvent.click(document.querySelector('[data-tab="imagen"]')!)
    expect(document.querySelector("[data-pose]")).toBeNull()
  })
  it("si el catálogo llega por la red sin Meshy 6, queda marcado el primero y no se pregunta la pose", async () => {
    const sinMeshy = { ...catalogo, "3d": { ...catalogo["3d"], modelos: [catalogo["3d"].modelos[0]] } }
    const llamadas: Llamada[] = []
    const f = (async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u)
      llamadas.push({ url, init })
      if (url.startsWith("/api/estudio/catalogo")) return new Response(JSON.stringify({ ok: true, ...sinMeshy }), { status: 200 })
      if (url.startsWith("/api/estudio/cotizar")) return new Response(JSON.stringify({ ok: true, total_usd: 0.3138, partes: [] }), { status: 200 })
      return new Response(JSON.stringify({ ok: true, piezas: [] }), { status: 200 })
    }) as typeof fetch
    render(<PanelEstudio onCerrar={() => undefined} fetchImpl={f} clientesIniciales={[{ id: CLIENTE, nombre: "Náufrago" }]} piezasIniciales={[]} textoInicial="El náufrago con su tabla" />)
    await waitFor(() => expect(document.querySelector('[data-tab="3d"]')).not.toBeNull())
    fireEvent.click(document.querySelector('[data-tab="3d"]')!)
    await waitFor(() => expect(boton("Tripo H3.1").getAttribute("aria-pressed")).toBe("true"))
    expect(document.querySelector("[data-pose]")).toBeNull()
    await waitFor(() => expect(cotizaciones(llamadas).some((c) => c.modelo === "tripo-h3.1")).toBe(true))
    expect(cotizaciones(llamadas).some((c) => c.modelo === "meshy-6")).toBe(false)
  })
})
