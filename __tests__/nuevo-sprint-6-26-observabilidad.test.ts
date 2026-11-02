/**
 * DASHBOARD NUEVO · SPRINT 6.26 (1-nov): pantalla 9 OBSERVABILIDAD de Tu oficina con la ESTRUCTURA de LangSmith (lista de corridas → árbol de pasos con cascada de
 * tiempos → detalle con pestañas Entrada / Salida / Metadatos · errores en rojo arriba del árbol); lo que la plataforma no guarda dice «sin dato todavía».
 * Y la regla de Emilio para el arco: al pasar el cursor por una pantalla, su título crece un poco para leerse.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import {
  arbolDeNodos, costoComoDato, duracion, leerCorrida, leerCorridas, lineaDeTiempo, nombreDeLaCorrida, nombreDeLaRama, nombreLimpio, normalizarDetalle, normalizarLista, resumenDeCorridas,
} from "@/lib/direccion-corridas"
import { PanelObservabilidad } from "@/components/nuevo/PanelObservabilidad"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { ESTILO_DE_DIRECCION, TableroDeDireccionVivo } from "@/components/nuevo/TablerosDeDireccion"

const NAU = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const paso = (id: string, agente: string, inicio: string, fin: string, ms: number, costo: number, extra: Record<string, unknown> = {}) => ({
  origen: "invocacion", id, agente, modelo: "claude-sonnet-4-6", inicio, fin, duracion_ms: ms, costo_usd: costo, tokens: { entrada: 3, salida: 100, cache_lectura: 0, cache_escritura: 900 }, tokens_total: 1003, turnos: 1, estado: "completed", error: null, despacho: null, ...extra,
})
// la forma real de la corrida corta 210273 de Náufrago (mesa de análisis en ramas → jefe marketing en la principal)
const CORRIDA_210273 = {
  ok: true, completo: true,
  corrida: { workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "210273", client_id: NAU, cliente: "Náufrago", inicio: "2026-11-01T16:32:14.368Z", fin: "2026-11-01T16:47:51.571Z", duracion_ms: 937203, costo_usd: 1.630376, tokens: 331729, pasos: 3, despachos: 1, fallos: 0, ramas: ["analisis-competencia", "analisis-voz_del_publico"], estado: "completa" },
  arbol: [
    { rama: null, costo_usd: 0.66, pasos: [paso("jm", "jefe-marketing", "2026-11-01T16:36:31.391Z", "2026-11-01T16:47:51.523Z", 680132, 0.659715)] },
    { rama: "analisis-competencia", costo_usd: 0.26, pasos: [paso("ci", "competitive-intelligence-agent", "2026-11-01T16:32:14.368Z", "2026-11-01T16:34:47.937Z", 153569, 0.261125)] },
    { rama: "analisis-voz_del_publico", costo_usd: 0.18, pasos: [paso("fs", "feedback-synthesizer", "2026-11-01T16:32:15.459Z", "2026-11-01T16:33:01.686Z", 46227, 0.176164)] },
  ],
  braintrust: { enlace: null, motivo: "ninguna fila guarda el identificador de la traza" },
}
const LISTA = {
  ok: true, completo: true, dias: 7, total: 3,
  corridas: [
    CORRIDA_210273.corrida,
    { ...CORRIDA_210273.corrida, workflow_execution_id: "210300", workflow_id: "o8qaF7bI0PKv2XGZ", ramas: [], estado: "fallida", fallos: 1 },
    { ...CORRIDA_210273.corrida, workflow_execution_id: "pasos-n-1", workflow_id: "cc-cerebro-fallas-y-retencion", client_id: null, cliente: null, estado: "en_curso", duracion_ms: null },
  ],
  braintrust: { enlace: null, motivo: "x" },
}
const NOMBRES = new Map([["X9F0zp6LQ2xGEYVS", "Zero Risk — Planeación (CC1)"], ["o8qaF7bI0PKv2XGZ", "Jefatura · un turno (agente → resultado → siguiente) · CC#2"]])

describe("6.26 · lectura y nombres", () => {
  it("la corrida se llama como su proceso en n8n, sin prefijos ni sufijos de empleado; si no es de n8n, en palabras; si no hay nada, su número", () => {
    expect(nombreLimpio("Jefatura · un turno (agente → resultado → siguiente) · CC#2")).toBe("Jefatura · un turno")
    expect(nombreDeLaCorrida("X9F0zp6LQ2xGEYVS", "210273", NOMBRES)).toBe("Planeación del plan de 90 días") // 6.27: nombre de oficina
    expect(nombreDeLaCorrida("cc-cerebro-fallas-y-retencion", "p1")).toBe("Cerebro · fallas y retención")
    expect(nombreDeLaCorrida("AbCdEfGhIjKlMnOp", "210273")).toBe("Ejecución 210273")
    expect(nombreDeLaRama("analisis-voz_del_publico")).toBe("analisis · voz del publico")
  })
  it("normaliza la lista y resume la pantalla 9 (errores y en curso)", () => {
    const l = normalizarLista(LISTA, NOMBRES)
    expect(l.corridas.map((c) => c.nombre)).toEqual(["Planeación del plan de 90 días", "Jefatura · un turno", "Cerebro · fallas y retención"])
    expect(l.sin_enlace_a_trazas).toBe("x")
    expect(resumenDeCorridas(l)).toEqual({ total: 3, en_curso: 1, con_error: 1, completo: true })
  })
  it("el servidor lee la plataforma con la llave interna, filtra por cliente y en la lectura liviana no busca nombres", async () => {
    const pedidos: string[] = []; let llave = ""
    const f = (async (u: string, init: RequestInit) => { pedidos.push(String(u)); llave = String((init.headers as Record<string, string>)["x-api-key"]); return new Response(JSON.stringify(LISTA), { status: 200 }) }) as unknown as typeof fetch
    let nombres = 0
    const n8n = (async () => { nombres++; return new Response("{}", { status: 404 }) }) as unknown as typeof fetch
    const r = await leerCorridas({ dias: 1, client_id: NAU, conNombres: false }, { plataformaUrl: "https://p", llave: "k", fetchImpl: f, procesosImpl: n8n })
    expect(r.ok).toBe(true); expect(llave).toBe("k"); expect(nombres).toBe(0)
    expect(pedidos[0]).toBe(`https://p/api/direccion/corridas?dias=1&limite=200&client_id=${NAU}`)
    expect((await leerCorridas({}, { llave: "" })).ok).toBe(false)
  })
  it("una corrida: identificador inválido 400, inexistente 404", async () => {
    expect(await leerCorrida("a b", { llave: "k" })).toMatchObject({ ok: false, status: 400 })
    const f404 = (async () => new Response(JSON.stringify({ ok: false }), { status: 404 })) as unknown as typeof fetch
    expect(await leerCorrida("999", { llave: "k", fetchImpl: f404, procesosImpl: f404 })).toMatchObject({ ok: false, status: 404 })
  })
})

describe("6.26 · el árbol y la cascada (estructura de LangSmith)", () => {
  const d = normalizarDetalle(CORRIDA_210273, NOMBRES)!
  const nodos = arbolDeNodos(d)
  it("la corrida arriba y sus pasos en orden de inicio: la mesa de análisis antes que jefe marketing", () => {
    expect(nodos.map((n) => [n.tipo, n.nombre, n.sub])).toEqual([
      ["corrida", "Planeación del plan de 90 días", "Náufrago"], ["paso", "Competitive intelligence", "analisis · competencia"], ["paso", "Feedback synthesizer", "analisis · voz del publico"], ["paso", "Jefe marketing", null],
    ])
  })
  it("una rama con varios pasos es un nodo propio con sus pasos debajo", () => {
    const dos = normalizarDetalle({ ...CORRIDA_210273, arbol: [{ rama: "voz:A", costo_usd: 0.1, pasos: [paso("a", "x", "2026-11-01T10:00:00Z", "2026-11-01T10:00:05Z", 5000, 0.05), paso("b", "x", "2026-11-01T10:00:06Z", "2026-11-01T10:00:09Z", 3000, 0.05)] }] })!
    expect(arbolDeNodos(dos).map((n) => [n.tipo, n.nivel])).toEqual([["corrida", 0], ["rama", 1], ["paso", 2], ["paso", 2]])
  })
  it("cada barra empieza donde empezó el paso y dura lo que duró", () => {
    const t = lineaDeTiempo(nodos)
    const jm = t.barra(nodos[3])!
    expect(Math.round(jm.izq)).toBe(27); expect(Math.round(jm.izq + jm.ancho)).toBe(100)
    expect(t.barra(nodos[0])).toEqual({ izq: 0, ancho: 100 })
  })
  it("formatos de dato: duración, costo", () => {
    expect(duracion(937203)).toBe("15 min 37 s"); expect(duracion(15495)).toBe("15,5 s"); expect(duracion(4958)).toBe("4,96 s"); expect(duracion(null)).toBe("—")
    expect(costoComoDato(1.630376)).toBe("US$ 1.63"); expect(costoComoDato(0.006)).toBe("US$ 0.0060"); expect(costoComoDato(0)).toBe("US$ 0")
  })
})

describe("6.26 · el panel", () => {
  const lista = normalizarLista(LISTA, NOMBRES)
  const h = renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: lista }))
  it("la lista: tabla con las columnas de LangSmith, búsqueda y filtros por fecha, cliente y estado; lo que falta dice «sin dato»", () => {
    expect(h).toContain('data-seccion="observabilidad"'); expect(h).toContain("nv-panel")
    for (const c of ["Nombre", "Cliente", "Estado", "Inicio", "Duración", "Tokens", "Costo", "Pasos"]) expect(h).toContain(`>${c}</th>`)
    expect(h).toContain("data-busca"); expect(h.match(/data-fecha=/g)).toHaveLength(3); expect(h).toContain("data-filtro-cliente"); expect(h.match(/data-filtro-estado=/g)).toHaveLength(6)
    expect(h.match(/data-corrida=/g)).toHaveLength(3); expect(h).toContain('data-estado="fallida"')
    expect(h).toContain("entrada y salida de cada paso: los primeros 2.000 caracteres") // 6.27: ya se leen
  })
  it("una corrida abierta: árbol con barras, detalle con 3 pestañas y metadatos; entrada y salida «sin dato todavía»", () => {
    const t = renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: lista, detalleInicial: normalizarDetalle(CORRIDA_210273, NOMBRES) }))
    expect(t).toContain('data-vista="traza"'); expect(t.match(/data-nodo=/g)).toHaveLength(4); expect(t.match(/data-barra/g)).toHaveLength(4)
    expect(t.match(/data-pestana=/g)).toHaveLength(3); expect(t).toContain(">Entrada<"); expect(t).toContain(">Salida<"); expect(t).toContain(">Metadatos<")
    expect(t).toContain("data-metadatos"); expect(t).toContain("Ejecución"); expect(t).not.toContain("data-errores")
  })
  it("los errores van en rojo arriba del árbol", () => {
    const conError = { ...CORRIDA_210273, arbol: [{ rama: null, costo_usd: 0, pasos: [paso("e", "jefe-marketing", "2026-11-01T16:36:31Z", "2026-11-01T16:37:31Z", 60000, 0, { estado: "error", error: "se acabó el tiempo" })] }] }
    const t = renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: lista, detalleInicial: normalizarDetalle(conError) }))
    expect(t).toMatch(/data-errores[^>]*role="alert"/); expect(t).toContain("1 paso con error"); expect(t).toContain("se acabó el tiempo")
    expect(t.indexOf("data-errores")).toBeLessThan(t.indexOf("data-arbol"))
  })
  it("es solo lectura y las rutas exigen administrador", () => {
    const s = readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")
    expect(s).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/)
    for (const r of ["app/api/direccion/corridas/route.ts", "app/api/direccion/corridas/[id]/route.ts"]) { const x = readFileSync(r, "utf8"); expect(x).toContain("await exigirAdmin()"); expect(x).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/) }
  })
})

describe("6.26 · el arco", () => {
  const vidrio = (corridas: ReturnType<typeof resumenDeCorridas> | null) => renderToStaticMarkup(createElement("svg", null, createElement(TableroDeDireccionVivo, { tablero: "observabilidad", titulo: ["OBSERVABILIDAD"], quieto: true, corridas }))).replace(/<!-- -->/g, "")
  it("la pantalla 9 dice lo real: errores primero; sin lectura, el dibujo", () => {
    expect(vidrio({ total: 78, en_curso: 1, con_error: 2, completo: true })).toMatch(/data-cuenta-corridas[^>]*>2 con error</)
    expect(vidrio({ total: 78, en_curso: 0, con_error: 0, completo: true })).toMatch(/>78 corridas</)
    expect(vidrio(null)).toContain('data-corridas="sin-lectura"'); expect(vidrio(null)).not.toContain("data-cuenta-corridas")
  })
  it("la pantalla 9 se abre al tocarla", () => {
    expect(renderToStaticMarkup(createElement(PantallasDelArco, { alAbrirObservabilidad: () => {} }))).toMatch(/data-id="arco-9"[^>]*data-abre="observabilidad"[^>]*aria-label="Abrir la observabilidad"/)
  })
  it("REGLA de Emilio · al pasar el cursor por una pantalla su título crece un poco para leerse", () => {
    expect(ESTILO_DE_DIRECCION).toContain(".nv-pantalla[data-encima] .nv-titulo{opacity:0}") // 6.29: el título grande va en su propia capa
    const s = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    expect(s).toContain("onMouseEnter={() => setEncima(id)}"); expect(s).toContain("data-encima={encima === id || undefined}")
  })
})
