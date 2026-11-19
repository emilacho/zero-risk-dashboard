// @vitest-environment jsdom
/**
 * EL BOTÓN «FLUJO DE LA CAMPAÑA» (GO de Lenovo 18-nov · boceto aprobado por Emilio) · la parte del tablero, sin red ni base (US$ 0).
 *   · los 3 estados se leen con la MISMA regla y el MISMO texto de contrato que la plataforma
 *   · el toque va a la plataforma como decisión humana (`workflow_id: tablero`); el 409 vuelve como dato, sin alarma
 *   · la ruta es solo de administrador: 401 sin sesión · 403 a un `client_viewer` · nunca toca la base sin la puerta
 *   · el botón: debajo de los 9 cuadros, ícono + título + UNA línea; el rojo parpadea; sin campaña no hay botón
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ESTADOS_EN_MARCHA, PREFIJO_DE_PAUSA_DEL_TABLERO, flujoDeCampana, leerFlujo, leerPausaDelTablero, motivoBreve, quieroAlTocar, tocarFlujo } from "@/lib/flujo-de-campana"
import { BotonFlujo, CLASES_DEL_FLUJO, CLASE_DEL_BOTON } from "@/components/nuevo/BotonFlujo"
import { CampanaComoTexto, LugaresDeCampana, campanaElegida, campanasDeLaLectura } from "@/components/nuevo/LugaresDeCampana"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const CAMPANA = "36e66179-3061-4a7d-94db-932a900d9515"
const CLIENTE = "11111111-2222-3333-4444-555555555555"
// la puerta de administrador simulada (la usan las pruebas de la ruta)
const puerta = vi.hoisted(() => ({ valor: { ok: false, status: 401 } as { ok: boolean; status?: number; email?: string } }))
const tocoLaBase = vi.hoisted(() => ({ n: 0 }))
vi.mock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta.valor }))
vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => { tocoLaBase.n++; return {} } }))
const PAUSA = `${PREFIJO_DE_PAUSA_DEL_TABLERO} · vuelve a: activa · en la semana 4 del calendario`

/** una base de juguete que solo contesta lo que el código pide (y registra qué pidió) */
function base(fila: Record<string, unknown> | null, error: { message: string } | null = null) {
  const pedidos: Array<{ tabla: string; filtros: Array<[string, unknown]> }> = []
  const supabase = {
    from(tabla: string) {
      const p = { tabla, filtros: [] as Array<[string, unknown]> }
      pedidos.push(p)
      const q: Record<string, unknown> = {
        select: () => q, order: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { p.filtros.push([k, v]); return q },
        maybeSingle: async () => ({ data: fila, error }),
      }
      return q
    },
  }
  return { supabase: supabase as never, pedidos }
}

describe("el contrato con la plataforma", () => {
  it("el prefijo es EXACTO (la plataforma escribe el mismo texto)", () => {
    expect(PREFIJO_DE_PAUSA_DEL_TABLERO).toBe("pausada desde el tablero")
    expect(leerPausaDelTablero(PAUSA)).toEqual({ vuelve_a: "activa", hito: "en la semana 4 del calendario" })
  })
  it("otro texto no es una pausa del tablero", () => {
    for (const m of ["pasaron 7 días en necesita_humano", `${PREFIJO_DE_PAUSA_DEL_TABLERO} · vuelve a: cerrada · x`, "Pausada desde el tablero · vuelve a: activa · x", null]) expect(leerPausaDelTablero(m)).toBeNull()
  })
})

