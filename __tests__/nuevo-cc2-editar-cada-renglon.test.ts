/** EDITAR CADA RENGLÓN DEL MANUAL (CC2 · 03-nov · corrección de Lenovo 18:12Z, Emilio con captura: «cada renglón solo tiene Retirar»). US$ 0 · sin red · datos de práctica (no los de Náufrago). */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import { cuerpoDelPedidoUnico, quitarDeTusCambios, renglonesDeTusCambios, SIN_CAMBIOS, type TusCambios } from "@/lib/pedido-del-manual"
import type { ManualDelCliente } from "@/lib/manual-datos"

const C = "00000000-0000-4000-8000-00000000c0c0"
const CICLO = { disponible: true, abierto: null, avance: null, que_cambio: [] }
const BORRADOR = {
  uso_del_logo: ["Respetar el aire alrededor", "No estirarlo", "Usar la versión clara sobre fondos oscuros"],
  jerarquia_tipografica: ["Título 32", "Subtítulo 20", "Cuerpo 16"],
}
const manual = (): ManualDelCliente => ({
  clientes: [{ id: C, nombre: "Cliente de práctica", con_manual: true }], cliente: { id: C, nombre: "Cliente de práctica" },
  manual: {
    version: 1, versiones: 1,
    lector: leerManual({ client_id: C, version: 1, brand_purpose: "Servir.", brand_vision: "Ser la marca.", brand_values: ["Frescura", "Honestidad", "Calidez"], content_text: "{}" })!,
    fidelidad: "", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null,
    secciones_nuevas: seccionesNuevasDelBorrador(BORRADOR), ciclo: CICLO,
  } as never,
  leido_en: "x",
})
const panel = (p: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual(), ...p }))
const cuenta = (h: string, re: RegExp) => (h.match(re) ?? []).length
const deCampo = (h: string, k: string) => { const i = h.indexOf(`data-campo="${k}"`); return h.slice(i, h.indexOf("</ul>", i)) }

describe("cada renglón de un campo con viñetas tiene «Editar» y «Retirar», uno al lado del otro", () => {
  it("campo de la lista principal (Valores): un Editar y un Retirar por renglón", () => {
    const v = deCampo(panel(), "valores")
    expect(cuenta(v, /data-elemento=/g)).toBe(3)
    expect(cuenta(v, /data-accion="editar-renglon"/g)).toBe(3)
    expect(cuenta(v, /data-accion="retirar"/g)).toBe(3)
  })
  it("secciones nuevas (Uso del logo, Jerarquía tipográfica): igual, en cada renglón", () => {
    const h = panel({ cambiosIniciales: {} })
    for (const k of ["uso_del_logo"]) {
      const v = deCampo(h, k)
      expect(cuenta(v, /data-elemento=/g), k).toBe(3)
      expect(cuenta(v, /data-accion="editar-renglon"/g), k).toBe(3)
      expect(cuenta(v, /data-accion="retirar"/g), k).toBe(3)
    }
  })
  it("una lista de UN solo renglón también lleva Editar y Retirar (antes no tenía Retirar por renglón)", () => {
    const h = panel({ cambiosIniciales: { valores: "Frescura" } })
    const v = deCampo(h, "valores")
    expect(cuenta(v, /data-accion="editar-renglon"/g)).toBe(1)
    expect(cuenta(v, /data-accion="retirar"/g)).toBe(1)
  })
  it("Editar y Retirar van en el mismo grupo (uno al lado del otro)", () => {
    const v = deCampo(panel(), "valores")
    expect(v).toMatch(/data-accion="editar-renglon"[^>]*>Editar<\/button><button[^>]*data-accion="retirar"/)
  })
  it("un renglón ya editado (cambio en espera) avisa antes de retirarse: el aviso vive en el componente, no manda nada solo", () => {
    const fuente = readFileSync("components/nuevo/manual/RenglonEditable.tsx", "utf8")
    expect(fuente).toContain("Este renglón ya lo editaste. Si lo retiras, se va con tu edición.")
    expect(fuente).toMatch(/const retirar = \(\) => \{ if \(editado\) setAvisar\(true\); else onRetirar\(\) \}/)
    // «Listo» solo avisa al panel si el texto cambió, y un renglón vacío no se acepta (para eso está «Retirar»)
    expect(fuente).toContain("if (t !== texto) onEditar(t)")
    expect(fuente).toContain("Escribe algo, o usa «Retirar».")
  })
  it("un renglón se marca como editado cuando ya no es uno de los guardados (el campo con un renglón cambiado lo pinta como editado)", () => {
    const h = panel({ cambiosIniciales: { valores: "Frescura\nHonestidad editada\nCalidez" } })
    expect(cuenta(deCampo(h, "valores"), /data-elemento=/g)).toBe(3)
    expect(deCampo(h, "valores")).toContain("Honestidad editada")
  })
})

