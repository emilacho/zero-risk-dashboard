// @vitest-environment jsdom
/**
 * 10-nov · T2 DE LA FICHA ÚNICA (SEÑAL Lenovo 01:10Z «¿quedan tramos?» · GO 09-nov · boceto v7 + v9 aprobados por Emilio). US$ 0 · sin red.
 * Toda decisión (firma, plan, gran idea, piezas, revisiones, campaña, avisos) se dibuja con la MISMA ficha que las preguntas (T1):
 *  - «Firmar» pasa a Aprobar; «Cambiar cifra» deja de ser botón: se toca la cifra (se ilumina como el pizarrón, v9) y abre el editor de siempre;
 *  - lo que se decide en otra pantalla queda sin verbo, con «Esta ficha solo avisa» y el enlace «Ir al …» de la lista cerrada;
 *  - sin cifras no hay Aprobar (nunca se firma a ciegas) y lleva su distintivo;
 *  - fuera «Origen», «Costó producirlo», la prioridad y los botones «Abrir … para decidir» (bloques fijos de la v7).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { readFileSync } from "node:fs"
import { PanelDecisiones, TarjetaDelFrente } from "@/components/nuevo/PanelDecisiones"
import { dondeSeDecide, normalizarDecisiones, tituloDeDecision, type Decision } from "@/lib/direccion-decisiones"
import { fichaDeLaDecision, revisarFicha } from "@/lib/ficha-de-decision"

afterEach(cleanup)
// jsdom no mueve la pantalla: el panel baja solo hasta «No salió» con scrollIntoView
Element.prototype.scrollIntoView = vi.fn()
const FIRMA = {
  id: "f4d46f59-1d22-4780-9e40-252e74fa53b4", tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: "df7e47cc", cliente: "Zero Risk Seguridad Industrial",
  titulo: "Tablero Financiero: espera tu firma", desde: "2026-10-20T20:11:17Z", vence: null, vencida: false, prioridad: null, decidir: { ruta: null, accion: "firmar-tablero" }, permite: ["aceptar", "editar"],
  pregunta_de: { oficina: "financiera", agente: null }, para_que: "La oficina financiera dejó 2 hallazgos críticos abiertos: tu firma da por buenas sus cifras.", para_que_corto: "Validar cifras",
  destraba: "El plan no espera esta firma: queda constancia de que diste por buenas estas cifras.", destraba_corto: "Solo constancia", costo_usd: 0.42, costo_nota: "lo que costó",
  cifras: [{ clave: "meta_por_semana", nombre: "Meta de ventas por semana", valor: 5, unidad: "ventas", nota: "Dato", editable: true }, { clave: "total_mes", nombre: "Presupuesto total al mes", valor: 1341.27, unidad: "US$", nota: "Supuesto", editable: true }, { clave: "pauta_diaria", nombre: "Pauta por día", valor: 26, unidad: "US$", nota: "Supuesto" }],
  al_editar: "Al cambiar una cifra se recalcula el tablero.", criticos: ["Precios reales sin dato: D4 y D6 son nulos."],
}
const GRAN_IDEA = { id: "2d3c4da1-d3d5-40e0-b18e-d90e8652e001", tipo: "gran_idea", subtipo: "concepto_review", fuente: "hitl_queue", client_id: "0a2f", cliente: "Náufrago", titulo: "Gran idea · **El oro que nunca buscaste** · campaña Náufrago", desde: "2026-11-09T22:02:15Z", vence: null, vencida: false, prioridad: "high", decidir: { ruta: "/piezas", accion: null }, costo_usd: null, costo_nota: null }
const CAMPANA = { id: "7e000000-0000-4000-8000-000000000003", tipo: "plan", subtipo: "campana_detenida", fuente: "cadena_campanas", client_id: "c2", cliente: "Náufrago", titulo: "La campaña de marketing está detenida: necesita que alguien la destrabe", desde: "2026-11-09T17:00:00Z", vence: "2026-11-16T17:00:00Z", vencida: false, prioridad: null, decidir: { ruta: null, accion: null }, permite: [], detiene: true, para_que: "Seguir la Campaña de Marketing", destraba: "Rearmar la Campaña de Marketing", costo_usd: null, costo_nota: null }
const PIEZA = { ...GRAN_IDEA, id: "9e000000-0000-4000-8000-000000000004", tipo: "pieza", subtipo: "content_piece_review", titulo: "content_piece_review · content-creator" }
const una = (fila: Record<string, unknown>): Decision => normalizarDecisiones({ ok: true, completo: true, fuentes: [], decisiones: [fila] }).decisiones[0]
const tarjeta = (d: Decision, x: Partial<Parameters<typeof TarjetaDelFrente>[0]> = {}) => {
  const contestar = vi.fn(async () => null), alDecidir = vi.fn()
  const r = render(createElement(TarjetaDelFrente, { d, alDecidir, enPausa: null, detiene: false, contestar, verCambio: async () => null as never, previa: null, ...x }))
  return { contestar, alDecidir, $: (s: string) => r.container.querySelector<HTMLElement>(s), $$: (s: string) => [...r.container.querySelectorAll<HTMLElement>(s)], r }
}

describe("1 · toda decisión sale por la ficha (ninguna tarjeta vieja)", () => {
  it("firma, gran idea, pieza y campaña: misma ficha, mismos bloques en el mismo orden", () => {
    for (const fila of [FIRMA, GRAN_IDEA, PIEZA, CAMPANA]) {
      const { $, $$ } = tarjeta(una(fila))
      expect($("[data-ficha]")).not.toBeNull(); expect($("[data-tipo]")).toBeNull()
      expect($$("[data-bloque]").map((b) => b.dataset.bloque)).toEqual(["quien", "que", "propuesta", "decisivo", "uso", "espera"])
    }
  })
  it("fuera lo que la v7 no tiene: Origen, Costó producirlo, prioridad y «Abrir … para decidir»", () => {
    for (const fila of [FIRMA, GRAN_IDEA, PIEZA]) {
      const t = tarjeta(una(fila)).r.container.textContent ?? ""
      expect(t).not.toMatch(/Origen|Costó producirlo|Prioridad|Abrir .* para decidir/)
    }
    expect(readFileSync("components/nuevo/PanelDecisiones.tsx", "utf8")).not.toMatch(/data-firmar|data-cambiar-cifra|data-origen|Costó producirlo/)
  })
  it("el título sale limpio (sin asteriscos ni nombres internos) y la cuenta, corta como en la v7", () => {
    expect(tarjeta(una(GRAN_IDEA)).$("[data-que-se-decide]")!.textContent).toBe("Gran idea · El oro que nunca buscaste · campaña Náufrago")
    expect(tarjeta(una(PIEZA)).$("[data-que-se-decide]")!.textContent).toBe("Hay una pieza lista para que la revises de 👤 Content Creator")
    expect(tarjeta(una(FIRMA)).$("[data-cuenta]")!.textContent).toBe("Zero Risk SI")
  })
})

describe("2 · la firma: Aprobar y tocar la cifra", () => {
  it("un solo botón, Aprobar (ámbar), que sale por la puerta de siempre (aceptar → firmar-tablero)", () => {
    const { $$, contestar } = tarjeta(una(FIRMA))
    expect($$("[data-verbo]").map((b) => b.textContent)).toEqual(["Aprobar"])
    fireEvent.click($$("[data-verbo='aprobar']")[0])
    expect(contestar).toHaveBeenCalledWith(expect.objectContaining({ id: FIRMA.id }), "aceptar", {})
  })
  it("las dos cifras que se cambian se tocan (con la luz del pizarrón) y abren el editor; la que no se cambia no es botón", () => {
    const { $, $$ } = tarjeta(una(FIRMA))
    expect($$("button[data-cambiar]").map((b) => b.dataset.cambiar)).toEqual(["meta_por_semana", "total_mes"])
    expect($("button[data-cambiar='total_mes']")!.className).toContain("zr-luz-del-pizarron")
    fireEvent.click($("button[data-cambiar='total_mes']")!)
    expect($("[data-editor-cifra='total_mes']")).not.toBeNull(); expect($("[data-ficha]")).toBeNull()
    fireEvent.click([...document.querySelectorAll<HTMLElement>("button")].find((b) => /Volver/.test(b.textContent ?? ""))!)
    expect($("[data-ficha]")).not.toBeNull()
  })
  it("sin permiso de editar, ninguna cifra se toca (aunque diga editable)", () => {
    const { $$ } = tarjeta(una({ ...FIRMA, permite: ["aceptar"] }))
    expect($$("button[data-cambiar]")).toHaveLength(0); expect($$("[data-cifra]")).toHaveLength(2)
  })
  it("la tercera cifra no se pierde: sale al abrir Decisivo o Uso, en la misma Propuesta", () => {
    const { $, $$ } = tarjeta(una(FIRMA))
    expect($("[data-cifra-del-detalle]")).toBeNull()
    fireEvent.click($$("[data-abre-el-largo]")[0])
    expect($("[data-cifra-del-detalle='pauta_diaria']")).not.toBeNull()
  })
  it("Vence: «Sin fecha límite» solo porque el Tablero Financiero lo declara; otra fuente sin plazo, guion rojo", () => {
    expect(tarjeta(una(FIRMA)).$("[data-vence]")!.textContent).toBe("Sin fecha límite")
    expect(tarjeta(una(GRAN_IDEA)).$("[data-vence] [data-sin-dato]")).not.toBeNull()
  })
  it("sin cifras: sin Aprobar, con «Falta información» arriba y el aviso de quién la debe", () => {
    const { $, $$ } = tarjeta(una({ ...FIRMA, cifras: [] }))
    expect($$("[data-verbo]")).toHaveLength(0); expect($("[data-chip='falta']")!.textContent).toBe("Falta información")
    expect($("[data-falta-informacion]")!.textContent).toContain("la Oficina Financiera debe mandar las cifras")
  })
  it("lo que no salió: «No salió» arriba, el motivo entero y Aprobar para volver a intentar", () => {
    const d = una(FIRMA)
    const previa = { d, accion: "aceptar" as const, en: "2026-11-10T01:00:00Z", resultado: { ok: false, sale: false, texto: "", motivo: "El tablero cambió mientras lo leías.", registro: [] } }
    const { $, $$ } = tarjeta(d, { previa: previa as never })
    expect($("[data-chip='volvio']")).not.toBeNull(); expect($("[data-por-que-volvio]")!.textContent).toContain("El tablero cambió mientras lo leías.")
    expect($$("[data-verbo='aprobar']")).toHaveLength(1)
  })
})

describe("3 · lo que se decide en otra pantalla: la ficha avisa y lleva a su pantalla", () => {
  it("gran idea → «Ir a la Gran idea →»; pieza → «Ir a Piezas →»; plan/campaña → «Ir al Plan de Marketing →»; ninguna con verbo", () => {
    for (const [fila, pantalla, texto] of [[GRAN_IDEA, "gran_idea", "Ir a la Gran idea →"], [PIEZA, "piezas", "Ir a Piezas →"], [CAMPANA, "plan", "Ir al Plan de Marketing →"]] as const) {
      const { $, $$, alDecidir } = tarjeta(una(fila))
      expect($$("[data-verbo]")).toHaveLength(0); expect($("[data-solo-avisa]")).toBeNull() // CC6 #321: no dice «no hay nada que decidir»
      expect($(`[data-se-decide-en='${pantalla}']`)).not.toBeNull()
      expect($(`[data-ir='${pantalla}']`)!.textContent).toBe(texto)
      fireEvent.click($(`[data-ir='${pantalla}']`)!); expect(alDecidir).toHaveBeenCalledTimes(1)
    }
  })
  it("la campaña detenida lleva «Detiene el plan» en rojo arriba (v7)", () => {
    const html = (() => { const r = render(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: normalizarDecisiones({ ok: true, completo: true, fuentes: [], decisiones: [CAMPANA] }) })); return r.container })()
    expect(html.querySelector("[data-detiene]")!.textContent).toBe("Detiene el plan")
  })
})

describe("4 · el traductor del tablero: nada se inventa", () => {
  const x = { departamento: "Departamento de Finanzas", cuenta: "Zero Risk SI", titulo: "T", detiene: false, destraba: null, acciones: [] as never[], panel: null }
  it("solo Aprobar si la oficina lo ofrece; cifras tocables solo con «editar»; la ficha pasa la guarda", () => {
    const d = una(FIRMA)
    expect(fichaDeLaDecision(d, { ...x, acciones: [] }).acciones).toEqual([])
    expect(fichaDeLaDecision(d, { ...x, acciones: ["aceptar"] }).acciones).toEqual([{ verbo: "aprobar", principal: true, destino: "firmar-tablero" }])
    expect(fichaDeLaDecision(d, { ...x, acciones: ["aceptar"] }).propuesta?.cifras?.some((c) => c.editable)).toBe(false)
    expect(fichaDeLaDecision(d, { ...x, acciones: ["aceptar", "editar"] }).propuesta?.cifras?.filter((c) => c.editable).map((c) => c.clave)).toEqual(["meta_por_semana", "total_mes"])
    expect(revisarFicha(fichaDeLaDecision(d, { ...x, acciones: ["aceptar", "editar"] })).ok).toBe(true)
  })
  it("una pantalla que no está en la lista cerrada no da enlace; sin cliente, sin cuenta (guion rojo)", () => {
    expect(fichaDeLaDecision(una(GRAN_IDEA), { ...x, panel: "otra" }).donde_se_hace).toBeUndefined()
    expect(fichaDeLaDecision(una(GRAN_IDEA), { ...x, panel: "gran_idea" }).donde_se_hace).toEqual({ pantalla: "gran_idea" })
    expect(fichaDeLaDecision(una(GRAN_IDEA), { ...x, cuenta: null }).cuenta).toBeNull()
  })
})

describe("5 · la versión va a la derecha de la fecha (Lenovo 01:23Z · CC1 #969/#971)", () => {
  const espera = (d: Decision) => tarjeta(d).$("[data-bloque='espera']")!.textContent ?? ""
  it("con versión entera: «fecha · versión 2», y nunca en el título", () => {
    const d = una({ ...FIRMA, version_del_documento: 2 })
    expect(d.version_del_documento).toBe(2)
    expect(espera(d)).toMatch(/2026 · versión 2/)
    expect(tarjeta(d).$("[data-bloque='que']")!.textContent).not.toMatch(/versión/)
  })
  it("sin versión, o con una que no es entero positivo: solo la fecha", () => {
    for (const v of [undefined, 0, -1, 1.5, "2", null]) {
      const d = una({ ...FIRMA, version_del_documento: v })
      expect(d.version_del_documento).toBeUndefined()
      expect(espera(d)).not.toMatch(/versión/)
      expect(espera(d)).toMatch(/2026/)
      cleanup()
    }
  })
})

describe("6 · cada revisión va a la pantalla de su documento (CC1 #973) y el título sin la versión queda limpio", () => {
  const REV = { ...GRAN_IDEA, id: "ae000000-0000-4000-8000-000000000005", tipo: "revision", subtipo: "manual_review", titulo: "Revisión del manual de marca" }
  it("manual → «Ir al Manual de marca»; plan → «Ir al Plan de Marketing»; pieza o sin documento → Piezas", () => {
    expect(una({ ...REV, documento: "manual" }).documento).toBe("manual")
    expect(dondeSeDecide(una({ ...REV, documento: "manual" })).panel).toBe("manual")
    expect(dondeSeDecide(una({ ...REV, documento: "plan" })).panel).toBe("plan")
    expect(dondeSeDecide(una({ ...REV, documento: "pieza" })).panel).toBe("piezas")
    expect(dondeSeDecide(una(REV)).panel).toBe("piezas")
    expect(una({ ...REV, documento: "  " }).documento).toBeUndefined()
    const x = { departamento: "Departamento Creativo", cuenta: "Náufrago", titulo: "T", detiene: false, destraba: null, acciones: [] as never[], panel: null }
    expect(fichaDeLaDecision(una(REV), { ...x, panel: "manual" }).donde_se_hace).toEqual({ pantalla: "manual" })
  })
  it("el panel de decisiones abre el Manual para una revisión del manual", () => {
    expect(tarjeta(una({ ...REV, documento: "manual" })).$("[data-se-decide-en='manual']")!.textContent).toBe("Se decide en el Manual de marca.")
    const panel = readFileSync("components/nuevo/PanelDecisiones.tsx", "utf8")
    expect(panel).toContain("if (donde.panel === \"manual\") return <PanelManual onCerrar={volver} clienteInicial={abierta.client_id} />")
  })
  it("«Tablero Financiero, versión 2: espera tu firma» → «Tablero Financiero: espera tu firma» (sin coma suelta)", () => {
    expect(tituloDeDecision({ titulo: "Tablero Financiero, versión 2: espera tu firma", subtipo: "x" })).toBe("Tablero Financiero: espera tu firma")
    expect(tituloDeDecision({ titulo: "Plan de Marketing, versión 3: espera tu decisión", subtipo: "x" })).toBe("Plan de Marketing: espera tu decisión")
    expect(tituloDeDecision({ titulo: "Hola, mundo: algo", subtipo: "x" })).toBe("Hola, mundo: algo")
  })
})

describe("7 · CC6 #321: el pie no miente, «vencida» vuelve y el Decisivo del frente es corto", () => {
  it("lo que se decide en otra pantalla dice dónde; «solo avisa» queda para lo que no tiene ni verbo ni pantalla", () => {
    expect(tarjeta(una(GRAN_IDEA)).$("[data-se-decide-en]")!.textContent).toBe("Se decide en la Gran idea.")
    cleanup()
    expect(tarjeta(una(PIEZA)).$("[data-se-decide-en]")!.textContent).toBe("Se decide en Piezas.")
    cleanup()
    expect(tarjeta(una(CAMPANA)).$("[data-se-decide-en='plan'] [data-nombre-propio]")!.textContent).toBe("Plan de Marketing")
    cleanup()
    const { $ } = tarjeta(una({ ...GRAN_IDEA, tipo: "pregunta_de_finanzas", subtipo: "x", decidir: { ruta: null, accion: null } }))
    expect($("[data-se-decide-en]")).toBeNull(); expect($("[data-solo-avisa]")).not.toBeNull()
  })
  it("vencida: «fecha · vencida» en Vence; sin vencer, solo la fecha", () => {
    expect(tarjeta(una({ ...CAMPANA, vencida: true })).$("[data-vence]")!.textContent).toMatch(/2026 · vencida$/)
    cleanup()
    expect(tarjeta(una(CAMPANA)).$("[data-vencida]")).toBeNull()
  })
  it("el Decisivo del frente muestra la frase corta y su porqué, nunca el texto entero", () => {
    const li = tarjeta(una(FIRMA)).$("[data-decisivo]")!
    expect(li.textContent).toBe("Precios reales sin datoD4 y D6 son nulos.")
  })
})
