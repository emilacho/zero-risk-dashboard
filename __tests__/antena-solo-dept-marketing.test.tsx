/**
 * 09-nov 21:44Z · CORRECCIÓN de Lenovo (Emilio: «La antena es para los mensajes que corresponden a Dept. Marketing»).
 * La antena muestra y cuenta SOLO los avisos cuyo dato dice departamento marketing. Lo del cerebro, el portero, Apify, finanzas o toda la
 * empresa no entra (va a Riesgos). Un aviso sin departamento no entra. El filtro es por el dato, nunca por una lista de tipos. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { DEPARTAMENTO_DE_LA_ANTENA, MAXIMO_DE_ALERTAS, armarAlertas, cerebroNoCorrio, delDepartamento, fallidas, preguntasSinResponder, sinDepartamento, type AlertaDeLaAntena, type EntradaDeAlertas } from "@/lib/escena-alertas"
import { AntenaDeAlertas } from "@/components/nuevo/escena/AntenaDeAlertas"

const AHORA = new Date("2026-11-09T22:00:00Z")
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const vacia = (): EntradaDeAlertas => ({ cliente: "c1", ahora: AHORA, plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [] })
// la alarma real abierta hoy en producción (cerebro_alertas): la que Emilio vio en la antena
const ALARMA_DE_HOY = { clave: "raspado-en-pausa:2026-11-25", ultima_en: "2026-11-09T18:30:00.897+00:00" }
// la forma real de las preguntas de hoy en dueno_preguntas: todas de la oficina «financiera»
const pregunta = (id: string, oficina: string | null) => ({ id, client_id: "c1", pregunta: "¿Cierro el mes con este saldo?", estado: "pendiente", creado_en: hace(2), oficina })
const plan = (id: string, estado: string, h: number) => ({ id, client_id: "c1", estado, creado_en: hace(h), actualizado_en: hace(h - 0.5), vence_en: null, motivo: null, dry_run: false })
const dibujar = (alertas: AlertaDeLaAntena[]) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas, onAbrir: () => undefined })))

describe("1 · lo que no es del Dept. Marketing no prende la antena", () => {
  it("la alarma del cerebro de hoy (portero · Apify en pausa) NO entra: la antena queda apagada y sin número", () => {
    const e = { ...vacia(), alarmasDelCerebro: [ALARMA_DE_HOY] }
    expect(cerebroNoCorrio(e)).toHaveLength(1) // el aviso existe (Riesgos lo muestra)…
    expect(cerebroNoCorrio(e)[0].departamento).toBeNull() // …pero su dato no dice departamento
    expect(armarAlertas(e)).toEqual([]) // …y la antena no lo cuenta
    const html = dibujar(armarAlertas(e))
    expect(html).not.toContain("nv-antena"); expect(html).not.toContain("data-alertas")
  })
  it("la corrida diaria del cerebro que no corrió o salió mal tampoco entra", () => {
    const fila = (dia: string, estado = "ok") => ({ client_id: "c1", dia, estado, prueba: false })
    expect(armarAlertas({ ...vacia(), cerebroDiario: [fila("2026-11-01")] })).toEqual([])
    expect(armarAlertas({ ...vacia(), cerebroDiario: [fila("2026-11-08", "fallida")] })).toEqual([])
  })
  it("una pregunta de la Oficina Financiera (la forma real de hoy) no entra; una sin oficina tampoco", () => {
    expect(preguntasSinResponder({ ...vacia(), preguntas: [pregunta("f", "financiera")] })[0].departamento).toBe("financiera")
    expect(armarAlertas({ ...vacia(), preguntas: [pregunta("f", "financiera"), pregunta("n", null), pregunta("v", "  ")] })).toEqual([])
  })
  it("un aviso de toda la empresa o sin departamento no entra (el sabotaje de CC6 debe hacer caer esto)", () => {
    const aviso = (departamento: string | null): AlertaDeLaAntena => ({ clave: `k:${departamento}`, tipo: "fallida", texto: "x", cuando: hace(1), abre: null, departamento })
    expect(delDepartamento(aviso("empresa"))).toBe(false)
    expect(delDepartamento(aviso("transversal"))).toBe(false)
    expect(delDepartamento(aviso(null))).toBe(false)
    expect(delDepartamento(aviso(DEPARTAMENTO_DE_LA_ANTENA))).toBe(true)
  })
})

describe("2 · lo del Dept. Marketing sí la prende", () => {
  it("el Plan de Marketing que falló prende la antena con su número", () => {
    const a = armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)], alarmasDelCerebro: [ALARMA_DE_HOY] })
    expect(a.map((x) => x.clave)).toEqual(["fallida:a"]) // el plan entra; la alarma del cerebro, en la misma lectura, no
    expect(fallidas({ ...vacia(), plan: [plan("a", "fallida", 3)] })[0].departamento).toBe("marketing")
    const html = dibujar(a)
    expect(html).toContain('data-alertas="1"'); expect(html).toContain("1 alerta del departamento")
  })
  it("una pregunta de la oficina de marketing entra (mayúsculas y espacios del dato no importan)", () => {
    expect(armarAlertas({ ...vacia(), preguntas: [pregunta("m", " Marketing ")] }).map((x) => x.clave)).toEqual(["pregunta:m"])
  })
  it("el número cuenta solo lo del departamento: 2 de marketing + 3 de afuera = 2", () => {
    const a = armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)], preguntas: [pregunta("m", "marketing"), pregunta("f", "financiera")], alarmasDelCerebro: [ALARMA_DE_HOY, { clave: "otra", ultima_en: hace(1) }] })
    expect(a).toHaveLength(2); expect(dibujar(a)).toContain('data-alertas="2"')
  })
  it("CC6 #309 menor 1 · el filtro va ANTES del tope: 7 alarmas de afuera más nuevas no empujan fuera al aviso de marketing", () => {
    const afuera = Array.from({ length: MAXIMO_DE_ALERTAS + 1 }, (_, i) => ({ clave: `a${i}`, ultima_en: hace(0.1 + i * 0.01) }))
    const a = armarAlertas({ ...vacia(), plan: [plan("a", "fallida", 3)], alarmasDelCerebro: afuera })
    expect(a.map((x) => x.clave)).toEqual(["fallida:a"]); expect(dibujar(a)).toContain('data-alertas="1"')
  })
})

describe("3 · por datos, no por lista de tipos", () => {
  it("el MISMO tipo de aviso entra o no según su departamento: la antena no mira el tipo", () => {
    const en = armarAlertas({ ...vacia(), preguntas: [pregunta("m", "marketing")] }), fuera = armarAlertas({ ...vacia(), preguntas: [pregunta("f", "financiera")] })
    expect(en[0]?.tipo).toBe("pregunta"); expect(fuera).toEqual([])
    const fuente = readFileSync("lib/escena-alertas.ts", "utf8")
    expect(fuente).toContain(".filter(delDepartamento)")
    expect(fuente).not.toMatch(/\.filter\(\(a\) => a\.tipo/) // ningún filtro por tipo
  })
  it("los tipos que llegan sin departamento se pueden listar para la nota a Lenovo", () => {
    const todas = [...cerebroNoCorrio({ ...vacia(), alarmasDelCerebro: [ALARMA_DE_HOY] }), ...fallidas({ ...vacia(), plan: [plan("a", "fallida", 3)] }), ...preguntasSinResponder({ ...vacia(), preguntas: [pregunta("n", null)] })]
    expect(sinDepartamento(todas).sort()).toEqual(["cerebro", "pregunta"])
  })
  it("la lectura pide la oficina de cada pregunta a la base (sin ella, ninguna pregunta entraría)", () => {
    const datos = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(datos).toContain('select("id, client_id, pregunta, estado, creado_en, oficina")')
    expect(datos).toContain("oficina: s(p.oficina)")
  })
})
