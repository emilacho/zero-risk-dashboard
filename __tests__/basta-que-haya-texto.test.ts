/**
 * GO Lenovo 11-nov 05:03Z (barrido CC6 #1 y #2) · «Pedir cambios» y «Rechazar» exigen SOLO que haya texto, en todas las pantallas del tablero. US$ 0.
 * Antes: 10 letras para pedir cambios a una pieza y 5 para rechazar (y 5 en el plan, el manual y las otras revisiones): «más rojo» no pasaba.
 * Dos clientes de rubros distintos: un restaurante y una consultora B2B.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { hayTexto, validarDecision } from "@/lib/piezas"
import { ACCIONES } from "@/lib/tablero-acciones"
import { cuerpoDePedirCambios, cuerpoDeResolucion } from "@/lib/plan"
import { cuerpoDePedirCambiosAlManual } from "@/lib/manual-ciclo"

const CLIENTES = [
  { rubro: "restaurante", id: "11111111-1111-4111-8111-111111111111", corto: "más rojo", rechazo: "no" },
  { rubro: "consultora B2B", id: "22222222-2222-4222-8222-222222222222", corto: "ok", rechazo: "caro" },
]
const PLAN = "33333333-3333-4333-8333-333333333333"
const HITL = "44444444-4444-4444-8444-444444444444"

describe("basta que haya texto · la regla única", () => {
  it("vacío o solo espacios no es texto; una letra sí", () => {
    for (const t of ["", "   ", "\n\t", null, undefined]) expect(hayTexto(t as string)).toBe(false)
    for (const t of ["a", "ok", " no "]) expect(hayTexto(t)).toBe(true)
  })
})

for (const c of CLIENTES) {
  describe(`${c.rubro} · un pedido corto pasa en cada pantalla; uno vacío no`, () => {
    it(`pieza: pedir cambios «${c.corto}» y rechazar «${c.rechazo}» pasan; vacíos, no`, () => {
      expect(validarDecision({ accion: "cambios", comentario: c.corto }, 3, false)).toMatchObject({ ok: true })
      expect(validarDecision({ accion: "rechazar", comentario: c.rechazo }, 3, false)).toMatchObject({ ok: true })
      expect(validarDecision({ accion: "cambios", comentario: "  " }, 3, false)).toMatchObject({ ok: false, error: "comentario_requerido" })
      expect(validarDecision({ accion: "rechazar", comentario: "" }, 3, false)).toMatchObject({ ok: false, error: "motivo_requerido" })
    })
    it("plan: pedir cambios y rechazar una revisión con texto corto pasan (pantalla y servidor del tablero)", () => {
      expect(cuerpoDePedirCambios(PLAN, c.corto)).not.toHaveProperty("error")
      expect(cuerpoDeResolucion(HITL, "rechazar", c.rechazo)).not.toHaveProperty("error")
      expect(ACCIONES["plan-cambios"].validar({ plan_id: PLAN, texto: c.corto, confirmo_gasto: true, tope_usd: 5 })).toMatchObject({ ok: true })
      expect(ACCIONES["plan-cambios"].validar({ plan_id: PLAN, texto: "ok", confirmo_gasto: true, tope_usd: 5 })).toMatchObject({ ok: true })
      expect(ACCIONES["plan-cambios"].validar({ plan_id: PLAN, texto: " ", confirmo_gasto: true, tope_usd: 5 })).toMatchObject({ ok: false })
      expect(ACCIONES["revision-resolver"].validar({ hitl_id: HITL, decision: "rechazar", comentario: c.rechazo })).toMatchObject({ ok: true })
      expect(ACCIONES["revision-resolver"].validar({ hitl_id: HITL, decision: "rechazar", comentario: "" })).toMatchObject({ ok: false })
    })
    it("manual: pedir cambios con texto corto pasa (pantalla y servidor); vacío no", () => {
      expect(cuerpoDePedirCambiosAlManual(c.id, c.corto)).not.toHaveProperty("error")
      expect(ACCIONES["manual-cambios"].validar({ client_id: c.id, texto: c.corto, confirmo_gasto: true, tope_usd: 5 })).toMatchObject({ ok: true })
      expect(cuerpoDePedirCambiosAlManual(c.id, "  ")).toHaveProperty("error")
    })
  })
}

describe("las pantallas ya no piden un mínimo de letras", () => {
  const PANTALLAS = ["components/nuevo/PanelPiezas.tsx", "app/piezas/VisorDePieza.tsx", "components/nuevo/manual/RevisionDelEditor.tsx"]
  it("ningún botón se apaga por un número de letras ni el texto dice «mínimo N letras»", () => {
    for (const p of PANTALLAS) {
      const s = readFileSync(p, "utf8")
      expect(s, p).not.toMatch(/m[ií]nimo \{?[A-Za-z.0-9]*\}? ?letras/i)
      expect(s, p).not.toMatch(/comentario\.trim\(\)\.length < /)
    }
  })
  it("los botones de pedir cambios y rechazar se apagan solo si no hay texto", () => {
    const s = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    for (const accion of ["confirmar-rechazar-pieza", "confirmar-revision-rechazar"]) {
      const boton = s.slice(s.indexOf(`data-accion="${accion}"`), s.indexOf(">", s.indexOf(`data-accion="${accion}"`)))
      expect(boton, accion).toMatch(/!hayTexto\(comentario\)/)
    }
    // «Pedir cambios» de la pieza va en la ventana nueva: su mínimo es MINIMO_DE_LA_NOTA.piezas (1 = basta que haya texto, por hayTexto)
    expect(s).toContain("minimo={MINIMO_DE_LA_NOTA.piezas}")
  })
})
