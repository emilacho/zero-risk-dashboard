// @vitest-environment jsdom
/**
 * 28-nov · GO Lenovo (`2026-11-28-GO-LENOVO-a-CC4-diagnostico-historia-invisible-y-eliminar-archivada.md`) · boceto 5/6/7 aprobado por Emilio 17:46Z:
 *  H · una pieza SIN fila del calendario (el kit de historias de la campaña entera) que espera tu decisión sale en Piezas con su tipo («Historias») y su «Abrir Propuestas»
 *  P · con «Por aprobar» NUNCA sale una pieza rechazada, superada (reemplazada) o ya decidida; con «Todas» sí; el archivo no cambia
 *  A · las campañas ARCHIVADAS salen debajo de los lugares con el mismo «Eliminar» de dos clics («¿Seguro?»)
 * US$ 0 · sin red · dos clientes de rubros distintos (un restaurante y una clínica dental): nada depende de uno.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { familiaLegible } from "@/lib/lenguaje"
import { listarEnCurso, type FilaDeLaLista } from "@/lib/piezas-datos"
import { arbolDeLaBandeja, filasDeSubcategorias, CARPETA_ARCHIVO, numeroDelCliente } from "@/lib/bandeja"
import { campanasArchivadas, flujoDeCampana, MAX_ARCHIVADAS, type CampanaArchivada } from "@/lib/flujo-de-campana"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { faseActiva } from "@/lib/pizarron"
import type { Pizarron } from "@/lib/pizarron-datos"
import { CampanasArchivadas, NO_SE_PUDO_ELIMINAR, TITULO_ARCHIVADAS, useCampanasArchivadas } from "@/components/nuevo/CampanasArchivadas"
import { ESPERA_DE_LAS_OPCIONES_MS, ESPERA_DEL_SEGURO_MS, TEXTO_SEGURO, TEXTO_TRABAJO_EN_CURSO } from "@/components/nuevo/BotonFlujo"

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const CASOS = [
  { id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", nombre: "Restaurante La Ola" },
  { id: "b7c9e2d4-1a3f-4e8b-9d6c-5f0a2b3c4d5e", nombre: "Clínica Dental Sonrisa" },
] as const

/** base falsa que filtra de verdad por eq / in / is / not-is-null y anota cada pedido */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, conError: string[] = [], log: string[] = []) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = (cols: string) => { log.push(`${t}:select ${cols}`); return b }
    b.eq = (c: string, v: unknown) => { log.push(`${t}:eq ${c}=${String(v)}`); filas = filas.filter((f) => f[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { log.push(`${t}:in ${c}=${vs.join(",")}`); filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.is = (c: string, v: unknown) => { filas = filas.filter((f) => (f[c] ?? null) === v); return b }
    b.not = (c: string, op: string, v: unknown) => { log.push(`${t}:not ${c} ${op} ${String(v)}`); if (op === "is" && v === null) filas = filas.filter((f) => (f[c] ?? null) !== null); return b }
    b.neq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] !== v); return b }
    b.order = (c: string, o: { ascending?: boolean } = {}) => { log.push(`${t}:order ${c} ${o.ascending === false ? "desc" : "asc"}`); filas.sort((x, y) => String(x[c]).localeCompare(String(y[c])) * (o.ascending === false ? -1 : 1)); return b }
    b.limit = (n: number) => { log.push(`${t}:limit ${n}`); filas = filas.slice(0, n); return b }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(conError.includes(t) ? { data: null, error: { message: "caída" } } : { data: filas, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}

describe("H · el kit de historias tiene nombre", () => {
  it("🔴 `kit_mesa` → «Historias» (antes «Pieza»); los demás no cambian", () => {
    expect(familiaLegible("kit_mesa")).toBe("Historias")
    expect(familiaLegible("kit_historias")).toBe("Historias")
    expect(familiaLegible("post_mesa")).toBe("Publicación con imagen")
    expect(familiaLegible("video_mesa")).toBe("Video corto")
    expect(familiaLegible("otra_cosa")).toBe("Pieza")
  })
})

describe.each(CASOS)("H · $nombre · un encargo SIN fila del calendario", (c) => {
  const K = "2c601793-a138-49a2-9788-f69ea424f5f0", F = "6f49c362-bd73-4d54-8ec0-56abb9f2bbdc", S = "11111111-0000-4000-8000-000000000003", Z = "22222222-0000-4000-8000-000000000004"
  const ENC = (id: string, p: Record<string, unknown> = {}) => ({ id, client_id: c.id, familia: "post_mesa", estado: "en_paso", dry_run: false, prueba: false, archivada_en: null, hitl_queue_id: null, creado_en: "2026-11-26T09:30:30Z", fila: { id: "s2-d1", fecha: "2026-12-07" }, rehace: null, paso: 21, ...p })
  const base = (log: string[] = []) => baseFalsa({
    oficina_encargos: [
      ENC(F),
      ENC(K, { familia: "kit_mesa", fila: null, creado_en: "2026-11-26T09:30:34Z", paso: 16 }), // sin fila, en la mesa, espera al dueño
      ENC(S, { familia: "kit_mesa", fila: null, creado_en: "2026-11-26T09:30:35Z" }), // sin fila, en la mesa, SIN turno del dueño
      ENC(Z, { familia: "kit_mesa", fila: null, estado: "cerrado", creado_en: "2026-11-26T09:30:36Z" }), // sin fila, ya entregado
    ],
    jefatura_revisiones: [{ artifact_type: "pieza", artifact_id: Z, estado: "en_curso", creado_en: "2" }],
    oficina_turnos: [
      { encargo_id: F, tipo: "dueno", estado: "corriendo" },
      { encargo_id: K, tipo: "dueno", estado: "corriendo" },
      { encargo_id: Z, tipo: "dueno", estado: "corriendo" },
    ],
  }, [], log)

  it("🔴 el que espera tu decisión entra con su tipo y «espera»; sin turno del dueño o ya entregado, no", async () => {
    const l = await listarEnCurso(base())
    expect(l.map((x) => [x.encargo_id, x.tipo_legible, x.espera_al_dueno ?? false, x.columna])).toEqual([
      [K, "Historias", true, "en_el_estudio"], // la más nueva primero (como siempre)
      [F, "Publicación con imagen", true, "en_el_estudio"],
    ])
    const k = l.find((x) => x.encargo_id === K)!
    expect(k.publica).toBeNull() // sin fila no hay día de publicación: no se inventa
    expect(k.paso).toBe(16)
    expect(k.cliente_id).toBe(c.id)
  })
  it("🔴 el turno del dueño se pregunta también por los encargos sin fila en la mesa (no por el entregado)", async () => {
    const log: string[] = []
    await listarEnCurso(base(log))
    expect(log).toContain(`oficina_turnos:in encargo_id=${F},${S},${K}`)
    // el entregado SIN fila no pide su revisión: solo los que tienen fila (como antes)
    expect(log.some((x) => x.startsWith("jefatura_revisiones:in") && x.includes(Z))).toBe(false)
  })
  it("🔴 un encargo para REHACER una pieza (sin fila pero con su pedido de cambios) sigue como antes: sale aunque no espere al dueño", async () => {
    const R = "33333333-0000-4000-8000-000000000005"
    const l = await listarEnCurso(baseFalsa({ oficina_encargos: [ENC(R, { fila: null, rehace: { desde_hitl: "h" }, familia: "kit_mesa" })], jefatura_revisiones: [], oficina_turnos: [] }))
    expect(l.map((x) => [x.encargo_id, x.espera_al_dueno ?? false])).toEqual([[R, false]])
  })
  it("🔴 en Piezas («Por aprobar»): carpeta «Historias» con 1 por aprobar y su tarjeta en curso", async () => {
    const l = (await listarEnCurso(base())).filter((x) => x.espera_al_dueno)
    const filas = filasDeSubcategorias(null, l, "pendiente", c.id)
    expect(filas.map((f) => [f.nombre, f.numero])).toEqual([["Historias", 1], ["Publicación con imagen", 1]])
    expect(filas[0].elementos).toEqual([{ tipo: "en_curso", pieza: l.find((x) => x.encargo_id === K) }])
  })
})

describe.each(CASOS)("P · $nombre · «Por aprobar» solo muestra lo que espera tu decisión", (c) => {
  const fila = (id: string, estado: FilaDeLaLista["estado"], carpeta = "Historias Instagram", p: Partial<FilaDeLaLista> = {}): FilaDeLaLista => ({
    id, cliente_id: c.id, cliente: c.nombre, carpeta, estado, status: estado === "pendiente" ? "pending" : "rejected", tipo: "content_piece_review", es_pieza: true,
    titulo: "x", titulo_legible: `${carpeta} · ${c.nombre}`, creada: "2026-11-26T09:00:00Z", gasto_usd: null, incompleta: false, desacuerdos: 0, tiene_dibujo: true, miniatura: "imagen", archivada: false, ...p,
  })
  const piezas = [fila("p1", "pendiente"), fila("r1", "rechazada"), fila("s1", "superada"), fila("a1", "aprobada"), fila("c1", "con_cambios"), fila("o1", "rechazada", "Pieza")]
  const archivo = [fila("x1", "rechazada", CARPETA_ARCHIVO, { archivada: true })]

  it("🔴 con «Por aprobar»: sale la pendiente; rechazada, superada, aprobada y con cambios NO; una carpeta que queda vacía desaparece", () => {
    const [cl] = arbolDeLaBandeja(piezas, [], archivo)
    const filas = filasDeSubcategorias(cl, [], "pendiente", c.id)
    expect(filas.map((f) => [f.nombre, f.elementos.map((e) => (e.tipo === "pieza" ? e.fila.id : "")).join(",")])).toEqual([
      ["Historias Instagram", "p1"],
      [CARPETA_ARCHIVO, "x1"], // el archivo no cambia
    ])
    expect(filas.some((f) => f.nombre === "Pieza")).toBe(false) // la carpeta «Pieza 0» con la tarjeta vieja ya no sale
    expect(numeroDelCliente(filas)).toBe(1)
  })
  it("🔴 con «Todas» sigue saliendo todo", () => {
    const [cl] = arbolDeLaBandeja(piezas, [], archivo)
    const filas = filasDeSubcategorias(cl, [], "todas", c.id)
    expect(filas.find((f) => f.nombre === "Historias Instagram")!.elementos.length).toBe(5)
    expect(filas.find((f) => f.nombre === "Pieza")!.elementos.length).toBe(1)
  })
})

describe.each(CASOS)("A · $nombre · la lectura de las archivadas", (c) => {
  const CAMP = (id: string, p: Record<string, unknown> = {}) => ({ id, client_id: c.id, seco: false, nombre_de_campana: null, creada_en: "2026-11-18T08:33:22Z", archivada_en: null, ...p })
  it("🔴 solo las archivadas reales del cliente, la más reciente primero; sin nombre «Campaña del <día de creación>»", async () => {
    const log: string[] = []
    const sb = baseFalsa({ cadena_campanas: [
      CAMP("a-vieja", { archivada_en: "2026-11-20T10:00:00Z", nombre_de_campana: "  Verano  " }),
      CAMP("a-nueva", { archivada_en: "2026-11-26T18:02:38Z" }),
      CAMP("viva"),
      CAMP("ensayo", { seco: true, archivada_en: "2026-11-27T10:00:00Z" }),
      CAMP("de-otro", { client_id: "otro", archivada_en: "2026-11-27T10:00:00Z" }),
    ] }, [], log)
    expect(await campanasArchivadas(sb, c.id)).toEqual([
      { campana_id: "a-nueva", nombre: "Campaña del 18 nov", archivada_en: "2026-11-26T18:02:38Z" },
      { campana_id: "a-vieja", nombre: "Verano", archivada_en: "2026-11-20T10:00:00Z" },
    ])
    expect(log).toEqual([
      "cadena_campanas:select id, nombre_de_campana, creada_en, archivada_en",
      `cadena_campanas:eq client_id=${c.id}`, "cadena_campanas:eq seco=false",
      "cadena_campanas:not archivada_en is null", "cadena_campanas:order archivada_en desc", `cadena_campanas:limit ${MAX_ARCHIVADAS}`,
    ])
  })
  it("🔴 si la base cae, lo dice (nunca «no hay archivadas»)", async () => {
    await expect(campanasArchivadas(baseFalsa({}, ["cadena_campanas"]), c.id)).rejects.toThrow(/archivadas: caída/)
  })
})

const puerta = vi.hoisted(() => ({ valor: { ok: true, email: "emilio" } as { ok: boolean; status?: number; email?: string } }))
const sb = vi.hoisted(() => ({ valor: null as unknown }))
vi.mock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta.valor }))
vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => sb.valor }))

