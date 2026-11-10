/** 09-nov · «Uso» y «Desbloquea» con los cortos que escribe cada oficina (#957 de la plataforma, CC1). Respaldo: la primera frase entera. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelDecisiones } from "@/components/nuevo/PanelDecisiones"
import { normalizarDecisiones, type Decisiones } from "@/lib/direccion-decisiones"

// los textos tal como los manda hoy la firma financiera (largo + corto de la oficina)
const USO = "La oficina financiera dejó 2 hallazgos críticos abiertos: tu firma da por buenas sus cifras."
const DESBLOQUEA = "El plan no espera esta firma: queda constancia de que diste por buenas estas cifras."
const decision = (extra: Record<string, unknown>) => ({
  id: "44444444-4444-4444-8444-444444444444", tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: "c", cliente: "Zero Risk Seguridad Industrial",
  titulo: "Tablero financiero: espera tu firma", desde: "2026-10-23T10:00:00Z", decidir: { ruta: null, accion: "firmar-tablero" }, permite: ["aceptar"], ...extra,
})
const lista = (extra: Record<string, unknown>): Decisiones => normalizarDecisiones({ ok: true, completo: true, fuentes: [], sin_fuente: [], decisiones: [decision(extra)] })
const pinta = (d: Decisiones, detalleInicial = false) => renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: d, detalleInicial })).replace(/<!-- -->/g, "")

describe("1 · la lectura: el corto solo vale con su largo", () => {
  it("con largo y corto, se copian los dos", () => {
    const [d] = lista({ para_que: USO, para_que_corto: "Validar cifras", destraba: DESBLOQUEA, destraba_corto: "Solo constancia" }).decisiones
    expect(d.para_que_corto).toBe("Validar cifras"); expect(d.destraba_corto).toBe("Solo constancia")
  })
  it("un corto sin su largo no se lee (la plataforma no lo manda así, y el tablero tampoco lo acepta)", () => {
    const [d] = lista({ para_que_corto: "Validar cifras", destraba_corto: "Solo constancia" }).decisiones
    expect(d.para_que_corto).toBeUndefined(); expect(d.destraba_corto).toBeUndefined()
  })
  it("un corto vacío o con solo espacios no cuenta", () => {
    const [d] = lista({ para_que: USO, para_que_corto: "   ", destraba: DESBLOQUEA, destraba_corto: "" }).decisiones
    expect(d.para_que_corto).toBeUndefined(); expect(d.destraba_corto).toBeUndefined()
  })
  it("cada corto va con SU largo: Uso con largo y Desbloquea sin largo → solo el de Uso", () => {
    const [d] = lista({ para_que: USO, para_que_corto: "Validar cifras", destraba_corto: "Solo constancia" }).decisiones
    expect(d.para_que_corto).toBe("Validar cifras"); expect(d.destraba_corto).toBeUndefined()
  })
})

describe("2 · el frente: el corto de la oficina, entero y sin «…»", () => {
  const conCortos = lista({ para_que: USO, para_que_corto: "Validar cifras", destraba: DESBLOQUEA, destraba_corto: "Solo constancia" })
  it("muestra los cortos tal cual, no la primera frase", () => {
    const h = pinta(conCortos)
    expect(h).toContain('<span data-uso="true">Validar cifras</span>'); expect(h).toContain('<span data-destraba="true">Solo constancia</span>')
    expect(h).not.toContain(USO); expect(h).not.toContain(DESBLOQUEA); expect(h).not.toContain("…")
  })
  it("el largo no se pierde: el bloque abre el detalle y ahí va entero", () => {
    expect(pinta(conCortos)).toContain("data-contexto=") // es botón, no texto suelto
    const a = pinta(conCortos, true)
    expect(a).toContain(`<p data-uso-entero="true" class="mt-1.5 text-dato text-hueso">${USO}</p>`)
    expect(a).toContain(`<p data-destraba-entero="true" class="mt-1.5 text-dato text-hueso">${DESBLOQUEA}</p>`)
  })
  it("aunque el largo sea una sola frase, con corto el largo va al detalle (el frente ya no lo dice)", () => {
    const una = lista({ para_que: "Una frase.", para_que_corto: "Corto" })
    expect(pinta(una)).toContain('<span data-uso="true">Corto</span>')
    expect(pinta(una, true)).toContain('<p data-uso-entero="true" class="mt-1.5 text-dato text-hueso">Una frase.</p>')
  })
})

describe("3 · respaldo: sin corto, la primera frase entera (como hasta hoy)", () => {
  it("solo Uso trae corto: Desbloquea cae a su primera frase", () => {
    const h = pinta(lista({ para_que: USO, para_que_corto: "Validar cifras", destraba: "Sigue el plan. Después mide." }))
    expect(h).toContain('<span data-uso="true">Validar cifras</span>'); expect(h).toContain('<span data-destraba="true">Sigue el plan.</span>')
  })
  it("sin ningún corto, una frase sola es texto (sin detalle vacío)", () => {
    const h = pinta(lista({ para_que: "Una frase.", destraba: "Otra frase." }))
    expect(h).toContain('<span data-uso="true">Una frase.</span>'); expect(h).toContain('<span data-destraba="true">Otra frase.</span>')
    expect(h).toContain("data-contexto-solo"); expect(pinta(lista({ para_que: "Una frase.", destraba: "Otra frase." }), true)).not.toContain("data-uso-entero")
  })
  it("el «Desbloquea» que arma el tablero (pregunta que detiene el plan) nunca toma un corto ajeno", () => {
    const d = lista({ tipo: "pregunta_al_dueno", subtipo: null, fuente: "preguntas", titulo: "¿Cuántas sedes?", permite: ["responder"], detiene: true, destraba_corto: "No es mío" })
    const h = pinta(d)
    expect(h).not.toContain("No es mío"); expect(h).toContain("<span data-desbloquea=\"true\"><span>Sigue el </span><span data-nombre-propio=\"true\" class=\"underline decoration-linea-oro decoration-1 underline-offset-4\">Plan de Marketing</span></span>") // 10-nov (#310 ajuste 1): el corto del tablero, con el nombre propio
  })
  it("…ni aunque el corto llegue al panel sin pasar por la lectura (el panel también lo exige)", () => {
    const base = lista({ tipo: "pregunta_al_dueno", subtipo: null, fuente: "preguntas", titulo: "¿Cuántas sedes?", permite: ["responder"], detiene: true })
    const h = pinta({ ...base, decisiones: base.decisiones.map((d) => ({ ...d, destraba_corto: "No es mío" })) })
    expect(h).not.toContain("No es mío"); expect(h).toContain("<span data-desbloquea=\"true\"><span>Sigue el </span><span data-nombre-propio=\"true\" class=\"underline decoration-linea-oro decoration-1 underline-offset-4\">Plan de Marketing</span></span>") // 10-nov (#310 ajuste 1): el corto del tablero, con el nombre propio
  })
})
