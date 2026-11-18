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
import { BotonFlujo, CLASES_DEL_FLUJO } from "@/components/nuevo/BotonFlujo"

const CAMPANA = "36e66179-3061-4a7d-94db-932a900d9515"
const CLIENTE = "11111111-2222-3333-4444-555555555555"
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
  const puerta = vi.hoisted(() => ({ valor: { ok: false, status: 401 } as { ok: boolean; status?: number; email?: string } }))
  const tocoLaBase = vi.hoisted(() => ({ n: 0 }))
  vi.mock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta.valor }))
  vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => { tocoLaBase.n++; return {} } }))
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
  it("debajo de los 9 cuadros del Centro de campaña, antes de la línea de salida", () => {
    const t = readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")
    const fin = t.indexOf("</ul>"), boton = t.indexOf("<BotonFlujo"), salida = t.indexOf("Esc o clic fuera para volver a la oficina")
    expect(fin).toBeGreaterThan(-1); expect(boton).toBeGreaterThan(fin); expect(salida).toBeGreaterThan(boton)
  })
})
