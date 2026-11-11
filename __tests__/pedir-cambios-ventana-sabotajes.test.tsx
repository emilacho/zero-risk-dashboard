// @vitest-environment jsdom
/**
 * «Pedir cambios» · las pruebas que pidieron los sabotajes que sobrevivieron (CC7 23:02 · 7 · CC6 23:03 · 3). Solo suman pruebas: el código no cambia.
 * - si falla, no se cierra en silencio: el plan con una puerta en 4xx/5xx; el `catch` de la ventana no llama a Cancelar
 * - un clic = un pedido: con el pedido en vuelo, ni Esc ni el clic en el fondo cierran la ventana
 * - piezas: lo editado viaja y no se borra (Cancelar no vacía las ediciones · la lámina de una edición viaja · con ediciones la nota es opcional)
 * - gran idea: «Aprobar» va sin la nota escrita y cancelada · plan: con «ok» la ventana se cierra
 * Dos clientes de rubros distintos (Náufrago · restaurante · y Zero Risk Seguridad Industrial · industria). `fetch` y el envío son falsos: nada escribe ni gasta.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { VentanaPedirCambios, DATO_DE_LA_VENTANA } from "@/components/nuevo/pedido/VentanaPedirCambios"
import { QUE_PASA_DESPUES } from "@/lib/pedir-cambios"
import { comentarioDeEdiciones } from "@/lib/bandeja"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { faseActiva } from "@/lib/pizarron"
import type { CicloDelPlan, RespuestaDelCiclo } from "@/lib/plan"
import type { PlanDelCliente } from "@/lib/plan-datos"
import type { DetalleDeLaPieza, FilaDeLaLista } from "@/lib/piezas-datos"
import type { Bandeja } from "@/lib/bandeja-datos"
import type { DetalleDelConcepto } from "@/lib/concepto-datos"

afterEach(cleanup)

const CLIENTES = [
  { id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", nombre: "Náufrago", titulo: "Historias Instagram · Náufrago · 31 oct", titular: "¿Qué lleva el encebollado?", nuevo: "¿Encebollado o ceviche?" },
  { id: "5a2a0b8e-6c0e-4d4f-9f2a-1b2c3d4e5f60", nombre: "Zero Risk Seguridad Industrial", titulo: "Carrusel Facebook · Zero Risk · 31 oct", titular: "¿Tu casco está vencido?", nuevo: "Revisa tu casco hoy" },
] as const

const ventana = () => document.querySelector<HTMLElement>(`[${DATO_DE_LA_VENTANA}]`)
const caja = () => document.querySelector<HTMLTextAreaElement>("[data-caja-pedir-cambios]")!
const confirmar = () => document.querySelector<HTMLButtonElement>('[data-accion="ventana-confirmar"]')!
const escribir = (t: string) => fireEvent.change(caja(), { target: { value: t } })

describe("la ventana · un pedido en vuelo no se cierra, y un fallo no cierra", () => {
  const abrir = (onConfirmar: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    const onCancelar = vi.fn()
    render(createElement(VentanaPedirCambios, { panel: "prueba", documento: "Plan", seccion: "Insight", minimo: 1, quePasaDespues: QUE_PASA_DESPUES.plan, onConfirmar, onCancelar }))
    return onCancelar
  }
  it("con el pedido en vuelo, ni Esc ni el clic en el fondo llaman a Cancelar; al volver la respuesta, sí", async () => {
    let soltar: (v: { ok: true }) => void = () => {}
    const onCancelar = abrir(() => new Promise((r) => { soltar = r }))
    escribir("Menos azul")
    act(() => { confirmar().click() })
    fireEvent.keyDown(window, { key: "Escape" })
    fireEvent.mouseDown(ventana()!)
    expect(onCancelar).not.toHaveBeenCalled()
    await act(async () => { soltar({ ok: true }) })
    fireEvent.mouseDown(ventana()!) // control: sin pedido en vuelo, el fondo SÍ cancela
    expect(onCancelar).toHaveBeenCalledTimes(1)
  })
  it("si la acción lanza, la ventana no llama a Cancelar: queda abierta con la nota y el error", async () => {
    const onCancelar = abrir(async () => { throw new Error("red caída") })
    escribir("Otra foto")
    await act(async () => { confirmar().click() })
    expect(onCancelar).not.toHaveBeenCalled()
    expect(ventana()).not.toBeNull(); expect(caja().value).toBe("Otra foto")
  })
  it("si la acción responde que falló, tampoco llama a Cancelar", async () => {
    const onCancelar = abrir(async () => ({ ok: false as const, error: "no" }))
    escribir("x")
    await act(async () => { confirmar().click() })
    expect(onCancelar).not.toHaveBeenCalled()
  })
})

// ── plan ─────────────────────────────────────────────────────────────────────
describe.each(CLIENTES)("plan · $nombre", (c) => {
  const ciclo: CicloDelPlan = { disponible: true, version: 2, historial: [], con_compuerta: true, compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, pedido: null, avance: null }
  const datos = (): PlanDelCliente => ({
    clientes: [{ id: c.id, nombre: c.nombre, con_campana: false }], cliente: { id: c.id, nombre: c.nombre }, hoy: "2026-11-01",
    campana: null, estrategia: null, fase_activa: faseActiva([], null, "2026-11-01"), revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [], leido_en: "x",
    documento: { id: "6b1d2a40-1111-4c22-8d33-5e6f7a8b9c0d", titulo: "Plan v2", creado_en: "2026-11-01T15:00:00Z", actualizado_en: null, status: "draft", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: null, prosa: "Prosa", caracteres: 5, que_cambio: null },
    ciclo,
  }) as PlanDelCliente
  const montar = (respuesta: RespuestaDelCiclo) => {
    const enviarCiclo = vi.fn(async () => respuesta)
    render(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: datos(), enviarCiclo: enviarCiclo as never }))
    fireEvent.click(document.querySelector('[data-accion="plan-pedir-cambios"]')!)
    return enviarCiclo
  }
  it("con «ok», la ventana se cierra (un 2.º clic no puede mandar otro pedido)", async () => {
    const enviar = montar({ ok: true, texto: "Pedido enviado", reintentar: false, releer: false })
    escribir("Menos promociones")
    await act(async () => { confirmar().click() })
    expect(enviar).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(ventana()).toBeNull())
  })
  it("si la puerta responde con error, la ventana queda abierta con la nota y el error", async () => {
    montar({ ok: false, texto: "La plataforma no aceptó el pedido.", reintentar: false, releer: false })
    escribir("Menos promociones")
    await act(async () => { confirmar().click() })
    expect(ventana()).not.toBeNull(); expect(caja().value).toBe("Menos promociones")
    expect(document.querySelector("[data-error-ventana]")!.textContent).toBe("La plataforma no aceptó el pedido.")
  })
})

// ── piezas: lo editado ───────────────────────────────────────────────────────
const PIEZA_ID = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
function piezaDe(c: (typeof CLIENTES)[number]) {
  const fila: FilaDeLaLista = { id: PIEZA_ID, tipo: "content_piece_review", es_pieza: true, estado: "pendiente", status: "pending", carpeta: "Historias", titulo: "crudo", titulo_legible: c.titulo, cliente_id: c.id, cliente: c.nombre, creada: "2026-10-31T13:38:01.926Z", gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true }
  const bandeja: Bandeja = { estado: "pendiente", por_aprobar: 1, piezas: [fila], otras: [], clientes: [{ id: c.id, nombre: c.nombre }], leido_en: "x" }
  const detalle = {
    id: PIEZA_ID, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: c.titulo, cliente: c.nombre, creada: "2026-10-31T13:38:01.926Z",
    familia: "kit_historias", brief_id: "BRF-0002", encargo_id: "db7c2d8b", gasto_usd: 1,
    laminas: [1, 2, 3].map((n) => ({ n, nombre: `0${n}.png`, ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: null, titular: n === 3 ? c.titular : `Lámina ${n}`, cuerpo: null, pie: null, glifos_riesgosos: false })),
    pie: "pie", avisos: [], exige_casilla: false, jefatura: { resultado: "limpia", desacuerdos: [], opinion_externa: null, revision_id: "r" }, aportes: [], version: 1, resumen_de_la_bandeja: "x", video: null, guion: null,
  } as unknown as DetalleDeLaPieza
  return { bandeja, detalle }
}

describe.each(CLIENTES)("piezas · lo editado · $nombre", (c) => {
  const montar = () => {
    const llamadas: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { llamadas.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true, simulado: true }), { status: 200 }) }
      return new Response(JSON.stringify({ ok: false, error: "sin lectura en la prueba" }), { status: 500 })
    }) as unknown as typeof fetch
    const { bandeja, detalle } = piezaDe(c)
    render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja, piezaInicialDatos: detalle, clienteInicial: c.id, fetchImpl }))
    return llamadas
  }
  /** va a la lámina 3 con → → y edita su titular (nada marcado) */
  const editarTitularDeLa3 = () => {
    fireEvent.keyDown(window, { key: "ArrowRight" }); fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.click(document.querySelector('[data-campo-editar="3-titular"]')!)
    fireEvent.change(document.querySelector('[data-editor="3-titular"] textarea')!, { target: { value: c.nuevo } })
    fireEvent.click(document.querySelector('[data-editor="3-titular"] [data-accion="guardar-texto"]')!)
    expect(document.querySelector('[data-campo="3-titular"]')!.getAttribute("data-editado")).toBe("true")
  }
  const pedir = () => fireEvent.click(document.querySelector('[data-accion="pieza-pedir-cambios"]')!)

  it("con un texto editado y la caja vacía, «Confirmar» está encendido y sale 1 pedido con las ediciones y la lámina de la edición", async () => {
    const llamadas = montar()
    editarTitularDeLa3()
    pedir()
    expect(caja().value).toBe(""); expect(confirmar().disabled).toBe(false)
    expect(document.querySelector("[data-va-con-tu-nota]")!.textContent).toContain("1 texto editado")
    await act(async () => { confirmar().click() })
    const esperado = comentarioDeEdiciones([{ lamina: 3, campo: "titular", antes: c.titular, despues: c.nuevo }], "")
    expect("comentario" in esperado).toBe(true)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]).toMatchObject({ accion: "cambios", comentario: (esperado as { comentario: string }).comentario, laminas: [3] })
  })
  it("Cancelar con textos editados no los borra: siguen en la pieza y en el recuadro al volver", () => {
    montar()
    editarTitularDeLa3()
    pedir(); fireEvent.click(document.querySelector('[data-accion="ventana-cancelar"]')!)
    expect(ventana()).toBeNull()
    expect(document.querySelector('[data-campo="3-titular"]')!.getAttribute("data-editado")).toBe("true")
    pedir(); expect(document.querySelector("[data-va-con-tu-nota]")!.textContent).toContain("1 texto editado")
  })
})