describe("A · GET /api/campanas-archivadas", () => {
  const C = CASOS[0].id
  beforeEach(() => { puerta.valor = { ok: true, email: "emilio" } })
  it("🔴 un administrador recibe las archivadas del cliente", async () => {
    sb.valor = baseFalsa({ cadena_campanas: [{ id: "a1", client_id: C, seco: false, nombre_de_campana: "Otoño", creada_en: "2026-11-01T12:00:00Z", archivada_en: "2026-11-26T18:00:00Z" }] })
    const { GET } = await import("@/app/api/campanas-archivadas/route")
    const r = await GET(new Request(`http://x/api/campanas-archivadas?cliente=${C}`))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, archivadas: [{ campana_id: "a1", nombre: "Otoño", archivada_en: "2026-11-26T18:00:00Z" }] })
  })
  it("🔴 un client_viewer recibe 403 y sin sesión 401, sin datos", async () => {
    const { GET } = await import("@/app/api/campanas-archivadas/route")
    puerta.valor = { ok: false, status: 403 }
    let r = await GET(new Request(`http://x/api/campanas-archivadas?cliente=${C}`))
    expect(r.status).toBe(403); expect(await r.json()).toEqual({ ok: false, error: "sin_permiso" })
    puerta.valor = { ok: false, status: 401 }
    r = await GET(new Request(`http://x/api/campanas-archivadas?cliente=${C}`))
    expect(r.status).toBe(401); expect(await r.json()).toEqual({ ok: false, error: "sin_sesion" })
  })
  it("🔴 sin cliente válido: 400 · si la base cae: 502", async () => {
    const { GET } = await import("@/app/api/campanas-archivadas/route")
    expect((await GET(new Request("http://x/api/campanas-archivadas?cliente=nada"))).status).toBe(400)
    sb.valor = baseFalsa({}, ["cadena_campanas"])
    const r = await GET(new Request(`http://x/api/campanas-archivadas?cliente=${C}`))
    expect(r.status).toBe(502); expect((await r.json()).ok).toBe(false)
  })
})