describe("los 3 estados", () => {
  it("verde en cada estado en marcha", () => {
    for (const e of ESTADOS_EN_MARCHA) expect(flujoDeCampana({ estado: e, estado_motivo: null })).toEqual({ color: "verde", linea: "EN MARCHA", estado: e })
  })
  it("dorado con su hito, solo si la pausó el tablero", () => {
    expect(flujoDeCampana({ estado: "pausada", estado_motivo: PAUSA })).toEqual({ color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" })
  })
  it("rojo: necesita_humano y la pausa del reloj, con el motivo breve", () => {
    expect(flujoDeCampana({ estado: "necesita_humano", estado_motivo: "el presupuesto de planificación se agotó (US$ 5.14 de 6)" })?.linea).toBe("DETENIDO · se acabó la bolsa de planificación")
    expect(flujoDeCampana({ estado: "pausada", estado_motivo: "pasaron 7 días en necesita_humano" })).toEqual({ color: "rojo", linea: "DETENIDO · lleva 7 días esperándote", estado: "pausada" })
    expect(motivoBreve("la tanda 3 agotó sus 3 intentos")).toBe("la tanda 3 agotó sus 3 intentos")
  })
  it("sin campaña, cerrada o reemplazada: no hay botón", () => {
    expect(flujoDeCampana(null)).toBeNull()
    expect(flujoDeCampana({ estado: "cerrada" })).toBeNull()
    expect(flujoDeCampana({ estado: "reemplazada" })).toBeNull()
  })
  it("qué hace el toque: verde para; dorado y rojo reanudan", () => {
    expect(quieroAlTocar({ color: "verde", linea: "", estado: "activa" })).toBe("parar")
    expect(quieroAlTocar({ color: "dorado", linea: "", estado: "pausada" })).toBe("reanudar")
    expect(quieroAlTocar({ color: "rojo", linea: "", estado: "necesita_humano" })).toBe("reanudar")
  })
})

describe("leer de la campaña real", () => {
  it("lee la última campaña de verdad del cliente (sin las de ensayo) y su botón", async () => {
    const b = base({ id: CAMPANA, estado: "pausada", estado_motivo: PAUSA })
    expect(await leerFlujo(b.supabase, CLIENTE)).toEqual({ campana_id: CAMPANA, flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" } })
    expect(b.pedidos[0].tabla).toBe("cadena_campanas")
    expect(b.pedidos[0].filtros).toEqual([["client_id", CLIENTE], ["seco", false]])
  })
  it("un error de la base se LANZA (nunca se lee como «sin campaña»)", async () => {
    await expect(leerFlujo(base(null, { message: "caída" }).supabase, CLIENTE)).rejects.toThrow(/caída/)
  })
})

describe("el toque va a la plataforma", () => {
  const plataforma = (status: number, cuerpo: Record<string, unknown>) => {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown>; llave: string | null }> = []
    const fetchImpl = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, cuerpo: JSON.parse(String(init.body)), llave: (init.headers as Record<string, string>)["x-api-key"] ?? null })
      return new Response(JSON.stringify(cuerpo), { status })
    }) as unknown as typeof fetch
    return { fetchImpl, llamadas }
  }
  const deps = (p: ReturnType<typeof plataforma>, fila: Record<string, unknown> | null = { id: CAMPANA }) => ({ supabase: base(fila).supabase, plataformaUrl: "https://plataforma.test/", llave: "k", fetchImpl: p.fetchImpl, ahora: () => "2026-11-18T14:00:00.000Z" })

  it("como decisión humana del tablero, con su rastro, y devuelve el botón como queda", async () => {
    const p = plataforma(200, { campana: { id: CAMPANA }, flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" } })
    const r = await tocarFlujo({ campana_id: CAMPANA, quiero: "parar" }, deps(p))
    expect(r.status).toBe(200); expect(r.cuerpo.ok).toBe(true); expect((r.cuerpo.flujo as { color: string }).color).toBe("dorado")
    expect(p.llamadas).toEqual([{ url: "https://plataforma.test/api/cadena/campanas", llave: "k", cuerpo: { accion: "flujo", campana_id: CAMPANA, quiero: "parar", workflow_id: "tablero", workflow_execution_id: `tablero:flujo:${CAMPANA}:2026-11-18T14:00:00.000Z` } }])
  })
  it("🔴 409 (la causa sigue): pasa tal cual con el botón rojo, para decirlo sin alarma", async () => {
    const p = plataforma(409, { code: "E-CAUSA-SIGUE", detalle: "la bolsa de planificación sigue sin alcanzar (US$ 5.14 de 6)", flujo: { color: "rojo", linea: "DETENIDO · se acabó la bolsa de planificación", estado: "necesita_humano" } })
    const r = await tocarFlujo({ campana_id: CAMPANA, quiero: "reanudar" }, deps(p))
    expect(r.status).toBe(409); expect(r.cuerpo.code).toBe("E-CAUSA-SIGUE"); expect((r.cuerpo.flujo as { color: string }).color).toBe("rojo")
  })
  it("la plataforma sin la acción todavía (404 · 400 E-ACCION): 501, sin simular nada", async () => {
    expect((await tocarFlujo({ campana_id: CAMPANA, quiero: "parar" }, deps(plataforma(404, {})))).status).toBe(501)
    expect((await tocarFlujo({ campana_id: CAMPANA, quiero: "parar" }, deps(plataforma(400, { code: "E-ACCION" })))).cuerpo.error).toBe("flujo_no_publicado")
    // otro 400 de la plataforma NO se disfraza de «sin publicar»
    expect((await tocarFlujo({ campana_id: CAMPANA, quiero: "parar" }, deps(plataforma(400, { code: "E-CAMPOS" })))).status).toBe(400)
  })
  it("pedido mal formado, campaña que no existe o sin llave: no se llama a la plataforma", async () => {
    const p = plataforma(200, {})
    expect((await tocarFlujo({ campana_id: CAMPANA, quiero: "apagar" }, deps(p))).status).toBe(400)
    expect((await tocarFlujo({ campana_id: "x", quiero: "parar" }, deps(p))).status).toBe(400)
    expect((await tocarFlujo({ campana_id: CAMPANA, quiero: "parar" }, deps(p, null))).status).toBe(404)
    expect((await tocarFlujo({ campana_id: CAMPANA, quiero: "parar" }, { ...deps(p), llave: "" })).status).toBe(503)
    expect(p.llamadas).toHaveLength(0)
  })
})

describe("la ruta /api/flujo es solo de administrador", () => {
  beforeEach(() => { tocoLaBase.n = 0 })

  it("sin sesión: 401 en GET y en POST, sin tocar la base", async () => {
    const { GET, POST } = await import("@/app/api/flujo/route")
    puerta.valor = { ok: false, status: 401 }
    expect((await GET(new Request(`http://x/api/flujo?cliente=${CLIENTE}`))).status).toBe(401)
    expect((await POST(new Request("http://x/api/flujo", { method: "POST", body: JSON.stringify({ campana_id: CAMPANA, quiero: "parar" }) }))).status).toBe(401)
    expect(tocoLaBase.n).toBe(0)
  })
  it("🔴 un client_viewer: 403 en GET y en POST, sin tocar la base", async () => {
    const { GET, POST } = await import("@/app/api/flujo/route")
    puerta.valor = { ok: false, status: 403 }
    const g = await GET(new Request(`http://x/api/flujo?cliente=${CLIENTE}`))
    expect(g.status).toBe(403); expect(await g.json()).toEqual({ ok: false, error: "sin_permiso" })
    expect((await POST(new Request("http://x/api/flujo", { method: "POST", body: JSON.stringify({ campana_id: CAMPANA, quiero: "parar" }) }))).status).toBe(403)
    expect(tocoLaBase.n).toBe(0)
  })
  it("administrador con un cliente mal escrito: 400", async () => {
    const { GET } = await import("@/app/api/flujo/route")
    puerta.valor = { ok: true, email: "emilio" }
    expect((await GET(new Request("http://x/api/flujo?cliente=nada"))).status).toBe(400)
  })
})

describe("el botón", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  const pintar = (flujo: Parameters<typeof BotonFlujo>[0]["inicial"]) => render(<BotonFlujo clienteId={CLIENTE} inicial={flujo} />)

  it("los 3 colores con su línea; solo el rojo parpadea; solo tokens de la guía", () => {
    for (const [estado, motivo, color, linea] of [
      ["activa", null, "verde", "EN MARCHA"],
      ["pausada", PAUSA, "dorado", "PARADO POR TI · en la semana 4 del calendario"],
      ["necesita_humano", "el presupuesto de planificación se agotó (US$ 5 de 6)", "rojo", "DETENIDO · se acabó la bolsa de planificación"],
    ] as const) {
      const { container, unmount } = pintar({ campana_id: CAMPANA, flujo: flujoDeCampana({ estado, estado_motivo: motivo }) })
      const b = container.querySelector("[data-flujo]") as HTMLElement
      expect(b.dataset.flujo).toBe(color)
      expect(b.textContent).toContain("Flujo de la campaña")
      expect(container.querySelector("[data-linea-del-flujo]")?.textContent).toBe(linea)
      expect(b.className.includes("zr-flujo-detenido")).toBe(color === "rojo")
      unmount()
    }
    for (const c of Object.values(CLASES_DEL_FLUJO)) for (const k of `${c.borde} ${c.texto} ${c.punto}`.split(" ")) expect(k).toMatch(/^(border|text|bg)-(linea|oro|alarma|marcha)$|^zr-flujo-detenido$/)
  })
  it("sin campaña o sin flujo: no se pinta nada", () => {
    expect(pintar({ campana_id: null, flujo: null }).container.innerHTML).toBe("")
    cleanup()
    expect(pintar({ campana_id: CAMPANA, flujo: null }).container.innerHTML).toBe("")
  })
  it("tocar el verde pide «parar» y se pone dorado con lo que contesta la plataforma", async () => {
    const pedidos: unknown[] = []
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { pedidos.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true, flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" } }), { status: 200 }) }))
    pintar({ campana_id: CAMPANA, flujo: flujoDeCampana({ estado: "activa" }) })
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(screen.getByRole("button").dataset.flujo).toBe("dorado"))
    expect(pedidos).toEqual([{ campana_id: CAMPANA, quiero: "parar" }])
  })
  it("🔴 el rojo que no puede reanudarse: sigue rojo y lo dice tranquilo (sin `alert`)", async () => {
    const rojo = { color: "rojo", linea: "DETENIDO · se acabó la bolsa de planificación", estado: "necesita_humano" }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, code: "E-CAUSA-SIGUE", detalle: "la bolsa de planificación sigue sin alcanzar (US$ 5.14 de 6)", flujo: rojo }), { status: 409 })))
    const { container } = pintar({ campana_id: CAMPANA, flujo: rojo as never })
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(container.querySelector("[data-nota-del-flujo]")?.textContent).toMatch(/sigue sin alcanzar/))
    expect(screen.getByRole("button").dataset.flujo).toBe("rojo")
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})

