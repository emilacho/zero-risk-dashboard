// @vitest-environment jsdom
/**
 * LA VENTANA «PEDIR CAMBIOS» (GO Lenovo 21:59 · Emilio aprobó A1 + B1 · boceto `raw/evidencia/2026-11-11-pedir-cambios/`).
 * Lo que CC7 pidió para el código: un doble clic = 1 llamada · si el envío falla la ventana queda abierta con el texto y el error · el mínimo
 * se cuenta con UNA función después de recortar · el cuerpo del plan es el MISMO byte a byte · en las piezas Cancelar no borra lo marcado ·
 * el manual (A1) suma a «Tus cambios» y no manda · Esc es Cancelar y el foco no sale de la ventana.
 * Dos clientes de rubros distintos: Náufrago (restaurante) y Zero Risk Seguridad Industrial (industria). Nada escribe ni gasta: `fetch` es falso.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { readFileSync } from "node:fs"
import { VentanaPedirCambios, DATO_DE_LA_VENTANA, hayVentanaDePedirCambios } from "@/components/nuevo/pedido/VentanaPedirCambios"
import { SUBTITULO_DE_LA_VENTANA, letrasDeLaNota, lineaDelMinimo, loQueVaConTuNota, MINIMO_DE_LA_NOTA, notaAlcanza, QUE_PASA_DESPUES, sumarATusCambios, textoDelPedidoDelPlan, trozosConNombres } from "@/lib/pedir-cambios"
import { NOTA_MINIMA } from "@/lib/concepto-decision"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import type { DetalleDeLaPieza, FilaDeLaLista } from "@/lib/piezas-datos"
import type { Bandeja } from "@/lib/bandeja-datos"
import type { DetalleDelConcepto } from "@/lib/concepto-datos"
import { PedirCambiosAlManual } from "@/components/nuevo/manual/PedirCambiosAlManual"

afterEach(cleanup)

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const PEREZ = "5a2a0b8e-6c0e-4d4f-9f2a-1b2c3d4e5f60"
const CLIENTES = [
  { id: NAUFRAGO, nombre: "Náufrago", titulo: "Historias Instagram · Náufrago · 31 oct", titular: "¿Qué lleva el encebollado?", nuevo: "¿Encebollado o ceviche?" },
  { id: PEREZ, nombre: "Zero Risk Seguridad Industrial", titulo: "Carrusel Facebook · Zero Risk · 31 oct", titular: "¿Tu casco está vencido?", nuevo: "Revisa tu casco hoy" },
] as const

const ventana = () => document.querySelector<HTMLElement>(`[${DATO_DE_LA_VENTANA}]`)
const caja = () => document.querySelector<HTMLTextAreaElement>("[data-caja-pedir-cambios]")!
const confirmar = () => document.querySelector<HTMLButtonElement>('[data-accion="ventana-confirmar"]')!
const escribir = (t: string) => fireEvent.change(caja(), { target: { value: t } })

describe("la nota · una sola función para contar, después de recortar", () => {
  it("10 espacios no son 10 letras; minimo 1 = basta que haya texto; la gran idea pide NOTA_MINIMA", () => {
    expect(letrasDeLaNota("   hola  ")).toBe(4); expect(letrasDeLaNota(null)).toBe(0)
    expect(notaAlcanza(" ".repeat(10), 1)).toBe(false); expect(notaAlcanza("x", 1)).toBe(true)
    expect(notaAlcanza(" ".repeat(12) + "123456789", 10)).toBe(false); expect(notaAlcanza("1234567890", 10)).toBe(true)
    expect(MINIMO_DE_LA_NOTA).toEqual({ plan: 1, manual: 1, piezas: 1, gran_idea: NOTA_MINIMA })
    expect(lineaDelMinimo(1)).toBeNull(); expect(lineaDelMinimo(10)).toBe("Mínimo 10 letras")
  })
  it("el plan manda el MISMO texto que el formulario de antes (el prefijo que se escribía en la caja, más la nota)", () => {
    const antes = (nota: string, seccion: string) => `Sección «${seccion}»: ` + nota // lo que quedaba en la caja vacía tras «Pedir cambios en esta sección»
    for (const nota of ["Menos promociones y más platos del día", "Quiten el tono alarmista del casco"]) {
      expect(textoDelPedidoDelPlan(nota, "Insight")).toBe(antes(nota, "Insight"))
      expect(textoDelPedidoDelPlan(nota, null)).toBe(nota)
    }
  })
  it("A1 · «Sumar a tus cambios» suma la nota al texto libre con un renglón en blanco y la sección delante", () => {
    expect(sumarATusCambios("", "más cálido", "Voz de la marca")).toBe("Sección «Voz de la marca»: más cálido")
    expect(sumarATusCambios("Lo de antes  \n", "sin jerga técnica", "Público")).toBe("Lo de antes\n\nSección «Público»: sin jerga técnica")
  })
  it("piezas · el recuadro «Va con tu nota» dice lo ya marcado (y nada si no hay nada)", () => {
    expect(loQueVaConTuNota(0, 0)).toBeNull()
    expect(loQueVaConTuNota(2, 1)).toBe("2 láminas marcadas y 1 texto editado")
    expect(loQueVaConTuNota(1, 0)).toBe("1 lámina marcada"); expect(loQueVaConTuNota(0, 3)).toBe("3 textos editados")
  })
  it("los nombres propios del «Qué pasa después» se subrayan sin partir palabras", () => {
    expect(trozosConNombres(QUE_PASA_DESPUES.plan).filter((p) => p.nombre).map((p) => p.texto)).toEqual(["Jefe de Marketing", "Jefatura"])
    expect(trozosConNombres({ texto: "sin nombres", nombres: [] })).toEqual([{ texto: "sin nombres", nombre: false }])
  })
})

describe("la ventana · las reglas de CC7", () => {
  const abrir = (p: Partial<Parameters<typeof VentanaPedirCambios>[0]> = {}) => {
    const onConfirmar = vi.fn(p.onConfirmar ?? (async () => ({ ok: true as const })))
    const onCancelar = vi.fn()
    render(createElement(VentanaPedirCambios, { panel: "prueba", documento: "Plan", seccion: "Insight", minimo: 1, quePasaDespues: QUE_PASA_DESPUES.plan, ...p, onConfirmar, onCancelar }))
    return { onConfirmar, onCancelar }
  }
  it("el título lleva el documento y la sección; sin mínimo real no hay línea «Mínimo»", () => {
    abrir()
    expect(document.querySelector("[data-titulo-ventana]")!.textContent).toBe("Pedir cambios al Plan · Insight")
    expect(document.querySelector("[data-minimo-ventana]")).toBeNull()
    expect(document.querySelector("[data-subtitulo-ventana]")!.textContent).toBe(SUBTITULO_DE_LA_VENTANA.sale)
    expect(hayVentanaDePedirCambios()).toBe(true)
    expect(document.activeElement).toBe(caja())
  })
  it("con la caja vacía o solo espacios el botón está apagado; con una letra se enciende", () => {
    abrir()
    expect(confirmar().disabled).toBe(true); escribir("   "); expect(confirmar().disabled).toBe(true); escribir("x"); expect(confirmar().disabled).toBe(false)
  })
  it("un doble clic = UNA llamada", async () => {
    let soltar: (v: { ok: true }) => void = () => {}
    const { onConfirmar } = abrir({ onConfirmar: () => new Promise((r) => { soltar = r }) })
    escribir("Menos azul")
    act(() => { confirmar().click(); confirmar().click() })
    fireEvent.click(confirmar())
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith("Menos azul")
    await act(async () => { soltar({ ok: true }) })
  })
  it("si el envío falla, la ventana queda abierta con el texto y el error; un 2.º intento sí llama", async () => {
    const { onConfirmar } = abrir({ onConfirmar: async () => ({ ok: false as const, error: "La plataforma no respondió." }) })
    escribir("Más gente comiendo")
    await act(async () => { confirmar().click() })
    expect(ventana()).not.toBeNull(); expect(caja().value).toBe("Más gente comiendo")
    expect(document.querySelector("[data-error-ventana]")!.textContent).toBe("La plataforma no respondió.")
    await act(async () => { confirmar().click() })
    expect(onConfirmar).toHaveBeenCalledTimes(2)
  })
  it("si la acción lanza, el error queda a la vista (no se pierde la nota)", async () => {
    abrir({ onConfirmar: async () => { throw new Error("red caída") } })
    escribir("x")
    await act(async () => { confirmar().click() })
    expect(document.querySelector("[data-error-ventana]")!.textContent).toMatch(/red caída/); expect(caja().value).toBe("x")
  })
  it("Esc es Cancelar; Tab no sale de la ventana (del último vuelve al primero y al revés)", () => {
    const { onCancelar } = abrir()
    escribir("x")
    const focos = [...ventana()!.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])")]
    focos[focos.length - 1].focus(); fireEvent.keyDown(window, { key: "Tab" }); expect(document.activeElement).toBe(focos[0])
    focos[0].focus(); fireEvent.keyDown(window, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(focos[focos.length - 1])
    fireEvent.keyDown(window, { key: "Escape" }); expect(onCancelar).toHaveBeenCalledTimes(1)
  })
  it("la gran idea pide 10 letras: con 9 no se enciende y la línea lo dice", () => {
    abrir({ documento: "Gran idea", seccion: "Concepto", minimo: MINIMO_DE_LA_NOTA.gran_idea })
    expect(document.querySelector("[data-titulo-ventana]")!.textContent).toBe("Pedir cambios a la Gran idea · Concepto")
    expect(document.querySelector("[data-minimo-ventana]")!.textContent).toBe(`Mínimo ${NOTA_MINIMA} letras`)
    escribir("x".repeat(NOTA_MINIMA - 1)); expect(confirmar().disabled).toBe(true)
    escribir("x".repeat(NOTA_MINIMA)); expect(confirmar().disabled).toBe(false)
  })
  it("nota opcional (piezas con textos editados): se puede confirmar con la caja vacía", () => {
    abrir({ documento: "Pieza", notaOpcional: true }); expect(confirmar().disabled).toBe(false)
  })
})

// ── piezas, con los dos clientes ─────────────────────────────────────────────
const PIEZA_ID = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
function piezaDe(c: (typeof CLIENTES)[number]) {
  const fila: FilaDeLaLista = { id: PIEZA_ID, tipo: "content_piece_review", es_pieza: true, estado: "pendiente", status: "pending", carpeta: "Historias", titulo: "crudo", titulo_legible: c.titulo, cliente_id: c.id, cliente: c.nombre, creada: "2026-10-31T13:38:01.926Z", gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true }
  const bandeja: Bandeja = { estado: "pendiente", por_aprobar: 1, piezas: [fila], otras: [], clientes: [{ id: c.id, nombre: c.nombre }], leido_en: "x" }
  const detalle: DetalleDeLaPieza = {
    id: PIEZA_ID, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: c.titulo, cliente: c.nombre, creada: "2026-10-31T13:38:01.926Z",
    familia: "kit_historias", brief_id: "BRF-0002", encargo_id: "db7c2d8b", gasto_usd: 1,
    laminas: [1, 2, 3].map((n) => ({ n, nombre: `0${n}.png`, ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: null, titular: n === 1 ? c.titular : `Lámina ${n}`, cuerpo: null, pie: null, glifos_riesgosos: false })),
    pie: "pie", avisos: [], exige_casilla: false, jefatura: { resultado: "limpia", desacuerdos: [], opinion_externa: null, revision_id: "r" }, aportes: [], version: 1, resumen_de_la_bandeja: "x", video: null, guion: null,
  } as unknown as DetalleDeLaPieza
  return { bandeja, detalle }
}

describe.each(CLIENTES)("piezas · $nombre", (c) => {
  const montar = (respuesta: () => Response) => {
    const llamadas: Array<{ url: string; cuerpo: unknown }> = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { llamadas.push({ url, cuerpo: JSON.parse(String(init.body)) }); return respuesta() }
      return new Response(JSON.stringify({ ok: false, error: "sin lectura en la prueba" }), { status: 500 })
    }) as unknown as typeof fetch
    const { bandeja, detalle } = piezaDe(c)
    render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja, piezaInicialDatos: detalle, clienteInicial: c.id, fetchImpl }))
    return llamadas
  }
  const marcar = (n: number) => fireEvent.click(document.querySelector(`[data-accion="marcar-lamina"][data-n="${n}"]`)!)
  const juntas = () => fireEvent.click(document.querySelector('[data-accion="ver-juntas"]')!)
  const pedir = () => fireEvent.click(document.querySelector('[data-accion="pieza-pedir-cambios"]')!)

  it("la ventana muestra la pieza en el título y lo ya marcado en el recuadro de solo lectura; Cancelar NO borra lo marcado", () => {
    montar(() => new Response("{}"))
    juntas(); marcar(2); marcar(3)
    pedir()
    expect(document.querySelector("[data-titulo-ventana]")!.textContent).toBe(`Pedir cambios a la Pieza · ${c.titulo}`)
    const va = document.querySelector("[data-va-con-tu-nota]")!
    expect(va.textContent).toContain("Va con tu nota: 2 láminas marcadas")
    expect([...va.querySelectorAll("[data-lamina-va]")].map((x) => x.getAttribute("data-va"))).toEqual(["false", "true", "true"])
    expect(va.querySelector("button, input, textarea")).toBeNull() // solo lectura
    fireEvent.click(document.querySelector('[data-accion="ventana-cancelar"]')!)
    expect(ventana()).toBeNull()
    expect([...document.querySelectorAll('[data-accion="marcar-lamina"]')].map((x) => x.textContent)).toEqual(["1 / 3", "2 · cambiar", "3 · cambiar"])
    pedir(); expect(document.querySelector("[data-va-con-tu-nota]")!.textContent).toContain("2 láminas marcadas") // al volver, sigue ahí
  })
  it("Esc en la ventana cierra la ventana, no el panel", () => {
    const onCerrar = vi.fn()
    const { bandeja, detalle } = piezaDe(c)
    render(createElement(PanelPiezas, { onCerrar, bandejaInicial: bandeja, piezaInicialDatos: detalle, clienteInicial: c.id, fetchImpl: vi.fn() as unknown as typeof fetch }))
    pedir(); fireEvent.keyDown(window, { key: "Escape" })
    expect(ventana()).toBeNull(); expect(onCerrar).not.toHaveBeenCalled()
  })
  it("el pedido va por la puerta de siempre con la nota, las láminas marcadas y el estado visto; un doble clic = 1 llamada", async () => {
    const llamadas = montar(() => new Response(JSON.stringify({ ok: true, simulado: true }), { status: 200 }))
    juntas(); marcar(2)
    pedir(); escribir("La foto más cerca")
    await act(async () => { confirmar().click(); confirmar().click() })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].url).toBe(`/api/piezas/${PIEZA_ID}/decidir`)
    expect(llamadas[0].cuerpo).toMatchObject({ accion: "cambios", comentario: "La foto más cerca", laminas: [2], estado_visto: "pending" })
    await waitFor(() => expect(ventana()).toBeNull())
  })
  it("si la puerta falla, la ventana queda abierta con la nota y el error, y lo marcado sigue", async () => {
    montar(() => new Response(JSON.stringify({ ok: false, error: "la oficina no está disponible" }), { status: 502 }))
    juntas(); marcar(3)
    pedir(); escribir("Otro color")
    await act(async () => { confirmar().click() })
    expect(ventana()).not.toBeNull(); expect(caja().value).toBe("Otro color")
    expect(document.querySelector("[data-error-ventana]")!.textContent!.length).toBeGreaterThan(0)
    expect(document.querySelector("[data-va-con-tu-nota]")!.textContent).toContain("1 lámina marcada")
  })
})

// ── gran idea (B1), con los dos clientes ─────────────────────────────────────
describe.each(CLIENTES)("gran idea · $nombre", (c) => {
  const concepto = (): DetalleDelConcepto => ({
    hitl_id: "11111111-2222-4333-8444-555555555555", status: "pending", estado: "pendiente", titulo: "Gran idea v1", cliente: c.nombre, cliente_id: c.id, creada: "2026-11-01T10:00:00Z", campana_id: "k", version: 1, concepto_id: "k",
    seco: false, costo_usd: 0.9, vueltas_restantes: 2, avisos: [], gran_idea: { nombre: "Idea", frase: "Frase" }, por_que_funciona: "x", como_se_ve: "x", como_suena: "x", fotos_citadas: [],
    capitulos: [], banco: [], resumen: { total: 0, por_red: {}, por_capitulo: {}, ejemplos: {}, parcial: [] }, caminos_descartados: "", devolucion_del_brief: null, brief: null, aprobacion: null, nota_de_emilio: null, apunta_a: null, decidido_en: null, sin_concepto: null,
  }) as DetalleDelConcepto
  it("la elección vive en la ventana: el título y el «Qué pasa después» siguen a lo elegido; el cuerpo lleva la nota y a qué apunta", async () => {
    const llamadas: unknown[] = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { llamadas.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true, nota: "listo" }), { status: 200 }) }
      return new Response(JSON.stringify({ ok: false, error: "sin lectura" }), { status: 500 })
    }) as unknown as typeof fetch
    const d = concepto()
    const cliente = { id: c.id, nombre: c.nombre }
    render(createElement(PanelGranIdea, { onCerrar: () => {}, fetchImpl, datosIniciales: { clientes: [cliente], cliente, campana: { id: "k", estado: "activa" }, publicado: true, leido_en: "x", tarjetas: [{ hitl_id: d.hitl_id, status: "pending", estado: "pendiente", titulo: d.titulo, creada: d.creada, version: 1 }], detalle: d } as never }))
    fireEvent.click(document.querySelector('[data-accion="pedir-cambios-gran-idea"]')!)
    const despues = () => document.querySelector("[data-que-pasa-despues]")!.textContent
    expect(document.querySelector("[data-titulo-ventana]")!.textContent).toBe("Pedir cambios a la Gran idea · Concepto")
    expect(despues()).toContain(QUE_PASA_DESPUES.gran_idea_concepto.texto)
    fireEvent.click(document.querySelector('input[name="gi-apunta"][value="brief"]')!)
    expect(document.querySelector("[data-titulo-ventana]")!.textContent).toBe("Pedir cambios a la Gran idea · Brief")
    expect(despues()).toContain(QUE_PASA_DESPUES.gran_idea_brief.texto)
    escribir("Menos azul, más gente")
    await act(async () => { confirmar().click(); confirmar().click() })
    expect(llamadas).toEqual([{ accion: "cambios", nota: "Menos azul, más gente", apunta_a: "brief", estado_visto: "pending" }])
  })
})

describe.each(CLIENTES)("manual (A1) · $nombre", (c) => {
  const ciclo = { disponible: true, abierto: null, avance: null, que_cambio: [] }
  const montar = (libre: string, validados: string[] = []) => {
    const onLibre = vi.fn()
    const props = { clienteNombre: c.nombre, ciclo, validadosDelManual: [], libre, onLibre }
    const r = render(createElement(PedirCambiosAlManual, { ...props, pedirEn: null }))
    r.rerender(createElement(PedirCambiosAlManual, { ...props, pedirEn: { titulo: "Voz de la marca", campos: ["voz"], validados, n: 1 } }))
    return onLibre
  }
  it("la sección abre la ventana; «Sumar a tus cambios» suma la nota al texto libre, cierra y no manda nada", async () => {
    const onLibre = montar("Lo que ya escribí")
    expect(document.querySelector("[data-titulo-ventana]")!.textContent).toBe("Pedir cambios al Manual · Voz de la marca")
    expect(confirmar().textContent).toBe("Sumar a tus cambios")
    expect(document.querySelector("[data-subtitulo-ventana]")!.textContent).toBe(SUBTITULO_DE_LA_VENTANA.suma) // aquí la nota no sale: se suma
    expect(document.querySelector("[data-que-pasa-despues]")!.textContent).toContain(QUE_PASA_DESPUES.manual.texto)
    expect(onLibre).not.toHaveBeenCalled() // abrir la ventana ya no escribe en el cuadro
    escribir("Más cercana, menos técnica")
    await act(async () => { confirmar().click() })
    expect(onLibre).toHaveBeenCalledTimes(1)
    expect(onLibre).toHaveBeenCalledWith("Lo que ya escribí\n\nSección «Voz de la marca»: Más cercana, menos técnica")
    expect(ventana()).toBeNull()
  })
  it("Cancelar no toca el texto libre; con campos validados por el dueño, la ventana lo avisa", () => {
    const onLibre = montar("", ["Tono"])
    expect(document.querySelector("[data-aviso-validados-ventana]")).not.toBeNull()
    escribir("algo"); fireEvent.click(document.querySelector('[data-accion="ventana-cancelar"]')!)
    expect(ventana()).toBeNull(); expect(onLibre).not.toHaveBeenCalled()
  })
})

describe("el manual (A1) y los Esc de los paneles", () => {
  it("«Sumar a tus cambios» no manda nada: suma al texto libre (sin fetch en el componente)", () => {
    const s = readFileSync("components/nuevo/manual/PedirCambiosAlManual.tsx", "utf8")
    expect(s).toContain('botonConfirmar="Sumar a tus cambios"'); expect(s).toContain("onLibre(sumarATusCambios(libre, nota, ventana.titulo))")
    expect(s).not.toMatch(/fetch\(/)
  })
  it("cada panel deja el Esc a la ventana cuando está abierta", () => {
    for (const f of ["PanelPlan", "PanelManual", "PanelGranIdea", "PanelPiezas"]) expect(readFileSync(`components/nuevo/${f}.tsx`, "utf8"), f).toContain("hayVentanaDePedirCambios()")
  })
})
