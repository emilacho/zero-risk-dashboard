/** SIN PULSO NI AURA ANARANJADA (CC6 · 04-nov · ORDEN de Lenovo, Emilio 13:31Z: «aún veo ese pulso anaranjado por todos lados»). US$ 0 · sin red.
 *  Queda: la pantalla prendida con su animación + el agente sentado; el titileo del aviso «hay algo que revisar» (#266); y el ROJO de falla (lo decide Emilio). */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { armarEscena, type EntradaDeLaEscena, type EscenaDatos } from "@/lib/escena-avatares"
import { Avatares } from "@/components/nuevo/escena/Avatares"

const ahora = new Date("2026-11-04T13:40:00Z")
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString()
const base = (extra: Partial<EntradaDeLaEscena> = {}): EntradaDeLaEscena => ({
  despachos: [], invocaciones: [], directorio: [{ agente: "market_research_analyst", equipo: "estrategia" }], agentes: [{ name: "market_research_analyst", display_name: "Analista de mercado" }],
  clientes: [{ id: "c1", nombre: "Náufrago" }], equipos: [{ clave: "estrategia", nombre: "Estrategia", etapa: "activo" }], ahora, ...extra,
} as EntradaDeLaEscena)
const trabajando = armarEscena(base({ despachos: [{ id: "d1", agent_name: "market_research_analyst", client_id: "c1", workflow_id: "X", workflow_execution_id: "1", status: "running", running_at: hace(2), completed_at: null, created_at: hace(2) }] }))
const fallando = armarEscena(base({ invocaciones: [{ agent_name: "market_research_analyst", client_id: "c1", workflow_id: "X", workflow_execution_id: "2", status: "failed", started_at: hace(5), ended_at: hace(3), cost_usd: 0.01, step_name: null, task_text: null }] as never }))
const leer = (p: string) => readFileSync(p, "utf8")

describe("la escena: sin aura ámbar que late", () => {
  it("con un agente trabajando, su mesa NO dibuja el aura ámbar (monitor ni silla); sin nadie, tampoco la tenue", () => {
    expect(trabajando.mesas.some((m) => m.trabajando > 0)).toBe(true)
    const h = renderToStaticMarkup(createElement(Avatares, { datosIniciales: trabajando as unknown as EscenaDatos }))
    expect(h).not.toContain('data-on="ambar"'); expect(h).not.toContain('data-on="tenue"')
    expect(renderToStaticMarkup(createElement(Avatares, { datosIniciales: armarEscena(base()) as unknown as EscenaDatos }))).not.toContain('class="nv-av-luz"')
  })
  it("04-nov (Emilio 13:38Z): la mesa ya no se pinta por ningún estado, tampoco el rojo de falla (la falla va en la ✕ roja del agente)", () => {
    const h = renderToStaticMarkup(createElement(Avatares, { datosIniciales: fallando as unknown as EscenaDatos }))
    expect(h).not.toContain('class="nv-av-luz"'); expect(leer("components/nuevo/escena/Avatares.tsx")).not.toContain('className="nv-av-luz"')
  })
  it("ni la sala, ni quien habla, ni la lámpara de firma, ni los recuadros del pizarrón llevan aura o latido ámbar", () => {
    const sala = leer("components/nuevo/escena/SalaDeReuniones.tsx"), sil = leer("components/nuevo/escena/Siluetas.tsx"), foto = leer("components/nuevo/escena/EntregasEnLaFoto.tsx")
    expect(sala).not.toContain('className="nv-sala-luz"'); expect(sala).not.toMatch(/<circle[^>]*url\(#nv-av-ambar\)/); expect(sala).not.toContain('[data-luz="habla"] rect{animation:nvSalaHabla')
    expect(sil).not.toContain('className="nv-sil-halo"'); expect(sil).not.toContain('[data-habla="true"] .nv-holo{filter')
    expect(foto).not.toMatch(/className="nv-firma-luz"[^>]*url\(#nv-av-ambar\)/); expect(foto).not.toContain("animation:nvFirmaPulso")
    expect(foto).not.toMatch(/\.nv-metrica-cuadro\{[^}]*drop-shadow/)
    expect(foto).toContain("animation:nvAvisoFirma 2.4s") // el aviso de #266 SÍ titila (lo pidió Emilio)
  })
  it("los paneles: los puntos y casillas naranjas ya no laten", () => {
    expect(leer("components/nuevo/PanelAplicaciones.tsx")).toContain('.ap-cuadro[data-aviso="true"] .ap-punto{animation:none}')
    expect(leer("components/nuevo/PanelDecisiones.tsx")).toContain(".de-urge{animation:none}")
    expect(leer("components/nuevo/PanelGranIdea.tsx")).toContain(".gi-punto{animation:none}")
    expect(leer("components/nuevo/PanelOrganizacion.tsx")).toContain(".or-late{animation:none}")
    expect(leer("components/nuevo/PanelPizarron.tsx")).not.toContain("animation:pzLate")
    // anexo de CC3: el paso «en curso» del plan, el punto «trabajando» de En vivo y el «por aprobar» del Calendario tampoco laten
    for (const p of ["components/nuevo/PanelPlan.tsx", "components/nuevo/pedido/PiezasDelPedido.tsx"]) { expect(leer(p)).toContain(".nv-pl-paso-vivo{animation:none}"); expect(leer(p)).not.toContain("animation:nvPlPaso") }
    // Lenovo 13:44Z: el punto «por aprobar» del Calendario SÍ titila cuando hay algo que revisar (criterio de #266); el resto, quieto
    expect(leer("components/nuevo/PanelPizarron.tsx")).toContain('${porAprobar > 0 ? "bg-amber-400 animate-pulse" : "bg-zinc-500"}')
    for (const p of ["components/nuevo/PanelEnVivo.tsx", "components/inicio/TrabajoEnVivo.tsx", "components/nuevo/PanelDecisiones.tsx"]) expect(leer(p)).not.toMatch(/bg-amber-\d+[^"`]*animate-pulse|animate-pulse[^"`]*bg-amber/)
    // mutante vivo de CC3 (Decisiones vuelve a latir): ninguna regla usa deLate, solo queda su @keyframes
    const de = leer("components/nuevo/PanelDecisiones.tsx")
    expect(de).not.toMatch(/animation(-name)?:\s*deLate/); expect((de.match(/deLate/g) ?? []).length).toBe(1)
    const t = leer("components/nuevo/TablerosDeDireccion.tsx")
    expect(t).not.toContain("animation:nvTgPunto"); expect(t).toContain('[data-anima="urge"]{animation:none}')
  })
})