describe("dónde va", () => {
  it("debajo de los 9 cuadros del Centro de campaña, antes de la línea de salida (19-nov: los 3 lugares)", () => {
    const t = readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")
    const fin = t.indexOf("</ul>"), boton = t.indexOf("<LugaresDeCampana"), salida = t.indexOf("Esc o clic fuera para volver a la oficina")
    expect(fin).toBeGreaterThan(-1); expect(boton).toBeGreaterThan(fin); expect(salida).toBeGreaterThan(boton)
  })
})

/** 🟡 de CC7 a 1907e10 · una base de juguete que SÍ filtra, ordena y limita (para que el orden y el `seco` se noten) */
function baseConFilas(filas: Array<Record<string, unknown>>) {
  const supabase = {
    from() {
      let sel = [...filas]
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => { sel = sel.filter((f) => f[k] === v); return q },
        order: (k: string, o: { ascending: boolean }) => { sel.sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : 1) * (o.ascending ? 1 : -1)); return q },
        limit: (n: number) => { sel = sel.slice(0, n); return q },
        maybeSingle: async () => ({ data: sel[0] ?? null, error: null }),
      }
      return q
    },
  }
  return supabase as never
}
const OTRA = "22222222-3333-4444-5555-666666666666"
const ENSAYO = "33333333-4444-5555-6666-777777777777"

