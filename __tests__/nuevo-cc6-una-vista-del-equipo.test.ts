/** UNA SOLA VISTA DEL EQUIPO (CC6 · 03-nov · sprint dashboard · auditoría punto 15): Centro de campaña › Equipo abre el Squad Hub de la escena (de CC4). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EVENTO_ABRIR_PLANTEL } from "@/lib/buscador"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"

describe("Centro de campaña › Equipo = el Squad Hub", () => {
  it("la tarjeta Equipo sigue en el Centro, pero ya no abre una vista propia: cierra el Centro y pide el Squad Hub con el cliente del centro", () => {
    const p = readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")
    expect(p).not.toMatch(/PanelEquipo/)
    expect(p).toContain('onClick={() => (a.clave === "equipo" ? abrirElSquadHub() : setVista(a.clave))}')
    expect(p).toMatch(/const abrirElSquadHub = useCallback\(\(\) => \{\s*onCerrar\(\)\s*window\.dispatchEvent\(new CustomEvent<PedidoDePlantel>\(EVENTO_ABRIR_PLANTEL, \{ detail: \{ cliente: datos\?\.cliente\?\.id \?\? cliente \?\? null \} \}\)\)/)
    const h = renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {} }))
    expect(h).toContain('data-aplicacion="equipo"')
  })
  it("la escena de Marketing escucha el pedido y abre su plantel (Squad Hub) en la mesa pedida o la primera con gente; la ficha es la del Squad Hub", () => {
    const a = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(EVENTO_ABRIR_PLANTEL).toBe("nv:abrir-plantel")
    expect(a).toContain("window.addEventListener(EVENTO_ABRIR_PLANTEL, alPedir)")
    expect(a).toMatch(/const elegida = \(mesa && ms\.find\(\(m\) => m\.clave === mesa\)\) \|\| ms\.find\(\(m\) => m\.equipo\.length > 0\) \|\| ms\[0\]/)
    expect(a).toMatch(/if \(elegida\) \{ setAgenteDelPlantel\(null\); setMesaAbierta\(elegida\.clave\) \}/)
    expect(a).toContain("onFicha={(a) => { cerrarPlantel(); setFichaDe(a) }}") // la única ficha: FichaDelEmpleado, la del Squad Hub
  })
  it("ningún otro panel de /nuevo abre la vista vieja del equipo", () => {
    for (const f of ["components/nuevo/EscenaViva.tsx", "components/nuevo/PanelAplicaciones.tsx", "components/nuevo/MarcoNuevo.tsx", "components/nuevo/Buscador.tsx"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/<PanelEquipo/)
  })
})
