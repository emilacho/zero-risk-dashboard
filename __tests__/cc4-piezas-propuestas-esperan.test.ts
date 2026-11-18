/**
 * 18-nov · GO Lenovo (pedido de Emilio 13:52 Zúrich): la tarjeta «Piezas» del Centro de campaña decía «Al día · 0 · Nada por aprobar» con el reel de Olón
 * esperando en `aprobar_propuestas`. Causa: «espera a Emilio» solo salía de la bandeja (`hitl_queue`); el turno del dueño (`oficina_turnos` tipo `dueno`
 * corriendo, la marca de la tarjeta «Propuestas» de Decisiones) no se leía. Parte A: la cuenta. Agnóstico: cualquier familia con turno del dueño. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { MOTIVO_PROPUESTAS_ESPERAN, estadoDelTablero } from "@/lib/pizarron"
import { TURNO_DEL_DUENO, leerPizarron } from "@/lib/pizarron-datos"
import { tarjetaDelCentro } from "@/lib/centro-tarjetas"
import { detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CAMPANA = "36e66179-3061-4a7d-94db-932a900d9515"

/** una base falsa que contesta por tabla y anota lo que se le pidió (filtros incluidos); `rota` = la tabla que contesta con error */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, rota: string | null = null) {
  const pedidos: Array<{ tabla: string; filtros: string[] }> = []
  const consulta = (tabla: string) => {
    const filtros: string[] = []
    pedidos.push({ tabla, filtros })
    let datos = tablas[tabla] ?? []
    const error = tabla === rota ? { message: "se cayó" } : null
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { filtros.push(`${c}=${String(v)}`); datos = datos.filter((f) => f[c] === v || (f[c] == null && v == null)); return q },
      in: (c: string, v: unknown[]) => { filtros.push(`${c} in ${v.length}`); datos = datos.filter((f) => v.includes(f[c])); return q },
      is: () => q,
      order: (c: string, o?: { ascending?: boolean }) => { datos = [...datos].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return q },
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data: error ? null : datos[0] ?? null, error }),
      then: (ok: (r: { data: unknown; error: unknown }) => unknown) => Promise.resolve({ data: error ? null : datos, error }).then(ok),
    }
    return q
  }
  return { supa: { from: consulta } as never, pedidos }
}

const fila = (id: string, fecha: string, estado: string, extra: Record<string, unknown> = {}) => ({ campana_id: CAMPANA, calendario_version: 1, id, fecha, hora: "09:00:00", red: "instagram", formato: "reel", pilar: "producto", tema: `Tema ${id}`, estado, seco: false, avisos: [], pendientes: [], tanda: 1, ...extra })
const encargo = (id: string, filaId: string, fecha: string, extra: Record<string, unknown> = {}) => ({ id, client_id: CLIENTE, brief_id: "BRF-1", familia: "video_mesa", estado: "en_paso", hitl_queue_id: null, sala_ref: { fila: { id: filaId, fecha, hora: "09:00" } }, gasto_usd: 2.47, dry_run: false, creado_en: "2026-11-18T09:44:42Z", ...extra })

function tablasDeLaCampana(turnos: Array<Record<string, unknown>>, extra: Record<string, Array<Record<string, unknown>>> = {}) {
  return {
    clients: [{ id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }],
    cadena_campanas: [{ id: CAMPANA, client_id: CLIENTE, estado: "necesita_humano", fecha_inicio: "2026-11-20", fecha_fin: "2027-01-30", seco: false, creada_en: "2026-11-18T08:33:22Z" }],
    cadena_calendario_filas: [
      fila("s4-d5-vie_reel_olon", "2026-11-27", "briefeada"),
      fila("s5-d1-lun_carrusel", "2026-11-30", "validada", { formato: "carrusel" }),
      fila("s1-d1-lun_carrusel", "2026-11-02", "perdio_su_fecha", { formato: "carrusel" }),
      fila("s6-d2-mar_reel", "2026-12-08", "briefeada"),
    ],
    oficina_encargos: [encargo("57101e2a", "s4-d5-vie_reel_olon", "2026-11-27"), encargo("e-mesa", "s6-d2-mar_reel", "2026-12-08")],
    oficina_turnos: turnos,
    ...extra,
  }
}
const TURNO_ABIERTO = { encargo_id: "57101e2a", tipo: "dueno", estado: "corriendo", paso: "aprobar_propuestas", n: 17 }