describe("🟡 de CC7 a 1907e10 (las 5 que sobrevivían)", () => {
  it("l2 · con 2 campañas reales del cliente se lee la MÁS NUEVA, y una de ensayo más nueva no cuenta", async () => {
    const sb = baseConFilas([
      { id: OTRA, client_id: CLIENTE, seco: false, creada_en: "2026-10-01T00:00:00Z", estado: "activa", estado_motivo: null },
      { id: CAMPANA, client_id: CLIENTE, seco: false, creada_en: "2026-11-01T00:00:00Z", estado: "pausada", estado_motivo: PAUSA },
      { id: ENSAYO, client_id: CLIENTE, seco: true, creada_en: "2026-11-15T00:00:00Z", estado: "activa", estado_motivo: null },
    ])
    expect(await leerFlujo(sb, CLIENTE)).toEqual({ campana_id: CAMPANA, flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" } })
  })
  it("t6 · tocar una campaña de ensayo (seco=true) contesta 404 y NO llama a la plataforma", async () => {
    const llamadas: unknown[] = []
    const fetchImpl = (async (...a: unknown[]) => { llamadas.push(a); return new Response("{}", { status: 200 }) }) as unknown as typeof fetch
    const sb = baseConFilas([{ id: ENSAYO, client_id: CLIENTE, seco: true, creada_en: "2026-11-15T00:00:00Z", estado: "activa" }])
    const r = await tocarFlujo({ campana_id: ENSAYO, quiero: "parar" }, { supabase: sb, plataformaUrl: "https://plataforma.test", llave: "k", fetchImpl })
    expect(r.status).toBe(404); expect(llamadas).toHaveLength(0)
  })
})

describe("🟡 de CC7 · g3: la ruta distingue sin sesión (401) de sin permiso (403)", () => {
  // usa la puerta simulada de «la ruta /api/flujo es solo de administrador» (vi.mock sube al inicio del archivo)
  const pedir = async () => {
    const { GET, POST } = await import("@/app/api/flujo/route")
    const g = await GET(new Request(`http://x/api/flujo?cliente=${CLIENTE}`))
    const p = await POST(new Request("http://x/api/flujo", { method: "POST", body: JSON.stringify({ campana_id: CAMPANA, quiero: "parar" }) }))
    return [{ status: g.status, cuerpo: await g.json() }, { status: p.status, cuerpo: await p.json() }]
  }
  it("sin sesión: 401 `sin_sesion` en GET y en POST", async () => {
    puerta.valor = { ok: false, status: 401 }
    for (const r of await pedir()) expect(r).toEqual({ status: 401, cuerpo: { ok: false, error: "sin_sesion" } })
  })
  it("un client_viewer: 403 `sin_permiso` en GET y en POST", async () => {
    puerta.valor = { ok: false, status: 403 }
    for (const r of await pedir()) expect(r).toEqual({ status: 403, cuerpo: { ok: false, error: "sin_permiso" } })
  })
})

describe("🟡 de CC7 · el botón (b2 y b6)", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  it("b2 · dos clics seguidos mientras la plataforma no contesta: UN solo POST", async () => {
    let soltar: (r: Response) => void = () => {}
    const f = vi.fn(() => new Promise<Response>((res) => { soltar = res }))
    vi.stubGlobal("fetch", f)
    render(<BotonFlujo clienteId={CLIENTE} inicial={{ campana_id: CAMPANA, flujo: flujoDeCampana({ estado: "activa" }) }} />)
    const b = screen.getByRole("button")
    fireEvent.click(b); fireEvent.click(b)
    expect(f).toHaveBeenCalledTimes(1)
    soltar(new Response(JSON.stringify({ ok: true, flujo: { color: "dorado", linea: "PARADO POR TI · x", estado: "pausada" } }), { status: 200 }))
    await waitFor(() => expect(screen.getByRole("button").dataset.flujo).toBe("dorado"))
    expect(f).toHaveBeenCalledTimes(1)
  })
  it("b6 · «EN MARCHA» va en verde `marcha` (texto, ícono y punto) y el dorado no usa `marcha`", () => {
    const verde = render(<BotonFlujo clienteId={CLIENTE} inicial={{ campana_id: CAMPANA, flujo: flujoDeCampana({ estado: "activa" }) }} />)
    const linea = verde.container.querySelector("[data-linea-del-flujo]") as HTMLElement
    expect(linea.className).toContain("text-marcha")
    expect(linea.querySelector("span")?.className).toContain("bg-marcha")
    expect(verde.container.querySelector("svg")?.getAttribute("class")).toContain("text-marcha")
    expect(verde.container.innerHTML).not.toMatch(/(text|bg|border)-oro(?![-\w])/)
    cleanup()
    const dorado = render(<BotonFlujo clienteId={CLIENTE} inicial={{ campana_id: CAMPANA, flujo: flujoDeCampana({ estado: "pausada", estado_motivo: PAUSA }) }} />)
    expect(dorado.container.innerHTML).not.toContain("marcha")
    expect((dorado.container.querySelector("[data-linea-del-flujo]") as HTMLElement).className).toContain("text-oro")
  })
})

/**
 * 19-nov · GO de Lenovo 22:04 Zúrich · boceto aprobado por Emilio 21:45 y 22:03 (`raw/evidencia/2026-11-19-boceto-boton-flujo-nombre/` vistas 4, 5 y 6):
 * siempre 3 lugares debajo de los 9 cuadros, uno por campaña viva con su nombre; los libres dicen «Crear Campaña»; el subtítulo dice la campaña elegida.
 */
describe("19-nov · los 3 lugares de campaña y el subtítulo", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  const VERDE = flujoDeCampana({ estado: "activa" })!
  const DORADO = flujoDeCampana({ estado: "pausada", estado_motivo: PAUSA })!
  const ROJO = flujoDeCampana({ estado: "necesita_humano", estado_motivo: "el presupuesto de planificación se agotó (US$ 5 de 6)" })!
  const C1 = { campana_id: CAMPANA, nombre: "Impulso del encebollado a domicilio", flujo: VERDE }
  const C2 = { campana_id: OTRA, nombre: "Firmas para limpiar la playa de Olón", flujo: DORADO }
  const C3 = { campana_id: ENSAYO, nombre: "Lanzamiento del ceviche para llevar", flujo: ROJO }
  const CUARTA = { campana_id: "44444444-5555-6666-7777-888888888888", nombre: "Una cuarta que no cabe", flujo: VERDE }
  const lugares = (campanas: Parameters<typeof LugaresDeCampana>[0]["campanas"]) => render(<LugaresDeCampana clienteId={CLIENTE} campanas={campanas} />)
  const lugaresDe = (c: HTMLElement) => [...(c.querySelector("[data-lugares-de-campana]")?.children ?? [])] as HTMLElement[]

  it("1 campaña: su botón con su nombre y su color, y 2 «Crear Campaña»", () => {
    const { container } = lugares([C1])
    const l = lugaresDe(container)
    expect(l).toHaveLength(3)
    expect(l[0].querySelector("[data-flujo]")?.getAttribute("data-flujo")).toBe("verde")
    expect(l[0].querySelector("[data-nombre-de-la-campana]")?.textContent).toBe("Impulso del encebollado a domicilio")
    expect(l.slice(1).map((x) => x.querySelector("[data-crear-campana]")?.textContent)).toEqual(["Crear Campaña", "Crear Campaña"])
  })
  it("2 campañas: 2 botones en el orden de la lectura y 1 «Crear Campaña»", () => {
    const { container } = lugares([C1, C2])
    const l = lugaresDe(container)
    expect(l.map((x) => x.querySelector("[data-nombre-de-la-campana]")?.textContent ?? x.querySelector("[data-crear-campana]")?.textContent)).toEqual(["Impulso del encebollado a domicilio", "Firmas para limpiar la playa de Olón", "Crear Campaña"])
    expect(l.map((x) => x.querySelector("[data-flujo]")?.getAttribute("data-flujo") ?? null)).toEqual(["verde", "dorado", null])
  })
  it("3 campañas: los 3 colores, sin «Crear Campaña»; una 4.ª no ocupa lugar", () => {
    for (const lista of [[C1, C2, C3], [C1, C2, C3, CUARTA]]) {
      const { container, unmount } = lugares(lista)
      const l = lugaresDe(container)
      expect(l.map((x) => x.querySelector("[data-flujo]")?.getAttribute("data-flujo"))).toEqual(["verde", "dorado", "rojo"])
      expect(container.querySelector("[data-crear-campana]")).toBeNull()
      expect(container.textContent).not.toContain("Una cuarta que no cabe")
      unmount()
    }
  })
  it("0 campañas vivas: 3 «Crear Campaña»; sin lectura (la base no contestó): no se pinta nada", () => {
    const { container, unmount } = lugares([])
    expect(container.querySelectorAll("[data-crear-campana]")).toHaveLength(3)
    unmount()
    expect(lugares(null).container.innerHTML).toBe("")
  })
  it("«Crear Campaña»: con mayúscula, «+» gris, mismo tamaño y estilo que el botón, sin color de estado ni textos de uso; por ahora no hace nada", () => {
    const pedidos = vi.fn(); vi.stubGlobal("fetch", pedidos)
    const { container } = lugares([C1])
    const crear = container.querySelector("[data-crear-campana]") as HTMLElement
    expect(crear.textContent).toBe("Crear Campaña")
    expect(crear.querySelector("svg")?.getAttribute("class")).toContain("text-gris")
    const boton = container.querySelector("[data-flujo]") as HTMLElement
    const sinColor = (k: string) => k.split(" ").filter((x) => !/^(border|text|bg)-(linea|oro|alarma|marcha)$|^zr-flujo-detenido$/.test(x)).join(" ")
    expect(sinColor(crear.className)).toBe(sinColor(boton.className))
    expect(crear.className).toContain("border-linea")
    expect(crear.innerHTML).not.toMatch(/(text|bg|border)-(oro|alarma|marcha)(?![-\w])|zr-flujo-detenido/)
    expect(crear.querySelector("[data-linea-del-flujo]")).toBeNull()
    fireEvent.click(crear)
    expect(pedidos).not.toHaveBeenCalled()
  })
  it("los lugares miden igual: el alto del botón es fijo", () => {
    expect(CLASE_DEL_BOTON).toContain("min-h-[164px]")
  })
  it("nombre largo: una sola línea cortada con «…» (el botón no crece) y el nombre entero en el `title`", () => {
    const largo = "Lanzamiento del ceviche para llevar en todas las sedes de la costa ecuatoriana durante la temporada alta de playa"
    const { container } = lugares([{ ...C1, nombre: largo }])
    const n = container.querySelector("[data-nombre-de-la-campana]") as HTMLElement
    expect(n.className).toContain("truncate"); expect(n.className).toContain("max-w-full")
    expect(n.textContent).toBe(largo); expect(n.getAttribute("title")).toBe(largo)
  })
  it("una campaña todavía sin nombre: su botón sin la línea del nombre (no se inventa)", () => {
    const { container } = lugares([{ ...C1, nombre: null }])
    expect(container.querySelector("[data-flujo]")).not.toBeNull()
    expect(container.querySelector("[data-nombre-de-la-campana]")).toBeNull()
  })
  it("🔴 tocar el 2.º botón para ESA campaña, y al releer toma ESA campaña de `campanas` (nunca la más nueva del cliente)", async () => {
    const pedidos: Array<{ url: string; cuerpo?: unknown }> = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (init?.method === "POST") return new Response(JSON.stringify({ ok: true }), { status: 200 })
      // la «última» del cliente es OTRA cosa (C3, roja): el 2.º botón no debe tomarla
      return new Response(JSON.stringify({ ok: true, campana_id: C3.campana_id, flujo: ROJO, campanas: [C1, { ...C2, flujo: VERDE }, C3] }), { status: 200 })
    }))
    const { container } = lugares([C1, C2, C3])
    const segundo = lugaresDe(container)[1].querySelector("[data-flujo]") as HTMLElement
    expect(segundo.dataset.flujo).toBe("dorado")
    fireEvent.click(segundo)
    await waitFor(() => expect((lugaresDe(container)[1].querySelector("[data-flujo]") as HTMLElement).dataset.flujo).toBe("verde"))
    expect(pedidos[0]).toEqual({ url: "/api/flujo", cuerpo: { campana_id: OTRA, quiero: "reanudar" } })
    expect(lugaresDe(container)[1].querySelector("[data-nombre-de-la-campana]")?.textContent).toBe("Firmas para limpiar la playa de Olón")
    expect(lugaresDe(container).map((x) => x.querySelector("[data-flujo]")?.getAttribute("data-flujo"))).toEqual(["verde", "verde", "rojo"])
  })
  it("🔴 s19 · la plataforma contesta con el botón nuevo: cambia el color y el nombre se queda", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, flujo: DORADO }), { status: 200 })))
    const { container } = lugares([C1])
    fireEvent.click(container.querySelector("[data-flujo]") as HTMLElement)
    await waitFor(() => expect((container.querySelector("[data-flujo]") as HTMLElement).dataset.flujo).toBe("dorado"))
    expect(container.querySelector("[data-nombre-de-la-campana]")?.textContent).toBe("Impulso del encebollado a domicilio")
  })
  it("la campaña elegida es la primera viva con botón; lo leído antes del 19-nov (sin `campanas`) ocupa el 1.er lugar sin nombre", () => {
    expect(campanaElegida([C2, C1])?.campana_id).toBe(OTRA)
    expect(campanaElegida([{ ...C1, flujo: null }, C2])?.campana_id).toBe(OTRA)
    expect(campanaElegida([])).toBeNull()
    expect(campanasDeLaLectura({ campana_id: CAMPANA, flujo: VERDE })).toEqual([{ campana_id: CAMPANA, nombre: null, flujo: VERDE }])
    expect(campanasDeLaLectura({ campana_id: null, flujo: null })).toEqual([])
    expect(campanasDeLaLectura({ campana_id: CAMPANA, flujo: VERDE, campanas: [C2] })).toEqual([C2])
    expect(campanasDeLaLectura(null)).toBeNull()
  })
  it("subtítulo: «CAMPAÑA · <nombre>» con el estilo del de cliente y cortado si es largo", () => {
    const { container } = render(<CampanaComoTexto nombre="Impulso del encebollado a domicilio" />)
    const p = container.querySelector("[data-campana-como-texto]") as HTMLElement
    expect(p.textContent).toBe("Campaña · Impulso del encebollado a domicilio")
    expect(p.className).toContain("text-rotulo uppercase tracking-rotulo text-gris")
    expect(p.className).toContain("truncate")
    expect(p.querySelector("[data-campana-nombre]")?.className).toBe("font-medio text-hueso")
  })
  it("el Centro: con nombre, el subtítulo dice la campaña elegida; sin nombre (o sin campaña viva), sigue «CLIENTE · <nombre>»", () => {
    const pintarCentro = (flujoInicial: Parameters<typeof PanelAplicaciones>[0]["flujoInicial"]) => renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {}, flujoInicial }))
    const conNombre = pintarCentro({ campana_id: C2.campana_id, flujo: C2.flujo, campanas: [C1, C2] })
    expect(conNombre).toMatch(/data-campana-como-texto[^>]*>Campaña · <span data-campana-nombre[^>]*>Impulso del encebollado a domicilio</)
    expect(conNombre).not.toContain("data-cliente-como-texto")
    expect(conNombre.match(/data-crear-campana/g)).toHaveLength(1)
    for (const f of [{ campana_id: CAMPANA, flujo: VERDE, campanas: [{ ...C1, nombre: null }] }, { campana_id: null, flujo: null, campanas: [] }, { campana_id: CAMPANA, flujo: VERDE }]) {
      const h = pintarCentro(f)
      expect(h).toContain("data-cliente-como-texto"); expect(h).not.toContain("data-campana-como-texto")
    }
  })
})
