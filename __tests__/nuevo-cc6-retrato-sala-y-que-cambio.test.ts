/** Dashboard nuevo · CC6 · 02-nov · retrato inventado, rótulo de la sala al pasar el cursor y «Qué cambió» plegable sin versiones a la vista. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { rasgosDelRetrato, RetratoInventado } from "@/components/nuevo/escena/RetratoInventado"
import { ESTILO_SALA } from "@/components/nuevo/escena/SalaDeReuniones"
import { lineasDeQueCambio } from "@/components/nuevo/PanelPlan"

describe("el retrato inventado", () => {
  it("es estable por empleado, distinto entre empleados, con su toque robótico, y no lleva fotos ni iniciales", () => {
    expect(rasgosDelRetrato("growth-hacker")).toEqual(rasgosDelRetrato("growth-hacker"))
    const varios = ["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => JSON.stringify(rasgosDelRetrato(`empleado-${x}`)))
    expect(new Set(varios).size).toBeGreaterThan(6)
    const svg = renderToStaticMarkup(createElement(RetratoInventado, { semilla: "growth-hacker", color: "#e8731a" }))
    expect(svg).toContain('data-retrato="growth-hacker"')
    expect(svg).toMatch(/-lente\)/) // la lente ámbar
    expect(svg).not.toMatch(/<image|https?:\/\//) // nada de fotos ni caras de afuera
    expect(svg).not.toContain("<text")
  })
})

describe("la sala de reuniones: el rótulo aparece al pasar el cursor, como los equipos", () => {
  it("escondido por defecto; visible al pasar, con foco, con la reunión en curso o con el panel abierto", () => {
    expect(ESTILO_SALA).toMatch(/\.nv-sala-rotulo\{[^}]*opacity:0/)
    expect(ESTILO_SALA).toContain('.nv-sala:hover .nv-sala-rotulo')
    expect(ESTILO_SALA).toContain('.nv-sala[data-sala="en_curso"] .nv-sala-rotulo')
    expect(readFileSync("components/nuevo/escena/SalaDeReuniones.tsx", "utf8")).toContain('className="nv-sala-zona"')
  })
})

describe("«Qué cambió» resumido y sin versiones a la vista", () => {
  it("las líneas sin viñetas ni rayas; el panel ya no muestra «versión …» ni «caracteres» junto al plan", () => {
    expect(lineasDeQueCambio("- uno\n2. dos\n\n---\n* tres")).toEqual(["uno", "dos", "tres"])
    const fuente = readFileSync("components/nuevo/PanelPlan.tsx", "utf8")
    expect(fuente).not.toMatch(/caracteres` : ""\}/)
    expect(fuente).toContain("<QueCambio texto={queCambio} />")
  })
})
