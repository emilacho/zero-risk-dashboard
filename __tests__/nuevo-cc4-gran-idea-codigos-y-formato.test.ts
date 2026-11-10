/**
 * GO Lenovo 10-nov 21:15Z · tras #327 · en la Gran idea todavía se veían (1) códigos de aporte pegados al nombre del que aportó («Camino B (content-creator A10)»)
 * y (2) los asteriscos crudos del formato («**…**»). Arreglo genérico, para todas las secciones de la gran idea y del brief (CC4 · certifica CC6 · US$ 0 · sin red):
 *  1 · tres formas más de código, con la MISMA regla de #324 (solo los aportes de ese encargo) y verificación exacta: el código Y quién lo dio coinciden;
 *  2 · el formato se muestra (negrita y cursiva de verdad); en títulos y resúmenes de una línea se quitan las marcas.
 * Dos clientes de rubros distintos: Náufrago (restaurante, el texto REAL de la v4 y su mesa) y un B2B industrial de práctica.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { ConFormato, TextoSinCodigos } from "@/components/nuevo/TextoSinCodigos"
import { sinCodigos, sinMarcasDeFormato, trozosDeFormato } from "@/lib/sin-codigos"
import type { DetalleDelConcepto } from "@/lib/concepto-datos"

const CLIENTES = [
  {
    nombre: "Náufrago (restaurante)", id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312",
    // los números → quién, como los guarda la mesa real de la v4 (encargo d0794d06)
    aportes: { "10": "content-creator", "11": "carousel-designer", "16": "design-visual-storyteller", "17": "tiktok-strategist", "23": "tiktok-strategist" } as Record<string, string>,
    // fragmentos REALES de «Caminos descartados» y del bloque de citas de la v4
    caminos: "- **Camino B (content-creator A10) · «El caldo tiene memoria»:** construye sobre nostalgia acumulada.\n- **Narrativa sin personaje (design-visual-storyteller A16):** propuso una variante.\n- **TikTok como canal de campaña (tiktok-strategist A17/A23):** el plan declara TikTok fuera.",
    limpio: "- **Camino B (content-creator) · «El caldo tiene memoria»:** construye sobre nostalgia acumulada.\n- **Narrativa sin personaje (design-visual-storyteller):** propuso una variante.\n- **TikTok como canal de campaña (tiktok-strategist):** el plan declara TikTok fuera.",
    codigoPrimero: "A10 (content-creator) propuso dos caminos; la aportación de A11 opera como lámina.",
    codigoPrimeroLimpio: "El aporte de content-creator propuso dos caminos; la aportación de carousel-designer opera como lámina.",
    otro: "content-creator", otroCodigo: "11",
  },
  {
    nombre: "B2B industrial (práctica)", id: "b2b00000-0000-4000-8000-000000000001",
    aportes: { "2": "prevencionista", "4": "content-creator", "5": "content-creator" } as Record<string, string>,
    caminos: "- **Camino A (prevencionista A2) · «Inspección sin sustos»:** parte del miedo a la multa.\n- **Camino B (content-creator A4/A5):** catálogo de extintores.",
    limpio: "- **Camino A (prevencionista) · «Inspección sin sustos»:** parte del miedo a la multa.\n- **Camino B (content-creator):** catálogo de extintores.",
    codigoPrimero: "A2 (prevencionista) dijo que el folleto va en formato A4; la aportación de A5 lo confirma.",
    codigoPrimeroLimpio: "El aporte de prevencionista dijo que el folleto va en formato A4; la aportación de content-creator lo confirma.",
    otro: "prevencionista", otroCodigo: "4",
  },
]

describe("1 · el código pegado al nombre de quien aportó", () => {
  for (const c of CLIENTES) {
    it(`${c.nombre}: «(nombre A10)» y «(nombre A17/A23)» → «(nombre)»`, () => {
      expect(sinCodigos(c.caminos, { aportes: c.aportes })).toBe(c.limpio)
    })
    it(`${c.nombre}: «A10 (nombre)» → «el aporte de nombre»; «la aportación de A11» → de quién`, () => {
      expect(sinCodigos(c.codigoPrimero, { aportes: c.aportes })).toBe(c.codigoPrimeroLimpio)
    })
    it(`${c.nombre}: verificación exacta · si el código es de OTRO empleado, se queda como vino (en las dos formas)`, () => {
      const t = `(${c.otro} A${c.otroCodigo})`
      // otroCodigo es de un empleado distinto de «otro»: no se toca
      expect(sinCodigos(t, { aportes: c.aportes })).not.toBe(`(${c.otro})`)
      expect(sinCodigos(`A${c.otroCodigo} (${c.otro}) dijo algo`, { aportes: c.aportes })).toContain(`(${c.otro})`)
      expect(sinCodigos(`A${c.otroCodigo} (${c.otro}) dijo algo`, { aportes: c.aportes })).not.toMatch(/^El aporte de/)
    })
    it(`${c.nombre}: un código que no es de la mesa, o sin la lista de la mesa, se queda`, () => {
      expect(sinCodigos(`(${c.otro} A99)`, { aportes: c.aportes })).toBe(`(${c.otro} A99)`)
      expect(sinCodigos(c.caminos, {})).toBe(c.caminos)
    })
    it(`${c.nombre}: en una lista de varios, si UNO no es de ese empleado, no se toca ninguno`, () => {
      const [primero] = Object.keys(c.aportes)
      const ajeno = Object.keys(c.aportes).find((n) => c.aportes[n] !== c.aportes[primero])!
      const t = `(${c.aportes[primero]} A${primero}/A${ajeno})`
      expect(sinCodigos(t, { aportes: c.aportes })).toBe(t)
    })
  }
  it("texto del cliente con «A4» que no va pegado al que aportó se queda («formato A4» no es un empleado)", () => {
    expect(sinCodigos("El folleto va en formato A4.", { aportes: CLIENTES[1].aportes })).toBe("El folleto va en formato A4.")
  })
  it("el nombre se compara sin distinguir mayúsculas", () => {
    expect(sinCodigos("(Content-Creator A10)", { aportes: CLIENTES[0].aportes })).toBe("(Content-Creator)")
  })
})

describe("2 · el formato se muestra, no sus asteriscos", () => {
  it("negrita y cursiva en pedazos; el resto como vino", () => {
    expect(trozosDeFormato("Antes **fuerte** y *suave* después")).toEqual([{ t: "Antes " }, { t: "fuerte", negrita: true }, { t: " y " }, { t: "suave", cursiva: true }, { t: " después" }])
  })
  it("control: un asterisco suelto, una cuenta, una marca que cruza un salto o una sin cerrar se quedan", () => {
    for (const t of ["5 * 3 = 15", "2 * 3 * 4", "nota* al pie", "**abre\ncierra**", "**sin cerrar", "* viñeta suelta", "palabra*pegada*"]) expect(sinMarcasDeFormato(t)).toBe(t)
  })
  it("sin marcas: para los títulos y los resúmenes de una línea", () => {
    expect(sinMarcasDeFormato("**El oro que nunca buscaste**")).toBe("El oro que nunca buscaste")
    expect(sinMarcasDeFormato("*Salió buscando oro.*")).toBe("Salió buscando oro.")
  })
  for (const c of CLIENTES) {
    it(`${c.nombre}: el texto de una sección se pinta con negrita de verdad, sin asteriscos ni códigos`, () => {
      const h = renderToStaticMarkup(createElement(TextoSinCodigos, { texto: c.caminos, contexto: { aportes: c.aportes } }))
      expect(h).not.toContain("**"); expect(h).not.toMatch(/A\d+\)/)
      expect(h).toMatch(/<strong data-negrita="true" class="font-medio">Camino /)
    })
    it(`${c.nombre}: el panel de la Gran idea · Caminos descartados sin códigos ni asteriscos (resumen y texto); el título sin marcas`, () => {
      const d = concepto({ cliente_id: c.id, gran_idea: { nombre: "**Una idea**", frase: "*Una frase.*" }, caminos_descartados: c.caminos })
      const h = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base(c), tarjetas: [tarjeta(d)], detalle: d, aportes: c.aportes } }))
      const bloque = h.slice(h.indexOf('data-bloque="caminos_descartados"'))
      expect(bloque).toContain("Caminos descartados"); expect(bloque.slice(0, 600)).not.toContain("**"); expect(bloque.slice(0, 600)).not.toMatch(/A\d+[)/]/)
      expect(h).toContain("Una idea"); expect(h).not.toContain("**Una idea**"); expect(h).not.toContain("*Una frase.*")
    })
  }
  it("ConFormato pinta la cursiva y deja el texto común como texto", () => {
    expect(renderToStaticMarkup(createElement(ConFormato, { texto: "va *así* nomás" }))).toBe('<span>va </span><em data-cursiva="true" class="italic">así</em><span> nomás</span>')
  })
})

const concepto = (p: Partial<DetalleDelConcepto> = {}): DetalleDelConcepto => ({
  hitl_id: "h1", status: "pending", estado: "pendiente", titulo: "Gran idea v1", cliente: "x", cliente_id: "x", creada: "2026-11-02T10:00:00Z", campana_id: "c", version: 1, concepto_id: "k",
  seco: false, costo_usd: 0.9, vueltas_restantes: 2, avisos: [], gran_idea: { nombre: "N", frase: "F" }, por_que_funciona: "Porque sí.", como_se_ve: "Azul", como_suena: "Olas", fotos_citadas: [],
  capitulos: [], banco: [], resumen: { total: 0, por_red: {}, por_capitulo: {}, ejemplos: {}, parcial: [] },
  caminos_descartados: "", devolucion_del_brief: null, brief: { version: 1, estado: "validada", texto_md: "## Insight\nx" }, aprobacion: null, nota_de_emilio: null, apunta_a: null, decidido_en: null, sin_concepto: null, ...p,
})
const base = (c: { id: string; nombre: string }) => ({ clientes: [c], cliente: c, campana: { id: "c", estado: "activa" }, publicado: true, leido_en: "x" })
const tarjeta = (d: DetalleDelConcepto) => ({ hitl_id: d.hitl_id, status: d.status, estado: d.estado, titulo: d.titulo, creada: d.creada, version: d.version })
