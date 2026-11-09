/** LA ANTENA CON SU NÚMERO (Emilio 06-nov 01:51 local: «el número no necesita fondo… el resto aprobado»). US$ 0 · sin red. */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { AntenaDeAlertas, ListaDeLasAlertas, PanelDeLasAlertas, alTocarElAviso, escucharEsc } from "@/components/nuevo/escena/AntenaDeAlertas"
import { isValidElement, type ReactElement, type ReactNode } from "react"
import { ANTENA, type AlertaDeLaAntena } from "@/lib/escena-alertas"

const AHORA = Date.parse("2026-11-06T10:00:00Z")
const A = (clave: string, abre: AlertaDeLaAntena["abre"], horas: number): AlertaDeLaAntena => ({ clave, tipo: "fallida", texto: `aviso ${clave}`, cuando: new Date(AHORA - horas * 3_600_000).toISOString(), abre })
const antena = (alertas: AlertaDeLaAntena[] | undefined) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas, onAbrir: () => {} })))

describe("el número de la antena", () => {
  it("🔴 con avisos: el número rojo, solo, sin círculo ni fondo detrás, arriba a la derecha de la luz", () => {
    const h = antena([A("a", "envivo", 1), A("b", null, 2), A("c", "decisiones", 3)])
    const t = h.match(/<text data-numero-antena[^>]*>([^<]*)<\/text>/)
    expect(t?.[1]).toBe("3")
    expect(t?.[0]).toContain('class="fill-alarma font-medio"')
    expect(t?.[0]).toContain(`x="${ANTENA.punta2.x + 30}"`); expect(t?.[0]).toContain(`y="${ANTENA.punta2.y - 26}"`)
    const c = readFileSync("components/nuevo/escena/AntenaDeAlertas.tsx", "utf8")
    const cerca = c.split("data-numero-antena")[0].split("\n").slice(-3).join("\n") + c.split("data-numero-antena")[1].split("\n")[0]
    expect(cerca).not.toMatch(/<circle|<rect|<ellipse|paint-order|stroke=/) // nada detrás ni alrededor del número
  })
  it("🔴 sin avisos: ni número ni luz", () => {
    for (const h of [antena([]), antena(undefined)]) { expect(h).not.toContain("data-numero-antena"); expect(h).not.toContain("nvAntRojo"); expect(h).toContain("data-luces-apagadas") } // 09-nov: ya no es un svg vacío; tapa las luces de la foto
  })
})