describe("«Tus cambios» dice qué renglón se editó y editar no gasta ni manda nada solo", () => {
  const etiqueta = (k: string) => ({ uso_del_logo: "Uso del logo", valores: "Valores" })[k] ?? k
  const UNO: TusCambios = { campos: { uso_del_logo: "Respetar el aire\nNo estirarlo" }, como: { uso_del_logo: "editar" }, notas: {}, libre: "", detalle: { uso_del_logo: "editaste el renglón 2" } }
  it("«Uso del logo: editaste el renglón 2» como un renglón más de la lista", () => {
    expect(renglonesDeTusCambios(UNO, etiqueta)).toEqual([{ id: "campo:uso_del_logo", texto: "Uso del logo: editaste el renglón 2" }])
  })
  it("sin detalle (o con varias ediciones en el campo) dice lo de siempre: «lo cambiaste»", () => {
    expect(renglonesDeTusCambios({ ...UNO, detalle: {} }, etiqueta)).toEqual([{ id: "campo:uso_del_logo", texto: "Uso del logo: lo cambiaste" }])
    expect(renglonesDeTusCambios({ ...UNO, detalle: undefined }, etiqueta)).toEqual([{ id: "campo:uso_del_logo", texto: "Uso del logo: lo cambiaste" }])
  })
  it("quitarlo de la lista (un toque) también borra su detalle", () => {
    const q = quitarDeTusCambios(UNO, "campo:uso_del_logo")
    expect(q.campos).toEqual({}); expect(q.detalle).toEqual({})
  })
  it("lo editado va como el valor completo del campo, directo: sin observaciones no hay reescritura ni gasto (contrato #869)", () => {
    const cuerpo = cuerpoDelPedidoUnico(C, UNO)
    expect(cuerpo).toEqual({ client_id: C, campos: { uso_del_logo: "Respetar el aire\nNo estirarlo" } })
    expect(cuerpo).not.toHaveProperty("confirmo_gasto"); expect(cuerpo).not.toHaveProperty("tope_usd")
    expect(cuerpo).not.toHaveProperty("retirar") // un campo va en UN solo lugar
  })
  it("el panel arma el detalle solo con UNA edición de renglón en ese campo y lo restaura al quitar/descartar", () => {
    const panelFuente = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
    expect(panelFuente).toContain("if (detalle && cambios[clave] === undefined) n[clave] = detalle; else delete n[clave]")
    expect(panelFuente).toContain("detalle: detalles }")
    expect(panelFuente).toContain("setDetalles(t.detalle ?? {})")
    expect(SIN_CAMBIOS.detalle).toBeUndefined()
  })
})

// ── las reglas, en funciones puras (certificación de CC3 sobre #239: 7 de 12 alteraciones vivían) ──
import { conRenglonCambiado, confirmaConEnter, detalleDelRenglon, renglonEditado, retirarRenglon, textoDelRenglon } from "@/lib/renglones-del-manual"

