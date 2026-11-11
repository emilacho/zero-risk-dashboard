/** AUDITORÍA DEL MANUAL · punto 3 (CC6 · 02-nov): las revisiones del editor viven en el panel del Manual, legibles y con su costo; Piezas ya no las muestra. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { bloquesDelTexto, clavesDeLaRevision, leerRevisionesDelEditor, nombresEnEspanol, sinMonologo } from "@/lib/revisiones-del-manual"
import { etiquetaDelCampo } from "@/lib/manual-datos"
import { listarPiezas, DOCUMENTOS_CON_SU_PROPIO_PANEL } from "@/lib/piezas-datos"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import type { ManualDelCliente } from "@/lib/manual-datos"

const ZR = "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5"
const BT = "`"
// el texto REAL de una revisión de hoy (ZR SI, 19:30), recortado
const REAL = `Voy a cargar el esquema de la herramienta ${BT}emit_brand_section${BT} antes de emitir.Tengo toda la evidencia analizada. Emito los cuatro campos.Sección emitida. Esto es lo que entregué al consolidador:\n\n---\n\n**${BT}tono_por_canal${BT}** — 6 canales, todos propuesta del agente:\n- **Instagram**: directo/visual, posts cortos\n- **WhatsApp**: operativo sin rodeos\n\n**${BT}voice_description${BT}** sin cambios.`
const ENCARGO = "Eres el DUEÑO de estas secciones del manual de marca de un cliente: tono_por_canal, reglas_de_escritura, valores, nunca_hace. tono_por_canal: una lista…"

describe("el texto de la revisión, legible", () => {
  it("sin el monólogo del agente, con los nombres en español, con negritas y viñetas de verdad", () => {
    const t = nombresEnEspanol(sinMonologo(REAL), etiquetaDelCampo)
    expect(t).not.toMatch(/Voy a cargar|Tengo toda la evidencia|Sección emitida|emit_brand_section/)
    expect(t).not.toContain(BT); expect(t).toContain("Voz de la marca"); expect(t).toContain("Por canal (Tono según el canal)")
    const b = bloquesDelTexto(t)
    expect(b[0].trozos[0]).toEqual({ texto: "Por canal (Tono según el canal)", negrita: true })
    expect(b.filter((x) => x.tipo === "vineta")).toHaveLength(2)
    expect(JSON.stringify(b)).not.toContain("**")
    expect(sinMonologo("Voy a revisar. Tengo todo listo. El tono queda formal.")).toBe("El tono queda formal.") // sin raya: frase por frase
    expect(nombresEnEspanol(`Conservado: ${BT}forbidden_words${BT}, ${BT}required_terminology${BT}. Arranca con ${BT}PROPUESTA (no es dato): …${BT}`, etiquetaDelCampo)).toBe("Conservado: Palabras a evitar, Términos propios. Arranca con «PROPUESTA (no es dato): …»")
  })
  it("las secciones de la revisión salen del encargo del empleado («DUEÑO de estas secciones»); si no, de lo que nombra", () => {
    expect(clavesDeLaRevision(ENCARGO, REAL)).toEqual(["tono_por_canal", "reglas_de_escritura", "valores", "nunca_hace"])
    expect(clavesDeLaRevision("", REAL)).toEqual(["emit_brand_section", "tono_por_canal", "voice_description"])
  })
})

describe("la lectura (base de prueba): revisiones pendientes del cliente con lo que costó producirlas", () => {
  const base = (tablas: Record<string, Array<Record<string, unknown>>>) => ({ from: (t: string) => {
    let d = [...(tablas[t] ?? [])]
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit", "gte"]) q[m] = () => q
    q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
    q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
    return q
  } }) as never
  it("el costo es la llamada del mismo empleado que terminó a menos de 1 minuto; sin llamada, «sin dato»; los revisores caídos se dicen", async () => {
    const meta = (full: string) => ({ editor: { full_content: full, original_task: ENCARGO, editor_verdict: { issues: ["editor-en-jefe unavailable"] } } })
    const r = await leerRevisionesDelEditor(base({
      hitl_queue: [
        { id: "a", client_id: ZR, type: "editor_escalation", documento: "manual", status: "pending", created_at: "2026-11-02T19:30:36Z", agent_name: "content-creator", metadata: meta(REAL) },
        { id: "b", client_id: ZR, type: "editor_escalation", documento: "manual", status: "pending", created_at: "2026-11-02T18:00:00Z", agent_name: "content-creator", metadata: meta(REAL) },
        { id: "p", client_id: ZR, type: "editor_escalation", documento: "pieza", status: "pending", created_at: "2026-11-02T19:10:00Z", agent_name: "content-creator", metadata: meta(REAL) }, // CC1 #871: del editor, pero sobre una PIEZA → no es del manual
        { id: "c", client_id: ZR, type: "editor_escalation", documento: "manual", status: "approved", created_at: "2026-11-02T19:00:00Z", agent_name: "content-creator", metadata: meta(REAL) },
      ],
      agent_invocations: [{ client_id: ZR, agent_name: "content-creator", ended_at: "2026-11-02T19:30:36.5Z", cost_usd: 0.283156 }, { client_id: ZR, agent_name: "brand-strategist", ended_at: "2026-11-02T19:30:30Z", cost_usd: 9 }],
    }), ZR, etiquetaDelCampo)
    expect(r.map((x) => x.id)).toEqual(["a", "b"]) // solo las pendientes
    expect(r[0].costo_usd).toBeCloseTo(0.283156); expect(r[1].costo_usd).toBeNull()
    expect(r[0].claves).toEqual(["tono_por_canal", "reglas_de_escritura", "valores", "nunca"]); expect(r[0].pista).toMatch(/nadie marcó un problema/)
    expect(r[0].texto).not.toContain("Voy a cargar")
  })
})

describe("en el panel del Manual, dentro de su sección; ya no en Piezas", () => {
  it("la revisión sale en «Tono según el canal», con su costo y sus botones; sin monólogo, sin ** y sin nombres técnicos", () => {
    const fila = { client_id: ZR, version: 3, auto_generated: true, human_validated: false, brand_purpose: "P", content_text: JSON.stringify({ brand_book_draft: {} }) }
    const rev = { id: "20b0bc25-0000-4000-8000-000000000000", creada: "2026-11-02T19:30:36Z", agente: "content-creator", claves: ["tono_por_canal"], texto: nombresEnEspanol(sinMonologo(REAL), etiquetaDelCampo), costo_usd: 0.283156, pista: null }
    const suelta = { ...rev, id: "x", claves: ["otra_cosa"] }
    const conVoz = { ...rev, id: "v", claves: ["tono_por_canal", "voz"] } // el primer campo manda: Tono según el canal, no «Cómo habla»
    const datos: ManualDelCliente = { clientes: [{ id: ZR, nombre: "Zero Risk SI", con_manual: true }], cliente: { id: ZR, nombre: "Zero Risk SI" }, manual: { version: 3, versiones: 3, lector: leerManual(fila)!, fidelidad: "—", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador({}), revisiones_del_editor: [rev, suelta, conVoz] }, leido_en: "x" }
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    const seccion = h.slice(h.indexOf('data-seccion-nueva="tono-por-canal"'), h.indexOf('data-seccion-nueva="fotografia"'))
    expect(seccion).toContain(`data-revision-del-editor="${rev.id}"`); expect(seccion).toContain("costó US$ 0,28"); expect(seccion).toContain("Dar por revisada"); expect(seccion).toContain("Devolver al equipo")
    expect(seccion).not.toMatch(/Voy a cargar|\*\*|voice_description/); expect(seccion).not.toContain(BT)
    expect(seccion).toContain('data-revision-del-editor="v"')
    expect(seccion).not.toMatch(/data-campo="tono_por_canal"[\s\S]{0,600}data-accion="validar-campo"/) // vacía: sin «Validar»
    expect(h).toContain("data-revisiones-sueltas"); expect(h).toContain('data-revision-del-editor="x"') // la que no encaja en ninguna sección, arriba
  })
  it("Piezas › Otras revisiones no trae lo del manual ni lo del plan: por DOCUMENTO (CC1 #871), no por tipo", async () => {
    const filtros: string[] = []
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit", "eq", "is", "in"]) q[m] = () => q
    q.neq = (...a: unknown[]) => { filtros.push(`neq ${JSON.stringify(a)}`); return q }
    q.not = (...a: unknown[]) => { filtros.push(`not ${JSON.stringify(a)}`); return q }
    q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
    await listarPiezas({ from: () => q } as never, { tipo: "otras", estado: "todas" })
    expect(filtros).toContain(`not ${JSON.stringify(["documento", "in", "(manual,plan,gran_idea)"])}`)
    expect(filtros).toContain(`neq ${JSON.stringify(["type", "content_piece_review"])}`)
    expect([...DOCUMENTOS_CON_SU_PROPIO_PANEL]).toEqual(["manual", "plan", "gran_idea"])
    expect(filtros.some((f) => f.includes("editor_escalation"))).toBe(false) // el tipo ya no decide el panel
  })
})