describe("la lista al tocarla, en estilo base", () => {
  it("🔴 09-nov · boceto aprobado: ALERTAS y el número en una sola línea (recuadro chico de borde rojo), la ✕ a la derecha; sin «Dept. Marketing» ni el recuadro grande; cada aviso con su punto, cuándo y qué abre", () => {
    const h = renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [A("a", "envivo", 1), A("b", "observabilidad", 48), A("c", null, 5)], onAbrir: () => {}, onCerrar: () => {}, ahora: AHORA }))
    expect(h).toMatch(/data-estilo="base"[\s\S]*<header[^>]*><div class="col-start-2 flex items-center justify-center gap-3"><h2 [^>]*text-oro">Alertas<\/h2><span data-numero="true" aria-label="3 avisos abiertos" class="[^"]*border-linea-alarma text-alarma"[^>]*>3<\/span><\/div><button[^>]*data-cerrar/)
    expect(h).not.toContain("Dept."); expect(h).not.toContain("Marketing"); expect(h).not.toContain("data-recuadro-alertas"); expect(h).not.toContain("Avisos abiertos<")
    expect(h).toMatch(/max-w-\[min\(720px,100%\)\] sm:w-auto sm:min-w-\[540px\]/) // CC6 🟡 525aaa1: el panel del tamaño de la imagen aprobada
    expect(h).toMatch(/<span class="block text-titulo text-hueso">[^<]+<\/span><span data-cuando="true" class="mt-1 block text-cuerpo text-gris">/) // el aviso es lo principal: 20 hueso y debajo 15 gris
    expect(h).toMatch(/grid-cols-\[20px_1fr_auto\] items-center gap-3 py-5/); expect(h).toContain('class="text-titulo text-gris">›</span>') // con aire
    expect(h).toMatch(/<h2 [^>]*text-cuerpo[^>]*>Alertas<\/h2>/) // el título queda más chico que el aviso
    expect(h).toContain(">Hace una hora · abre En vivo<"); expect(h).toContain(">Hace 2 días · abre Observabilidad<")
    expect(h).toContain(">Hace 5 horas<") // sin lugar: no dice «abre» y el botón queda quieto
    expect(h).toContain('class="inline-flex h-6 min-w-9 items-center justify-center rounded-control border px-2 text-cuerpo leading-none font-medio tabular-nums border-linea-alarma text-alarma">3</span>') // CC6: el número en un recuadro más ancho que alto, de buen tamaño, como el aprobado
    expect(h).toContain('<span aria-hidden="true" class="h-2 w-2 rounded-full bg-alarma"></span>') // el punto de 8 px (CC6: vivía en 7)
    expect((h.match(/rounded-full bg-alarma/g) ?? []).length).toBe(3)
    expect((h.match(/<button type="button" disabled=""/g) ?? []).length).toBe(1)
  })
  it("🔴 sin avisos: «Todo en orden», número sin rojo", () => {
    const h = renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [], onAbrir: () => {}, onCerrar: () => {} }))
    expect(h).toContain(">Todo en orden<"); expect(h).not.toContain("text-alarma"); expect(h).not.toContain("border-linea-alarma"); expect(h).toMatch(/data-numero="true" aria-label="0 avisos abiertos"[^>]*>0</)
    expect(renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [A("a", "envivo", 1)], onAbrir: () => {}, onCerrar: () => {}, ahora: AHORA }))).not.toContain("Todo en orden")
  })
  it("🔴 se abre encima con su propio panel y sigues en Dept. Marketing (no en el marco viejo del pizarrón); Esc lo cierra", () => {
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain('{panelTablero?.tipo === "antena" && <PanelDeLasAlertas alertas={datos?.alertas} onCerrar={() => setPanelTablero(null)} ') // menor CC6 #296: la ✕ y Esc cierran de verdad
    expect(av).toContain('{panelTablero && panelTablero.tipo !== "antena" && (')
    const c = readFileSync("components/nuevo/escena/AntenaDeAlertas.tsx", "utf8")
    expect(c).toContain('if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar()') // en escucharEsc
  })
  it("🔴 CC6 · el clic: tocar un aviso con lugar cierra la lista y abre ese lugar; sin lugar, nada; la ✕ cierra", () => {
    // se recorre lo que dibuja la lista (sin navegador) y se aprietan sus botones de verdad
    const botones = (n: ReactNode, out: ReactElement<{ onClick?: () => void; disabled?: boolean; "data-cerrar"?: boolean }>[] = []) => {
      if (Array.isArray(n)) n.forEach((x) => botones(x, out))
      else if (isValidElement(n)) { const el = n as ReactElement<{ children?: ReactNode; onClick?: () => void }>; if (el.type === "button") out.push(el as never); botones(el.props.children, out) }
      return out
    }
    const tocados: AlertaDeLaAntena[] = [], cerrar = vi.fn()
    const avisos = [A("a", "envivo", 1), A("c", null, 5)]
    const el = ListaDeLasAlertas({ alertas: avisos, onAbrir: (a) => tocados.push(a), onCerrar: cerrar, ahora: AHORA }) as ReactElement<{ onCerrar: () => void; children: ReactNode }>
    expect(el.props.onCerrar).toBe(cerrar) // la ✕ del panel base llama a cerrar
    el.props.onCerrar(); expect(cerrar).toHaveBeenCalledTimes(1)
    const b = botones(el.props.children)
    expect(b).toHaveLength(2); expect(b[1].props.disabled).toBe(true)
    b[0].props.onClick!(); expect(tocados.map((x) => x.clave)).toEqual(["a"])
    // y lo que hace la oficina con ese toque
    const pasos: string[] = []
    expect(alTocarElAviso(avisos[0], { cerrar: () => pasos.push("cerrar"), abrir: (p) => pasos.push(`abrir:${p}`) })).toBe(true)
    expect(pasos).toEqual(["cerrar", "abrir:envivo"])
    expect(alTocarElAviso(avisos[1], { cerrar: () => pasos.push("x"), abrir: () => pasos.push("y") })).toBe(false); expect(pasos).toHaveLength(2)
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toContain("onAbrir={(a) => alTocarElAviso(a, { cerrar: () => setPanelTablero(null), abrir: (panel) => window.dispatchEvent(new CustomEvent<PedidoDePanel>(EVENTO_ABRIR_PANEL, { detail: { panel } })) })}")
    expect(PanelDeLasAlertas).toBeTypeOf("function")
  })
  it("🔴 CC6 · Esc cierra solo la lista (no llega a la oficina) y se suelta al cerrarla", () => {
    const oyentes = new Map<string, { f: (e: KeyboardEvent) => void; captura: unknown }>()
    const w = { addEventListener: (t: string, f: unknown, c: unknown) => oyentes.set(t, { f: f as never, captura: c }), removeEventListener: (t: string, f: unknown) => { if (oyentes.get(t)?.f === f) oyentes.delete(t) } }
    const cerrar = vi.fn(), soltar = escucharEsc(w as never, cerrar)
    expect(oyentes.get("keydown")?.captura).toBe(true)
    const e = { key: "Escape", stopPropagation: vi.fn(), preventDefault: vi.fn() }
    oyentes.get("keydown")!.f(e as never); expect(cerrar).toHaveBeenCalledTimes(1); expect(e.stopPropagation).toHaveBeenCalled()
    oyentes.get("keydown")!.f({ key: "a", stopPropagation: vi.fn(), preventDefault: vi.fn() } as never); expect(cerrar).toHaveBeenCalledTimes(1)
    soltar(); expect(oyentes.has("keydown")).toBe(false)
    expect(readFileSync("components/nuevo/escena/AntenaDeAlertas.tsx", "utf8")).toContain("useEffect(() => escucharEsc(window, onCerrar), [onCerrar])")
  })
  it("sin avisos de dinero en la antena (firmado)", () => {
    expect(readFileSync("lib/escena-alertas.ts", "utf8")).toContain("export const GASTO_RARO_EN_LA_ANTENA = false")
  })
})

