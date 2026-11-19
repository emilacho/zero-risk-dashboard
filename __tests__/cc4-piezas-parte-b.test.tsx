// @vitest-environment jsdom
/**
 * PIEZAS parte B (CC4 · 19-nov · boceto aprobado por Emilio, `RESPUESTA-LENOVO-a-CC4-piezas-parte-B-boceto.md`):
 *  A · lo que espera tu decisión (sus propuestas) dice «Espera tu decisión» en la lista y en el Kanban, cuenta como «por aprobar» y abre Propuestas ahí mismo.
 *  B · el Kanban de Piezas lee también el calendario del cliente: las publicaciones sin pieza («Por hacer», «En el estudio», vencidas), cada cosa UNA vez.
 *  C · «Por hacer» muestra las 10 más cercanas y «+ N más».
 *  Sin textos de uso arriba del Kanban. Dos clientes de rubros distintos (un restaurante y una clínica dental): nada depende de uno.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { Kanban } from "@/components/nuevo/Kanban"
import { ESPERA_TU_DECISION, POR_HACER_A_LA_VISTA, armarKanban, kanbanDeLasPiezas, type TarjetaDelKanban } from "@/lib/kanban"
import { filasDeSubcategorias, numeroDelCliente } from "@/lib/bandeja"
import { MOTIVO_PROPUESTAS_ESPERAN, type FilaDelTablero } from "@/lib/pizarron"
import { normalizarDecisiones } from "@/lib/direccion-decisiones"
import type { Bandeja } from "@/lib/bandeja-datos"
import { listarEnCurso, type FilaDeLaLista, type PiezaEnCurso } from "@/lib/piezas-datos"
import { TURNO_DEL_DUENO } from "@/lib/pizarron-datos"
import type { SupabaseClient } from "@supabase/supabase-js"

afterEach(cleanup)

const CASOS = [
  { id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", nombre: "Restaurante La Ola", tipo: "Video corto", carpeta: "Video corto Instagram" },
  { id: "b7c9e2d4-1a3f-4e8b-9d6c-5f0a2b3c4d5e", nombre: "Clínica Dental Sonrisa", tipo: "Carrusel", carpeta: "Carrusel Facebook" },
] as const
type Caso = (typeof CASOS)[number]

const pieza = (c: Caso, p: Partial<FilaDeLaLista> = {}): FilaDeLaLista => ({
  id: `pieza-${c.id.slice(0, 4)}`, cliente_id: c.id, cliente: c.nombre, carpeta: c.carpeta, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true,
  titulo: "x", titulo_legible: `${c.carpeta} · ${c.nombre}`, creada: "2026-11-18T10:00:00Z", gasto_usd: null, incompleta: false, desacuerdos: 0, tiene_dibujo: true,
  miniatura: "imagen", archivada: false, ...p,
})
const enCurso = (c: Caso, p: Partial<PiezaEnCurso> = {}): PiezaEnCurso => ({
  encargo_id: `${c.id.slice(0, 8)}-aaaa-4aaa-8aaa-000000000001`, cliente_id: c.id, familia: "video_mesa", tipo_legible: c.tipo, columna: "en_el_estudio", paso: 17, publica: "2026-11-27", creada: "2026-11-19T08:00:00Z", ...p,
})
const filaCal = (p: Partial<FilaDelTablero>): FilaDelTablero => ({
  id: "f1", fecha: "2026-11-27", hora: "09:00", red: "instagram", formato: "reel", pilar: null, tema: "", sede: null, pieza_fija: false, tanda: 1, semana: 1,
  estado_fila: "validada", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "validada", ...p,
})
const bandeja = (_c: Caso, o: { piezas?: FilaDeLaLista[]; en_curso?: PiezaEnCurso[]; estado?: "pendiente" | "todas" } = {}): Bandeja => ({
  estado: o.estado ?? "pendiente", por_aprobar: (o.piezas ?? []).length, piezas: o.piezas ?? [], otras: [], archivo: [], en_curso: o.en_curso ?? [], leido_en: "x",
  clientes: CASOS.map((x) => ({ id: x.id, nombre: x.nombre })),
})
const columna = (cols: ReturnType<typeof armarKanban>, clave: string) => cols.find((k) => k.clave === clave)!

describe("Piezas parte B · A · lo que espera tu decisión", () => {
  for (const c of CASOS) {
    it(`${c.nombre}: con «Por aprobar» entra a su fila y cuenta; con «Todas» también; la que no espera solo sale con «Todas»`, () => {
      const espera = enCurso(c, { espera_al_dueno: true })
      const haciendo = enCurso(c, { encargo_id: "enc-otro", paso: 5 })
      const pend = filasDeSubcategorias(null, [espera, haciendo], "pendiente", c.id)
      expect(pend.map((f) => [f.nombre, f.numero, f.elementos.length])).toEqual([[c.tipo, 1, 1]])
      expect(numeroDelCliente(pend)).toBe(1)
      const todas = filasDeSubcategorias(null, [espera, haciendo], "todas", c.id)
      expect(todas[0].elementos.length).toBe(2)
      // otro cliente no ve las del primero
      const otro = CASOS.find((x) => x.id !== c.id)!
      expect(filasDeSubcategorias(null, [espera], "pendiente", otro.id)).toEqual([])
    })

    it(`${c.nombre}: la tarjeta dice «${ESPERA_TU_DECISION}» y «Abrir Propuestas →» abre las propuestas de ESE encargo encima`, async () => {
      const espera = enCurso(c, { espera_al_dueno: true })
      const decisiones = normalizarDecisiones({ decisiones: [
        { id: "otra", tipo: "propuestas", fuente: "oficina_turnos", client_id: c.id, cliente: c.nombre, titulo: "Otra", desde: "2026-11-19T08:00:00Z", vence: null, decidir: { ruta: null, accion: "propuestas-aprobar" }, detiene: true,
          propuestas: { encargo_id: "99999999-aaaa-4aaa-8aaa-000000000009", brief_id: null, ronda: 1, quedan_vueltas: 1, avisos: [], lista: [{ id: "P9", nombre: "Ajena", concepto: "c", segundos: 10, red: "Instagram", objetivo: "o", por_que: "p", video_url: null, costo: { borrador_usd: null, final_usd: null }, planos: [] }] } },
        { id: espera.encargo_id, tipo: "propuestas", fuente: "oficina_turnos", client_id: c.id, cliente: c.nombre, titulo: "Propuestas del video: elige una", desde: "2026-11-19T08:00:00Z", vence: null, decidir: { ruta: null, accion: "propuestas-aprobar" }, detiene: true,
          propuestas: { encargo_id: espera.encargo_id, brief_id: "b1", ronda: 1, quedan_vueltas: 2, avisos: [], lista: [{ id: "P1", nombre: "La de este encargo", concepto: "c", segundos: 12, red: "Instagram", objetivo: "o", por_que: "p", video_url: null, costo: { borrador_usd: null, final_usd: null }, planos: [] }] } },
      ], fuentes: [], sin_fuente: [], completo: true })
      const fetchImpl = vi.fn(async (url: string) => {
        if (String(url).startsWith("/api/direccion/decisiones")) return new Response(JSON.stringify({ ok: true, ...decisiones }), { status: 200 })
        return new Response(JSON.stringify(bandeja(c, { en_curso: [espera] })), { status: 200 })
      }) as unknown as typeof fetch
      const { container, findByText } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(c, { en_curso: [espera] }), clienteInicial: c.id, carpetaInicial: c.tipo, fetchImpl }))
      const tarjeta = container.querySelector(`[data-en-curso="${espera.encargo_id}"]`)!
      expect(tarjeta.getAttribute("data-espera")).toBe("true")
      expect(tarjeta.textContent).toContain(ESPERA_TU_DECISION)
      expect(tarjeta.textContent).not.toContain("todavía no llega a tu bandeja")
      await act(async () => { fireEvent.click(tarjeta.querySelector('[data-accion="abrir-propuestas"]')!) })
      expect(await findByText("La de este encargo")).toBeTruthy()
      expect(container.ownerDocument.body.textContent).not.toContain("Ajena")
    })

    it(`${c.nombre}: si las propuestas ya no esperan, lo dice (no abre otra cosa)`, async () => {
      const espera = enCurso(c, { espera_al_dueno: true })
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, decisiones: [], fuentes: [], sin_fuente: [], completo: true }), { status: 200 })) as unknown as typeof fetch
      const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(c, { en_curso: [espera] }), clienteInicial: c.id, carpetaInicial: c.tipo, fetchImpl }))
      await act(async () => { fireEvent.click(container.querySelector('[data-accion="abrir-propuestas"]')!) })
      await waitFor(() => expect(container.querySelector('[data-error="propuestas"]')?.textContent).toBe("Esas propuestas ya no esperan tu decisión."))
    })
  }
})

describe("Piezas parte B · B · el Kanban lee el calendario, cada cosa una vez", () => {
  for (const c of CASOS) {
    it(`${c.nombre}: pieza + filas del calendario + encargos sin fila; sin repetir y sin «Próximas»`, () => {
      const p = pieza(c)
      const conPieza = filaCal({ id: "con-pieza", pieza: { id: p.id, status: "pending", estado: "pendiente", expires_at: null, created_at: p.creada }, tablero: "emilio", motivo: "la pieza está en tu bandeja" })
      const porHacer = filaCal({ id: "por-hacer", fecha: "2026-11-30" })
      const esquema = filaCal({ id: "esquema", estado_fila: "esquema" })
      const vencida = filaCal({ id: "vencida", fecha: "2026-11-01", tablero: "vencida", motivo: "perdió su fecha" })
      const esperaConFila = filaCal({ id: "espera", encargo: { id: "enc-fila", familia: "video_mesa", estado: "en_paso", gasto_usd: 1, creado_en: "x", espera_al_dueno: true }, tablero: "emilio", motivo: MOTIVO_PROPUESTAS_ESPERAN })
      const repetido = enCurso(c, { encargo_id: "enc-fila", espera_al_dueno: true })
      const suelto = enCurso(c, { encargo_id: "enc-suelto", columna: "en_revision", publica: null })
      const k = kanbanDeLasPiezas({ piezas: [p], calendario: [conPieza, porHacer, esquema, vencida, esperaConFila], enCurso: [repetido, suelto] })
      const ids = k.tarjetas.map((t) => t.id)
      expect(ids.sort()).toEqual([p.id, "enc-suelto", "espera|2026-11-27", "por-hacer|2026-11-30", "vencida|2026-11-01"].sort())
      const cols = armarKanban(k.tarjetas)
      expect(columna(cols, "por_hacer").tarjetas.map((t) => t.id)).toEqual(["por-hacer|2026-11-30"])
      expect(columna(cols, "vencida").tarjetas.map((t) => t.id)).toEqual(["vencida|2026-11-01"])
      expect(columna(cols, "en_revision").tarjetas.map((t) => t.id)).toEqual(["enc-suelto"])
      const porAprobar = columna(cols, "por_aprobar").tarjetas
      expect(porAprobar.map((t) => t.id).sort()).toEqual([p.id, "espera|2026-11-27"].sort())
      expect(porAprobar.find((t) => t.id === "espera|2026-11-27")!.estado).toBe(ESPERA_TU_DECISION)
      // qué abre cada una: la pieza, o las propuestas de su encargo; la de «Por hacer» todavía no abre nada
      expect(k.abre.get(p.id)).toEqual({ tipo: "pieza", id: p.id })
      expect(k.abre.get("espera|2026-11-27")).toEqual({ tipo: "propuestas", id: "enc-fila" })
      expect(k.abre.has("por-hacer|2026-11-30")).toBe(false)
    })

    it(`${c.nombre}: un encargo en curso sin fila que espera tu decisión va a «Por aprobar» y abre sus propuestas`, () => {
      const k = kanbanDeLasPiezas({ piezas: [], calendario: [], enCurso: [enCurso(c, { espera_al_dueno: true })] })
      const cols = armarKanban(k.tarjetas)
      expect(columna(cols, "por_aprobar").tarjetas.map((t) => [t.estado, t.destacada])).toEqual([[ESPERA_TU_DECISION, true]])
      expect(columna(cols, "en_el_estudio").tarjetas).toEqual([])
      expect(k.abre.get(`${c.id.slice(0, 8)}-aaaa-4aaa-8aaa-000000000001`)).toEqual({ tipo: "propuestas", id: `${c.id.slice(0, 8)}-aaaa-4aaa-8aaa-000000000001` })
    })

    it(`${c.nombre}: el Kanban del panel muestra las filas del calendario y no lleva texto de uso arriba`, async () => {
      const { container } = render(createElement(PanelPiezas, {
        onCerrar: () => {}, bandejaInicial: bandeja(c, { piezas: [pieza(c)], estado: "todas" }), clienteInicial: c.id, vistaInicial: "kanban",
        filasDelCalendario: [filaCal({ id: "por-hacer", fecha: "2026-11-30" })],
      }))
      const vista = container.querySelector('[data-vista="kanban"]')!
      expect(vista.querySelector('[data-tarjeta="por-hacer|2026-11-30"]')).not.toBeNull()
      expect(vista.querySelector(`[data-tarjeta="pieza-${c.id.slice(0, 4)}"]`)).not.toBeNull()
      expect(vista.querySelector(":scope > p")).toBeNull()
      expect(vista.textContent).not.toContain("Toca una tarjeta")
    })
  }

  it("sin filas pasadas, el Kanban lee el calendario de ESE cliente en /api/pizarron", async () => {
    const c = CASOS[1]
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, filas: [filaCal({ id: "leida", fecha: "2026-12-02" })] }), { status: 200 })) as unknown as typeof fetch
    const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(c, { estado: "todas" }), clienteInicial: c.id, vistaInicial: "kanban", fetchImpl }))
    await waitFor(() => expect(container.querySelector('[data-tarjeta="leida|2026-12-02"]')).not.toBeNull())
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((x) => String(x[0]))).toContain(`/api/pizarron?cliente=${encodeURIComponent(c.id)}`)
  })
})

describe("Piezas parte B · C · «Por hacer» muestra las 10 más cercanas", () => {
  const tarjeta = (i: number): TarjetaDelKanban => ({ id: `t${i}`, columna: "por_hacer", titulo: `T${i}`, detalle: null, cuando: null, color: "#000", estado: "Idea", motivo: null, destacada: false, orden: `2026-12-${String(i).padStart(2, "0")}` })
  it("con 13 se ven las 10 primeras por fecha y «+ 3 más»; al tocarlo se ven todas", async () => {
    expect(POR_HACER_A_LA_VISTA).toBe(10)
    const cols = armarKanban(Array.from({ length: 13 }, (_, i) => tarjeta(13 - i)))
    const { container } = render(createElement(Kanban, { columnas: cols, etiqueta: "k", maximoPorHacer: POR_HACER_A_LA_VISTA }))
    const col = container.querySelector('[data-columna="por_hacer"]')!
    expect([...col.querySelectorAll("[data-tarjeta]")].map((b) => b.getAttribute("data-tarjeta"))).toEqual(Array.from({ length: 10 }, (_, i) => `t${i + 1}`))
    const mas = col.querySelector('[data-accion="ver-mas-por-hacer"]')!
    expect(mas.textContent).toBe("+ 3 más")
    await act(async () => { fireEvent.click(mas) })
    expect(col.querySelectorAll("[data-tarjeta]").length).toBe(13)
    expect(col.querySelector('[data-accion="ver-mas-por-hacer"]')).toBeNull()
  })
  it("con 10 o menos no hay «+ N más»; las otras columnas no tienen tope de 10", () => {
    const cols = armarKanban([...Array.from({ length: 10 }, (_, i) => tarjeta(i + 1)), ...Array.from({ length: 12 }, (_, i) => ({ ...tarjeta(i + 1), id: `v${i}`, columna: "vencida" as const }))])
    const { container } = render(createElement(Kanban, { columnas: cols, etiqueta: "k", maximoPorHacer: POR_HACER_A_LA_VISTA }))
    expect(container.querySelector('[data-accion="ver-mas-por-hacer"]')).toBeNull()
    expect(container.querySelector('[data-columna="vencida"]')!.querySelectorAll("[data-tarjeta]").length).toBe(12)
  })
})

/** la base falsa de `panel-piezas-v2.test.ts` (filtra de verdad por eq / in / is y anota cada filtro) */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, conError: string[] = [], log: string[] = []) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = (cols: string) => { log.push(`${t}:select ${cols}`); return b }
    b.eq = (c: string, v: unknown) => { log.push(`${t}:eq ${c}=${String(v)}`); filas = filas.filter((f) => f[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { log.push(`${t}:in ${c}=${vs.join(",")}`); filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.is = (c: string, v: unknown) => { filas = filas.filter((f) => (f[c] ?? null) === v); return b }
    b.not = () => b
    b.neq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] !== v); return b }
    b.order = () => b
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(conError.includes(t) ? { data: null, error: { message: "x" } } : { data: filas, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}
const E1 = "ed641cdf-77ba-4d59-8a1a-50ea75decede", E2 = "b6a60551-0000-4000-8000-000000000002", E3 = "3d63ac2f-31c5-47f3-a827-c20ac3a38154"
const ENC = (id: string, p: Record<string, unknown> = {}) => ({ id, client_id: CASOS[0].id, familia: "video_mesa", estado: "en_paso", dry_run: false, prueba: false, archivada_en: null, hitl_queue_id: null, creado_en: "2026-11-19T08:00:00Z", fila: { id: "s1", fecha: "2026-11-27" }, rehace: null, paso: 17, ...p })

describe("Piezas parte B · A · la lectura: quién espera tu decisión", () => {
  it("un turno del dueño CORRIENDO marca «espera»; uno muerto (archivado) o de otro tipo, no; un encargo cerrado ni se pregunta", async () => {
    const log: string[] = []
    const supa = baseFalsa({
      oficina_encargos: [ENC(E1), ENC(E2), ENC(E3, { estado: "cerrado", rehace: { desde_hitl: "h" } })],
      jefatura_revisiones: [{ artifact_type: "pieza", artifact_id: E3, estado: "en_curso", creado_en: "2" }],
      oficina_turnos: [
        { encargo_id: E1, tipo: "dueno", estado: "corriendo" },
        { encargo_id: E2, tipo: "dueno", estado: "muerto" },
        { encargo_id: E2, tipo: "agente", estado: "corriendo" },
        { encargo_id: E3, tipo: "dueno", estado: "corriendo" },
      ],
    }, [], log)
    const l = await listarEnCurso(supa)
    expect(l.map((x) => [x.encargo_id, x.espera_al_dueno ?? false])).toEqual([[E1, true], [E2, false], [E3, false]])
    // la misma marca que el Calendario: tipo = el turno del dueño, estado corriendo, solo de los encargos en la mesa
    expect(log).toContain(`oficina_turnos:eq tipo=${TURNO_DEL_DUENO}`)
    expect(log).toContain("oficina_turnos:eq estado=corriendo")
    expect(log).toContain(`oficina_turnos:in encargo_id=${E1},${E2}`)
  })
  it("si no puede leer los turnos, lo dice (nunca «nada espera tu decisión»)", async () => {
    await expect(listarEnCurso(baseFalsa({ oficina_encargos: [ENC(E1)] }, ["oficina_turnos"]))).rejects.toThrow(/turnos del dueño/)
  })
})
