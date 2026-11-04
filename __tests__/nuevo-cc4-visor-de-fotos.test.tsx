import { describe, expect, it, vi } from "vitest"
import { createElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { accionDeTecla, esFotoChica, miniaturaDe, siguienteEnLaTrampa, siguienteFoto } from "@/lib/visor-de-fotos"
import { fotosDeLaBarra } from "@/lib/manual-barra"

const BUCKET = "https://abc.supabase.co/storage/v1/object/public/client-social/nau"
const foto = (n: number) => ({ url: `${BUCKET}/f${n}.jpg`, que_muestra: `foto ${n}` })

describe("CC4 · barra del manual · el doble de fotos (corrección de Emilio 18:09Z)", () => {
  it("la barra toma hasta 12 fotos del cliente (antes 6); con menos, las que haya, sin relleno; lo que no es de nuestro almacén no entra", () => {
    const filas = Array.from({ length: 20 }, (_, n) => foto(n))
    expect(fotosDeLaBarra(filas)).toHaveLength(12)
    expect(fotosDeLaBarra(filas.slice(0, 5))).toHaveLength(5)
    expect(fotosDeLaBarra([])).toEqual([])
    expect(fotosDeLaBarra([foto(1), { url: "https://scontent.cdninstagram.com/b.jpg", que_muestra: null }])).toHaveLength(1)
  })
})

describe("CC4 · visor de fotos · lógica pura", () => {
  it("una original es «chica de verdad» solo si su lado mayor mide menos de 480 px; sin medidas no se avisa", () => {
    expect(esFotoChica(300, 200)).toBe(true); expect(esFotoChica(479, 100)).toBe(true)
    expect(esFotoChica(480, 100)).toBe(false); expect(esFotoChica(1000, 700)).toBe(false); expect(esFotoChica(0, 0)).toBe(false)
  })
  it("la trampa de foco: Tab da la vuelta dentro del visor, Mayús+Tab al revés, y desde fuera entra por un extremo", () => {
    expect(siguienteEnLaTrampa(0, 4, false)).toBe(1); expect(siguienteEnLaTrampa(3, 4, false)).toBe(0)
    expect(siguienteEnLaTrampa(0, 4, true)).toBe(3); expect(siguienteEnLaTrampa(2, 4, true)).toBe(1)
    expect(siguienteEnLaTrampa(-1, 4, false)).toBe(0); expect(siguienteEnLaTrampa(-1, 4, true)).toBe(3); expect(siguienteEnLaTrampa(0, 0, false)).toBe(0)
  })
  it("la miniatura pide la foto chica al almacén; una dirección ajena queda tal cual", () => {
    expect(miniaturaDe(`${BUCKET}/f1.jpg`)).toBe("https://abc.supabase.co/storage/v1/render/image/public/client-social/nau/f1.jpg?width=240&quality=70")
    expect(miniaturaDe(`${BUCKET}/f1.jpg`, 120)).toContain("width=120")
    expect(miniaturaDe("https://scontent.cdninstagram.com/b.jpg")).toBe("https://scontent.cdninstagram.com/b.jpg")
  })
  it("pasar a la siguiente da la vuelta en los dos sentidos", () => {
    expect(siguienteFoto(0, 5, 1)).toBe(1); expect(siguienteFoto(4, 5, 1)).toBe(0)
    expect(siguienteFoto(0, 5, -1)).toBe(4); expect(siguienteFoto(2, 5, -1)).toBe(1); expect(siguienteFoto(0, 0, 1)).toBe(0)
  })
  it("Esc cierra, las flechas pasan de foto y las demás teclas no hacen nada", () => {
    expect(accionDeTecla("Escape")).toBe("cerrar"); expect(accionDeTecla("ArrowRight")).toBe("siguiente"); expect(accionDeTecla("ArrowLeft")).toBe("anterior")
    expect(accionDeTecla("Enter")).toBeNull(); expect(accionDeTecla("a")).toBeNull()
  })
})

// los clics se prueban llamando a los componentes como funciones, con los hooks sin estado (no hay navegador en las pruebas)
let abierta: number | null = null
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: (v: unknown) => [typeof v === "function" ? (v as () => unknown)() : (v === null && abierta !== null ? abierta : v), (x: unknown) => { abierta = typeof x === "function" ? (x as (p: unknown) => number | null)(null) : (x as number | null) }], useEffect: () => {}, useCallback: (f: unknown) => f, useRef: () => ({ current: null }) }))
const { VisorDeFotos, FotosConVisor } = await import("@/components/nuevo/VisorDeFotos")
function buscar(n: ReactNode, ok: (e: ReactElement<Record<string, unknown>>) => boolean, sal: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(n)) n.forEach((x) => buscar(x, ok, sal))
  else if (n && typeof n === "object" && "props" in n) { const e = n as ReactElement<Record<string, unknown>>; if (ok(e)) sal.push(e); buscar(e.props.children as ReactNode, ok, sal) }
  return sal
}

