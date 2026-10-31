/**
 * LA TARJETA «GRAN IDEA» (T4 del nuevo orden de la cadena · 31-oct · CC#1): lo que Emilio ve y decide UNA vez por campaña. US$ 0, sin red, sin base.
 *  · lectura pura: de las filas (bandeja + `cadena_conceptos.leido` + brief) a la tarjeta; lo que falta se declara;
 *  · el resumen del banco: conteo por red y capítulo + 3 ejemplos por capítulo; el banco parcial se dice;
 *  · la decisión: aprobar (nota opcional) · cambios (nota ≥ 10 + a qué apunta); 409 si ya no está pendiente o la pantalla estaba vieja;
 *    va a la PLATAFORMA como decisión humana (`workflow_id: tablero` + execution id con rastro); 404/405 de la plataforma = 501 «no publicada»; 409 se pasa;
 *  · el visor se dibuja (pendiente con los dos botones; aprobada sin botones; sin concepto lo dice);
 *  · la lista la rotula «Gran idea por aprobar».
 */
import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { detalleDelConcepto, estadoDelConcepto, resumenDelBanco, TIPO_CONCEPTO, VUELTAS_MAXIMAS_DE_CAMBIOS, type DetalleDelConcepto } from "@/lib/concepto-datos"
import { decidirConcepto, validarDecisionDeConcepto, WORKFLOW_DEL_TABLERO } from "@/lib/concepto-decision"
import { tipoDeRevisionLegible } from "@/lib/lenguaje"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

const HITL = "6f1c2a7e-0b1d-4c3e-9a8f-1234567890ab"
const CAMP = "7a0c7a2e-2222-4333-8444-555566667777"
const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"

/** la forma REAL con la que la cadena abre la tarjeta (`abrirTarjetaDeConcepto`) */
const hitl = (x: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: HITL, client_id: CLIENTE, agent_name: "cadena · concepto", risk_type: "strategic_decision", type: TIPO_CONCEPTO, status: "pending", priority: "high", payload: {}, decision: null,
  title: "Gran idea · La mesa larga · campaña Náufrago", output_preview: "Noventa días para sentarse juntos\n3 ideas en el banco · 1 capítulo(s)", created_at: "2026-10-31T21:00:00.000Z", expires_at: null,
  metadata: { origen: "cadena", tipo: "concepto", campana_id: CAMP, version: 1, concepto_id: `cpt-${CAMP.slice(0, 12)}-v1`, brief_version: 1, seco: true, costo_usd: 0.1, vueltas_restantes: 2, avisos: ["la idea C1-I03 apunta a un capítulo que no existe"], resumen_del_banco: {} },
  ...x,
})
/** lo que la cadena guardó en `cadena_conceptos.leido` (contrato concepto.v1) */
const leido = {
  contrato: "concepto.v1",
  gran_idea: { nombre: "La mesa larga", frase: "Noventa días para sentarse juntos" },
  por_que_funciona: "El insight del brief dice que la gente desayuna de pie; la idea lo convierte en costumbre.",
  como_se_ve: "Luz cálida, madera, manos sobre la mesa.", como_suena: "Voz cercana, frases cortas.",
  capitulos: [{ clave: "f1", fase: "f1", nombre: "Abrir la mesa", que_cuenta: "la mesa se abre", objetivo_cita: "«presentar»", como_se_ve: "planos cerrados", series: [{ id: "S1", nombre: "La silla", que_cuenta: "una silla por semana", redes: ["instagram"] }] }],
  banco: [
    { id: "C1-I01", capitulo: "f1", red: "instagram", formato: "carrusel", idea: "la primera silla", mensaje: "aquí siempre hay una silla para ti", gancho: "¿quién se sentaba aquí?", protagonista: "la silla", serie: null, foto: null, linea: "…" },
    { id: "C1-I02", capitulo: "f1", red: "instagram", formato: "foto", idea: "la mesa a las 7", mensaje: "la mesa se llena de a poco", gancho: "mira lo que pasa en dos horas", protagonista: "la mesa", serie: "S1", foto: "foto-3", linea: "…" },
    { id: "C1-I03", capitulo: "f1", red: "facebook", formato: "foto", idea: "la silla que nadie usa", mensaje: "ninguna silla sobra", gancho: "esta silla lleva un mes vacía", protagonista: "la silla", serie: null, foto: null, linea: "…" },
    { id: "C1-I04", capitulo: "f1", red: "facebook", formato: "foto", idea: "cuarta idea", mensaje: "m4", gancho: "g4", protagonista: "p4", serie: null, foto: null, linea: "…" },
  ],
  ideas_descartadas: [], ideas_que_salen: [], caminos_descartados: "- «El plato del día»: habla del producto, no de la mesa", devolucion_del_brief: null, citas: "", fotos_citadas: ["foto-3"],
  banco_parcial: [{ red: "facebook", capitulo: "f1", faltan: 2, esperadas: 4, hay: 2 }], avisos: ["la idea C1-I03 apunta a un capítulo que no existe"], bloqueos: [], estado: "ok",
}
const concepto = (x: Record<string, unknown> = {}): Record<string, unknown> => ({ campana_id: CAMP, version: 1, estado: "lista", aprobacion: "pendiente", leido, costo_usd: "0.1000", nota_de_emilio: null, apunta_a: null, decidido_en: null, seco: true, ...x })
const brief = { version: 1, estado: "validada", texto_md: "## Mensaje\nHay mesa desde las siete.\n## Tono\nCercano." }

