/**
 * GO Lenovo 10-nov 20:30Z (punto 3) · «sala vacía · ninguna reunión en las últimas 24 h» con las mesas del brief y de la gran idea reunidas ese día (CC4 · certifica CC6).
 * Causa: la sala junta llamadas por la raíz de la corrida y abre solo con un paso que consolida (regla C); las mesas de la oficina corren a cada empleado
 * en SU corrida y sin paso, y su conversación vive en `oficina_mesa_aportes` (encargo · tipo · corrida). Arreglo: las corridas de un encargo son UNA
 * sesión y la de un aporte `integra` es el paso que consolida. La regla C no cambia. Dos clientes de rubros distintos. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { armarEscena, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { lineasDeLaSala, tituloDeLaMesa, type AporteDeMesa } from "@/lib/escena-sala"
import { leerMesasDeLaSala } from "@/lib/escena-avatares-datos"

const T0 = Date.parse("2026-11-10T12:00:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()

const CLIENTES = [
  { nombre: "Náufrago", id: "nau", rubro: "restaurante", familia: "concepto_mesa", titulo: "Mesa de la gran idea", dirige: "creative-director-mesa", aportan: ["content-creator", "carousel-designer", "whimsy-injector"] },
  { nombre: "Extintores del Litoral", id: "b2b", rubro: "seguridad industrial", familia: "carrusel_mesa", titulo: "Mesa del carrusel", dirige: "creative-director-mesa", aportan: ["content-creator", "carousel-designer"] },
]
type Cl = (typeof CLIENTES)[number]
const TODOS = [...new Set(CLIENTES.flatMap((c) => [c.dirige, ...c.aportan]).concat(["campaign-brief-agent"]))]

/** cada empleado de la mesa corre en SU corrida (sin «:paso» y sin step_name), como en producción */
const inv = (c: Cl, agent_name: string, exec: string, iniMin: number, finMin: number | null): InvocacionViva =>
  ({ agent_name, client_id: c.id, workflow_id: "bTbWL9lUvQCfStAz", workflow_execution_id: exec, status: finMin == null ? "running" : "completed", started_at: en(iniMin), ended_at: finMin == null ? null : en(finMin), cost_usd: 0.2, step_name: null, task_text: null })
/** una mesa: abre quien dirige (min 0), aportan los demás (uno por minuto) e integra quien dirige (al final) */
function mesa(c: Cl, encargo: string, base: number, o: { integra?: boolean; integraAbierta?: boolean; desde?: number } = {}) {
  const t0 = o.desde ?? 0
  const invocaciones: InvocacionViva[] = [inv(c, c.dirige, `${base}`, t0, t0 + 1)]
  const aportes: AporteDeMesa[] = [{ workflow_execution_id: `${base}`, encargo_id: encargo, tipo: "dirige", familia: c.familia }]
  c.aportan.forEach((a, k) => {
    invocaciones.push(inv(c, a, `${base + k + 1}`, t0 + 1 + k, t0 + 2 + k))
    aportes.push({ workflow_execution_id: `${base + k + 1}`, encargo_id: encargo, tipo: k % 2 ? "responde" : "aporta", familia: c.familia })
  })
  const fin = t0 + 2 + c.aportan.length
  if (o.integra !== false) {
    invocaciones.push(inv(c, c.dirige, `${base + 50}`, fin, o.integraAbierta ? null : fin + 2))
    if (!o.integraAbierta) aportes.push({ workflow_execution_id: `${base + 50}`, encargo_id: encargo, tipo: "integra", familia: c.familia })
  }
  return { invocaciones, aportes, fin: fin + 2 }
}
const entrada = (c: Cl, minAhora: number, invocaciones: InvocacionViva[], mesas?: AporteDeMesa[]): EntradaDeLaEscena => ({
  despachos: [], invocaciones,
  directorio: TODOS.map((a) => ({ agente: a, equipo: "creativo", rol: a === c.dirige ? "direccion" : "miembro" })),
  agentes: TODOS.map((a) => ({ name: a, display_name: a })), clientes: [{ id: c.id, nombre: c.nombre }], equipos: null,
  ahora: new Date(T0 + minAhora * 60_000), mesas,
})