describe.each(CASOS)("A · $nombre · «Eliminar» de una archivada", (c) => {
  const ARCH: CampanaArchivada = { campana_id: `${c.id.slice(0, 8)}-0000-4000-8000-00000000000a`, nombre: "Campaña del 18 nov", archivada_en: "2026-11-26T18:02:38Z" }
  const red = (respuesta: { status: number; cuerpo: Record<string, unknown> }) => {
    const pedidos: Array<{ url: string; cuerpo: unknown }> = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url: String(url), cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
      return new Response(JSON.stringify(respuesta.cuerpo), { status: respuesta.status })
    }))
    return pedidos
  }
  const pasar = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms) }) }
  const lugar = (x: HTMLElement) => x.querySelector(`[data-campana-archivada="${ARCH.campana_id}"]`)!
  const boton = (x: HTMLElement) => x.querySelector("[data-eliminar-campana]") as HTMLButtonElement | null

  it("🔴 sin archivadas (o sin lectura) no se pinta nada", () => {
    expect(render(createElement(CampanasArchivadas, { archivadas: [] })).container.innerHTML).toBe("")
    expect(render(createElement(CampanasArchivadas, { archivadas: null })).container.innerHTML).toBe("")
  })
  it("🔴 «ARCHIVADAS · N», su nombre y el día en que se archivó; «Eliminar» solo al dejar el cursor encima", async () => {
    vi.useFakeTimers()
    const { container } = render(createElement(CampanasArchivadas, { archivadas: [ARCH, { ...ARCH, campana_id: "otra", nombre: "Verano" }] }))
    expect(container.querySelector("[data-campanas-archivadas] p")?.textContent).toBe(`${TITULO_ARCHIVADAS} · 2`)
    expect(lugar(container).textContent).toContain("Campaña del 18 nov")
    expect(lugar(container).textContent).toContain("Archivada · 26 nov")
    expect(boton(container)).toBeNull()
    fireEvent.mouseEnter(lugar(container))
    await pasar(ESPERA_DE_LAS_OPCIONES_MS - 1)
    expect(boton(container)).toBeNull()
    await pasar(1)
    expect(boton(container)?.textContent).toBe("Eliminar")
    fireEvent.mouseLeave(lugar(container))
    expect(boton(container)).toBeNull()
  })
  it("🔴 dos clics: el 1.º pide «¿Seguro?» sin pedir nada; el 2.º elimina ESA campaña y el Centro vuelve a leer", async () => {
    vi.useFakeTimers()
    const pedidos = red({ status: 200, cuerpo: { ok: true } })
    const onCambio = vi.fn()
    const { container } = render(createElement(CampanasArchivadas, { archivadas: [ARCH], onCambio }))
    fireEvent.mouseEnter(lugar(container)); await pasar(ESPERA_DE_LAS_OPCIONES_MS)
    await act(async () => { fireEvent.click(boton(container)!) })
    expect(boton(container)?.textContent).toBe(TEXTO_SEGURO)
    expect(boton(container)?.getAttribute("data-seguro")).toBe("si")
    expect(pedidos).toEqual([])
    await act(async () => { fireEvent.click(boton(container)!) })
    expect(pedidos).toEqual([{ url: "/api/campana-archivo", cuerpo: { campana_id: ARCH.campana_id, accion: "eliminar" } }])
    expect(onCambio).toHaveBeenCalledTimes(1)
  })
  it("🔴 «¿Seguro?» vuelve solo a «Eliminar» si no llega el 2.º clic (y al salir el cursor)", async () => {
    vi.useFakeTimers()
    const pedidos = red({ status: 200, cuerpo: { ok: true } })
    const { container } = render(createElement(CampanasArchivadas, { archivadas: [ARCH] }))
    fireEvent.mouseEnter(lugar(container)); await pasar(ESPERA_DE_LAS_OPCIONES_MS)
    await act(async () => { fireEvent.click(boton(container)!) })
    await pasar(ESPERA_DEL_SEGURO_MS - 1)
    expect(boton(container)?.textContent).toBe(TEXTO_SEGURO)
    await pasar(1)
    expect(boton(container)?.textContent).toBe("Eliminar")
    await act(async () => { fireEvent.click(boton(container)!) }) // vuelve a pedir «¿Seguro?», no elimina
    expect(pedidos).toEqual([])
    fireEvent.mouseLeave(lugar(container)); fireEvent.mouseEnter(lugar(container)); await pasar(ESPERA_DE_LAS_OPCIONES_MS)
    expect(boton(container)?.textContent).toBe("Eliminar")
  })
  it("🔴 si hay trabajo en curso lo dice tal cual; si falla, «No se pudo eliminar ahora…»; en los dos casos el Centro no se relee", async () => {
    vi.useFakeTimers()
    for (const [resp, texto] of [[{ status: 409, cuerpo: { ok: false, error: "trabajo_en_curso" } }, TEXTO_TRABAJO_EN_CURSO], [{ status: 502, cuerpo: { ok: false, error: "base_no_responde" } }, NO_SE_PUDO_ELIMINAR]] as const) {
      red(resp)
      const onCambio = vi.fn()
      const { container, unmount } = render(createElement(CampanasArchivadas, { archivadas: [ARCH], onCambio }))
      fireEvent.mouseEnter(lugar(container)); await pasar(ESPERA_DE_LAS_OPCIONES_MS)
      await act(async () => { fireEvent.click(boton(container)!) })
      await act(async () => { fireEvent.click(boton(container)!) })
      expect(container.querySelector("[data-nota-de-la-archivada]")?.textContent).toBe(texto)
      expect(onCambio).not.toHaveBeenCalled()
      unmount()
    }
  })
  it("🔴 la lectura: pide `/api/campanas-archivadas` de ESE cliente; con lo ya leído no pide nada", async () => {
    const pedidos = red({ status: 200, cuerpo: { ok: true, archivadas: [ARCH] } })
    function Ver({ inicial }: { inicial: CampanaArchivada[] | null }) {
      const a = useCampanasArchivadas(c.id, 0, inicial)
      return createElement("p", { "data-n": a ? a.length : "nada" })
    }
    const v = render(createElement(Ver, { inicial: null }))
    await act(async () => { await Promise.resolve() })
    await vi.waitFor(() => expect(v.container.querySelector("[data-n]")?.getAttribute("data-n")).toBe("1"))
    expect(pedidos.map((p) => p.url)).toEqual([`/api/campanas-archivadas?cliente=${encodeURIComponent(c.id)}`])
    cleanup(); pedidos.length = 0
    const w = render(createElement(Ver, { inicial: [] }))
    expect(w.container.querySelector("[data-n]")?.getAttribute("data-n")).toBe("0")
    expect(pedidos).toEqual([])
  })
})

