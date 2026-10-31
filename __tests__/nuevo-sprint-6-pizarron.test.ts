/**
 * Dashboard nuevo · sprint 6 «Pizarrón de piezas» (31-oct · propuesta de Emilio): el tablero de la campaña dentro de la oficina de marketing.
 * SOLO LECTURA sobre tablas reales. Arriba la gran idea (hoy: no existe, se dice) y la fase activa; la cuadrícula = publicaciones del calendario coloreadas por estado;
 * clic en una casilla = la publicación y el enlace a la ventana de la pieza (ahí se aprueba o se piden cambios); selector de cliente. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { PanelPizarron, agruparEsperas, textoDeLaFase } from "@/components/nuevo/PanelPizarron"
import { ESTADOS_DEL_TABLERO, colorDelEstado, enlaceDeLaPieza, estadoDelTablero, faseActiva, hoyEnEcuador, redDelTablero, semanasDelTablero, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import { GRAN_IDEA_SIN_TABLA, leerPizarron, type Pizarron } from "@/lib/pizarron-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CAMPANA = "8168f32b-47d9-466a-9350-3dff31700a58"

/** una base falsa que contesta por tabla y anota lo que se le pidió (filtros incluidos) */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>) {
  const pedidos: Array<{ tabla: string; filtros: string[] }> = []
  const consulta = (tabla: string) => {
    const filtros: string[] = []
    pedidos.push({ tabla, filtros })
    let datos = tablas[tabla] ?? []
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { filtros.push(`${c}=${String(v)}`); datos = datos.filter((f) => f[c] === v || (f[c] == null && v == null)); return q },
      in: (c: string, v: unknown[]) => { filtros.push(`${c} in ${v.length}`); datos = datos.filter((f) => v.includes(f[c])); return q },
      is: () => q,
      order: (c: string, o?: { ascending?: boolean }) => { datos = [...datos].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return q },
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data: datos[0] ?? null, error: null }),
      then: (ok: (r: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: datos, error: null }).then(ok),
    }
    return q
  }
  return { supa: { from: consulta } as never, pedidos }
}

const fila = (id: string, fecha: string, estado: string, extra: Record<string, unknown> = {}) => ({ campana_id: CAMPANA, calendario_version: 1, id, fecha, hora: "11:00:00", red: "instagram", formato: "historia", pilar: "producto", tema: `Tema ${id}`, estado, seco: false, avisos: [], pendientes: [], tanda: 1, ...extra })

