import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { DE_PIE, LUGARES, decidirMovimiento, duracionDelRecorrido, largoDeLaRuta, puntoEnLaRuta, rutaPorLasLineas } from "@/lib/escena-movimiento"
import { U, V, MESAS } from "@/lib/escena-avatares"
import { SALA, SILLAS_DE_LA_SALA } from "@/lib/escena-sala"

const pos = { x: 1325, y: 671 }
const puesto = { s: {} as never, pos, postura: "sentado" as const }

describe("sprint 2 · caminar a la sala de reuniones y volver", () => {
  it("la ruta va de A a B por las líneas de luz del piso (ejes isométricos), nunca en diagonal por el aire", () => {
    for (const m of MESAS) {
      const r = rutaPorLasLineas(m.silla, LUGARES.sala)
      expect(r[0]).toEqual(m.silla); expect(r[r.length - 1]).toEqual(LUGARES.sala)
      for (let i = 1; i < r.length; i++) {
        const dx = r[i].x - r[i - 1].x, dy = r[i].y - r[i - 1].y
        const sobreU = Math.abs(dy * U.x - dx * U.y) < 2, sobreV = Math.abs(dy * V.x - dx * V.y) < 2 // paralelo a un eje
        expect(sobreU || sobreV).toBe(true)
      }
    }
  })
  it("el punto del recorrido empieza en A, termina en B y avanza con la fracción; la duración es pausada (0,8–4 s)", () => {
    const r = rutaPorLasLineas(pos, LUGARES.sala)
    expect(puntoEnLaRuta(r, 0)).toEqual(r[0]); expect(puntoEnLaRuta(r, 1)).toEqual(r[r.length - 1])
    const mitad = puntoEnLaRuta(r, 0.5); expect(Math.hypot(mitad.x - pos.x, mitad.y - pos.y)).toBeGreaterThan(0)
    expect(largoDeLaRuta(r)).toBeGreaterThan(0)
    const d = duracionDelRecorrido(r); expect(d).toBeGreaterThanOrEqual(800); expect(d).toBeLessThanOrEqual(4000)
  })
  it("la entrada de la sala está en el piso frente a su vidrio, fuera de las sillas y de la mesa de la reunión", () => {
    for (const s of SILLAS_DE_LA_SALA) expect(Math.hypot(s.x - LUGARES.sala.x, s.y - LUGARES.sala.y)).toBeGreaterThan(60)
    expect(Math.hypot(SALA.mesa.x - LUGARES.sala.x, SALA.mesa.y - LUGARES.sala.y)).toBeGreaterThan(100)
  })
  it("cada movimiento sale de una diferencia real entre lo que se veía y lo que dicen los datos", () => {
    const visto = { pos, postura: "sentado" as const }
    expect(decidirMovimiento(undefined, puesto, { enLaSala: false, veniaDeLaSala: false }).tipo).toBe("aparece")
    expect(decidirMovimiento(undefined, puesto, { enLaSala: false, veniaDeLaSala: true }).tipo).toBe("llega_de_la_sala") // la reunión terminó: sale de la entrada y vuelve
    expect(decidirMovimiento(visto, puesto, { enLaSala: false, veniaDeLaSala: false }).tipo).toBe("queda")
    expect(decidirMovimiento(visto, undefined, { enLaSala: true, veniaDeLaSala: false }).tipo).toBe("va_a_la_sala") // la reunión real lo sentó en la sala
    expect(decidirMovimiento(visto, undefined, { enLaSala: false, veniaDeLaSala: false }).tipo).toBe("se_va") // dejó de trabajar sin reunión: se desvanece
    expect(decidirMovimiento(undefined, undefined, { enLaSala: true, veniaDeLaSala: false }).tipo).toBe("queda") // ya estaba en la sala al abrir: lo dibuja la sala
    expect(DE_PIE.length).toBe(3)
  })
  it("el componente no dibuja ninguna reunión (es de CC6) ni adelanta los sprints 3 y 4 (pizarrón, puerta, clic)", () => {
    const f = readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")
    expect(f).toContain("LUGARES.sala"); expect(f).toContain("prefers-reduced-motion")
    for (const x of ["SalaDeReuniones", "PanelDelAgente", "pizarron", "esperaFirma", "entregas"]) expect(f, x).not.toContain(x)
  })
})

describe("la sala con siluetas holográficas (reasignada a CC4, 02-nov)", () => {
  it("la puerta, el interior y el piso de afuera están ordenados y el camino entra por la puerta y rodea la mesa hasta cada silla", async () => {
    const { rutaDeLaPuertaALaSilla, rutaDeLaSillaALaPuerta } = await import("@/lib/escena-movimiento")
    for (const s of SILLAS_DE_LA_SALA) {
      const r = rutaDeLaPuertaALaSilla(s)
      expect(r[0]).toEqual(LUGARES.sala); expect(r[r.length - 1]).toEqual(s)
      expect(r.some((p) => Math.hypot(p.x - LUGARES.puerta.x, p.y - LUGARES.puerta.y) < 3)).toBe(true) // pasa por la puerta
      expect(rutaDeLaSillaALaPuerta(s)[0]).toEqual(s)
    }
  })
  it("los participantes ya no son círculos con iniciales ni hay texto sin estilo: el globo es una tarjeta SVG con nuestro estilo", () => {
    const sala = readFileSync("components/nuevo/escena/SalaDeReuniones.tsx", "utf8")
    expect(sala).not.toContain('className="nv-sala-aro"'); expect(sala).toContain("GloboEnLaFoto")
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).not.toContain("toca su avatar")
  })
  it("respeta «reducir movimiento»", () => { expect(readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")).toContain("(prefers-reduced-motion: reduce)") })
})