const dibujar = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "")

describe("la lectura de la tarjeta es pura y declara lo que falta", () => {
  it("🔴 de las filas sale la tarjeta completa: gran idea, por qué, cómo se ve con fotos citadas, capítulos, banco, resumen, caminos, brief, vueltas, costo y ensayo", () => {
    const d = detalleDelConcepto({ hitl: hitl(), concepto: concepto(), brief, cliente: "Náufrago" })
    expect(d).toMatchObject({ hitl_id: HITL, estado: "pendiente", cliente: "Náufrago", campana_id: CAMP, version: 1, seco: true, costo_usd: 0.1, vueltas_restantes: 2, sin_concepto: null })
    expect(d.gran_idea).toEqual({ nombre: "La mesa larga", frase: "Noventa días para sentarse juntos" })
    expect(d.fotos_citadas).toEqual(["foto-3"])
    expect(d.capitulos).toHaveLength(1)
    expect(d.capitulos[0].series[0]).toMatchObject({ nombre: "La silla", redes: ["instagram"] })
    expect(d.banco).toHaveLength(4)
    expect(d.resumen).toMatchObject({ total: 4, por_red: { instagram: 2, facebook: 2 }, por_capitulo: { f1: 4 } })
    expect(d.resumen.ejemplos.f1).toHaveLength(3) // 3 ejemplos por capítulo, no más
    expect(d.resumen.parcial).toEqual([{ red: "facebook", capitulo: "f1", faltan: 2, esperadas: 4, hay: 2 }])
    expect(d.caminos_descartados).toMatch(/plato del día/)
    expect(d.brief).toEqual({ version: 1, estado: "validada", texto_md: brief.texto_md })
    expect(d.avisos).toEqual(["la idea C1-I03 apunta a un capítulo que no existe"]) // el mismo aviso en la bandeja y en la lectura no se repite
  })
  it("🔴 sin fila de concepto en la cadena, la tarjeta lo dice (no inventa); sin lectura también; sin campaña en la bandeja, también", () => {
    expect(detalleDelConcepto({ hitl: hitl(), concepto: null, brief: null, cliente: null }).sin_concepto).toMatch(/no tiene la versión 1 del concepto/)
    expect(detalleDelConcepto({ hitl: hitl(), concepto: concepto({ leido: null }), brief: null, cliente: null }).sin_concepto).toMatch(/sin lectura/)
    expect(detalleDelConcepto({ hitl: hitl({ metadata: {} }), concepto: null, brief: null, cliente: null }).sin_concepto).toMatch(/no dice a qué campaña/)
    const d = detalleDelConcepto({ hitl: hitl(), concepto: concepto({ leido: null }), brief: null, cliente: null })
    expect(d.banco).toEqual([])
    expect(d.resumen.total).toBe(0)
    expect(d.brief).toBeNull()
  })
  it("el estado: pendiente · aprobada · «cambios» (la cadena lo cierra como rejected + pedir_cambios, no es un rechazo) · rechazada · otro", () => {
    expect(estadoDelConcepto("pending", null)).toBe("pendiente")
    expect(estadoDelConcepto("approved", { accion: "aprobar" })).toBe("aprobada")
    expect(estadoDelConcepto("rejected", { accion: "pedir_cambios", apunta_a: "brief" })).toBe("con_cambios")
    expect(estadoDelConcepto("rejected", null)).toBe("rechazada")
    expect(estadoDelConcepto("edited", null)).toBe("otro")
  })
  it("resumenDelBanco: una idea sin capítulo cuenta bajo «?»; con menos de 3 ideas, menos ejemplos", () => {
    const r = resumenDelBanco([{ id: "X", capitulo: null, red: "tiktok", formato: "reel", idea: "i", mensaje: "m", gancho: "g", protagonista: "p", serie: null, foto: null }], [])
    expect(r).toMatchObject({ total: 1, por_red: { tiktok: 1 }, por_capitulo: { "?": 1 } })
    expect(r.ejemplos["?"]).toHaveLength(1)
  })
  it("la lista rotula la tarjeta como «Gran idea por aprobar»; las vueltas máximas son 2 (las hace cumplir la plataforma)", () => {
    expect(tipoDeRevisionLegible(TIPO_CONCEPTO)).toBe("Gran idea por aprobar")
    expect(VUELTAS_MAXIMAS_DE_CAMBIOS).toBe(2)
  })
})