describe("CC4 · visor de fotos · lo que se ve y lo que hace", () => {
  const fotos = [1, 2, 3].map((n) => ({ url: `${BUCKET}/f${n}.jpg`, texto: `foto ${n}` }))
  it("las miniaturas son botones con la foto chica; la grande NO está en la página hasta abrirla", () => {
    abierta = null
    const h = renderToStaticMarkup(createElement(FotosConVisor, { fotos }))
    expect((h.match(/data-foto="/g) ?? []).length).toBe(3)
    expect(h).toContain("/render/image/public/client-social/nau/f1.jpg?width=240"); expect(h).not.toContain("object/public/client-social/nau/f1.jpg")
    expect(h).toContain('loading="lazy"'); expect(h).not.toContain("data-visor-de-fotos")
    expect(h).toContain("Ver en grande: foto 1")
  })
  it("tocar una miniatura la abre en esa foto, a tamaño completo (la dirección original, no la chica)", () => {
    abierta = null
    const arbol = FotosConVisor({ fotos }) as ReactElement
    const botones = buscar(arbol, (e) => e.props["data-foto"] !== undefined)
    expect(botones).toHaveLength(3); ;(botones[1].props.onClick as () => void)()
    expect(abierta).toBe(1)
    const h = renderToStaticMarkup(createElement(FotosConVisor, { fotos }))
    expect(h).toContain("data-visor-de-fotos"); expect(h).toMatch(/data-visor-foto="true" src="https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/client-social\/nau\/f2\.jpg"/)
    expect(h).toContain("2 de 3")
    abierta = null
  })
  it("el visor: ✕ de 44 px, anterior y siguiente de 44 px, fondo oscuro, sobre todo (z-95); con una sola foto no hay flechas", () => {
    const h = renderToStaticMarkup(createElement(VisorDeFotos, { fotos, inicial: 0, onCerrar: () => {} }))
    expect(h).toMatch(/data-visor-cerrar[^>]*class="[^"]*h-11 w-11/); expect(h).toMatch(/data-visor-anterior[^>]*class="[^"]*h-11 w-11/); expect(h).toMatch(/data-visor-siguiente[^>]*class="[^"]*h-11 w-11/)
    expect(h).toContain("bg-black/95"); expect(h).toContain("z-[95]"); expect(h).toContain("max-h-full max-w-full"); expect(h).toContain("object-contain"); expect(h).not.toContain("data-visor-solo-chica")
    const sola = renderToStaticMarkup(createElement(VisorDeFotos, { fotos: [fotos[0]], inicial: 0, onCerrar: () => {} }))
    expect(sola).not.toContain("data-visor-anterior"); expect(sola).not.toContain("data-visor-siguiente"); expect(sola).toContain("data-visor-cerrar")
  })
  it("Esc y deslizar están cableados (captura de teclado y toque), y el cierre llama a onCerrar", () => {
    const f = readFileSync("components/nuevo/VisorDeFotos.tsx", "utf8")
    expect(f).toContain('addEventListener("keydown", tecla, true)'); expect(f).toContain("antes?.focus?.()"); expect(f).toContain('e.key === "Tab"'); expect(f).toContain("key={`${f.url}#${k}`}"); expect(f).toContain("onTouchStart"); expect(f).toContain("onTouchEnd"); expect(f).toContain("Math.abs(x1 - x0) > 50")
    let n = 0
    const arbol = VisorDeFotos({ fotos, inicial: 0, onCerrar: () => { n++ } }) as ReactElement
    const x = buscar(arbol, (e) => e.props["data-visor-cerrar"] !== undefined)[0]
    ;(x.props.onClick as () => void)(); expect(n).toBe(1)
  })
  it("la barra del manual usa el visor y ya no pinta sus fotos a mano", () => {
    const b = readFileSync("components/nuevo/manual/BarraDelManual.tsx", "utf8")
    expect(b).toContain("FotosConVisor"); expect(b).not.toMatch(/barra\.fotos\.slice\(/)
  })
})