describe("A · en el Centro: debajo de los 3 lugares", () => {
  const HOY = "2026-11-28"
  const piz = (id: string, nombre: string) => ({
    clientes: [{ id, nombre, con_campana: true }], cliente: { id, nombre },
    campana: { id: "c-viva", estado: "activa", desde: "2026-11-09", hasta: "2027-02-06", version_calendario: null, version_estrategia: 1 },
    fases: [], fase_activa: faseActiva([], null, HOY), gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, manual_aprobado: true, hoy: HOY, leido_en: "x",
  }) as unknown as Pizarron
  const VERDE = flujoDeCampana({ estado: "activa" })!
  for (const c of CASOS) {
    it(`🔴 ${c.nombre}: «ARCHIVADAS · 1» va después de los lugares; sin archivadas, nada`, () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 500 })))
      const arch: CampanaArchivada = { campana_id: "c-arch", nombre: "Campaña del 18 nov", archivada_en: "2026-11-26T18:02:38Z" }
      const con = render(createElement(PanelAplicaciones, { onCerrar: () => {}, datosIniciales: piz(c.id, c.nombre), flujoInicial: { campana_id: "c-viva", flujo: VERDE, campanas: [{ campana_id: "c-viva", nombre: "Viva", flujo: VERDE }], archivadas: [arch] } }))
      const seccion = con.container.querySelector("[data-campanas-archivadas]")
      expect(seccion?.textContent).toContain(`${TITULO_ARCHIVADAS} · 1`)
      expect(seccion?.querySelector('[data-campana-archivada="c-arch"]')).not.toBeNull()
      const lugares = con.container.querySelector("[data-lugares-de-campana]")!
      expect(lugares.compareDocumentPosition(seccion!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      cleanup()
      const sin = render(createElement(PanelAplicaciones, { onCerrar: () => {}, datosIniciales: piz(c.id, c.nombre), flujoInicial: { campana_id: "c-viva", flujo: VERDE, campanas: [{ campana_id: "c-viva", nombre: "Viva", flujo: VERDE }] } }))
      expect(sin.container.querySelector("[data-campanas-archivadas]")).toBeNull()
      expect((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.some((x) => String(x[0]).includes("campanas-archivadas"))).toBe(false)
    })
  }
})
