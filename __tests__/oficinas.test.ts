/**
 * LAS OFICINAS (CC#1 · 29-oct · parte 2). US$ 0, sin red: base falsa. La prueba contra la base viva (solo lectura) está en `oficinas-viva.test.ts` (ZR_PRUEBA_VIVA=1).
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { agrupar, desde, haceCuanto, peorSemaforo, semaforoDelInterruptor, suma, tarjetaConError, usd } from "@/lib/oficinas"
import { leerOficinas } from "@/lib/oficinas-datos"

const AHORA = new Date("2026-10-29T12:00:00Z")
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()

type Fila = Record<string, unknown>
/** base falsa con filtros eq/gte/is/in, orden, límite, conteo y un error opcional por tabla */
function baseFalsa(tablas: Record<string, Fila[]>, errores: Record<string, string> = {}) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    let cabeza = false
    const b: Record<string, unknown> = {}
    b.select = (_c?: string, o?: { head?: boolean }) => { cabeza = !!o?.head; return b }
    b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
    b.gte = (c: string, v: string) => { filas = filas.filter((f) => String(f[c]) >= v); return b }
    b.is = (c: string, v: null) => { filas = filas.filter((f) => (f[c] ?? null) === v); return b }
    b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.order = (c: string, o?: { ascending?: boolean }) => { filas.sort((x, y) => (String(x[c] ?? "") < String(y[c] ?? "") ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return b }
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.maybeSingle = () => Promise.resolve(errores[t] ? { data: null, error: { message: errores[t] } } : { data: filas[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(errores[t] ? { data: null, count: null, error: { message: errores[t] } } : { data: cabeza ? null : filas, count: filas.length, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}

const TABLAS = (): Record<string, Fila[]> => ({
  oficina_config: [{ id: 1, estado: "encendida", familias_activas: ["post_img", "carrusel_mesa"], clientes_ensayo: [] }],
  oficina_encargos: [
    { estado: "cerrado", gasto_usd: 1.84, dry_run: false, familia: "carrusel_ig_v1", brief_id: "BRF-0001", version_encargo: 3, creado_en: hace(5) },
    { estado: "cerrado", gasto_usd: 1.73, dry_run: false, familia: "carrusel_ig_v1", brief_id: "BRF-0002", version_encargo: 3, creado_en: hace(6) },
    { estado: "fallido", gasto_usd: 0.24, dry_run: false, familia: "carrusel_ig_v1", brief_id: "BRF-0002", version_encargo: 2, creado_en: hace(30) },
    { estado: "en_curso", gasto_usd: 0.1, dry_run: false, familia: "carrusel_mesa", brief_id: "BRF-0002", version_encargo: 4, creado_en: hace(1) },
    { estado: "cerrado", gasto_usd: 0, dry_run: true, familia: "carrusel_mesa", brief_id: "BRF-0002", version_encargo: 2, creado_en: hace(20) }, // ensayo: no cuenta
    { estado: "cerrado", gasto_usd: 9, dry_run: false, familia: "post_img", brief_id: "VIEJO", version_encargo: 1, creado_en: hace(24 * 9) }, // fuera de la ventana
  ],
  hitl_queue: [{ status: "pending", type: "content_piece_review" }, { status: "pending", type: "content_piece_review" }, { status: "pending", type: "confirm_competitor_list" }, { status: "approved", type: "content_piece_review" }],
  oficina_turnos: [{ estado: "fallo", paso: "mesa:dirigir:creative-director-mesa", agente: "creative-director-mesa", error: "OFICINA_SIN_MOLDE_SIMULADO · no hay respuesta", fin: hace(20) }, { estado: "hecho", paso: "x", agente: "y", error: null, fin: hace(1) }],
  finanzas_config: [{ id: 1, estado: "encendida", conversa: "enciende", preguntas_slack: "envia", clientes_ensayo: [] }],
  finanzas_encargos: [{ estado: "cerrado", gasto_usd: 0.5, dry_run: false, creado_en: hace(3), actualizado_en: hace(2) }, { estado: "sin_acuerdo", gasto_usd: 0.2, dry_run: false, creado_en: hace(4), actualizado_en: hace(4) }],
  finanzas_preguntas: [{ respondida_en: null }, { respondida_en: hace(2) }],
  finanzas_tableros: [{ estado: "firmado", vigente: true, creado_en: hace(50) }],
  jefatura_config: [{ id: 1, estado: "encendida", tipos_activos: ["plan", "pieza"], clientes_ensayo: [] }],
  jefatura_revisiones: [
    { estado: "cerrada_por_tope", resultado: "incompleta_por_tope", gasto_usd: 0.7, dry_run: false, creado_en: hace(5) },
    { estado: "cerrada", resultado: "limpia", gasto_usd: 0.4, dry_run: false, creado_en: hace(8) },
    { estado: "fallida", resultado: "fallida", gasto_usd: 0, dry_run: false, creado_en: hace(9) },
  ],
  client_brain_chunks: Array.from({ length: 514 }, () => ({})),
  cerebro_fichas: [{ retirada_en: null }, { retirada_en: null }, { retirada_en: hace(100) }],
  cerebro_portero_corridas: [{ estado: "hecha", gasto_apify_usd: 0.1, gasto_modelo_usd: 0.05, creado_en: hace(10), prueba: false }, { estado: "hecha", gasto_apify_usd: 0.2, gasto_modelo_usd: 0, creado_en: hace(34), prueba: false }],
  cerebro_pedidos: [{ estado: "hecho", costo_usd: 0.2, creado_en: hace(5) }],
  cerebro_portero_pausas: [],
  cerebro_alertas: [],
  cadena_config: [{ clave: "estado_cadena", valor: "encendida" }, { clave: "clientes_ensayo", valor: [] }, { clave: "otra", valor: 1 }],
  cadena_campanas: [{ estado: "activa", seco: false }, { estado: "cerrada", seco: false }, { estado: "activa", seco: true }],
  cadena_corridas: [{ estado: "ok", costo_usd: 0.3, seco: false, creada_en: hace(7) }, { estado: "vencida", costo_usd: 0, seco: false, creada_en: hace(9) }, { estado: "ok", costo_usd: 5, seco: true, creada_en: hace(2) }],
  cadena_esperas: [{ estado: "viva", motivo: "x", vence_en: hace(-5), seco: false }, { estado: "viva", motivo: "y", vence_en: hace(-6), seco: true }],
})

describe("las piezas puras de la pantalla", () => {
  it("el interruptor: encendida verde, apagada gris, encendida solo para práctica ámbar, vacío rojo, otro valor ámbar", () => {
    expect(semaforoDelInterruptor("encendida", [])).toEqual({ semaforo: "verde", texto: "Encendida" })
    expect(semaforoDelInterruptor("encendida", ["cliente-x"]).semaforo).toBe("ambar")
    expect(semaforoDelInterruptor("apagada", [])).toMatchObject({ semaforo: "gris", texto: "Apagada" })
    expect(semaforoDelInterruptor(undefined, null).semaforo).toBe("rojo")
    expect(semaforoDelInterruptor("pausada", [])).toMatchObject({ semaforo: "ambar", texto: "Estado: pausada" })
  })
  it("haceCuanto: momento, minutos, horas, días y sin dato", () => {
    expect(haceCuanto(hace(0), AHORA)).toBe("hace un momento")
    expect(haceCuanto(new Date(AHORA.getTime() - 20 * 60_000).toISOString(), AHORA)).toBe("hace 20 min")
    expect(haceCuanto(hace(5), AHORA)).toBe("hace 5 h")
    expect(haceCuanto(hace(24 * 3), AHORA)).toBe("hace 3 d")
    expect(haceCuanto(null, AHORA)).toBe("sin actividad registrada")
    expect(haceCuanto("no es fecha", AHORA)).toBe("sin actividad registrada")
  })
  it("agrupar, suma (ignora lo que no es número) y desde", () => {
    expect(agrupar([{ e: "a" }, { e: "a" }, { e: "b" }, { e: null }], "e")).toEqual({ a: 2, b: 1, "—": 1 })
    expect(suma([{ c: "1.5" }, { c: 2 }, { c: null }, { c: "x" }], "c")).toBe(3.5)
    expect(desde(7, AHORA)).toBe("2026-10-22T12:00:00.000Z")
    expect(usd(1.8408)).toBe("US$ 1,84")
    expect(usd(null)).toBe("—")
  })
  it("la peor luz: rojo manda sobre ámbar sobre verde sobre gris", () => {
    const t = (s: "verde" | "ambar" | "rojo" | "gris") => ({ ...tarjetaConError("creativa", "x", "y", "e"), semaforo: s })
    expect(peorSemaforo([t("verde"), t("rojo"), t("ambar")])).toBe("rojo")
    expect(peorSemaforo([t("verde"), t("ambar")])).toBe("ambar")
    expect(peorSemaforo([t("gris"), t("verde")])).toBe("verde")
    expect(peorSemaforo([t("gris")])).toBe("gris")
    expect(peorSemaforo([])).toBe("gris")
  })
})

describe("las cinco tarjetas con datos conocidos", () => {
  it("creativa: cuenta SOLO lo real de los últimos 7 días (no el ensayo ni lo viejo), gasto, piezas por aprobar y el último fallo con su causa literal", async () => {
    const c = (await leerOficinas(baseFalsa(TABLAS()), AHORA)).find((t) => t.clave === "creativa")!
    const d = Object.fromEntries(c.datos.map((x) => [x.etiqueta, x]))
    expect(d["Piezas entregadas (7 días)"].valor).toBe("2")
    expect(d["Piezas con problema"]).toMatchObject({ valor: "0" }) // el intento fallido ya fue reemplazado por uno nuevo del mismo pedido: no cuenta como fallo
    expect(d["Gasto (7 días)"].valor).toBe("US$ 3,91") // 1.84+1.73+0.24+0.10; ni el ensayo (0) ni los US$ 9 de hace 9 días
    expect(c.espera).toEqual(["2 piezas por aprobar"]) // solo content_piece_review pendientes; no la lista de competidores ni la aprobada
    expect(c.hizo).toContain("Trabaja ahora en 1 pieza")
    // nada de lo interno se ve: ni fallos de ensayo, ni familias crudas, ni códigos
    expect(JSON.stringify(c)).not.toMatch(/SIMULADO|carrusel_mesa|post_img|mesa:dirigir|Familias activas|último turno/i)
    expect(c).toMatchObject({ semaforo: "verde", estado_texto: "Encendida", enlace: { href: "/piezas" } })
  })
  it("financiera: encargos por estado, gasto, preguntas al dueño sin responder y tablero vigente", async () => {
    const f = (await leerOficinas(baseFalsa(TABLAS()), AHORA)).find((t) => t.clave === "financiera")!
    expect(f.hizo[0]).toBe("Trabajó en 2 encargos en 7 días (1 terminado)")
    expect(f.datos.find((x) => x.etiqueta === "Gasto (7 días)")!.valor).toBe("US$ 0,70")
    expect(f.espera).toEqual(["1 pregunta al dueño sin responder"])
    expect(f.hizo).toContain("Tablero vigente: 1 firmado")
    expect(f.hizo).toContain("Sus preguntas salen por Slack")
  })
  it("jefatura: revisiones, resultados, las cortadas por tope en alerta y las fallidas", async () => {
    const j = (await leerOficinas(baseFalsa(TABLAS()), AHORA)).find((t) => t.clave === "jefatura")!
    expect(j.datos.find((x) => x.etiqueta === "Revisiones (7 días)")!.valor).toBe("3")
    expect(j.semaforo).toBe("ambar") // hay una revisión cortada por tope: se dice en la frase de estado
    expect(j.estado_texto).toMatch(/1 revisión cortada por límite de gasto/)
    expect(j.hizo).toContain("Revisa piezas y planes antes de que lleguen a Emilio")
    expect(j.hizo).toContain("1 falló")
    expect(JSON.stringify(j)).not.toMatch(/incompleta_por_tope|Revisa: plan, pieza/)
  })
  it("cerebro: trozos, fichas vigentes (no las retiradas), pasadas del portero y gasto; al día = verde", async () => {
    const c = (await leerOficinas(baseFalsa(TABLAS()), AHORA)).find((t) => t.clave === "cerebro")!
    const d = Object.fromEntries(c.datos.map((x) => [x.etiqueta, x.valor]))
    expect(d["Trozos de conocimiento"]).toBe("514")
    expect(d["Fichas vigentes"]).toBe("2")
    expect(c.hizo).toContain("El portero repasó 2 veces en 7 días (2 terminadas bien)")
    expect(c.hizo).toContain("Gastó US$ 0,35 en 7 días")
    expect(c.semaforo).toBe("verde")
  })
  it("cerebro: una pausa abierta del portero es ROJA y se dice; una alarma abierta, ámbar; sin pasadas en 2 días, ámbar", async () => {
    const pausa = TABLAS(); pausa.cerebro_portero_pausas = [{ motivo: "Apify sin saldo", desde: hace(3), levantada_en: null }]
    const a = (await leerOficinas(baseFalsa(pausa), AHORA)).find((t) => t.clave === "cerebro")!
    expect(a).toMatchObject({ semaforo: "rojo", estado_texto: "Portero en pausa" })
    expect(a.espera[0]).toMatch(/Apify sin saldo/)
    const alarma = TABLAS(); alarma.cerebro_alertas = [{ titulo: "Sin saldo de Anthropic", repeticiones: 3, cerrado_en: null }]
    const b = (await leerOficinas(baseFalsa(alarma), AHORA)).find((t) => t.clave === "cerebro")!
    expect(b.semaforo).toBe("ambar")
    expect(b.espera[0]).toBe("Alarma abierta: Sin saldo de Anthropic (se repitió 3 veces)")
    const parado = TABLAS(); parado.cerebro_portero_corridas = [{ estado: "hecha", gasto_apify_usd: 0, gasto_modelo_usd: 0, creado_en: hace(24 * 4), prueba: false }]
    expect((await leerOficinas(baseFalsa(parado), AHORA)).find((t) => t.clave === "cerebro")!.semaforo).toBe("ambar")
  })
  it("planeación: lee el interruptor de cadena_config, no cuenta lo seco, y marca los vencidos", async () => {
    const p = (await leerOficinas(baseFalsa(TABLAS()), AHORA)).find((t) => t.clave === "planeacion")!
    expect(p.estado_texto).toBe("Encendida")
    expect(p.hizo[0]).toBe("2 campañas: en marcha, terminada") // la campaña seca (de ensayo) no cuenta
    expect(p.hizo).toContain("1 paso se venció sin terminar")
    expect(p.datos.find((x) => x.etiqueta === "Gasto (7 días)")!.valor).toBe("US$ 0,30") // los US$ 5 son de una corrida seca
    expect(p.espera).toEqual(["1 paso espera una respuesta y su plazo corre"])
    expect(p.semaforo).toBe("ambar") // encendida pero con un paso vencido
  })
  it("una oficina apagada se ve gris y no la tapa nada", async () => {
    const t = TABLAS(); t.oficina_config = [{ id: 1, estado: "apagada", familias_activas: [], clientes_ensayo: [] }]
    const c = (await leerOficinas(baseFalsa(t), AHORA)).find((x) => x.clave === "creativa")!
    expect(c).toMatchObject({ semaforo: "gris", estado_texto: "Apagada" })
  })
})

describe("cuando una lectura falla NO se inventa un número", () => {
  it("la tarjeta que falla dice por qué y las otras cuatro siguen vivas", async () => {
    const t = await leerOficinas(baseFalsa(TABLAS(), { jefatura_revisiones: "permission denied for table jefatura_revisiones" }), AHORA)
    expect(t).toHaveLength(5)
    const j = t.find((x) => x.clave === "jefatura")!
    expect(j).toMatchObject({ semaforo: "rojo", estado_texto: "No pude leerla", datos: [] })
    expect(j.error).toMatch(/jefatura_revisiones: permission denied/)
    expect(t.filter((x) => !x.error)).toHaveLength(4)
  })
  it("un error al leer el conteo de piezas por aprobar tampoco se vuelve «0 piezas»", async () => {
    const t = await leerOficinas(baseFalsa(TABLAS(), { hitl_queue: "connection refused" }), AHORA)
    const c = t.find((x) => x.clave === "creativa")!
    expect(c.error).toMatch(/connection refused/)
    expect(c.espera).toEqual([])
    expect(c.datos).toEqual([])
  })
})

describe("la puerta de la pantalla", () => {
  it("/oficinas redirige sin sesión, es solo de administrador en el middleware, y la pantalla solo LEE (ninguna escritura)", async () => {
    const fs = await import("node:fs")
    const path = await import("node:path")
    const leer = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8")
    expect(leer("app/oficinas/page.tsx")).toMatch(/exigirAdmin\(\)[\s\S]*redirect\(/)
    expect(leer("middleware.ts")).toMatch(/ADMIN_ONLY_PREFIXES = \[[^\]]*"\/oficinas"/)
    for (const f of ["lib/oficinas-datos.ts", "app/oficinas/page.tsx"]) expect(leer(f), f).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})
