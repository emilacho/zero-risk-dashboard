/**
 * RIESGOS EN ESCRITORIO (Emilio 06-nov 01:46: «el radar a la izquierda, y lo nuevo reemplaza lo de la derecha» · pedido y corrección de Lenovo sobre #290).
 * Abiertas · Tomadas · Cerradas con la marca «Visto» del tablero; la campana y el $ no se tocan. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { claveDelRiesgo, estadoDeLosRiesgos, leerVistosDeRiesgos, vistosDeLasMarcas } from "@/lib/riesgos-vistos"
import { claveValida } from "@/lib/alertas"
import { PanelRiesgos } from "@/components/nuevo/PanelRiesgos"

const R = (id: string, gravedad: 1 | 2 | 3, sector = "flujos") => ({ id, gravedad, titulo: `riesgo ${id}`, categoria: "incidente", detalle: null, sector, client_id: null, cliente: null, fuente: "n8n", desde: "2026-11-06T08:00:00Z" }) as never
const AHORA = Date.parse("2026-11-06T10:00:00Z")
const datos = (riesgos: never[], vistos?: Record<string, string> | null) => ({
  generado_en: null, completo: true, total: riesgos.length, por_gravedad: { 1: 0, 2: 0, 3: 0 }, por_sector: { dinero: 0, credenciales: 0, servicios: 0, flujos: 0, datos: 0, calidad: 0, plazos: 0, seguridad: 0 },
  riesgos, decisiones_tuyas: [], caducados: 0, saldos: [], topes: [], fuentes: [], sin_fuente: [], ...(vistos === undefined ? {} : { vistos }),
}) as never
const pinta = (d: never, filtroInicial?: "abiertas" | "tomadas" | "cerradas") => renderToStaticMarkup(createElement(PanelRiesgos, { onCerrar: () => {}, datosIniciales: d, filtroInicial })).replace(/<!-- -->/g, "")
const recuadro = (h: string, k: string) => h.match(new RegExp(`data-recuadro="${k}".*?</button>`))?.[0] ?? ""

describe("las marcas «Visto» de los riesgos", () => {
  it("🔴 abiertas = activas sin marca · tomadas = activas con marca · cerradas = con marca y ya no activas, solo 7 días, la más reciente arriba", () => {
    const activos = [R("a", 3), R("b", 2), R("c", 1)]
    const vistos = { b: "2026-11-06T09:00:00Z", viejo: "2026-10-20T09:00:00Z", x: "2026-11-05T09:00:00Z", y: "2026-11-06T07:00:00Z" }
    const e = estadoDeLosRiesgos(activos, vistos, AHORA)
    expect(e.abiertas.map((r: { id: string }) => r.id)).toEqual(["a", "c"])
    expect(e.tomadas.map((r: { id: string }) => r.id)).toEqual(["b"])
    expect(e.cerradas).toEqual([{ id: "y", visto_en: "2026-11-06T07:00:00Z" }, { id: "x", visto_en: "2026-11-05T09:00:00Z" }])
  })
  it("🔴 de las marcas del tablero solo cuentan las de riesgos; la clave es «riesgo:<id>» y la ruta de «visto» la acepta", () => {
    expect(vistosDeLasMarcas([{ clave: "riesgo:saldo:apify", visto_en: "t1" }, { clave: "oficina:x", visto_en: "t2" }, { clave: "riesgo:", visto_en: "t3" }, { clave: "riesgo:b", visto_en: null }])).toEqual({ "saldo:apify": "t1" })
    expect(claveDelRiesgo("reconciliacion:dispatch:X9F0:jefe-marketing:220399")).toBe("riesgo:reconciliacion:dispatch:X9F0:jefe-marketing:220399")
    expect(claveValida(claveDelRiesgo("reconciliacion:dispatch:X9F0:jefe-marketing:220399"))).toBe(true)
    expect(claveValida("riesgo:<script>")).toBe(false); expect(claveValida("otra:x")).toBe(false)
  })
  it("🔴 si la base falla al leer las marcas, null (nunca «nada visto»)", async () => {
    const base = (r: unknown) => ({ from: () => ({ select: () => ({ like: () => ({ order: () => ({ limit: () => Promise.resolve(r) }) }) }) }) }) as never
    expect(await leerVistosDeRiesgos(base({ data: null, error: { message: "caída" } }))).toBeNull()
    expect(await leerVistosDeRiesgos(base({ data: [{ clave: "riesgo:a", visto_en: "t" }], error: null }))).toEqual({ a: "t" })
    const lanza = { from: () => { throw new Error("red") } } as never
    expect(await leerVistosDeRiesgos(lanza)).toBeNull()
  })
  it("la ruta del tablero devuelve las marcas junto a los riesgos", () => {
    const ruta = readFileSync("app/api/direccion/riesgos/route.ts", "utf8")
    expect(ruta).toContain("const vistos = await leerVistosDeRiesgos(getServiceRoleClient())"); expect(ruta).toContain("{ ok: true, ...r.datos, vistos }")
  })
})

describe("el panel en escritorio", () => {
  it("🔴 Abiertas · Tomadas · Cerradas con sus cuentas; el activo va en oro; Abiertas en rojo (sin elegir) solo si queda algo grave sin ver", () => {
    expect(recuadro(pinta(datos([R("a", 3)], {})), "abiertas")).toMatch(/text-oro[^>]*>1</) // el elegido, en oro (imagen aprobada)
    const h = pinta(datos([R("a", 3), R("b", 2)], { b: "2026-11-06T09:00:00Z" }), "tomadas")
    expect(recuadro(h, "abiertas")).toMatch(/text-alarma[^>]*>1</); expect(recuadro(h, "tomadas")).toMatch(/>1</); expect(recuadro(h, "cerradas")).toMatch(/>0</)
    const vistoElGrave = pinta(datos([R("a", 3), R("b", 2)], { a: "2026-11-06T09:00:00Z" }), "tomadas")
    expect(recuadro(vistoElGrave, "abiertas")).not.toContain("text-alarma")
  })
  it("🔴 la tarjeta abierta ofrece «Detalle» y «Visto» (ámbar, a la derecha); la tomada no ofrece «Visto»", () => {
    const conDetalle = (id: string, g: 1 | 2 | 3) => ({ ...(R(id, g) as object), detalle: "lo que pasó" }) as never
    const h = pinta(datos([conDetalle("a", 3)], {}))
    expect(h).toMatch(/data-ver-detalle[\s\S]*data-visto="a"[^>]*bg-ambar/)
    const t = pinta(datos([conDetalle("a", 3)], { a: "2026-11-06T09:00:00Z" }), "tomadas")
    expect(t).not.toContain("data-visto="); expect(t).toContain("data-ver-detalle")
  })
  it("🔴 sin las marcas no se inventa: «…» mientras llegan, «—» y sin «Visto» si no se pudieron leer", () => {
    const llegando = pinta(datos([R("a", 3)]))
    expect(recuadro(llegando, "tomadas")).toContain(">…<"); expect(llegando).not.toContain("data-visto=")
    const caidas = pinta(datos([R("a", 3)], null))
    expect(recuadro(caidas, "tomadas")).toContain(">—<"); expect(caidas).not.toContain("data-visto="); expect(caidas).toContain("data-sin-marcas")
  })
  it("el radar y los 8 temas a la izquierda; el título RIESGOS con la ✕ arriba de la columna derecha; sin «Actualizar», píldoras, pausas ni «Sin dato»", () => {
    const h = pinta(datos([R("a", 3, "dinero")], {}))
    expect(h).toMatch(/data-columna="lado"[\s\S]*data-radar[\s\S]*data-columna="principal"[\s\S]*id="riesgos-titulo"[^>]*>Riesgos<[\s\S]*data-cerrar/)
    expect(recuadro(h, "abiertas")).toBeTruthy()
    expect(h).toMatch(/data-tarjeta-sector="dinero"[^>]*>.*?text-alarma[^>]*>1</) // el tema con lo grave, en rojo
    expect(h).not.toMatch(/Actualizar|data-filtro-gravedad|Tus pausas|data-sin-dato/)
  })
  it("los colores del radar salen de los tokens: alarma solo para lo grave, oro y gris para lo demás", () => {
    const c = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
    expect(c).toContain('const RELLENO: Record<Gravedad, string> = { 3: "fill-alarma", 2: "fill-oro", 1: "fill-apagado" }')
    expect(c).not.toMatch(/rgba\(|#[0-9a-fA-F]{3,6}\b|amber|rose|yellow|orange/)
  })
})