describe("1 · el estado de la publicación: el turno del dueño abierto = espera a Emilio", () => {
  const enc = (estado: string, espera_al_dueno?: boolean) => ({ id: "e", familia: "video_mesa", estado, gasto_usd: 0, creado_en: "x", ...(espera_al_dueno === undefined ? {} : { espera_al_dueno }) })
  it("en_paso o abierto con el turno del dueño → «emilio», con el motivo en palabras", () => {
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("en_paso", true) })).toEqual({ tablero: "emilio", motivo: MOTIVO_PROPUESTAS_ESPERAN })
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("abierto", true) })).toEqual({ tablero: "emilio", motivo: MOTIVO_PROPUESTAS_ESPERAN })
    expect(MOTIVO_PROPUESTAS_ESPERAN).toBe("las propuestas esperan tu decisión")
  })
  it("sin el turno sigue en la mesa (lo de siempre); `false` explícito tampoco espera", () => {
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("en_paso") }).tablero).toBe("mesa")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("en_paso", false) }).tablero).toBe("mesa")
  })
  it("un encargo que ya terminó, falló o quedó aprobado NO espera aunque quede la marca; la bandeja manda sobre el turno", () => {
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("cerrado", true) }).tablero).toBe("jefatura")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("fallido", true) }).tablero).toBe("idea")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("aprobada", true) }).tablero).toBe("aprobada")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("en_paso", true), pieza: { status: "approved" } }).tablero).toBe("aprobada")
  })
})

describe("2 · la lectura del tablero lee los turnos del dueño de sus encargos (solo lectura, acotada)", () => {
  it("el reel con su turno abierto cuenta como «espera a Emilio»; el otro encargo sigue en la mesa; las demás filas, su estado de calendario", async () => {
    const { supa, pedidos } = baseFalsa(tablasDeLaCampana([TURNO_ABIERTO]))
    const p = await leerPizarron(supa, { ahora: new Date("2026-11-18T13:00:00Z") })
    const por = Object.fromEntries(p.filas.map((f) => [f.id, f.tablero]))
    expect(por).toEqual({ "s4-d5-vie_reel_olon": "emilio", "s5-d1-lun_carrusel": "idea", "s1-d1-lun_carrusel": "vencida", "s6-d2-mar_reel": "mesa" })
    expect(p.filas.find((f) => f.id === "s4-d5-vie_reel_olon")).toMatchObject({ motivo: MOTIVO_PROPUESTAS_ESPERAN, encargo: { id: "57101e2a", espera_al_dueno: true }, pieza: null })
    expect(p.filas.find((f) => f.id === "s6-d2-mar_reel")?.encargo).not.toHaveProperty("espera_al_dueno")
    expect(p.totales.emilio).toBe(1)
    // solo los turnos del dueño corriendo, y solo de los encargos de esta campaña
    expect(pedidos.find((x) => x.tabla === "oficina_turnos")?.filtros).toEqual([`tipo=${TURNO_DEL_DUENO}`, "estado=corriendo", "encargo_id in 2"])
    expect(TURNO_DEL_DUENO).toBe("dueno")
  })
  it("un turno cerrado, uno de otro tipo o el de otro encargo no hacen esperar a Emilio", async () => {
    const otros = [{ ...TURNO_ABIERTO, estado: "cerrado" }, { ...TURNO_ABIERTO, tipo: "codigo" }, { ...TURNO_ABIERTO, encargo_id: "de-otro-cliente" }]
    const p = await leerPizarron(baseFalsa(tablasDeLaCampana(otros)).supa, { ahora: new Date("2026-11-18T13:00:00Z") })
    expect(p.filas.find((f) => f.id === "s4-d5-vie_reel_olon")?.tablero).toBe("mesa")
    expect(p.totales.emilio).toBeUndefined()
  })
  it("sin encargos no pregunta por turnos", async () => {
    const { supa, pedidos } = baseFalsa(tablasDeLaCampana([TURNO_ABIERTO], { oficina_encargos: [] }))
    await leerPizarron(supa, { ahora: new Date("2026-11-18T13:00:00Z") })
    expect(pedidos.some((x) => x.tabla === "oficina_turnos")).toBe(false)
  })
  it("si la tabla de turnos no se puede leer, la lectura falla (nunca se lee como «nada espera»)", async () => {
    await expect(leerPizarron(baseFalsa(tablasDeLaCampana([TURNO_ABIERTO]), "oficina_turnos").supa, { ahora: new Date("2026-11-18T13:00:00Z") })).rejects.toThrow(/oficina_turnos/)
  })
})

describe("3 · la tarjeta «Piezas» del Centro: con el reel esperando dice «Por aprobar · 1»", () => {
  it("la tarjeta y la segunda línea del cuadro cuentan la publicación que espera tus propuestas", async () => {
    const p = await leerPizarron(baseFalsa(tablasDeLaCampana([TURNO_ABIERTO])).supa, { ahora: new Date("2026-11-18T13:00:00Z") })
    expect(tarjetaDelCentro("piezas", p, null)).toEqual({ estado: "Por aprobar", tono: "oro", cantidad: "1", linea: "Espera tu aprobación" })
    expect(detalleDelCuadro("piezas", p)).toEqual({ texto: "1 pieza espera tu aprobación", aviso: true })
  })
  it("sin el turno, la misma campaña vuelve a «Al día · 0» (lo que veía Emilio)", async () => {
    const p = await leerPizarron(baseFalsa(tablasDeLaCampana([])).supa, { ahora: new Date("2026-11-18T13:00:00Z") })
    expect(tarjetaDelCentro("piezas", p, null)).toMatchObject({ estado: "Al día", cantidad: "0", linea: "Nada por aprobar" })
  })
})
