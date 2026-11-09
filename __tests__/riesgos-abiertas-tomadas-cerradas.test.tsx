/**
 * RIESGOS EN ESCRITORIO (Emilio 06-nov 01:46: «el radar a la izquierda, y lo nuevo reemplaza lo de la derecha» · pedido y corrección de Lenovo sobre #290).
 * Abiertas · Tomadas · Cerradas con la marca «Visto» del tablero; la campana y el $ no se tocan. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { cerrarLasQueYaNoEstan, claveDelCierre, claveDelRiesgo, estadoDeLosRiesgos, leerVistosDeRiesgos, marcarRiesgoVisto, TOPE_DE_MARCAS, vistosDeLasMarcas } from "@/lib/riesgos-vistos"
import { claveValida } from "@/lib/alertas"
import { PanelRiesgos } from "@/components/nuevo/PanelRiesgos"

const R = (id: string, gravedad: 1 | 2 | 3, sector = "flujos") => ({ id, gravedad, titulo: `riesgo ${id}`, categoria: "incidente", detalle: null, sector, client_id: null, cliente: null, fuente: "n8n", desde: "2026-11-06T08:00:00Z" }) as never
const AHORA = Date.parse("2026-11-06T10:00:00Z")
const datos = (riesgos: never[], vistos?: Record<string, string> | null, o: { cierres?: Record<string, string> | null; completo?: boolean } = { cierres: {} }) => ({
  generado_en: null, completo: o.completo ?? true, ...("cierres" in o ? { cierres: o.cierres } : {}), total: riesgos.length, por_gravedad: { 1: 0, 2: 0, 3: 0 }, por_sector: { dinero: 0, credenciales: 0, servicios: 0, flujos: 0, datos: 0, calidad: 0, plazos: 0, seguridad: 0 },
  riesgos, decisiones_tuyas: [], caducados: 0, saldos: [], topes: [], fuentes: [], sin_fuente: [], ...(vistos === undefined ? {} : { vistos }),
}) as never
const pinta = (d: never, filtroInicial?: "abiertas" | "tomadas" | "cerradas") => renderToStaticMarkup(createElement(PanelRiesgos, { onCerrar: () => {}, datosIniciales: d, filtroInicial })).replace(/<!-- -->/g, "")
const recuadro = (h: string, k: string) => h.match(new RegExp(`data-recuadro="${k}".*?</button>`))?.[0] ?? ""

describe("las marcas «Visto» de los riesgos", () => {
  it("🔴 abiertas = activas sin marca · tomadas = activas con marca · cerradas = cierres guardados que no volvieron, solo 7 días, la más reciente arriba", () => {
    const activos = [R("a", 3), R("b", 2), R("c", 1)]
    const cierres = { viejo: "2026-10-20T09:00:00Z", x: "2026-11-05T09:00:00Z", y: "2026-11-06T07:00:00Z", c: "2026-11-06T06:00:00Z" } // «c» volvió: no es cerrada
    const e = estadoDeLosRiesgos(activos, { b: "2026-11-06T09:00:00Z" }, { cierres, completo: true, ahora: AHORA })
    expect(e.abiertas.map((r: { id: string }) => r.id)).toEqual(["a", "c"])
    expect(e.tomadas.map((r: { id: string }) => r.id)).toEqual(["b"])
    expect(e.cerradas).toEqual([{ id: "y", cerrada_en: "2026-11-06T07:00:00Z" }, { id: "x", cerrada_en: "2026-11-05T09:00:00Z" }])
  })
  it("🔴 CC6 · con la lista incompleta no se afirma ningún cierre (null), aunque haya cierres guardados; sin cierres leídos, tampoco", () => {
    expect(estadoDeLosRiesgos([], {}, { cierres: { y: "2026-11-06T07:00:00Z" }, completo: false, ahora: AHORA }).cerradas).toBeNull()
    expect(estadoDeLosRiesgos([], {}, { cierres: null, completo: true, ahora: AHORA }).cerradas).toBeNull()
    expect(estadoDeLosRiesgos([], {}, { cierres: { y: "2026-11-06T07:00:00Z" }, completo: true, ahora: AHORA }).cerradas).toHaveLength(1)
  })
  it("🔴 CC6 · la marca no sobrevive al cierre: visto → falta en una lectura completa → vuelve ⇒ ABIERTA", async () => {
    // base de mentira con la tabla de marcas en memoria
    const tabla = new Map<string, string>([[claveDelRiesgo("credencial:n8n"), "2026-10-01T09:00:00Z"], [claveDelRiesgo("b"), "2026-11-06T09:00:00Z"]])
    const supa = { from: () => ({
      upsert: (f: { clave: string; visto_en: string }) => { tabla.set(f.clave, f.visto_en); return Promise.resolve({ error: null }) },
      delete: () => ({ eq: (_c: string, v: string) => { tabla.delete(v); return Promise.resolve({ error: null }) } }),
    }) } as never
    const leidos = vistosDeLasMarcas([...tabla].map(([clave, visto_en]) => ({ clave, visto_en })))
    // lectura INCOMPLETA sin el riesgo: no se toca nada
    expect(await cerrarLasQueYaNoEstan(supa, [R("b", 2)], leidos, false)).toEqual(leidos)
    expect(tabla.has(claveDelRiesgo("credencial:n8n"))).toBe(true)
    // lectura COMPLETA sin el riesgo: se guarda el cierre y se borra la marca
    const quedan = await cerrarLasQueYaNoEstan(supa, [R("b", 2)], leidos, true, new Date(AHORA))
    expect(quedan).toEqual({ b: "2026-11-06T09:00:00Z" })
    expect(tabla.has(claveDelRiesgo("credencial:n8n"))).toBe(false); expect(tabla.get(claveDelCierre("credencial:n8n"))).toBe(new Date(AHORA).toISOString())
    // vuelve: entra Abierto, no Tomado; y ya no cuenta como cerrada
    const e = estadoDeLosRiesgos([R("credencial:n8n", 3), R("b", 2)], quedan!, { cierres: { "credencial:n8n": new Date(AHORA).toISOString() }, completo: true, ahora: AHORA })
    expect(e.abiertas.map((r: { id: string }) => r.id)).toEqual(["credencial:n8n"]); expect(e.cerradas).toEqual([])
  })
  it("🔴 si guardar el cierre falla, la marca se queda (se reintenta); si borrar falla, también; sin marcas, nada", async () => {
    const borradas: string[] = []
    const base = (upsertFalla: boolean, borrarFalla: boolean) => ({ from: () => ({
      upsert: () => Promise.resolve({ error: upsertFalla ? { message: "x" } : null }),
      delete: () => ({ eq: (_c: string, v: string) => { borradas.push(v); return Promise.resolve({ error: borrarFalla ? { message: "x" } : null }) } }),
    }) }) as never
    expect(await cerrarLasQueYaNoEstan(base(true, false), [], { a: "t" }, true)).toEqual({ a: "t" }); expect(borradas).toEqual([]) // sin cierre guardado, no se borra la marca
    expect(await cerrarLasQueYaNoEstan(base(false, true), [], { a: "t" }, true)).toEqual({ a: "t" })
    expect(await cerrarLasQueYaNoEstan(base(false, false), [], null, true)).toBeNull()
  })
  it("🔴 CC6 · «Visto»: si se guardó, pasa a Tomada; si falla (respuesta o red), lo dice y sigue Abierta", async () => {
    const pedidos: Array<{ url: string; cuerpo: string }> = []
    const ok = ((url: string, init: { body: string }) => { pedidos.push({ url, cuerpo: init.body }); return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })) }) as never
    const r = await marcarRiesgoVisto(ok, "a", { b: "t0" }, new Date(AHORA))
    expect(r).toEqual({ ok: true, vistos: { b: "t0", a: new Date(AHORA).toISOString() } })
    expect(pedidos).toEqual([{ url: "/api/alertas/visto", cuerpo: JSON.stringify({ clave: "riesgo:a" }) }])
    const e = estadoDeLosRiesgos([R("a", 3)], r.ok ? r.vistos : {}, { cierres: {}, completo: true, ahora: AHORA })
    expect(e.tomadas).toHaveLength(1); expect(e.abiertas).toHaveLength(0)
    const falla = (() => Promise.resolve(new Response(JSON.stringify({ ok: false, error: "no_se_pudo_guardar" }), { status: 500 }))) as never
    expect(await marcarRiesgoVisto(falla, "a", {})).toEqual({ ok: false, error: "No pude guardar que lo viste. Prueba otra vez." })
    const okFalso = (() => Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 200 }))) as never
    expect((await marcarRiesgoVisto(okFalso, "a", {})).ok).toBe(false)
    const red = (() => Promise.reject(new Error("red"))) as never
    expect((await marcarRiesgoVisto(red, "a", {})).ok).toBe(false)
    // el panel usa esta función y muestra su error
    const c = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
    expect(c).toContain("const r = await marcarRiesgoVisto(fetchImpl, id, datos?.vistos)"); expect(c).toContain("else setError(r.error)")
    expect(c).toContain("if (r.ok) { setDatos((d) => (d ? { ...d, vistos: { ...(d.vistos ?? {}), ...r.vistos } } : d)); setElegido(null) }") // sin otra lectura de por medio
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
    // CC6 · en el tope de lectura no se sabe qué quedó afuera: null
    const llenas = Array.from({ length: TOPE_DE_MARCAS }, (_, i) => ({ clave: `riesgo:r${i}`, visto_en: "t" }))
    expect(await leerVistosDeRiesgos(base({ data: llenas, error: null }))).toBeNull()
    expect(await leerVistosDeRiesgos(base({ data: llenas.slice(1), error: null }))).not.toBeNull()
    const lanza = { from: () => { throw new Error("red") } } as never
    expect(await leerVistosDeRiesgos(lanza)).toBeNull()
  })
  it("la ruta del tablero devuelve las marcas junto a los riesgos", () => {
    const ruta = readFileSync("app/api/direccion/riesgos/route.ts", "utf8")
    expect(ruta).toContain("await cerrarLasQueYaNoEstan(supa, r.datos.riesgos, await leerVistosDeRiesgos(supa), r.datos.completo)")
    expect(ruta).toContain("const cierres = await leerCierresDeRiesgos(supa)"); expect(ruta).toContain("{ ok: true, ...r.datos, vistos, cierres }")
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
  it("🔴 CC6 · con la lista incompleta, Cerradas dice «—» y no muestra ningún «se resolvió»", () => {
    const d = datos([R("a", 3)], {}, { cierres: { y: "2026-11-06T07:00:00Z" }, completo: false })
    expect(recuadro(pinta(d), "cerradas")).toContain(">—<")
    const h = pinta(d, "cerradas")
    expect(h).not.toContain("se resolvió"); expect(h).not.toContain("data-ficha-cerrada"); expect(h).toContain("La lista vino incompleta")
    const completa = pinta(datos([R("a", 3)], {}, { cierres: { y: new Date().toISOString() }, completo: true }), "cerradas")
    expect(completa).toContain('data-ficha-cerrada="y"'); expect(completa).toContain("Se cerró")
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
