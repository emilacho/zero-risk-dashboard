/** El menú final (aprobado por Emilio, 29-oct): siete entradas, todas con página, y ninguna del menú viejo. US$ 0. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const RAIZ = path.join(__dirname, "..")
const sidebar = fs.readFileSync(path.join(RAIZ, "components/Sidebar.tsx"), "utf8")
const entradas = [...sidebar.matchAll(/\{ href: "([^"]+)", label: "([^"]+)", icon: \w+, hue: "(\w+)" \}/g)].map((m) => [m[1], m[2], m[3]])

describe("el menú lateral", () => {
  it("tiene exactamente las siete entradas, en este orden", () => {
    expect(entradas.map((e) => [e[0], e[1]])).toEqual([["/", "Inicio"], ["/piezas", "Piezas"], ["/clientes", "Clientes"], ["/oficinas", "Oficinas"], ["/gasto", "Gasto"], ["/alertas", "Alertas"], ["/mapa", "Mapa"]])
    expect(new Set(entradas.map((e) => e[2])).size).toBe(7) // cada sección, su propio color
  })
  it("cada entrada lleva a una página que existe", () => {
    for (const [href] of entradas) {
      const p = href === "/" ? "app/page.tsx" : `app${href}/page.tsx`
      expect(fs.existsSync(path.join(RAIZ, p)), href).toBe(true)
    }
  })
  it("no queda ninguna entrada del menú viejo", () => {
    for (const viejo of ["/dept", "/system", "/agents", "/graph", "/workflows", "/clients\"", "Atlas", "Pipeline", "CRM", "DEPARTMENTS", "SYSTEM_TABS"]) expect(sidebar, viejo).not.toContain(viejo)
  })
})