for (const c of CLIENTES) {
  describe(`${c.nombre} (${c.rubro}) · ${c.titulo}`, () => {
    const m = mesa(c, `enc-${c.id}`, 231500)
    it("control (el error de hoy): sin leer las mesas, la sala no ve la reunión", () => {
      const s = armarEscena(entrada(c, m.fin + 1, m.invocaciones)).sala!
      expect(s.reunion).toBeNull(); expect(s.ultima).toBeNull()
      expect(lineasDeLaSala(s)[1]).toBe("sala vacía · ninguna reunión en las últimas 24 h")
    })
    it("con las mesas: una sola reunión con quien dirige a la cabecera y todos los que aportaron", () => {
      const r = armarEscena(entrada(c, m.fin + 1, m.invocaciones, m.aportes)).sala!.reunion!
      expect(r.titulo).toBe(`${c.titulo} · ${c.nombre}`)
      expect(r.participantes[0]).toMatchObject({ agente: c.dirige, cabecera: true, fase: "redacción" })
      expect(r.participantes.map((p) => p.agente).sort()).toEqual([c.dirige, ...c.aportan].sort())
      expect(r.participantes.slice(1).every((p) => p.fase === "aporte a la mesa")).toBe(true)
      expect(r.fases.map((f) => f.nombre)).toEqual(["apertura de la mesa", "aporte a la mesa", "redacción"])
      expect(r.estado).toBe("terminada")
    })
    it("mientras integra (corrida abierta con su aporte `integra` ya escrito), la reunión está en curso", () => {
      const abierta = mesa(c, `enc-${c.id}`, 231500)
      abierta.invocaciones[abierta.invocaciones.length - 1] = { ...abierta.invocaciones[abierta.invocaciones.length - 1], ended_at: null, status: "running" }
      expect(armarEscena(entrada(c, abierta.fin - 1, abierta.invocaciones, abierta.aportes)).sala!.reunion!.estado).toBe("en_curso")
    })
    it("horas después: la sala vacía nombra la última reunión (no «ninguna en 24 h»)", () => {
      const s = armarEscena(entrada(c, m.fin + 8 * 60, m.invocaciones, m.aportes)).sala!
      expect(s.reunion).toBeNull()
      expect(lineasDeLaSala(s)[1]).toMatch(new RegExp(`^sala vacía · la última, ${c.titulo} · ${c.nombre}, terminó `))
    })
    it("regla C intacta: una mesa en la que nadie integró todavía no abre la sala", () => {
      const sin = mesa(c, `enc-${c.id}`, 231500, { integra: false })
      expect(armarEscena(entrada(c, sin.fin + 1, sin.invocaciones, sin.aportes)).sala!.reunion).toBeNull()
    })
  })
}

describe("dos mesas seguidas del mismo cliente no se mezclan", () => {
  it("la mesa del brief y la de la gran idea (pegadas en el tiempo) son dos reuniones, cada una con su gente", () => {
    const c = CLIENTES[0]
    const brief = { ...c, familia: "brief_mesa", dirige: "campaign-brief-agent", aportan: [] as string[] }
    const b = mesa(brief, "enc-brief", 231400)
    const g = mesa(c, "enc-gran-idea", 231500, { desde: b.fin + 1 })
    const s = armarEscena(entrada(c, g.fin + 1, [...b.invocaciones, ...g.invocaciones], [...b.aportes, ...g.aportes])).sala!
    expect(s.reunion!.titulo).toBe("Mesa de la gran idea · Náufrago")
    expect(s.reunion!.participantes.map((p) => p.agente)).not.toContain("campaign-brief-agent")
    // y la del brief, sola, es la suya (quien dirige basta, como dice la regla C)
    const sb = armarEscena(entrada(brief, b.fin + 1, b.invocaciones, b.aportes)).sala!.reunion!
    expect(sb.titulo).toBe("Mesa del brief · Náufrago"); expect(sb.participantes.map((p) => p.agente)).toEqual(["campaign-brief-agent"])
  })
})

describe("una mesa y una corrida ajena del mismo cliente, pegadas en el tiempo, no se mezclan", () => {
  const c = CLIENTES[1]
  const m = mesa(c, "enc-carrusel", 231500, { desde: 5 })
  // otra corrida (no de la mesa) del mismo cliente, a 2 minutos: un plan que consolida, y alguien que trabaja en su escritorio
  const plan = [inv(c, "campaign-brief-agent", "231900:bba-resintesis-c1", m.fin + 2, m.fin + 4)]
  const escritorio = [inv(c, "whimsy-injector", "231950", 2, 4)]
  it("la reunión de la mesa no suma a quien trabajó aparte justo antes", () => {
    const r = armarEscena(entrada(c, m.fin + 1, [...escritorio, ...m.invocaciones], m.aportes)).sala!.reunion!
    expect(r.titulo).toBe("Mesa del carrusel · Extintores del Litoral"); expect(r.participantes.map((p) => p.agente)).not.toContain("whimsy-injector")
  })
  it("y la reunión de la corrida ajena no se lleva a la gente de la mesa", () => {
    const r = armarEscena(entrada(c, m.fin + 5, [...m.invocaciones, ...plan], m.aportes)).sala!.reunion!
    expect(r.participantes.map((p) => p.agente)).toEqual(["campaign-brief-agent"])
  })
})

