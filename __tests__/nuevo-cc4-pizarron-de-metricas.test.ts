import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena } from "@/lib/escena-avatares"
import { CUADRO_GENERAL, cuadrosDelPizarron, leerMetricas, redDeLaLlave, redesDelCliente, REDES_DEL_PIZARRON, TEXTO_SIN_METRICAS } from "@/lib/escena-metricas"
import { Avatares } from "@/components/nuevo/escena/Avatares"

const config = (own: Record<string, unknown>) => ({ apify: { own_handles: own } })
const escenaCon = (metricas: ReturnType<typeof armarMetricas> | undefined) => ({ ...armarEscena({ despachos: [], invocaciones: [], directorio: [], agentes: [], clientes: [], equipos: null, ahora: new Date("2026-11-02T17:00:00Z") }), metricas })
const armarMetricas = (redes: ReturnType<typeof redesDelCliente>) => ({ cliente: "Náufrago", cuadros: cuadrosDelPizarron(redes, { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS }), lectura: "sin_datos" as const })

describe("pizarrón de métricas (tarea 1 del encargo de Lenovo · 02-nov)", () => {
  it("la lectura es UNA sola función y hoy devuelve «sin datos» (la forma del dato no se inventa)", async () => {
    expect(await leerMetricas(null, { cliente: "x" })).toEqual({ estado: "sin_datos", motivo: "pronto" })
    const fuente = readFileSync("lib/escena-metricas.ts", "utf8")
    expect((fuente.match(/export async function leer/g) ?? []).length).toBe(1)
    expect(fuente).not.toMatch(/\.from\(/) // no lee ninguna tabla: no hay tabla de métricas todavía
  })
  it("las redes salen de los canales del cliente: Instagram, Facebook, TikTok, YouTube, WhatsApp, web, Google Maps; lo que no tiene no sale", () => {
    expect(redesDelCliente(config({ instagram: "@naufrago", tiktok: "naufrago", linkedin: "x", youtube: "" }), "https://naufrago.ec")).toEqual(["instagram", "tiktok", "web"])
    expect(redesDelCliente(config({ whatsapp: "+593", google_maps: "ficha", facebook: "n" }), null)).toEqual(["facebook", "whatsapp", "google_maps"])
    expect(redesDelCliente(config({ instagram: "@naufrago" }), null)).toEqual(["instagram"]) // Google Maps no se declara en las cuentas propias
    expect(redesDelCliente(null, null)).toEqual([])
    expect(REDES_DEL_PIZARRON.map((r) => r.clave)).toEqual(["instagram", "facebook", "tiktok", "youtube", "whatsapp", "web", "google_maps"])
  })
  it("CORRECCIÓN 02-nov · las llaves de la ficha se reconocen por lo que dicen (como la barra del manual): no faltan Facebook, TikTok, YouTube ni WhatsApp de Náufrago", () => {
    const naufrago = config({ instagram: "@naufrago.ec", facebook_page: "naufrago.ec", tiktok_handle: "@naufrago", youtube_channel: "@naufrago", whatsapp_number: "+593999", linkedin: "" })
    expect(redesDelCliente(naufrago, "https://naufrago.ec")).toEqual(["instagram", "facebook", "tiktok", "youtube", "whatsapp", "web"])
    expect(redesDelCliente(config({ Facebook: { handle: "n", url: "https://facebook.com/n" }, TikTok: ["a"], YouTube: { handle: "" } }), null)).toEqual(["facebook", "tiktok"]) // un objeto con cuenta cuenta; uno vacío no
    expect(redDeLaLlave("FB")).toBe("facebook")
    expect(redDeLaLlave("pinterest")).toBeNull()
    // los campos de sus sedes que nombran una red (el WhatsApp de una sede)
    expect(redesDelCliente(config({ instagram: "x" }), null, ["horario", "whatsapp", "direccion"])).toEqual(["instagram", "whatsapp"])
    expect(redesDelCliente(config({}), null, [])).toEqual([])
  })
  it("ESTÁNDAR (Emilio, 02-nov): General y TODAS las redes siempre; la que el cliente tiene dice «pronto», la que no, se ve tenue y dice «sin cuenta»; Google Maps cuenta siempre", () => {
    const c = cuadrosDelPizarron(["instagram", "web"], { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS })
    expect(c.map((x) => x.clave)).toEqual(["general", "instagram", "facebook", "tiktok", "youtube", "whatsapp", "web", "google_maps"])
    const tiene = (k: string) => c.find((x) => x.clave === k)!
    for (const k of ["general", "instagram", "web", "google_maps"]) expect(tiene(k)).toMatchObject({ tiene: true, texto: "pronto" })
    for (const k of ["facebook", "tiktok", "youtube", "whatsapp"]) expect(tiene(k)).toMatchObject({ tiene: false, texto: "sin cuenta" })
    const todas = cuadrosDelPizarron([], { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS })
    expect(todas).toHaveLength(8)
    expect(todas.filter((x) => !x.tiene).map((x) => x.clave)).toEqual(["instagram", "facebook", "tiktok", "youtube", "whatsapp", "web"])
    expect(c[0].nombre).toBe(CUADRO_GENERAL.nombre)
    for (const x of c) expect(x).toMatchObject({ principal: null, variacion: null })
    expect(cuadrosDelPizarron(["google_maps"], { estado: "sin_datos", motivo: TEXTO_SIN_METRICAS }).filter((x) => x.clave === "google_maps")).toHaveLength(1)
  })
  it("se dibuja: cuadros por red y General con «pronto» (en el nombre accesible, no pintado en la foto); sin gastos; sin pizarrón si no hay lectura", () => {
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escenaCon(armarMetricas(["instagram", "facebook", "web"])) as never }))
    expect(html).toContain('data-pizarron-de-metricas')
    expect(html).toContain('data-cuadros="8"') // el estándar: todas las redes, siempre
    for (const k of ["general", "instagram", "facebook", "tiktok", "youtube", "whatsapp", "web", "google_maps"]) expect(html).toContain(`data-metrica="${k}"`)
    expect(html).toMatch(/data-metrica="tiktok" data-tiene="false" opacity="0.4"/) // sin cuenta: tenue, no oculta
    expect(html).toMatch(/data-metrica="facebook" data-tiene="true"/)
    expect(html).toContain("General: pronto"); expect(html).toContain("TikTok: sin cuenta")
    // 03-nov · lo que se ve se dice UNA vez, en la franja de botones: la foto ya no pinta las siglas ni «pronto» sobre los cuadros
    for (const sigla of ["GEN", "IG", "FB", "TT", "YT", "WA", "WEB", "MAP"]) expect(html).not.toContain(`>${sigla}</text>`)
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
