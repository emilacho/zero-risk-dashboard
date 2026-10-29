/** LENGUAJE DE NEGOCIO (correcciones D1–D6, 29-oct): ningún código interno sale en pantalla. US$ 0, sin red. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { diaCorto, estadoDeCampanaLegible, estadoDeLaPiezaLegible, estadoDelClienteLegible, familiaLegible, pilarLegible, resultadoDeJefaturaLegible, revisionDeFidelidadLegible, tipoDeRevisionLegible, tituloDePieza, usdES, usdFinoES } from "@/lib/lenguaje"

const PROHIBIDOS = /BRF-\d|carrusel_mesa|post_img|editor_escalation|content-creator|sin_firma|paso_la_vara|consulta_entrante|incompleta_por_tope|OFICINA_SIN_MOLDE|confirm_competitor_list|content_piece_review|\bNO GLYPH\b/

describe("dinero y fechas", () => {
  it("coma decimal y punto de miles", () => {
    expect(usdES(1.73)).toBe("US$ 1,73")
    expect(usdES(1234.5)).toBe("US$ 1.234,50")
    expect(usdES(null)).toBe("—")
    expect(usdFinoES(0.0042)).toBe("US$ 0,0042")
  })
  it("el día se dice en hora de Ecuador", () => {
    expect(diaCorto("2026-10-29T03:00:00Z")).toBe("28 oct")
  })
})

describe("las traducciones nunca devuelven el código", () => {
  it("títulos, estados y resultados", () => {
    expect(tituloDePieza({ familia: "carrusel_mesa", tituloCrudo: "BRF-0002 carrusel facebook v3", cliente: "Zero Risk Seguridad Industrial", creada: "2026-10-29T15:00:00Z" })).toBe("Carrusel Facebook · Zero Risk Seguridad Industrial · 29 oct")
    for (const x of [familiaLegible("carrusel_mesa"), familiaLegible("post_img"), tipoDeRevisionLegible("editor_escalation"), tipoDeRevisionLegible("lo_que_sea"), estadoDelClienteLegible("onboarding"), estadoDelClienteLegible("raro"), resultadoDeJefaturaLegible("incompleta_por_tope"), revisionDeFidelidadLegible("paso_la_vara"), revisionDeFidelidadLegible("otro_codigo"), pilarLegible("consulta_entrante"), estadoDeCampanaLegible("rarisimo"), estadoDeLaPiezaLegible("cerrado_ok")]) {
      expect(x).not.toMatch(PROHIBIDOS)
      expect(x).not.toMatch(/_/)
    }
    expect(estadoDelClienteLegible("onboarding")).toBe("Cliente nuevo, en preparación")
    expect(pilarLegible("consulta_entrante")).toBe("consultas entrantes")
  })
})

describe("las pantallas no muestran valores crudos", () => {
  const leer = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8")
  const PANTALLAS = ["app/page.tsx", "app/piezas/page.tsx", "app/piezas/VisorDePieza.tsx", "app/oficinas/page.tsx", "app/clientes/page.tsx", "app/clientes/[id]/page.tsx", "app/gasto/page.tsx", "app/mapa/page.tsx", "lib/oficinas-datos.ts", "lib/oficinas-frases.ts", "lib/mapa-datos.ts", "lib/inicio-datos.ts", "lib/clientes-datos.ts"]
  it("ninguna escribe un código interno ni «guion bajo → espacio» sobre un valor de la base", () => {
    for (const p of PANTALLAS) {
      const t = leer(p).split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.includes(".from(") && !l.includes(".select(")).join("\n")
      expect(t, p).not.toMatch(/BRF-\d|carrusel_mesa|post_img|OFICINA_SIN_MOLDE|Familias activas|Último turno fallido/)
      expect(t, p).not.toMatch(/\.replace(All)?\((\/_\/g|"_")/)
    }
  })
})
