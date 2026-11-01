/**
 * DASHBOARD NUEVO · SPRINT 6.23 (1-nov): REGLA de Emilio para todo /nuevo — «nada de avisos de gasto en botones ni pantallas; el gasto se ve en Dinero (y en
 * el panel de gastos de cada oficina, después)» — y la pantalla DINERO con los saldos de proveedores y el freno de gasto que salieron de Riesgos.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync, readdirSync } from "node:fs"
import { normalizarRiesgos } from "@/lib/direccion-riesgos"
import { colorDelMedidor, resumenDeDinero } from "@/lib/direccion-dinero"
import { cuerpoDeRehacer, alcanceDeLosCambios } from "@/lib/bandeja"
import { PanelDinero } from "@/components/nuevo/PanelDinero"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { TableroDeDireccionVivo } from "@/components/nuevo/TablerosDeDireccion"

const CRUDO = {
  ok: true, completo: true, total: 0, riesgos: [],
  saldos: [{ proveedor: "Apify", plan: "STARTER", usado_usd: 14.774, credito_usd: 29, pct: 50.9, ciclo_hasta: "2026-11-24T23:59:59.999Z" }],
  topes: [{ client_id: "n", cliente: "Náufrago", gastado_24h_usd: 2.62, techo_usd: 20, pct: 13.1 }, { client_id: "z", cliente: "Zero Risk Seguridad Industrial", gastado_24h_usd: 0.23, techo_usd: 8, pct: 2.9 }],
  fuentes: [], sin_fuente: [{ que: "saldo de Anthropic y demás proveedores", motivo: "solo Apify" }],
}

describe("6.23 · REGLA · nada de avisos de gasto en botones ni pantallas de /nuevo", () => {
  // el panel del plan es de CC6 (lo corrige en su cola); el resto de los paneles ya no avisa gasto
  const PANELES = readdirSync("components/nuevo").filter((f) => /^Panel.*\.tsx$/.test(f) && f !== "PanelPlan.tsx" && f !== "PanelDinero.tsx")
  it.each(PANELES)("%s no muestra costos, topes ni «vuelve a gastar»", (f) => {
    const s = readFileSync(`components/nuevo/${f}`, "utf8")
    expect(s).not.toMatch(/data-casilla="gasto"|vuelve a gastar|Entiendo que .* gasta|costó \{|usdES\(|usdFinoES\(|data-costo|Sin costo ·/)
  })
  it("rehacer una pieza es un clic: el cuerpo sigue diciendo confirmo_gasto (la plataforma cuida el tope), sin preguntarle a Emilio", () => {
    expect(cuerpoDeRehacer("e1", "")).toEqual({ encargo_id: "e1", confirmo_gasto: true })
    expect(alcanceDeLosCambios([1, 3])).toBe("Láminas 1, 3")
    expect(readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")).toContain('disabled={enviando} className={B_AMBAR}>{enviando ? "Enviando…" : "Rehacer la pieza"}')
  })
  it("la pantalla Dinero ya no promete un «presupuesto del mes» que no existe", () => {
    expect(readFileSync("components/nuevo/TablerosDeDireccion.tsx", "utf8")).not.toContain("<Nota x={50} y={150}>presupuesto del mes</Nota>")
  })
})

describe("6.23 · Dinero", () => {
  const d = normalizarRiesgos(CRUDO)
  it("el resumen elige la medida más cerca de su límite", () => {
    expect(resumenDeDinero(d).mayor).toEqual({ que: "Apify", tipo: "saldo", pct: 50.9 })
    expect(resumenDeDinero({ saldos: [], topes: [] }).mayor).toBeNull()
    expect(colorDelMedidor(90)).toBe("#ff5a36"); expect(colorDelMedidor(65)).toBe("#f5a524"); expect(colorDelMedidor(10)).toBe("#e8731a")
  })
  it("la pantalla 4 muestra esa medida; sin lectura, el dibujo del boceto", () => {
    const html = (dinero: ReturnType<typeof resumenDeDinero> | null) => renderToStaticMarkup(createElement("svg", null, createElement(TableroDeDireccionVivo, { tablero: "dinero", titulo: ["DINERO"], quieto: true, dinero })))
    expect(html(resumenDeDinero(d)).replace(/<!-- -->/g, "")).toMatch(/data-mayor[^>]*>Apify 51 %</)
    expect(html(null)).toContain('data-dinero="sin-lectura"'); expect(html(null)).not.toContain("data-mayor")
  })
  it("la pantalla 4 se abre al tocarla", () => {
    expect(renderToStaticMarkup(createElement(PantallasDelArco, { alAbrirDinero: () => {} }))).toMatch(/data-id="arco-4"[^>]*data-abre="dinero"[^>]*aria-label="Abrir el dinero"/)
  })
  it("el panel muestra los saldos (anillo), el freno por cliente con su techo y la fuente del techo; lo que no hay, «sin dato»", () => {
    const h = renderToStaticMarkup(createElement(PanelDinero, { onCerrar: () => {}, datosIniciales: d }))
    expect(h).toContain('data-seccion="dinero"'); expect(h).toContain("nv-panel")
    expect(h).toContain('data-saldo="Apify"'); expect(h).toContain("US$ 14.77 de US$ 29.00"); expect(h).toContain("Quedan US$ 14.23"); expect(h).toContain("24 de noviembre")
    expect(h).toContain('data-freno="Náufrago"'); expect(h).toContain("US$ 2.62 gastado en 24 h · techo US$ 20.00")
    expect(h).toContain("el de su ficha o, si no tiene, el general de arranque")
    expect(h).toContain("saldo de Anthropic y demás proveedores"); expect(h).toContain("presupuesto del mes")
  })
  it("es solo lectura", () => {
    const s = readFileSync("components/nuevo/PanelDinero.tsx", "utf8")
    expect(s).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/); expect(s).not.toContain("href=")
  })
})