describe("09-nov · el título con algo al lado es solo para quien lo pide", () => {
  it("sin «junto», la cabecera de los demás paneles no cambia", () => {
    const e = readFileSync("components/nuevo/EstiloBase.tsx", "utf8")
    expect(e).toContain('        : <h2 id={id} className="col-start-2 text-center text-titulo font-medio uppercase tracking-titulo text-oro">{titulo}</h2>}')
  })
})

describe("09-nov · regla de Emilio: la luz de la antena solo se prende cuando hay una alerta", () => {
  const pinta = (alertas: AlertaDeLaAntena[] | undefined) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas, onAbrir: () => {} })))
  it("sin avisos: las tres luces de la foto (las dos puntas y el centro del plato) quedan tapadas por una bombilla apagada; sin rojo y sin número", () => {
    for (const h of [pinta([]), pinta(undefined)]) {
      expect(h).toContain("data-luces-apagadas")
      expect([...h.matchAll(/data-luz-apagada="([^"]+)"/g)].map((m) => m[1])).toEqual(["mayor", "menor", "plato"])
      expect(h).toContain('<circle cx="505" cy="257" r="20" fill="url(#nvAntApaga-mayor)"></circle><circle cx="505" cy="257" r="3.2" fill="#24221f"></circle>')
      expect(h).toContain('<circle cx="369" cy="342" r="15" fill="url(#nvAntApaga-menor)"></circle><circle cx="369" cy="342" r="3.2" fill="#24221f"></circle>')
      expect(h).toContain('<circle cx="446" cy="338" r="9" fill="url(#nvAntApaga-plato)"></circle><circle cx="446" cy="338" r="3.2" fill="#24221f"></circle>')
      expect(h).toMatch(/id="nvAntApaga-mayor"[^>]*><stop offset="0" stop-color="#070605"><\/stop><stop offset="\.55" stop-color="#070605" stop-opacity="\.92"><\/stop><stop offset="1" stop-color="#070605" stop-opacity="0">/)
      expect(h).toContain('id="nvAntApaga-plato" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#423f3c">')
      expect(h).not.toContain("nvAntRojo"); expect(h).not.toContain("nv-antena-pulso"); expect(h).not.toContain("data-numero-antena"); expect(h).not.toContain("#ff3b2a")
    }
  })
  it("con un aviso: las luces de la foto siguen apagadas debajo y solo la punta mayor se prende en rojo, con su número", () => {
    const h = pinta([A("a", "envivo", 1)])
    expect(h).toMatch(/<g class="nv-antena" data-alertas="1">[\s\S]*?<g data-luces-apagadas[\s\S]*data-luz-apagada="plato"[\s\S]*nv-antena-pulso/)
    expect(h).toContain("data-numero-antena")
  })
})
