/**
 * G2b-tablero · «nada se recorta» (GO Lenovo 18-nov 15:52Z · CC5): lo que Emilio escribe en el tablero llega ENTERO al cuerpo que va a la plataforma,
 * hasta el tope único de 100 000 (el mismo de la plataforma y la base); arriba del tope se rechaza con motivo, nunca se corta en silencio.
 * Prueba de conducta: se llama a la validación REAL de cada acción y se mira el cuerpo que sale.
 */
import { describe, expect, it } from "vitest"
import { TOPE_DEL_TEXTO_DEL_DUENO } from "@/lib/tope-del-texto"
import { ACCIONES, TOPE_DEL_TEXTO_DEL_DUENO as RE_EXPORTADO } from "@/lib/tablero-acciones"
import { COMENTARIO_MAXIMO, validarDecision } from "@/lib/piezas"
import { NOTA_MAXIMA } from "@/lib/concepto-decision"
import { FRASE_MAXIMA } from "@/lib/hitl-resolve"
import { MAX_PREGUNTA, MAX_RESPUESTA, MAX_TEMA } from "@/lib/cerebro"
import { TOPE_MOTIVO, TOPE_RESPUESTA } from "@/lib/direccion-decisiones"
import { TOPE_DEL_CAMPO } from "@/lib/banco-de-ideas"
import { cuerpoDeAprobar, cuerpoDePedirCambios, cuerpoDeResolucion } from "@/lib/plan"
import { cuerpoDePedirCambiosAlManual } from "@/lib/manual-ciclo"

const ID = "11111111-1111-4111-8111-111111111111"
const largo = "w".repeat(5000)
const demas = "w".repeat(100_001)
type Salida = { ok: boolean; cuerpo?: Record<string, unknown>; error?: string }
const v = (accion: keyof typeof ACCIONES, c: Record<string, unknown>) => ACCIONES[accion].validar(c) as Salida

describe("G2b-tablero · el tope es UNO y es el de la plataforma", () => {
  it("🔴 100 000, escrito aquí; el re-export de tablero-acciones es el mismo número", () => {
    expect(TOPE_DEL_TEXTO_DEL_DUENO).toBe(100_000)
    expect(RE_EXPORTADO).toBe(100_000)
  })
  it("🔴 ninguna constante del tablero tiene un tope propio más corto", () => {
    for (const [n, x] of Object.entries({ COMENTARIO_MAXIMO, NOTA_MAXIMA, FRASE_MAXIMA, MAX_TEMA, MAX_PREGUNTA, MAX_RESPUESTA, TOPE_RESPUESTA, TOPE_MOTIVO, TOPE_DEL_CAMPO })) expect(x, n).toBe(100_000)
  })
})

describe("G2b-tablero · cada acción: 5000 llega entero; 100 001 se rechaza con motivo", () => {
  const casos: { accion: keyof typeof ACCIONES; cuerpo: (t: string) => Record<string, unknown>; campo: string }[] = [
    { accion: "propuestas-cambios", cuerpo: (t) => ({ encargo_id: ID, ronda: 1, observaciones: t }), campo: "observaciones" },
    { accion: "rehacer-pieza", cuerpo: (t) => ({ encargo_id: ID, comentario: t }), campo: "comentario" },
    { accion: "plan-aprobar", cuerpo: (t) => ({ plan_id: ID, comentario: t }), campo: "comentario" },
    { accion: "plan-cambios", cuerpo: (t) => ({ plan_id: ID, texto: t, confirmo_gasto: true, tope_usd: 1 }), campo: "texto" },
    { accion: "plan-responder", cuerpo: (t) => ({ espera_id: ID, respuesta: t }), campo: "respuesta" },
    { accion: "cliente-baja", cuerpo: (t) => ({ client_id: ID, comentario: t }), campo: "comentario" },
    { accion: "revision-resolver", cuerpo: (t) => ({ hitl_id: ID, decision: "rechazar", comentario: t }), campo: "comentario" },
  ]
  for (const k of casos) {
    it(`🔴 ${k.accion}`, () => {
      const ok = v(k.accion, k.cuerpo(largo))
      expect(ok.ok, JSON.stringify(ok).slice(0, 200)).toBe(true)
      expect(ok.cuerpo?.[k.campo]).toBe(largo)
      const no = v(k.accion, k.cuerpo(demas))
      expect(no.ok).toBe(false)
      expect(String(no.error ?? "") + JSON.stringify(no)).toMatch(/100[.,]000|caracteres/)
    })
  }
})

describe("G2b-tablero · las ventanas de pedir cambios, aprobar y resolver", () => {
  it("🔴 el plan (pedir cambios, aprobar, resolver) y el manual: 5000 entero; 100 001 dice el tope", () => {
    expect(cuerpoDePedirCambios(ID, largo)).toMatchObject({ texto: largo })
    expect(cuerpoDeAprobar(ID, largo)).toMatchObject({ comentario: largo })
    expect(cuerpoDeResolucion(ID, "rechazar", largo)).toMatchObject({ comentario: largo })
    for (const r of [cuerpoDePedirCambios(ID, demas), cuerpoDeAprobar(ID, demas), cuerpoDeResolucion(ID, "aprobar", demas)]) expect(r).toEqual({ error: "Máximo 100.000 caracteres" })
    expect(cuerpoDePedirCambiosAlManual(ID, largo, null)).toMatchObject({ texto: largo })
    expect(cuerpoDePedirCambiosAlManual(ID, demas, null)).toEqual({ error: "Máximo 100.000 caracteres." })
  })
  it("🔴 piezas: un comentario de 5000 pasa entero; uno de 100 001, no", () => {
    expect(validarDecision({ accion: "cambios", comentario: largo }, 3, false)).toMatchObject({ ok: true, pedido: { comentario: largo } })
    expect(validarDecision({ accion: "cambios", comentario: demas }, 3, false)).toMatchObject({ ok: false })
  })
})