describe("la decisión: la regla es la de la plataforma y la aplica la plataforma", () => {
  it("🔴 validar: aprobar sin nota vale; cambios exige nota ≥ 10 y a qué apunta; otra acción no vale", () => {
    expect(validarDecisionDeConcepto({ accion: "aprobar" })).toMatchObject({ ok: true, pedido: { accion: "aprobar", nota: null, apunta_a: null } })
    expect(validarDecisionDeConcepto({ accion: "aprobar", apunta_a: "brief", nota: "  bien  " })).toMatchObject({ ok: true, pedido: { nota: "bien", apunta_a: null } })
    expect(validarDecisionDeConcepto({ accion: "cambios", nota: "corta", apunta_a: "concepto" })).toMatchObject({ ok: false, error: "nota_corta" })
    expect(validarDecisionDeConcepto({ accion: "cambios", nota: "más barrio, menos producto" })).toMatchObject({ ok: false, error: "apunta_a_falta" })
    expect(validarDecisionDeConcepto({ accion: "cambios", nota: "más barrio, menos producto", apunta_a: "brief", estado_visto: "pending" })).toMatchObject({ ok: true, pedido: { accion: "cambios", apunta_a: "brief", estado_visto: "pending" } })
    expect(validarDecisionDeConcepto({ accion: "rechazar" })).toMatchObject({ ok: false, error: "accion_invalida" })
    expect(validarDecisionDeConcepto(null)).toMatchObject({ ok: false })
  })

  /** una base falsa con las tres tablas que lee la tarjeta */
  function base(filas: { hitl: Record<string, unknown> | null; concepto?: Record<string, unknown> | null; brief?: Record<string, unknown> | null }) {
    const tabla = (nombre: string) => {
      const q: Record<string, unknown> = {}
      const encadena = () => q
      for (const m of ["select", "eq", "order", "limit"]) q[m] = encadena
      q.maybeSingle = async () => ({ data: nombre === "hitl_queue" ? filas.hitl : nombre === "clients" ? { name: "Náufrago" } : nombre === "cadena_conceptos" ? (filas.concepto ?? null) : null, error: null })
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: nombre === "cadena_brief_creativo" ? (filas.brief ? [filas.brief] : []) : [], error: null }).then(res)
      return q
    }
    return { from: (nombre: string) => tabla(nombre) } as never
  }
  const deps = (b: unknown, fetchImpl: typeof fetch) => ({ supabase: b as never, revisor: "emilio@correo", plataformaUrl: "https://plataforma.test/", llave: "llave", fetchImpl, ahora: () => "2026-10-31T21:05:00.000Z" })
  const respuesta = (status: number, cuerpo: unknown) => vi.fn(async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch
  const cuerpoEnviado = (f: unknown) => JSON.parse(((f as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[])[1] ? ((((f as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[])[1] as { body: string }).body) : "{}")

  it("🔴 aprobar: POST a la plataforma `/api/cadena/concepto` con accion decidir, campaña y versión de la tarjeta, autor, workflow_id «tablero» y un execution id con rastro", async () => {
    const f = respuesta(200, { decision: "aprobar", version: 1 })
    const r = await decidirConcepto(HITL, { accion: "aprobar", estado_visto: "pending" }, deps(base({ hitl: hitl(), concepto: concepto(), brief }), f))
    expect(r.status, JSON.stringify(r.cuerpo)).toBe(200)
    expect(r.cuerpo).toMatchObject({ ok: true, accion: "aprobar", version: 1 })
    expect(String(r.cuerpo.nota)).toMatch(/calendario de la primera tanda/)
    const llamada = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
    expect(llamada[0]).toBe("https://plataforma.test/api/cadena/concepto")
    expect((llamada[1] as { headers: Record<string, string> }).headers["x-api-key"]).toBe("llave")
    expect(cuerpoEnviado(f)).toEqual({ accion: "decidir", campana_id: CAMP, version: 1, decision: "aprobar", nota: null, autor: "emilio@correo", workflow_id: WORKFLOW_DEL_TABLERO, workflow_execution_id: `tablero:${HITL}:2026-10-31T21:05:00.000Z` })
  })
  it("🔴 cambios: lleva nota y apunta_a; 409 de la plataforma (versión ya decidida) se pasa tal cual; 404 de la plataforma = 501 «no publicada» sin simular", async () => {
    const f = respuesta(200, { decision: "cambios", version: 1, vueltas_restantes: 1 })
    const r = await decidirConcepto(HITL, { accion: "cambios", nota: "más barrio, menos producto", apunta_a: "brief" }, deps(base({ hitl: hitl(), concepto: concepto(), brief }), f))
    expect(r.status).toBe(200)
    expect(cuerpoEnviado(f)).toMatchObject({ decision: "cambios", nota: "más barrio, menos producto", apunta_a: "brief" })
    expect(String(r.cuerpo.nota)).toMatch(/brief nuevo/)
    const r409 = await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: hitl(), concepto: concepto() }), respuesta(409, { error: "e_ya_decidido", code: "E-YA-DECIDIDO", detalle: "ya se mandó a cambios" })))
    expect(r409).toMatchObject({ status: 409, cuerpo: { ok: false, error: "e_ya_decidido", detalle: "ya se mandó a cambios" } })
    const r404 = await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: hitl(), concepto: concepto() }), respuesta(404, {})))
    expect(r404).toMatchObject({ status: 501, cuerpo: { error: "cadena_no_publicada" } })
  })
  it("🔴 no se manda nada si: la tarjeta no existe o no es de gran idea (404) · ya no está pendiente (409) · la pantalla estaba vieja (409) · el pedido no vale (400) · la tarjeta no apunta a una campaña (409)", async () => {
    const f = respuesta(200, {})
    expect((await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: null }), f))).status).toBe(404)
    expect((await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: hitl({ type: "content_piece_review" }) }), f))).status).toBe(404)
    expect((await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: hitl({ status: "approved" }), concepto: concepto() }), f))).cuerpo).toMatchObject({ error: "ya_resuelta" })
    expect((await decidirConcepto(HITL, { accion: "aprobar", estado_visto: "approved" }, deps(base({ hitl: hitl(), concepto: concepto() }), f))).cuerpo).toMatchObject({ error: "estado_cambio" })
    expect((await decidirConcepto(HITL, { accion: "cambios", nota: "x" }, deps(base({ hitl: hitl(), concepto: concepto() }), f))).status).toBe(400)
    expect((await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: hitl({ metadata: {} }) }), f))).cuerpo).toMatchObject({ error: "tarjeta_sin_destino" })
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })
  it("sin llave interna el tablero dice 503 y no llama; si la plataforma no responde, 502", async () => {
    const f = respuesta(200, {})
    const sinLlave = await decidirConcepto(HITL, { accion: "aprobar" }, { ...deps(base({ hitl: hitl(), concepto: concepto() }), f), llave: "" })
    expect(sinLlave.status).toBe(503)
    const caida = vi.fn(async () => { throw new Error("sin red") }) as unknown as typeof fetch
    expect((await decidirConcepto(HITL, { accion: "aprobar" }, deps(base({ hitl: hitl(), concepto: concepto() }), caida))).cuerpo).toMatchObject({ error: "plataforma_sin_respuesta" })
  })
})

