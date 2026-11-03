import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { ESTILO_DEL_SELLO, quitarSelloDeSpline, SELECTOR_DEL_SELLO } from "@/lib/sello-spline"

// un árbol mínimo: cada nodo sabe si coincide con el selector del sello, se puede quitar y puede tener un shadow root abierto
type Nodo = { sello: boolean; quitado: boolean; remove: () => void; shadowRoot?: Raiz | null }
type Raiz = { nodos: Nodo[]; querySelectorAll: (s: string) => Nodo[] }
const nodo = (sello: boolean, shadowRoot: Raiz | null = null): Nodo => { const n: Nodo = { sello, quitado: false, remove() { n.quitado = true }, shadowRoot }; return n }
const raiz = (nodos: Nodo[]): Raiz => ({ nodos, querySelectorAll: (s) => (s === "*" ? nodos : nodos.filter((n) => n.sello && !n.quitado)) })

describe("CC4 · sello «Built with Spline» · se quita de toda la página", () => {
  it("quita los sellos de la página y también los de un shadow root abierto; deja lo demás", () => {
    const dentro = nodo(true), otro = nodo(false)
    const sombra = raiz([dentro])
    const fuera = nodo(true), anfitrion = nodo(false, sombra)
    const pagina = raiz([fuera, otro, anfitrion])
    expect(quitarSelloDeSpline(pagina)).toBe(2)
    expect(fuera.quitado).toBe(true); expect(dentro.quitado).toBe(true); expect(otro.quitado).toBe(false); expect(anfitrion.quitado).toBe(false)
  })
  it("sin sello no quita nada, y una cadena de shadow roots no se enreda (tope de profundidad)", () => {
    expect(quitarSelloDeSpline(raiz([nodo(false)]))).toBe(0)
    const a: Raiz = { nodos: [], querySelectorAll: () => [] }
    const bucle = nodo(false, a); a.nodos = [bucle]; a.querySelectorAll = (s) => (s === "*" ? [bucle] : [])
    expect(() => quitarSelloDeSpline(a)).not.toThrow()
  })
  it("el selector y el estilo cubren el enlace con id «logo» y cualquier enlace a spline.design", () => {
    for (const parte of ["a#logo", 'a[href*="spline.design"]']) { expect(SELECTOR_DEL_SELLO).toContain(parte); expect(ESTILO_DEL_SELLO).toContain(parte) }
    expect(ESTILO_DEL_SELLO).toContain("display:none!important")
  })
  it("las dos escenas (pulsos y figuras) la usan mientras están montadas, y ya no hay un barrido solo dentro del contenedor", () => {
    for (const f of ["components/nuevo/VidaSpline.tsx", "components/nuevo/escena/FigurasSpline.tsx"]) {
      const s = readFileSync(f, "utf8")
      expect(s, f).toContain("vigilarSelloDeSpline()"); expect(s, f).toContain("ESTILO_DEL_SELLO")
    }
    expect(readFileSync("components/nuevo/VidaSpline.tsx", "utf8")).not.toContain("new MutationObserver")
  })
})