describe("el estado de cada publicación (de dónde sale cada color)", () => {
  it("la bandeja manda: pendiente = esperando a Emilio (destacada); aprobada; con cambios; vencida; superada = descartada; rechazada", () => {
    const base = { estado_fila: "briefeada", encargo: { id: "e", familia: "kit_historias", estado: "cerrado", gasto_usd: 0.3, creado_en: "x" } }
    expect(estadoDelTablero({ ...base, pieza: { status: "pending" } }).tablero).toBe("emilio")
    expect(estadoDelTablero({ ...base, pieza: { status: "approved" } }).tablero).toBe("aprobada")
    expect(estadoDelTablero({ ...base, pieza: { status: "edited", decision: { pidio_cambios: true } } }).tablero).toBe("cambios")
    expect(estadoDelTablero({ ...base, pieza: { status: "rejected", decision: { vencida: true } } }).tablero).toBe("vencida")
    expect(estadoDelTablero({ ...base, pieza: { status: "rejected", decision: { superada: true } } }).tablero).toBe("descartada")
    expect(estadoDelTablero({ ...base, pieza: { status: "rejected", decision: { motivo: "no" } } }).tablero).toBe("rechazada")
    expect(ESTADOS_DEL_TABLERO.find((e) => e.clave === "emilio")?.destacada).toBe(true)
  })
  it("sin bandeja, la oficina: abierta = mesa; entregada sin revisión o con revisión = jefatura; fallida vuelve a idea; encargo aprobado = aprobada", () => {
    const enc = (estado: string) => ({ id: "e", familia: "post_img", estado, gasto_usd: 0, creado_en: "x" })
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("en_paso") }).tablero).toBe("mesa")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("cerrado") }).tablero).toBe("jefatura")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("cerrado"), jefatura: { estado: "en_paso", resultado: null } })).toEqual({ tablero: "jefatura", motivo: "la jefatura la está revisando" })
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("cerrado"), jefatura: { estado: "cerrada", resultado: "limpia" } }).motivo).toContain("limpia")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("fallido") }).tablero).toBe("idea")
    expect(estadoDelTablero({ estado_fila: "briefeada", encargo: enc("aprobada") }).tablero).toBe("aprobada")
  })
  it("sin oficina, el calendario: los 13 estados de la fila caen en idea · mesa · aprobada · vencida · descartada, con su motivo en palabras", () => {
    const de = (f: string) => estadoDelTablero({ estado_fila: f })
    for (const f of ["esquema", "propuesta", "validada", "en_investigacion", "lista_para_brief", "briefeada", "espera_video"]) expect(de(f).tablero).toBe("idea")
    expect(de("en_oficina").tablero).toBe("mesa"); expect(de("aprobada").tablero).toBe("aprobada")
    expect(de("perdio_su_fecha").tablero).toBe("vencida"); expect(de("vencida_sin_brazo").tablero).toBe("vencida")
    expect(de("cancelada").tablero).toBe("descartada"); expect(de("descartada_sin_fuente").tablero).toBe("descartada")
    expect(de("espera_video").motivo).toBe("espera el brazo de video (aún no construido)")
    expect(de("algo_nuevo").motivo).toBe("algo nuevo")
    for (const e of ESTADOS_DEL_TABLERO) expect(colorDelEstado(e.clave)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe("la fase activa y la cuadrícula", () => {
  const fases = [{ clave: "senal", objetivo: "Señal", dia_desde: 1, dia_hasta: 30 }, { clave: "recompra", objetivo: "Recompra", dia_desde: 31, dia_hasta: 60 }, { clave: "temporada", objetivo: "Temporada", dia_desde: 61, dia_hasta: 90 }]
  it("antes de empezar dice cuánto falta y cuál es la primera; en curso, el día y la fase; después, la última; sin fases o sin fecha lo dice", () => {
    expect(faseActiva(fases, "2026-11-02", "2026-10-31")).toMatchObject({ situacion: "antes", dias_para_empezar: 2, fase: { clave: "senal" } })
    expect(faseActiva(fases, "2026-11-02", "2026-11-02")).toMatchObject({ situacion: "en_curso", dia: 1, fase: { clave: "senal" } })
    expect(faseActiva(fases, "2026-11-02", "2026-12-15")).toMatchObject({ situacion: "en_curso", dia: 44, fase: { clave: "recompra" } })
    expect(faseActiva(fases, "2026-11-02", "2027-02-10")).toMatchObject({ situacion: "despues", fase: { clave: "temporada" } })
    expect(faseActiva([], "2026-11-02", "2026-11-02").situacion).toBe("sin_fases")
    expect(faseActiva(fases, null, "2026-11-02").situacion).toBe("sin_fecha")
    expect(hoyEnEcuador(new Date("2026-11-01T03:30:00Z"))).toBe("2026-10-31") // a las 22:30 de Ecuador todavía es 31
  })
  it("el texto de arriba", () => {
    const base = { campana: { id: "c", estado: "pausada", desde: "2026-11-02", hasta: null, version_calendario: 1, version_estrategia: 1 } }
    expect(textoDeLaFase({ ...base, fase_activa: faseActiva(fases, "2026-11-02", "2026-10-31") })).toBe("Empieza en 2 días (2 nov) · primera fase: senal")
    expect(textoDeLaFase({ ...base, fase_activa: faseActiva(fases, "2026-11-02", "2026-11-01") })).toBe("Empieza mañana (2 nov) · primera fase: senal")
    expect(textoDeLaFase({ ...base, fase_activa: faseActiva(fases, "2026-11-02", "2026-11-20") })).toBe("Día 19 · fase senal")
  })
  it("semanas de lunes a domingo desde la primera fecha hasta la última; cada día con sus publicaciones por hora; el total por estado", () => {
    const f = (id: string, fecha: string, hora: string | null, tablero: FilaDelTablero["tablero"]): FilaDelTablero => ({ id, fecha, hora, red: "instagram", formato: "foto", pilar: null, tema: id, sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "validada", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero, motivo: "" })
    const s = semanasDelTablero([f("b", "2026-11-04", "15:00", "idea"), f("a", "2026-11-04", "09:00", "emilio"), f("c", "2026-11-12", null, "aprobada")])
    expect(s.map((x) => [x.desde, x.hasta])).toEqual([["2026-11-02", "2026-11-08"], ["2026-11-09", "2026-11-15"]])
    expect(s[0].dias.map((d) => d.fecha)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])
    expect(s[0].dias[2].publicaciones.map((p) => p.id)).toEqual(["a", "b"])
    expect(s[1].dias[3].publicaciones.map((p) => p.id)).toEqual(["c"])
    expect(semanasDelTablero([])).toEqual([])
    expect(totalesDelTablero([f("a", "2026-11-04", null, "idea"), f("b", "2026-11-04", null, "idea"), f("c", "2026-11-04", null, "emilio")])).toEqual({ idea: 2, emilio: 1 })
    expect(redDelTablero("whatsapp")).toEqual({ nombre: "WhatsApp", sigla: "WA" }); expect(redDelTablero("instagram").sigla).toBe("IG"); expect(redDelTablero("rara")).toEqual({ nombre: "rara", sigla: "RA" })
    expect(enlaceDeLaPieza("70b922a5-e9f8-4f48-9134-24f3418d9a0b")).toBe("/piezas?id=70b922a5-e9f8-4f48-9134-24f3418d9a0b&estado=todas")
  })
})

describe("la lectura (base falsa con la forma real de las tablas)", () => {
  const tablas = {
    clients: [{ id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }, { id: "11111111-1111-1111-1111-111111111111", name: "Otro", industry: "x", status: "active", archived_at: null }, { id: "2", name: "zz prueba", industry: "prueba", status: "active", archived_at: null }],
    cadena_campanas: [{ id: CAMPANA, client_id: CLIENTE, estado: "pausada", fecha_inicio: "2026-11-02", fecha_fin: "2027-01-30", seco: false, creada_en: "2026-10-30" }, { id: "vieja", client_id: CLIENTE, estado: "reemplazada", fecha_inicio: "2026-10-01", seco: false, creada_en: "2026-10-01" }],
    cadena_estrategias: [{ campana_id: CAMPANA, version: 1, seco: false, contenido: { fases: [{ clave: "senal", objetivo: "Señal", dia_desde: 1, dia_hasta: 30 }] } }],
    cadena_esperas: [{ campana_id: CAMPANA, estado: "viva", seco: false, motivo: "espera la revisión de la primera pieza", vence_en: null }],
    cadena_calendario_filas: [
      fila("s1-d1-lun_historia", "2026-11-02", "briefeada"),
      fila("s1-d1-lun_foto", "2026-11-02", "en_investigacion", { formato: "foto", hora: "15:00:00" }),
      fila("s1-d2-mar_estado", "2026-11-03", "espera_video", { red: "whatsapp", formato: "estado", pendientes: ["falta el precio"] }),
      fila("s1-d3", "2026-11-04", "descartada_sin_fuente"),
      { ...fila("vieja", "2026-11-02", "esquema"), calendario_version: 0 }, // versión anterior del calendario: no se mezcla
    ],
    oficina_encargos: [
      { id: "enc-real", client_id: CLIENTE, brief_id: "BRF-0002", familia: "kit_historias", estado: "cerrado", hitl_queue_id: "hitl-1", sala_ref: { fila: { id: "s1-d1-lun_historia", fecha: "2026-11-02", hora: "11:00" } }, gasto_usd: 0.42, dry_run: false, creado_en: "2026-10-31T13:32:05Z" },
      { id: "enc-seco", client_id: CLIENTE, brief_id: "BRF-0005", familia: "kit_historias", estado: "cerrado", hitl_queue_id: null, sala_ref: { fila: { id: "s1-d1-lun_foto", fecha: "2026-11-02" } }, gasto_usd: 0.1, dry_run: true, creado_en: "2026-10-13" },
    ],
    jefatura_revisiones: [{ artifact_type: "pieza", artifact_id: "enc-real", estado: "cerrada", resultado: "limpia", creado_en: "2026-10-31T13:40:00Z" }],
    hitl_queue: [{ id: "hitl-1", status: "pending", decision: null, expires_at: "2026-11-02T16:00:00Z", created_at: "2026-10-31T13:45:00Z" }],
  }
  it("arma el pizarrón de Náufrago: el cliente con campaña por omisión, la fase, la espera, 4 publicaciones de la última versión y sus estados reales", async () => {
    const { supa, pedidos } = baseFalsa(tablas)
    const p = await leerPizarron(supa, { ahora: new Date("2026-10-31T20:00:00Z") })
    expect(p.cliente).toEqual({ id: CLIENTE, nombre: "Náufrago" })
    expect(p.clientes.map((c) => [c.nombre, c.con_campana])).toEqual([["Náufrago", true], ["Otro", false]]) // sin la ficha de práctica
    expect(p.campana).toMatchObject({ id: CAMPANA, estado: "pausada", desde: "2026-11-02", version_calendario: 1, version_estrategia: 1 })
    expect(p.gran_idea).toEqual(GRAN_IDEA_SIN_TABLA)
    expect(p.fase_activa).toMatchObject({ situacion: "antes", dias_para_empezar: 2 })
    expect(p.esperas).toEqual([{ motivo: "espera la revisión de la primera pieza", vence_en: null }])
    expect(p.filas.map((f) => [f.id, f.tablero])).toEqual([["s1-d1-lun_historia", "emilio"], ["s1-d1-lun_foto", "idea"], ["s1-d2-mar_estado", "idea"], ["s1-d3", "descartada"]])
    const h = p.filas[0]
    expect(h.encargo).toMatchObject({ id: "enc-real", familia: "kit_historias", gasto_usd: 0.42 }); expect(h.jefatura).toEqual({ estado: "cerrada", resultado: "limpia" }); expect(h.pieza).toMatchObject({ id: "hitl-1", estado: "pendiente" })
    expect(p.filas[1].encargo).toBeNull() // el encargo de ensayo (dry_run) no cuenta
    expect(p.filas[2]).toMatchObject({ red: "whatsapp", pendientes: ["falta el precio"], motivo: "espera el brazo de video (aún no construido)" })
    expect(p.totales).toEqual({ emilio: 1, idea: 2, descartada: 1 })
    expect(p.semanas).toHaveLength(1); expect(p.semanas[0].dias[0].publicaciones.map((x) => x.hora)).toEqual(["11:00", "15:00"])
    // solo lectura y acotado: filas de la última versión, encargos reales del cliente, bandeja solo por los ids de los encargos
    expect(pedidos.find((x) => x.tabla === "cadena_calendario_filas" && x.filtros.includes("calendario_version=1"))).toBeTruthy()
    expect(pedidos.find((x) => x.tabla === "oficina_encargos")?.filtros).toEqual(expect.arrayContaining([`client_id=${CLIENTE}`, "dry_run=false"]))
    expect(pedidos.find((x) => x.tabla === "hitl_queue")?.filtros).toEqual(["id in 1"])
  })
  it("con un cliente pedido sin campaña, lo dice (no inventa una); con un cliente desconocido, vuelve al de la campaña", async () => {
    const otro = await leerPizarron(baseFalsa(tablas).supa, { cliente: "11111111-1111-1111-1111-111111111111" })
    expect(otro.cliente?.nombre).toBe("Otro"); expect(otro.campana).toBeNull(); expect(otro.filas).toEqual([])
    const des = await leerPizarron(baseFalsa(tablas).supa, { cliente: "99999999-9999-9999-9999-999999999999" })
    expect(des.cliente?.nombre).toBe("Náufrago")
  })
  it("un error de la base lanza (nunca se lee como «sin campaña»)", async () => {
    const q: Record<string, unknown> = { then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "se cayó" } }).then(ok) }
    for (const m of ["select", "eq", "in", "is", "order", "limit", "maybeSingle"]) q[m] = () => q
    await expect(leerPizarron({ from: () => q } as never)).rejects.toThrow(/se cayó/)
  })
})

