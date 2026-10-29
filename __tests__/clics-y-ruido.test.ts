/** Clics que responden y pantallas sin descripciones (29-oct, ADENDA de Emilio). US$ 0, sin red. La prueba con navegador y sesión real la corre el empleado técnico a mano. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const RAIZ = path.join(__dirname, "..")
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), "utf8")
const PAGINAS = ["app/page.tsx", "app/piezas/page.tsx", "app/clientes/page.tsx", "app/clientes/[id]/page.tsx", "app/oficinas/page.tsx", "app/gasto/page.tsx", "app/alertas/page.tsx", "app/mapa/page.tsx"]

describe("los clics responden", () => {
  it("hay pantalla de espera: tocar algo muestra respuesta al instante", () => {
    for (const r of ["clientes", "clientes/[id]", "oficinas", "gasto", "alertas", "mapa"]) expect(fs.existsSync(path.join(RAIZ, `app/${r}/loading.tsx`)), r).toBe(true)
  })
  it("NO hay loading.tsx en la raíz ni en Piezas: con él, los enlaces que solo cambian ?id= dejaban de navegar en producción", () => {
    expect(fs.existsSync(path.join(RAIZ, "app/loading.tsx"))).toBe(false)
    expect(fs.existsSync(path.join(RAIZ, "app/piezas/loading.tsx"))).toBe(false)
  })
  it("el menú se enciende al tocar, sin esperar la pantalla nueva", () => {
    const s = leer("components/Sidebar.tsx")
    expect(s).toMatch(/onClick=\{\(\) => setTocada\(href\)\}/)
  })
  it("solo reaccionan al cursor las tarjetas que se pueden tocar (enlace o botón)", () => {
    const css = leer("app/globals.css")
    expect(css).not.toMatch(/(^|\n)\s*\.surface-card:hover\s*[{,]/)
    expect(css).toMatch(/a\.surface-card:hover/)
  })
  it("«Abrir» del Mapa lleva a LA pieza, no a la lista", () => {
    const m = leer("app/mapa/page.tsx")
    expect(m).toMatch(/\/piezas\?id=\$\{p\.hitl_queue_id\}/)
    expect(m).not.toMatch(/href="\/piezas"/)
  })
  it("en Clientes se toca la fila entera", () => {
    expect(leer("app/clientes/page.tsx")).toMatch(/<FilaClicable key=\{c\.id\} href=/)
  })
})

describe("sin descripciones ni rótulos de más", () => {
  it("ninguna pantalla pinta el «qué hace» de una oficina o estación", () => {
    for (const p of PAGINAS) expect(leer(p), p).not.toMatch(/\.que_hace/)
  })
  it("Inicio no lleva chips «Parte 0N» ni subtítulos de ayuda bajo las tarjetas", () => {
    const s = leer("app/page.tsx")
    expect(s).not.toMatch(/Parte \{/)
    expect(s).not.toMatch(/\{p\.nota\b/)
  })
  it("no quedan los párrafos explicativos que Emilio pidió quitar", () => {
    for (const [p, frase] of [
      ["app/gasto/page.tsx", "Cómo se calcula"],
      ["app/gasto/page.tsx", "Es la misma cifra que miran los vigías"],
      ["app/alertas/page.tsx", "Todavía no lee el historial"],
      ["app/clientes/page.tsx", "Una ficha por cliente"],
      ["app/mapa/page.tsx", "El recorrido de una pieza"],
      ["app/oficinas/page.tsx", "Estado real"],
    ] as const) expect(leer(p), `${p}: ${frase}`).not.toContain(frase)
  })
})
