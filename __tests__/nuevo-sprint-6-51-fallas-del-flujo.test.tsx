/**
 * DASHBOARD NUEVO · SPRINT 6.51 · «LO QUE FALLÓ» VE LAS FALLAS DEL FLUJO (corrección aprobada por Emilio 2-nov,
 * `2026-11-02-CORRECCION-LENOVO-a-CC5-CC1-lo-que-fallo-no-ve-las-fallas-del-flujo.md`): los dos pedidos del manual de hoy fallaron con los empleados
 * bien (Náufrago 19:21Z «connection closed»; Zero Risk SI 19:29Z, límite de 120 s). Deben verse, con el motivo en palabras, y contar como error.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { normalizarLista } from "@/lib/direccion-corridas"
import { conFallasDelFlujo, corridaDelPedido, motivoDelFlujo, normalizarFallas, procesoDeLaFalla } from "@/lib/fallas-del-flujo"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }) }))

const NAU = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZR = "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5"
const CLIENTES = new Map([[NAU, "Náufrago"], [ZR, "Zero Risk Seguridad Industrial"]])
// las dos filas reales de hoy (plan_cambios, lectura del 2-nov)
const FILAS = [
  { id: "3420e8ce", client_id: NAU, estado: "fallido", documento: "manual", seccion: null, workflow_execution_id: "212901", creado_en: "2026-11-02T19:15:40.751+00:00", actualizado_en: "2026-11-02T19:21:22.234+00:00", despertar_detalle: "el flujo terminó sin dejar una versión nueva del manual · The connection to the server was closed unexpectedly, perhaps it is offline. You can retry the request immediately or wait and retry later." },
  { id: "223798b5", client_id: ZR, estado: "fallido", documento: "manual", seccion: null, workflow_execution_id: "212892", creado_en: "2026-11-02T19:13:56.905+00:00", actualizado_en: "2026-11-02T19:29:36.854+00:00", despertar_detalle: "el flujo terminó sin dejar una versión nueva del manual · Task execution timed out after 120 seconds" },
  { id: "ok", client_id: NAU, estado: "aplicado", documento: "plan", creado_en: "2026-11-01T10:00:00Z" },
]
const FALLAS = normalizarFallas(FILAS, CLIENTES)

describe("6.51 · las fallas del flujo", () => {
  it("lee solo los pedidos fallidos, con cliente, día de Ecuador y motivo en palabras", () => {
    expect(FALLAS.map((f) => [f.cliente, f.dia, f.motivo])).toEqual([
      ["Náufrago", "2026-11-02", "se cortó la conexión a los 6 min"],
      ["Zero Risk Seguridad Industrial", "2026-11-02", "un paso pasó de 2 min (su límite) y se cortó a los 16 min"],
    ])
    expect(procesoDeLaFalla(FALLAS[0])).toBe("Cambios al manual"); expect(procesoDeLaFalla({ documento: "plan" })).toBe("Cambios al plan")
  })
  it("otros motivos en palabras; nunca el texto técnico", () => {
    expect(motivoDelFlujo("socket hang up", null, null)).toBe("se cortó la conexión")
    expect(motivoDelFlujo("Task execution timed out after 45 seconds", "2026-11-02T10:00:00Z", "2026-11-02T10:03:00Z")).toBe("un paso pasó de 45 s (su límite) y se cortó a los 3 min")
    expect(motivoDelFlujo("algo raro", null, null)).toBe("el flujo falló")
  })
  it("suman como error: el pedido ya estaba entre las corridas (su sub-corrida terminó bien)", () => {
    expect(conFallasDelFlujo({ corridas: 126, con_error: 1, pct_error: 0.8 }, 2)).toEqual({ corridas: 126, con_error: 3, pct_error: 2.4 })
    expect(conFallasDelFlujo({ corridas: 10, con_error: 0, pct_error: 0 }, 0)).toEqual({ corridas: 10, con_error: 0, pct_error: 0 })
  })
  it("encuentra la corrida de los empleados que nació del pedido (mismo cliente, dentro de su ventana)", () => {
    const cs = [{ workflow_execution_id: "212902", client_id: NAU, inicio: "2026-11-02T19:15:44.784Z" }, { workflow_execution_id: "212893", client_id: ZR, inicio: "2026-11-02T19:14:00.502Z" }, { workflow_execution_id: "x", client_id: NAU, inicio: "2026-11-02T20:00:00Z" }]
    expect(corridaDelPedido(FALLAS[0], cs)?.workflow_execution_id).toBe("212902"); expect(corridaDelPedido(FALLAS[1], cs)?.workflow_execution_id).toBe("212893")
  })
  it("la ruta: solo administrador, valida fechas y cliente, solo lee plan_cambios fallidos", () => {
    const src = readFileSync("app/api/direccion/fallas-del-flujo/route.ts", "utf8")
    expect(src).toContain("exigirAdmin()"); expect(src).toContain('.eq("estado", "fallido")'); expect(src).toContain("UUID.test(cliente)")
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })

  const render = async (x: Record<string, unknown> = {}) => {
    const { PanelObservabilidad } = await import("@/components/nuevo/PanelObservabilidad")
    const lista = normalizarLista({ total: 2, corridas: [
      { workflow_execution_id: "212902", workflow_id: "ssLtwYPt7zxuvnM2", estado: "completa", inicio: "2026-11-02T19:15:44.784Z", duracion_ms: 300000, client_id: NAU, cliente: "Náufrago" },
      { workflow_execution_id: "212893", workflow_id: "ssLtwYPt7zxuvnM2", estado: "completa", inicio: "2026-11-02T19:14:00.502Z", duracion_ms: 900000, client_id: ZR, cliente: "Zero Risk Seguridad Industrial" },
    ] })
    return renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: lista, empleadosInicial: { todo: [], sin_interno: [] }, hoy: "2026-11-02", internoInicial: true, ...x })).replace(/<!-- -->/g, "")
  }
  it("en pantalla: las 2 fallas de hoy en «Lo que falló», con motivo, y el conteo de errores las incluye", async () => {
    const h = await render({ flujoInicial: FALLAS })
    const caja = h.slice(h.indexOf("data-lo-que-fallo"), h.indexOf("data-grupos"))
    expect(caja).toContain("Lo que falló <span")
    expect(caja.match(/data-falla-del-flujo=/g)).toHaveLength(2); expect(caja).toContain(">(2)<")
    expect(caja).toContain("«se cortó la conexión a los 6 min»"); expect(caja).toContain("Zero Risk Seguridad Industrial")
    expect(caja).toContain("falló el flujo; los empleados terminaron bien"); expect(caja).toContain('data-ver-donde-fallo="212902"')
    expect(caja).not.toMatch(/timed out|connection to the server/)
    const cor = h.slice(h.indexOf('data-grafico-caja="corridas"'), h.indexOf('data-grafico-caja="costo"'))
    expect(cor).toContain("2 con error")
  })
  it("si no se pudieron leer las fallas del flujo, se dice (no se presenta «sin errores» como seguro)", async () => {
    const h = await render({ flujoInicial: null })
    expect(h).toContain("data-flujo-sin-lectura")
  })
})
