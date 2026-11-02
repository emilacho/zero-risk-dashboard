/** Dashboard nuevo · CC6 · 02-nov · retrato inventado, rótulo de la sala al pasar el cursor y «Qué cambió» plegable sin versiones a la vista. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync, readFileSync } from "node:fs"
import { HologramaBusto, HologramaFigura } from "@/components/nuevo/escena/Holograma"
import { descripcionDelHolograma, rasgosDelHolograma } from "@/lib/holograma"
import { ESTILO_SALA } from "@/components/nuevo/escena/SalaDeReuniones"
import { lineasDeQueCambio } from "@/components/nuevo/PanelPlan"

describe("el retrato de la ficha es el holograma de la escena (ADENDA 3 de Lenovo, 02-nov)", () => {
  it("la ficha usa el busto holográfico con la misma semilla que la silueta; el retrato caricatura ya no existe", () => {
    const ficha = readFileSync("components/nuevo/escena/FichaDelEmpleado.tsx", "utf8")
    expect(ficha).toContain("<HologramaBusto semilla={agente} color={color} />")
    expect(ficha).not.toContain("RetratoInventado")
    expect(existsSync("components/nuevo/escena/RetratoInventado.tsx")).toBe(false)
    expect(readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")).toContain("<HologramaFigura semilla={s.agente}")
  })
  it("mismo personaje: la ficha y la escena leen los mismos rasgos aunque el nombre llegue con guion bajo; estable y sin fotos ni letras", () => {
    expect(rasgosDelHolograma("brand_strategist")).toEqual(rasgosDelHolograma("brand-strategist"))
    const busto = renderToStaticMarkup(createElement(HologramaBusto, { semilla: "growth-hacker", color: "#e8731a" }))
    expect(busto).toContain('data-holograma-busto="growth-hacker"')
    expect(busto).toBe(renderToStaticMarkup(createElement(HologramaBusto, { semilla: "growth-hacker", color: "#e8731a" })))
    expect(busto).not.toMatch(/<image|https?:\/\/|<text/)
    const r = rasgosDelHolograma("growth-hacker")
    const figura = renderToStaticMarkup(createElement("svg", null, createElement(HologramaFigura, { semilla: "growth_hacker", color: "#e8731a", postura: "de_pie" })))
    expect(figura).toContain(`data-cabello="${r.cabello}"`); expect(figura).toContain(`data-accesorio="${r.accesorio}"`); expect(figura).toContain(`data-ropa="${r.ropa}"`)
    expect(descripcionDelHolograma("growth-hacker")).toMatch(/\S/)
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
