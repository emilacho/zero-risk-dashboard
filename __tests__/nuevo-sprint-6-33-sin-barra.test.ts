/**
 * DASHBOARD NUEVO · SPRINT 6.33 (2-nov · Emilio: «quítale la barra de desplazamiento de manera visual pero no funcional: la rueda del ratón debe mover el chat siempre y cuando esté encima de él»).
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const c = readFileSync("components/nuevo/ChatDeOficinas.tsx", "utf8")
const zona = c.slice(c.indexOf("data-chat-respuestas aria-label"), c.indexOf("<form onSubmit"))

describe("6.33 · respuestas sin barra visible, con rueda", () => {
  it("la barra no se ve (Chrome, Edge, Safari y Firefox) pero la zona sigue desplazándose", () => {
    expect(zona).toContain("[scrollbar-width:none]")
    expect(zona).toContain("[&::-webkit-scrollbar]:hidden")
    expect(zona).toContain("overflow-y-auto")
    expect(zona).not.toContain("overflow-hidden")
  })
  it("la rueda sobre las respuestas mueve solo las respuestas, no la escena de atrás", () => {
    expect(zona).toContain("overscroll-contain")
  })
})