describe("cómo se leen los aportes", () => {
  it("un aporte sin encargo no junta nada (la corrida queda como estaba)", async () => {
    const { lecturaDeMesas } = await import("@/lib/escena-sala")
    const l = lecturaDeMesas([{ workflow_execution_id: "1", encargo_id: null, tipo: "integra" }, { workflow_execution_id: null, encargo_id: "e", tipo: "integra" }])
    expect(l.raiz.size).toBe(0); expect(l.tipo.size).toBe(0)
  })
  it("una corrida que integró sigue contando como integración aunque deje otro aporte después", async () => {
    const { lecturaDeMesas } = await import("@/lib/escena-sala")
    expect(lecturaDeMesas([{ workflow_execution_id: "9", encargo_id: "e", tipo: "integra" }, { workflow_execution_id: "9", encargo_id: "e", tipo: "nota" }]).tipo.get("9")).toBe("integra")
  })
})

describe("el nombre de la reunión sale de la familia del encargo", () => {
  it("brief, gran idea y carrusel por nombre; una familia nueva, genérica (nunca su clave)", () => {
    expect(tituloDeLaMesa("brief_mesa")).toBe("Mesa del brief")
    expect(tituloDeLaMesa("concepto_mesa")).toBe("Mesa de la gran idea")
    expect(tituloDeLaMesa("carrusel_mesa")).toBe("Mesa del carrusel")
    expect(tituloDeLaMesa("video_mesa")).toBe("Mesa de la oficina creativa"); expect(tituloDeLaMesa(null)).toBe("Mesa de la oficina creativa")
  })
})

describe("la lectura de las mesas", () => {
  const base = (tablas: Record<string, Array<Record<string, unknown>>>, registro: string[] = []) => ({ from: (t: string) => {
    let d = [...(tablas[t] ?? [])]
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit"]) q[m] = (...a: unknown[]) => { registro.push(`${t}.${m}(${JSON.stringify(a)})`); return q }
    q.gte = (c: string, v: string) => { registro.push(`${t}.gte(${c})`); d = d.filter((f) => String(f[c]) >= v); return q }
    q.not = (c: string, op: string, v: unknown) => { registro.push(`${t}.not(${c},${op})`); d = d.filter((f) => (op === "is" && v === null ? f[c] != null : true)); return q }
    q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
    q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
    return q
  } }) as never
  it("trae los aportes con corrida desde la ventana, con su familia; deja fuera los ensayos en seco y los encargos de prueba", async () => {
    const registro: string[] = []
    const r = await leerMesasDeLaSala(base({
      oficina_mesa_aportes: [
        { workflow_execution_id: "1", encargo_id: "real", tipo: "integra", creado_en: "2026-11-10T12:00:00Z" },
        { workflow_execution_id: null, encargo_id: "real", tipo: "pide", creado_en: "2026-11-10T12:00:00Z" },
        { workflow_execution_id: "2", encargo_id: "seco", tipo: "integra", creado_en: "2026-11-10T12:00:00Z" },
        { workflow_execution_id: "3", encargo_id: "prueba", tipo: "integra", creado_en: "2026-11-10T12:00:00Z" },
        { workflow_execution_id: "4", encargo_id: "real", tipo: "aporta", creado_en: "2026-11-08T12:00:00Z" },
      ],
      oficina_encargos: [{ id: "real", familia: "brief_mesa", dry_run: false, prueba: false }, { id: "seco", familia: "brief_mesa", dry_run: true, prueba: false }, { id: "prueba", familia: "brief_mesa", dry_run: false, prueba: true }],
    }, registro), "2026-11-09T21:00:00Z")
    expect(r).toEqual([{ workflow_execution_id: "1", encargo_id: "real", tipo: "integra", familia: "brief_mesa" }])
    expect(registro).toContain("oficina_mesa_aportes.gte(creado_en)"); expect(registro).toContain("oficina_mesa_aportes.not(workflow_execution_id,is)")
  })
  it("sin aportes no pregunta por los encargos", async () => {
    const registro: string[] = []
    expect(await leerMesasDeLaSala(base({ oficina_mesa_aportes: [] }, registro), "2026-11-09T21:00:00Z")).toEqual([])
    expect(registro.some((x) => x.startsWith("oficina_encargos"))).toBe(false)
  })
})
