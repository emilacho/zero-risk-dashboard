import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena } from "@/lib/escena-avatares"
import { CUADRO_GENERAL, cuadrosDelPizarron, leerMetricas, redesDelCliente, REDES_DEL_PIZARRON, TEXTO_SIN_METRICAS } from "@/lib/escena-metricas"
import { Avatares } from "@/components/nuevo/escena/Avatares"

const config = (own: Record<string, string>) => ({ apify: { own_handles: own } })
const escenaCon = (metricas: ReturnType<typeof armarMetricas> | undefined) => ({ ...armarEscena({ despachos: [], invocaciones: [], directorio: [], agentes: [], clientes: [], equipos: null, ahora: new Date("2026-11-02T17:00:00Z") }), metricas })
const armarMetricas = (redes: ReturnType<typeof redesDelCliente>) => ({ cliente: "Náufrago", cuadros: cuadrosDelPizarron(redes, { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS }), lectura: "sin_datos" as const })

describe("pizarrón de métricas (tarea 1 del encargo de Lenovo · 02-nov)", () => {
  it("la lectura es UNA sola función y hoy devuelve «sin datos» (la forma del dato no se inventa)", async () => {
    expect(await leerMetricas(null, { cliente: "x" })).toEqual({ estado: "sin_datos", motivo: "métricas pronto" })
    const fuente = readFileSync("lib/escena-metricas.ts", "utf8")
    expect((fuente.match(/export async function leer/g) ?? []).length).toBe(1)
    expect(fuente).not.toMatch(/\.from\(/) // no lee ninguna tabla: no hay tabla de métricas todavía
  })
  it("las redes salen de los canales del cliente: Instagram, Facebook, TikTok, YouTube, WhatsApp, web, Google Maps; lo que no tiene no sale", () => {
    expect(redesDelCliente(config({ instagram: "@naufrago", tiktok: "naufrago", linkedin: "x", youtube: "" }), "https://naufrago.ec")).toEqual(["instagram", "tiktok", "web"])
    expect(redesDelCliente(config({ whatsapp: "+593", google_maps: "ficha", facebook: "n" }), null)).toEqual(["facebook", "whatsapp", "google_maps"])
    expect(redesDelCliente(null, null)).toEqual([])
    expect(REDES_DEL_PIZARRON.map((r) => r.clave)).toEqual(["instagram", "facebook", "tiktok", "youtube", "whatsapp", "web", "google_maps"])
  })
  it("un cuadro por red + «General»; cada uno dice «métricas pronto» y no trae métrica ni variación", () => {
    const c = cuadrosDelPizarron(["instagram", "web"], { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS })
    expect(c.map((x) => x.clave)).toEqual(["general", "instagram", "web"])
    expect(c[0].nombre).toBe(CUADRO_GENERAL.nombre)
    for (const x of c) expect(x).toMatchObject({ principal: null, variacion: null, texto: "métricas pronto" })
    expect(cuadrosDelPizarron([], { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS }).map((x) => x.clave)).toEqual(["general"])
  })
  it("se dibuja: cuadros por red y General con «métricas pronto»; sin gastos; sin pizarrón si no hay lectura", () => {
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escenaCon(armarMetricas(["instagram", "facebook", "web"])) as never }))
    expect(html).toContain('data-pizarron-de-metricas')
    expect(html).toContain('data-cuadros="4"')
    for (const k of ["general", "instagram", "facebook", "web"]) expect(html).toContain(`data-metrica="${k}"`)
    expect(html).toContain("métricas pronto")
    const dentro = html.split("data-pizarron-de-metricas")[1].split("</svg>")[0]
    expect(dentro).not.toMatch(/US\$|gasto|costo/i)
    expect(renderToStaticMarkup(createElement(Avatares, { datosIniciales: escenaCon(undefined) as never }))).not.toContain("data-pizarron-de-metricas")
  })
  it("solo lectura y respeta prefers-reduced-motion", () => {
    const lector = readFileSync("lib/escena-avatares-datos.ts", "utf8").split("export async function leerElPizarronDeMetricas")[1]
    expect(lector).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/)
    expect(readFileSync("components/nuevo/escena/EntregasEnLaFoto.tsx", "utf8")).toContain("prefers-reduced-motion")
  })
})
