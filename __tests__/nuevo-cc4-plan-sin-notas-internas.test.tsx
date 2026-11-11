/**
 * GO Lenovo 11-nov 23:54Z · la cabecera del Plan mostraba «reintento del Pedir cambios de Emilio (dale 11:43Z)»: es `cadena_campanas.estado_motivo`,
 * la nota que la cadena deja para sí misma en cada cambio de estado (reintentos, pausas, revalidaciones). Arreglo genérico: el tablero no la lee
 * (ni se pide a la base), así que ninguna pantalla puede mostrarla. El estado de la campaña sigue diciéndose en palabras del tablero.
 * Dos clientes de rubros distintos con las notas REALES de producción del 11-nov. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { leerPlanDelCliente, type PlanDelCliente } from "@/lib/plan-datos"
import { barraDelPlan } from "@/lib/plan-barra"
import { PanelPlan } from "@/components/nuevo/PanelPlan"

// las dos notas que había en producción (lectura del 11-nov): una activa (Náufrago, restaurante) y una pausada (B2B industrial de práctica)
const CLIENTES = [
  { nombre: "Náufrago", industria: "restaurante", id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", estado: "activa", nota: "reintento del Pedir cambios de Emilio (dale 11:43Z)" },
  { nombre: "Extintores del Litoral", industria: "seguridad industrial", id: "b2b00000-0000-4000-8000-000000000001", estado: "pausada", nota: "pausa por decisión del dueño 31-oct: foco en Náufrago" },
]
const K = "8168f32b-47d9-466a-9350-3dff31700a58"

/** base falsa de solo lectura: registra lo que se pide; las filas traen la nota como en la base */
function base(c: (typeof CLIENTES)[number]) {
  const registro: string[] = []
  const tablas: Record<string, unknown[]> = {
    clients: [{ id: c.id, name: c.nombre, industry: c.industria, status: "active", archived_at: null }],
    cadena_campanas: [{ id: K, client_id: c.id, estado: c.estado, estado_motivo: c.nota, seco: false, fecha_inicio: "2026-11-02", fecha_fin: "2027-01-30", sedes: [], autoproducir: false, creada_en: "2026-11-01T00:00:00Z" }],
    client_historical_outputs: [], cadena_estrategias: [], cadena_esperas: [], hitl_queue: [], cadena_calendario_filas: [],
  }
  const from = (tabla: string) => {
    const q: Record<string, unknown> = {}
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq", "not"]) q[n] = (...a: unknown[]) => { registro.push(`${tabla}.${n}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q }
    q.maybeSingle = () => Promise.resolve({ data: tablas[tabla]?.[0] ?? null, error: null })
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tablas[tabla] ?? [], count: 0, error: null }).then(ok)
    return q
  }
  return { supa: { from } as never, registro }
}

for (const c of CLIENTES) {
  describe(`${c.nombre} (${c.industria}) · campaña ${c.estado}`, () => {
    it("la lectura no pide ni devuelve la nota interna de la campaña", async () => {
      const b = base(c)
      const p = await leerPlanDelCliente(b.supa, { cliente: c.id, ahora: new Date("2026-11-11T00:00:00Z") })
      expect(p.campana).toMatchObject({ id: K, estado: c.estado })
      expect(JSON.stringify(p)).not.toContain(c.nota)
      const sel = b.registro.find((x) => x.startsWith("cadena_campanas.select("))!
      expect(sel).toBeTruthy(); expect(sel).not.toContain("estado_motivo")
    })
    it("ni la cabecera del Plan ni la barra la muestran; si está pausada, se dice en palabras del tablero", async () => {
      const p = await leerPlanDelCliente(base(c).supa, { cliente: c.id, ahora: new Date("2026-11-11T00:00:00Z") })
      // aunque llegara con la nota (un lector viejo en caché), la pantalla no la dibuja
      const conNota = { ...p, campana: { ...p.campana!, estado_motivo: c.nota } } as PlanDelCliente
      const h = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: conNota }))
      expect(h).not.toContain(c.nota.slice(0, 20))
      const teToca = barraDelPlan(conNota).te_toca
      expect(JSON.stringify(teToca)).not.toContain(c.nota.slice(0, 20))
      if (c.estado === "pausada") expect(teToca).toContain("La campaña está pausada: reanudarla es decisión tuya")
    })
  })
}

it("ningún archivo del tablero nombra la nota interna de la campaña (regla para todos)", () => {
  for (const f of ["lib/plan-datos.ts", "lib/plan-barra.ts", "components/nuevo/PanelPlan.tsx"]) expect(readFileSync(f, "utf8")).not.toContain("estado_motivo")
})