// ── gran idea: «Aprobar» va sin la nota cancelada ────────────────────────────
describe.each(CLIENTES)("gran idea · aprobar · $nombre", (c) => {
  it("se escribe en la ventana, se cancela y se aprueba: la aprobación no lleva ese texto", async () => {
    const cuerpos: unknown[] = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { cuerpos.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true }), { status: 200 }) }
      return new Response(JSON.stringify({ ok: false, error: "sin lectura" }), { status: 500 })
    }) as unknown as typeof fetch
    const d = {
      hitl_id: "11111111-2222-4333-8444-555555555555", status: "pending", estado: "pendiente", titulo: "Gran idea v1", cliente: c.nombre, cliente_id: c.id, creada: "2026-11-01T10:00:00Z", campana_id: "k", version: 1, concepto_id: "k",
      seco: false, costo_usd: 0.9, vueltas_restantes: 2, avisos: [], gran_idea: { nombre: "Idea", frase: "Frase" }, por_que_funciona: "x", como_se_ve: "x", como_suena: "x", fotos_citadas: [],
      capitulos: [], banco: [], resumen: { total: 0, por_red: {}, por_capitulo: {}, ejemplos: {}, parcial: [] }, caminos_descartados: "", devolucion_del_brief: null, brief: null, aprobacion: null, nota_de_emilio: null, apunta_a: null, decidido_en: null, sin_concepto: null,
    } as unknown as DetalleDelConcepto
    const cliente = { id: c.id, nombre: c.nombre }
    render(createElement(PanelGranIdea, { onCerrar: () => {}, fetchImpl, datosIniciales: { clientes: [cliente], cliente, campana: { id: "k", estado: "activa" }, publicado: true, leido_en: "x", tarjetas: [{ hitl_id: d.hitl_id, status: "pending", estado: "pendiente", titulo: d.titulo, creada: d.creada, version: 1 }], detalle: d } as never }))
    fireEvent.click(document.querySelector('[data-accion="pedir-cambios-gran-idea"]')!)
    escribir("Una nota que al final no mando")
    fireEvent.click(document.querySelector('[data-accion="ventana-cancelar"]')!)
    expect(ventana()).toBeNull()
    await act(async () => { fireEvent.click(document.querySelector('[data-accion="aprobar-gran-idea"]')!) })
    expect(cuerpos).toEqual([{ accion: "aprobar", estado_visto: "pending" }])
  })
})
