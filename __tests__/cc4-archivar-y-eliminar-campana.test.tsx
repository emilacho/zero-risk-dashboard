// @vitest-environment jsdom
/**
 * 26-nov · «ARCHIVAR» Y «ELIMINAR» UNA CAMPAÑA (diseño de Emilio · GO de Lenovo 11:57Z) · sin red ni base (US$ 0).
 *   · al dejar el cursor sobre «Flujo de la campaña» aparecen 2 botones a la derecha (una palabra + ícono), sin menús ni ventanas;
 *   · el clic en el botón grande sigue siendo parar/reanudar;
 *   · «Archivar» = UN clic; «Eliminar» = DOS clics: el primero solo cambia a «¿Seguro?» (y NO borra), que vuelve solo a «Eliminar»;
 *   · la ruta es solo de administrador y el pedido a la plataforma va SIEMPRE con `dry_run:false` (el clic es la decisión).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { BotonFlujo, ESPERA_DE_LAS_OPCIONES_MS, ESPERA_DEL_SEGURO_MS, TEXTO_SEGURO } from "@/components/nuevo/BotonFlujo"
import { LugaresDeCampana } from "@/components/nuevo/LugaresDeCampana"
import { MOTIVO_DEL_TABLERO, cuerpoDeLaAccion, tocarArchivo } from "@/lib/archivo-de-campana"

const CAMPANA = "36e66179-3061-4a7d-94db-932a900d9515"
const CLIENTE = "11111111-2222-3333-4444-555555555555"
const puerta = vi.hoisted(() => ({ valor: { ok: false, status: 401 } as { ok: boolean; status?: number } }))
const tocoLaBase = vi.hoisted(() => ({ n: 0 }))
vi.mock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta.valor }))
vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => { tocoLaBase.n++; return {} } }))

const verde = { campana_id: CAMPANA, flujo: { color: "verde" as const, linea: "EN MARCHA", estado: "activa" }, nombre: "Campaña de prueba" }
/** una base de juguete: la campaña existe (o no) */
/** una base de juguete que SÍ aplica los filtros: la campaña existe (o no), y puede ser de práctica (`seco`) */
const base = (existe = true, seco = false) => ({ from: () => {
  const filtros: Array<[string, unknown]> = []
  const fila = { id: CAMPANA, seco }
  const q: Record<string, unknown> = { select: () => q, eq: (c: string, v: unknown) => { filtros.push([c, v]); return q },
    maybeSingle: async () => ({ data: existe && filtros.every(([c, v]) => (fila as Record<string, unknown>)[c] === v) ? { id: CAMPANA } : null, error: null }) }
  return q
} }) as never
const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } })

describe("el pedido a la plataforma", () => {
  it("🔴 archivar va con dry_run:false y el motivo fijo del tablero; eliminar con dry_run:false", () => {
    expect(cuerpoDeLaAccion("archivar", CAMPANA)).toEqual({ campana_id: CAMPANA, dry_run: false, motivo: MOTIVO_DEL_TABLERO })
    expect(cuerpoDeLaAccion("eliminar", CAMPANA)).toEqual({ campana_id: CAMPANA, dry_run: false })
    expect(MOTIVO_DEL_TABLERO).toBe("archivada desde el tablero")
  })
  it("🔴 cada acción a su ruta, con la llave interna", async () => {
    for (const [accion, ruta] of [["archivar", "/api/cadena/archivo/archivar"], ["eliminar", "/api/cadena/archivo/eliminar"]] as const) {
      const f = vi.fn(async () => respuesta(200, { ok: true }))
      const r = await tocarArchivo({ campana_id: CAMPANA, accion }, { supabase: base(), plataformaUrl: "https://p.test/", llave: "k", fetchImpl: f as never })
      expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, accion } })
      const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe(`https://p.test${ruta}`)
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k")
      expect(JSON.parse(String(init.body))).toEqual(cuerpoDeLaAccion(accion, CAMPANA))
    }
  })
  it("🔴 un pedido inválido o una campaña que no existe no llega a la plataforma", async () => {
    const f = vi.fn()
    expect((await tocarArchivo({ campana_id: "x", accion: "archivar" }, { supabase: base(), llave: "k", fetchImpl: f as never })).status).toBe(400)
    expect((await tocarArchivo({ campana_id: CAMPANA, accion: "borrar" }, { supabase: base(), llave: "k", fetchImpl: f as never })).status).toBe(400)
    expect((await tocarArchivo({ campana_id: CAMPANA, accion: "eliminar" }, { supabase: base(false), llave: "k", fetchImpl: f as never })).status).toBe(404)
    // d7 de CC6: una campaña de PRÁCTICA (`seco`) no se archiva ni se borra desde el tablero
    for (const accion of ["archivar", "eliminar"] as const) expect((await tocarArchivo({ campana_id: CAMPANA, accion }, { supabase: base(true, true), llave: "k", fetchImpl: f as never })).status).toBe(404)
    expect(f).not.toHaveBeenCalled()
  })
  it("🔴 sin la ruta en la plataforma se dice (501); un error de la plataforma vuelve como error, nunca como ok", async () => {
    const sinRuta = await tocarArchivo({ campana_id: CAMPANA, accion: "eliminar" }, { supabase: base(), llave: "k", fetchImpl: (async () => new Response("", { status: 404 })) as never })
    expect(sinRuta).toMatchObject({ status: 501, cuerpo: { ok: false, error: "accion_no_publicada" } })
    const falla = await tocarArchivo({ campana_id: CAMPANA, accion: "archivar" }, { supabase: base(), llave: "k", fetchImpl: (async () => respuesta(500, { error: "archivo_error" })) as never })
    expect(falla).toMatchObject({ status: 500, cuerpo: { ok: false, error: "archivo_error" } })
    const raro = await tocarArchivo({ campana_id: CAMPANA, accion: "archivar" }, { supabase: base(), llave: "k", fetchImpl: (async () => respuesta(200, { dry_run: true })) as never })
    expect(raro.cuerpo.ok).toBe(false)
  })
})

