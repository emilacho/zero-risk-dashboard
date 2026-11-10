// @vitest-environment jsdom
/**
 * Cert CC6 #329 (🟡) · los 4 lugares que muestran el formato y no tenían prueba: capítulos («qué cuenta»), avisos de la sala, devolución del brief y
 * «Por qué esta versión». Se dibujan los dos paneles con TODO abierto y textos con `**…**`: no debe quedar ningún asterisco y la negrita es de verdad.
 * Dos clientes de rubros distintos (Náufrago restaurante con su brief real del 10-nov · B2B industrial de práctica). US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import type { DetalleDelConcepto } from "@/lib/concepto-datos"
import BRIEF from "./fixtures/naufrago-brief-10-nov.json"

const CLIENTES = [
  { nombre: "Náufrago", id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", fuerte: "el caldo del día", capitulo: "La leyenda", aviso: "falta la foto del encebollado" },
  { nombre: "Extintores del Litoral", id: "b2b00000-0000-4000-8000-000000000001", fuerte: "la inspección anual", capitulo: "Sin sustos", aviso: "falta la ficha técnica del extintor" },
]
const sinRed = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch
const abrirTodo = (c: HTMLElement) => { for (let k = 0; k < 3; k++) for (const b of c.querySelectorAll<HTMLButtonElement>("[data-bloque][data-abierta='false'] > button, [data-seccion][data-abierta='false'] > button")) fireEvent.click(b) }
const negritas = (el: Element | null) => [...(el?.querySelectorAll("strong[data-negrita]") ?? [])].map((x) => x.textContent)

for (const c of CLIENTES) {
  describe(`${c.nombre} · el formato se ve, no sus asteriscos`, () => {
    it("Gran idea · capítulos («qué cuenta») y avisos de la sala", () => {
      const d = concepto({
        cliente_id: c.id,
        capitulos: [{ clave: "c1", fase: "1", nombre: c.capitulo, que_cuenta: `Cuenta **${c.fuerte}** y *nada más*.`, objetivo_cita: "", como_se_ve: "", series: [] }],
        avisos: [`Ojo: **${c.aviso}**.`],
      })
      const { container } = render(createElement(PanelGranIdea, { onCerrar: () => {}, fetchImpl: sinRed, datosIniciales: { clientes: [c], cliente: c, campana: { id: "k", estado: "activa" }, publicado: true, leido_en: "x", tarjetas: [{ hitl_id: d.hitl_id, status: d.status, estado: d.estado, titulo: d.titulo, creada: d.creada, version: d.version }], detalle: d, aportes: {} } as never }))
      abrirTodo(container)
      const cap = container.querySelector('[data-bloque="capitulos"]'), av = container.querySelector('[data-bloque="avisos"]')
      expect(cap?.getAttribute("data-abierta")).toBe("true"); expect(av?.getAttribute("data-abierta")).toBe("true")
      expect(cap!.textContent).not.toContain("*"); expect(negritas(cap)).toContain(c.fuerte)
      expect(cap!.querySelector("em[data-cursiva]")?.textContent).toBe("nada más")
      expect(av!.textContent).not.toContain("*"); expect(negritas(av)).toContain(c.aviso)
    })
    it("Brief · devolución y «Por qué esta versión»", async () => {
      const datos = JSON.parse(JSON.stringify(BRIEF)) as typeof BRIEF & { briefs: Array<Record<string, unknown>> }
      datos.cliente = { id: c.id, nombre: c.nombre }
      datos.briefs[0].devolucion_texto = `Lo devuelvo: **${c.fuerte}** no tiene fuente.`
      datos.briefs[0].motivo = `rehecho con **${c.aviso}**`
      const r = render(createElement(PanelBrief, { onCerrar: () => {}, datosIniciales: datos as never, fetchImpl: sinRed }))
      await new Promise((x) => setTimeout(x, 30))
      abrirTodo(r.container)
      const dev = r.container.querySelector('[data-bloque="devolucion"]'), origen = r.container.querySelector('[data-barra="origen"]')
      expect(dev!.textContent).not.toContain("*"); expect(negritas(dev)).toContain(c.fuerte)
      expect(origen!.textContent).toContain("Por qué esta versión"); expect(origen!.textContent).not.toContain("*"); expect(negritas(origen)).toContain(c.aviso)
    })
  })
}

const concepto = (p: Partial<DetalleDelConcepto> = {}): DetalleDelConcepto => ({
  hitl_id: "h1", status: "pending", estado: "pendiente", titulo: "Gran idea v1", cliente: "x", cliente_id: "x", creada: "2026-11-02T10:00:00Z", campana_id: "c", version: 1, concepto_id: "k",
  seco: false, costo_usd: 0.9, vueltas_restantes: 2, avisos: [], gran_idea: { nombre: "N", frase: "F" }, por_que_funciona: "Porque sí.", como_se_ve: "Azul", como_suena: "Olas", fotos_citadas: [],
  capitulos: [], banco: [], resumen: { total: 0, por_red: {}, por_capitulo: {}, ejemplos: {}, parcial: [] },
  caminos_descartados: "", devolucion_del_brief: null, brief: { version: 1, estado: "validada", texto_md: "## Insight\nx" }, aprobacion: null, nota_de_emilio: null, apunta_a: null, decidido_en: null, sin_concepto: null, ...p,
})
