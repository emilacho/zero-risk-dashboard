/**
 * DASHBOARD NUEVO · SPRINT 6.32 (2-nov · Emilio: «pon las respuestas del chat más abajo, en armonía con la esquina derecha inferior, y una pequeña x elegante y sutil que me permita cerrar ese chat»).
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const c = readFileSync("components/nuevo/ChatDeOficinas.tsx", "utf8")
const marco = c.slice(c.indexOf("data-chat-respuestas-marco"), c.indexOf("<form onSubmit"))

describe("6.32 · respuestas en la esquina inferior derecha, con una X sutil", () => {
  it("en ancha: pegadas abajo con el cuadro y al mismo margen del borde derecho (1.5rem); crecen hacia arriba, sin alto fijo", () => {
    expect(marco).toContain("min-[1100px]:bottom-0")
    expect(marco).toContain("min-[1100px]:w-[calc((100vw-min(610px,100vw-7rem))/2-2.75rem)]")
    expect(marco).not.toContain("min-[1100px]:h-[")
    expect(marco).toContain("min-[1100px]:max-h-[min(55vh,26rem)]")
  })
  it("una X chica, tenue y sin caja, que solo esconde las respuestas; el cuadro de chat sigue siempre", () => {
    expect(marco).toContain('aria-label="Cerrar las respuestas"')
    expect(marco).toContain('<X size={14} weight="light" />')
    expect(marco).toContain("text-white/45")
    expect(marco).not.toMatch(/bg-|border|rounded|shadow/)
    expect(c).toContain("mensajes.length > 0 && !respuestasCerradas")
  })
  it("las respuestas vuelven solas con el próximo mensaje", () => {
    const enviar = c.slice(c.indexOf("const enviar = useCallback"), c.indexOf("const enviar = useCallback") + 700)
    expect(enviar).toContain("setRespuestasCerradas(false)")
  })
})