describe("la ruta /api/campana-archivo", () => {
  beforeEach(() => { tocoLaBase.n = 0 })
  it("🔴 sin sesión 401 y a un client_viewer 403, sin tocar la base", async () => {
    const { POST } = await import("@/app/api/campana-archivo/route")
    for (const [valor, status] of [[{ ok: false, status: 401 }, 401], [{ ok: false, status: 403 }, 403]] as const) {
      puerta.valor = valor
      const r = await POST(new Request("https://t.test/api/campana-archivo", { method: "POST", body: JSON.stringify({ campana_id: CAMPANA, accion: "eliminar" }) }))
      expect(r.status).toBe(status)
    }
    expect(tocoLaBase.n).toBe(0)
  })
})

describe("los 2 botones junto a «Flujo de la campaña»", () => {
  let f: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.useFakeTimers()
    f = vi.fn(async () => respuesta(200, { ok: true }))
    vi.stubGlobal("fetch", f)
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
  const lugar = (c: HTMLElement) => c.querySelector("[data-lugar-de-la-campana]") as HTMLElement
  const montar = (onQuitada = vi.fn()) => { const r = render(<BotonFlujo clienteId={CLIENTE} inicial={verde} onQuitada={onQuitada} />); return { ...r, onQuitada } }
  const quedarse = async (c: HTMLElement) => { fireEvent.mouseEnter(lugar(c)); await act(async () => { vi.advanceTimersByTime(ESPERA_DE_LAS_OPCIONES_MS) }) }
  const eliminar = (c: HTMLElement) => c.querySelector("[data-eliminar-campana]") as HTMLButtonElement
  const archivar = (c: HTMLElement) => c.querySelector("[data-archivar-campana]") as HTMLButtonElement
  const pedidosAlArchivo = () => f.mock.calls.filter(([u]) => u === "/api/campana-archivo")

  it("🔴 no están de entrada ni al pasar de largo: aparecen si el cursor se QUEDA encima", async () => {
    const { container } = montar()
    expect(container.querySelector("[data-opciones-de-campana]")).toBeNull()
    fireEvent.mouseEnter(lugar(container))
    await act(async () => { vi.advanceTimersByTime(ESPERA_DE_LAS_OPCIONES_MS - 50) })
    // d10 de CC6: todavía encima, pero antes de la espera: no salen
    expect(container.querySelector("[data-opciones-de-campana]")).toBeNull()
    fireEvent.mouseLeave(lugar(container))
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(container.querySelector("[data-opciones-de-campana]")).toBeNull()
    await quedarse(container)
    expect(archivar(container).textContent).toBe("Archivar")
    expect(eliminar(container).textContent).toBe("Eliminar")
    expect(archivar(container).querySelector("svg")).not.toBeNull()
    expect(eliminar(container).querySelector("svg")).not.toBeNull()
    // sin menús ni ventanas
    expect(container.querySelector("[role=dialog],[role=menu],select,textarea,input")).toBeNull()
  })

  it("🔴 el botón grande se ilumina al pasar y su clic sigue siendo parar el flujo (no archiva)", async () => {
    const { container } = montar()
    const grande = container.querySelector("[data-flujo]") as HTMLButtonElement
    expect(grande.className).toMatch(/group-hover:border-linea-oro/)
    expect(lugar(container).className).toMatch(/\bgroup\b/)
    await act(async () => { fireEvent.click(grande) })
    expect(f.mock.calls[0][0]).toBe("/api/flujo")
    expect(pedidosAlArchivo()).toHaveLength(0)
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toMatchObject({ quiero: "parar" })
  })

  it("🔴 «Archivar» es UN clic: archiva y libera el lugar", async () => {
    const { container, onQuitada } = montar()
    await quedarse(container)
    await act(async () => { fireEvent.click(archivar(container)) })
    expect(pedidosAlArchivo()).toHaveLength(1)
    expect(JSON.parse(String((pedidosAlArchivo()[0][1] as RequestInit).body))).toEqual({ campana_id: CAMPANA, accion: "archivar" })
    expect(onQuitada).toHaveBeenCalledTimes(1)
  })

  it("🔴 un solo clic en «Eliminar» NO borra: solo pide «¿Seguro?»", async () => {
    const { container, onQuitada } = montar()
    await quedarse(container)
    await act(async () => { fireEvent.click(eliminar(container)) })
    expect(eliminar(container).textContent).toBe(TEXTO_SEGURO)
    expect(f).not.toHaveBeenCalled()
    expect(onQuitada).not.toHaveBeenCalled()
  })

  it("🔴 el segundo clic en el MISMO botón elimina", async () => {
    const { container, onQuitada } = montar()
    await quedarse(container)
    await act(async () => { fireEvent.click(eliminar(container)) })
    await act(async () => { fireEvent.click(eliminar(container)) })
    expect(pedidosAlArchivo()).toHaveLength(1)
    expect(JSON.parse(String((pedidosAlArchivo()[0][1] as RequestInit).body))).toEqual({ campana_id: CAMPANA, accion: "eliminar" })
    expect(onQuitada).toHaveBeenCalledTimes(1)
  })

  it("🔴 «¿Seguro?» vuelve solo a «Eliminar» si no llega el segundo clic a tiempo: el clic siguiente vuelve a ser el primero", async () => {
    const { container } = montar()
    await quedarse(container)
    await act(async () => { fireEvent.click(eliminar(container)) })
    await act(async () => { vi.advanceTimersByTime(ESPERA_DEL_SEGURO_MS) })
    expect(eliminar(container).textContent).toBe("Eliminar")
    await act(async () => { fireEvent.click(eliminar(container)) })
    expect(eliminar(container).textContent).toBe(TEXTO_SEGURO)
    expect(f).not.toHaveBeenCalled()
  })

  it("🔴 si sale el cursor, «¿Seguro?» se olvida y las opciones se van", async () => {
    const { container } = montar()
    await quedarse(container)
    await act(async () => { fireEvent.click(eliminar(container)) })
    fireEvent.mouseLeave(lugar(container))
    expect(container.querySelector("[data-opciones-de-campana]")).toBeNull()
    await quedarse(container)
    expect(eliminar(container).textContent).toBe("Eliminar")
    await act(async () => { fireEvent.click(eliminar(container)) })
    expect(f).not.toHaveBeenCalled()
  })

  it("🔴 si la plataforma no pudo, se dice y el lugar NO se libera", async () => {
    f.mockImplementation(async () => respuesta(500, { ok: false, error: "archivo_error" }))
    const { container, onQuitada } = montar()
    await quedarse(container)
    await act(async () => { fireEvent.click(archivar(container)) })
    expect(onQuitada).not.toHaveBeenCalled()
    expect(container.querySelector("[data-nota-del-flujo]")?.textContent).toMatch(/No se pudo archivar/)
  })

  it("🔴 los lugares pasan el aviso al Centro (vuelve a leer)", async () => {
    const onCambio = vi.fn()
    const { container } = render(<LugaresDeCampana clienteId={CLIENTE} campanas={[verde]} onCambio={onCambio} />)
    await quedarse(container)
    await act(async () => { fireEvent.click(archivar(container)) })
    expect(onCambio).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText("Crear Campaña")).toHaveLength(2)
  })
})