describe("la puerta y el dibujo", () => {
  it("la ruta exige administrador antes de leer y valida el id del cliente", () => {
    const r = readFileSync("app/api/pizarron/route.ts", "utf8")
    expect(r.indexOf("exigirAdmin()")).toBeLessThan(r.indexOf("leerPizarron("))
    expect(r).toContain("cliente_invalido")
    expect(r).not.toMatch(/\.(insert|update|upsert|delete)\(/)
    expect(readFileSync("lib/pizarron-datos.ts", "utf8")).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/)
  })
  it("el tablero de la oficina abre el pizarrón (botón con diálogo); cerrado de entrada", () => {
    const html = renderToStaticMarkup(createElement(EscenaViva, { inicial: true }))
    expect(html).toMatch(/<g class="nv-tablero"[^>]*role="button"[^>]*aria-haspopup="dialog" aria-expanded="false"/)
    expect(html).not.toContain('data-seccion="pizarron"')
    const c = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(c).toContain("createPortal(<PanelAplicaciones onCerrar={cerrarPizarron} />, document.body)") // 6.2: primero las aplicaciones; el calendario se abre desde ahí
  })
  it("el panel dibuja la campaña, la gran idea ausente, la leyenda, las semanas, la casilla destacada y el enlace a la ventana de la pieza", () => {
    const filas: FilaDelTablero[] = [
      { id: "s1-d1-lun_historia", fecha: "2026-11-02", hora: "11:00", red: "instagram", formato: "historia", pilar: "producto", tema: "Encebollado al amanecer", sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "briefeada", avisos: [], pendientes: [], encargo: { id: "e", familia: "kit_historias", estado: "cerrado", gasto_usd: 0.42, creado_en: "x" }, jefatura: { estado: "cerrada", resultado: "limpia" }, pieza: { id: "70b922a5-e9f8-4f48-9134-24f3418d9a0b", status: "pending", estado: "pendiente", expires_at: null, created_at: "x" }, tablero: "emilio", motivo: "la pieza está en tu bandeja" },
      { id: "s1-d1-lun_foto", fecha: "2026-11-02", hora: "15:00", red: "instagram", formato: "foto", pilar: "lugar", tema: "La terraza", sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "en_investigacion", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "en investigación (buscando fuentes)" },
    ]
    const datos: Pizarron = {
      clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: true }], cliente: { id: CLIENTE, nombre: "Náufrago" },
      campana: { id: CAMPANA, estado: "pausada", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1 },
      fases: [{ clave: "senal", objetivo: "Juntar señal", dia_desde: 1, dia_hasta: 30 }], fase_activa: faseActiva([{ clave: "senal", objetivo: "Juntar señal", dia_desde: 1, dia_hasta: 30 }], "2026-11-02", "2026-11-05"),
      gran_idea: GRAN_IDEA_SIN_TABLA, esperas: [{ motivo: "espera la revisión", vence_en: null }], filas, semanas: semanasDelTablero(filas), totales: totalesDelTablero(filas), hoy: "2026-11-05", leido_en: "x",
    }
    const html = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('role="dialog"'); expect(html).toContain("Pizarrón de piezas"); expect(html).toContain("Campaña de Náufrago"); expect(html).toContain("en pausa")
    expect(html).toContain(GRAN_IDEA_SIN_TABLA.nota); expect(html).toContain("Día 4 · fase senal"); expect(html).toContain('aria-current="step"')
    expect(html).toContain("La campaña espera: espera la revisión")
    expect(agruparEsperas([{ motivo: "a" }, { motivo: "b" }, { motivo: "a" }])).toEqual(["a ×2", "b"])
    expect(html).toContain("Esperando tu aprobación"); expect(html).toMatch(/<button[^>]*class="pz-casilla[^"]*"[^>]*data-estado="emilio" data-destacada="true"/)
    expect(html).toMatch(/aria-label="Elegir el cliente"/); expect(html).toContain("<option value=\"" + CLIENTE + "\"")
    expect(html).toContain("2 nov – 8 nov"); expect(html).toContain("Haz clic en una casilla")
    // nada de aprobar/rechazar aquí: el pizarrón solo enlaza a la ventana de la pieza
    expect(html).not.toMatch(/decidir|aprobar\b/i)
    const c = readFileSync("components/nuevo/PanelPizarron.tsx", "utf8")
    expect(c).not.toContain("method: \"POST\""); expect(c).toContain('data-accion="abrir-pieza"'); expect(c).toContain("enlaceDeLaPieza(f.pieza.id)")
    expect(c).toContain('window.addEventListener("keydown", tecla, true)') // Esc cierra el pizarrón y no la oficina
  })
})