describe("las reglas de editar y retirar un renglón", () => {
  const L = ["Frescura", "Honestidad", "Calidez"]
  it("editar cambia SOLO el renglón pedido y deja los demás en su sitio (primero, medio y último)", () => {
    expect(conRenglonCambiado(L, 0, "X")).toEqual(["X", "Honestidad", "Calidez"])
    expect(conRenglonCambiado(L, 1, "X")).toEqual(["Frescura", "X", "Calidez"])
    expect(conRenglonCambiado(L, 2, "X")).toEqual(["Frescura", "Honestidad", "X"])
    expect(L).toEqual(["Frescura", "Honestidad", "Calidez"]) // no toca la lista original
  })
  it("el número que dice «Tus cambios» empieza en 1 y coincide con el renglón editado", () => {
    expect([0, 1, 2].map(detalleDelRenglon)).toEqual(["editaste el renglón 1", "editaste el renglón 2", "editaste el renglón 3"])
  })
  it("retirar: con varios se quita solo ese; con uno solo se pide confirmar el retiro del campo entero", () => {
    expect(retirarRenglon(L, 1)).toEqual({ tipo: "quitar", quedan: ["Frescura", "Calidez"] })
    expect(retirarRenglon(["Solo uno"], 0)).toEqual({ tipo: "confirmar_campo" })
    expect(retirarRenglon(L, 0)).toEqual({ tipo: "quitar", quedan: ["Honestidad", "Calidez"] })
  })
  it("un renglón está «editado» solo si ya no es uno de los guardados", () => {
    expect(renglonEditado("Honestidad", L)).toBe(false)
    expect(renglonEditado("Honestidad total", L)).toBe(true)
  })
  it("el texto corregido va en una línea, sin espacios de más; vacío o en blanco no vale", () => {
    expect(textoDelRenglon("  Honestidad \n  total  ")).toBe("Honestidad total")
    expect(textoDelRenglon("   \n ")).toBe("")
  })
  it("Enter confirma; Mayús + Enter y otras teclas no", () => {
    expect(confirmaConEnter("Enter", false)).toBe(true)
    expect(confirmaConEnter("Enter", true)).toBe(false)
    expect(confirmaConEnter("a", false)).toBe(false)
  })
  it("los tres sitios usan esas reglas (no una copia): el campo, las secciones nuevas y el renglón", () => {
    const campo = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
    const secc = readFileSync("components/nuevo/manual/SeccionesNuevas.tsx", "utf8")
    const reng = readFileSync("components/nuevo/manual/RenglonEditable.tsx", "utf8")
    for (const f of ["conRenglonCambiado(elementos.map", "renglonEditado(e.crudo", "retirarRenglon(elementos.map", "detalleDelRenglon(i)", "detalleDelRenglon(renglon - 1)"]) expect(campo).toContain(f)
    for (const f of ["conRenglonCambiado(lineas, k, nuevo)", "renglonEditado(l, guardadas)"]) expect(secc).toContain(f)
    for (const f of ["confirmaConEnter(e.key, e.shiftKey)", "textoDelRenglon(valor)"]) expect(reng).toContain(f)
  })
  it("🔴 alteraciones: renglón equivocado, número corrido, retiro de uno solo sin confirmar, marca de editado siempre falsa, Enter con Mayús", () => {
    const mal = (f: () => unknown, esperado: unknown) => expect(f()).not.toEqual(esperado)
    // si conRenglonCambiado cambiara j === i + 1, el medio quedaría igual → la prueba de arriba lo atrapa
    mal(() => L.map((r, j) => (j === 2 ? "X" : r)), conRenglonCambiado(L, 1, "X"))
    mal(() => `editaste el renglón ${0}`, detalleDelRenglon(0))
    mal(() => ({ tipo: "quitar", quedan: [] }), retirarRenglon(["Solo uno"], 0))
    mal(() => false, renglonEditado("Honestidad total", L))
    mal(() => true, confirmaConEnter("Enter", true))
  })
})