describe("el visor de la gran idea se dibuja", () => {
  const detalle = (): DetalleDelConcepto => detalleDelConcepto({ hitl: hitl(), concepto: concepto(), brief, cliente: "Náufrago" })
  it("🔴 pendiente: frase paraguas, capítulo, resumen con ejemplos, banco plegado, brief en solo lectura, vueltas, ensayo y los dos botones", async () => {
    const { VisorDeConcepto } = await import("@/app/piezas/VisorDeConcepto")
    const html = dibujar(<VisorDeConcepto concepto={detalle()} />)
    expect(html).toContain("La mesa larga")
    expect(html).toContain("Noventa días para sentarse juntos")
    expect(html).toContain("Capítulo f1 · Abrir la mesa")
    expect(html).toContain("Resumen del banco · 4 ideas")
    expect(html).toMatch(/instagram 2 · facebook 2/)
    expect(html).toContain("Banco parcial: faltan 2 de 4 (facebook · capítulo f1)")
    expect(html).toContain("Banco completo (4 ideas")
    expect(html).toContain("cuarta idea") // el banco completo está en la página (plegado)
    expect(html).toContain("Hay mesa desde las siete.")
    expect(html).toContain("2 de 2 vueltas de cambios disponibles")
    expect(html).toContain("ensayo en seco")
    expect(html).toContain("Fotos propias citadas: foto-3")
    expect(html).toContain("plato del día")
    expect(html).toContain("Aprobar la gran idea")
    expect(html).toContain("Pedir cambios…")
    expect(html).not.toContain("Rechazar")
  })
  it("aprobada: sin botones, dice el estado y la fecha; sin concepto en la cadena: lo dice en rojo y los botones van bloqueados", async () => {
    const { VisorDeConcepto } = await import("@/app/piezas/VisorDeConcepto")
    const ok = dibujar(<VisorDeConcepto concepto={detalleDelConcepto({ hitl: hitl({ status: "approved", decision: { accion: "aprobar" } }), concepto: concepto({ aprobacion: "aprobado", decidido_en: "2026-10-31T21:10:00Z", nota_de_emilio: "adelante" }), brief, cliente: null })} />)
    expect(ok).toContain("Aprobada.")
    expect(ok).toContain("Decidida el 2026-10-31")
    expect(ok).toContain("adelante")
    expect(ok).not.toContain("Aprobar la gran idea")
    const sin = dibujar(<VisorDeConcepto concepto={detalleDelConcepto({ hitl: hitl(), concepto: null, brief: null, cliente: null })} />)
    expect(sin).toMatch(/no tiene la versión 1 del concepto/)
    expect(sin).toMatch(/<button[^>]*disabled=""[^>]*>Aprobar la gran idea/)
    expect(sin).toContain("La cadena no tiene guardado el brief")
  })
})
