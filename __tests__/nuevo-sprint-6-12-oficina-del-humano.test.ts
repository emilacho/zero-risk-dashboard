/**
 * DASHBOARD NUEVO · SPRINT 6.12 (Emilio, 1-nov): «el monolito central va a ser la oficina del humano; al darle clic, igual que el Dept. Marketing, se expande la oficina;
 * crea una imagen con el mismo estilo pero que parezca un centro de comando, algo como una nave espacial moderna con pantallas, sin perder el estilo sencillo y sofisticado».
 *  · el monolito es la zona «Tu oficina» (/nuevo/oficina) y se proyecta con la MISMA mecánica que el departamento (crece desde el monolito, miniatura, Esc/atrás).
 *  · la imagen `oficina-2560.jpg` (+ 1280) existe y es liviana; su encaje (`SALA_EN_LA_OFICINA`) está medido.
 *  · el Cerebro no se pierde: es el arco de pantallas DENTRO de tu oficina (`PANTALLAS`): luz suave + rótulo al pasar el ratón; el clic abre el explorador encima
 *    sin cambiar la dirección (como el Centro de campaña dentro de marketing). La dirección directa /nuevo/cerebro sigue existiendo.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync, readFileSync, statSync } from "node:fs"
import { EscenaNuevo, ZONAS } from "@/components/nuevo/EscenaNuevo"
import { DEPARTAMENTOS, EscenaViva, PANTALLAS, SALA_EN_LA_FOTO, SALA_EN_LA_OFICINA, departamentoDeLaRuta, ovaloDeLaSala, transformacionDesdeLaPlataforma } from "@/components/nuevo/EscenaViva"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"

const leer = (p: string) => readFileSync(p, "utf8")
const enlaces = (html: string) => [...html.matchAll(/<a [^>]*?href="([^"]+)"/g)].map((m) => m[1]).sort()

describe("6.12 · el monolito es TU OFICINA", () => {
  it("la zona del monolito (mismo polígono que antes) lleva a /nuevo/oficina con el rótulo «TU OFICINA»; la escena sigue con DOS zonas", () => {
    const z = ZONAS.find((x) => x.clave === "oficina")!
    expect(z.href).toBe("/nuevo/oficina"); expect(z.nombre).toBe("Tu oficina"); expect(z.rotulo?.texto).toBe("TU OFICINA")
    expect(z.formas).toEqual(["936,352 1010,306 1084,338 1084,507 1010,552 936,517"]); expect(z.superficie).toBe(z.formas[0]) // el monolito mismo, con su luz al pasar el ratón
    expect(ZONAS.map((x) => x.clave)).toEqual(["oficina", "marketing"])
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(enlaces(html)).toEqual(["/nuevo/marketing", "/nuevo/oficina"])
    expect(html).toContain(">TU OFICINA</text>")
    // el rótulo con las mismas letras que la marca (5.5)
    const logo = renderToStaticMarkup(createElement(BarraSuperior)).match(/<text[^>]*>ZERO RISK<\/text>/)![0]
    const rotulo = html.match(/<text class="nv-rotulo"[^>]*>TU OFICINA<\/text>/)![0]
    for (const s of [logo, rotulo]) { expect(s).toContain('fill="none"'); expect(s).toContain('stroke="#e8731a"'); expect(s).toContain('font-weight="500"') }
  })
  it("la imagen del centro de comando existe, es 16:9 (2560×1440 como la de marketing) y es liviana; su encaje está medido y es distinto del de marketing", () => {
    for (const [p, max] of [["public/nuevo/oficina-2560.jpg", 500], ["public/nuevo/oficina-1280.jpg", 150]] as const) {
      expect(existsSync(p), p).toBe(true); expect(statSync(p).size).toBeLessThan(max * 1024)
    }
    const o = DEPARTAMENTOS.oficina
    expect(o).toMatchObject({ clave: "oficina", url: "/nuevo/oficina", src: "/nuevo/oficina-2560.jpg", src1280: "/nuevo/oficina-1280.jpg", sala: SALA_EN_LA_OFICINA })
    expect(DEPARTAMENTOS.marketing).toMatchObject({ clave: "marketing", url: "/nuevo/marketing", src: "/nuevo/marketing-2560.jpg", sala: SALA_EN_LA_FOTO })
    for (const v of [SALA_EN_LA_OFICINA.ancho, SALA_EN_LA_OFICINA.cx, SALA_EN_LA_OFICINA.cy]) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1) }
    expect(SALA_EN_LA_OFICINA.ancho).not.toBe(SALA_EN_LA_FOTO.ancho) // la losa del centro de comando es más ancha en su foto (x 120-2445 de 2560)
    expect(o.ovalo).toBe(ovaloDeLaSala(SALA_EN_LA_OFICINA, 46, 48)); expect(o.ovalo).toContain(`at ${SALA_EN_LA_OFICINA.cx * 100}% ${SALA_EN_LA_OFICINA.cy * 100}%`)
  })
  it("la mecánica es la MISMA que la del departamento: la foto sale del monolito con el encaje de su propia sala; la dirección dice cuál se proyecta", () => {
    const final = { x: 0, y: 0, w: 1000, h: 562.5 }, monolito = { x: 480, y: 180, w: 60, h: 110 }
    const t = transformacionDesdeLaPlataforma(monolito, final, SALA_EN_LA_OFICINA)
    expect(t.s).toBeCloseTo(60 / (1000 * SALA_EN_LA_OFICINA.ancho), 6)
    expect(t.x + t.s * 1000 * SALA_EN_LA_OFICINA.cx).toBeCloseTo(510, 6) // el centro de la sala cae en el centro del monolito
    expect(t.y + t.s * 562.5 * SALA_EN_LA_OFICINA.cy).toBeCloseTo(235, 6)
    expect(transformacionDesdeLaPlataforma(monolito, final)).toEqual(transformacionDesdeLaPlataforma(monolito, final, SALA_EN_LA_FOTO)) // sin tercer dato: marketing, como antes
    expect(departamentoDeLaRuta("/nuevo/oficina")).toBe("oficina"); expect(departamentoDeLaRuta("/nuevo/marketing")).toBe("marketing")
    expect(departamentoDeLaRuta("/nuevo")).toBeNull(); expect(departamentoDeLaRuta("/nuevo/cerebro")).toBeNull()
  })
  it("tu oficina abierta: la foto del centro de comando (no la de marketing), el óvalo de SU sala, el arco de pantallas = Cerebro con rótulo; sin el tablero de marketing y sin enlaces propios", () => {
    const html = renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))
    expect(html).toContain("/nuevo/oficina-2560.jpg"); expect(html).toContain("/nuevo/oficina-1280.jpg 1280w"); expect(html).not.toContain("marketing-2560.jpg")
    expect(html).toContain('data-departamento="oficina"'); expect(html).toContain('data-atenuado="true"'); expect(html).toContain("Volver a la escena")
    expect(html).toContain(`--nv-ovalo:${DEPARTAMENTOS.oficina.ovalo}`); expect(html).toContain(".nv-foto-a{-webkit-mask-image:var(--nv-ovalo);mask-image:var(--nv-ovalo)}")
    expect(html).toContain('alt="Tu oficina: el centro de comando"')
    expect(html).toMatch(new RegExp(`<g class="nv-pantallas" data-zona="cerebro" role="button" tabindex="0" aria-label="Cerebro" aria-haspopup="dialog" aria-expanded="false"[^>]*><polygon points="${PANTALLAS.forma}"><\\/polygon>`))
    expect(html).toContain(">CEREBRO</text>"); expect(html).toContain('<radialGradient id="nv-luz-oficina"')
    expect(html).toMatch(/\.nv-pantallas polygon\.nv-luz\{[^}]*mix-blend-mode:screen[^}]*transition:opacity \.45s/)
    expect(html).toContain(".nv-pantallas:hover polygon.nv-luz,.nv-pantallas:focus-visible polygon.nv-luz{opacity:1}")
    expect(html).not.toContain('class="nv-tablero"'); expect(html).not.toContain("CENTRO DE CAMPAÑA"); expect(html).not.toContain("marketing-tablero-encendido")
    expect(enlaces(html)).toEqual(["/nuevo/marketing", "/nuevo/oficina"]) // los únicos enlaces son los de la escena de fondo
    // el arco de pantallas cae dentro de la foto y sobre su mitad superior (donde están las pantallas)
    for (const par of PANTALLAS.forma.split(" ")) { const [x, y] = par.split(",").map(Number); expect(x).toBeGreaterThan(800); expect(x).toBeLessThan(1800); expect(y).toBeGreaterThan(200); expect(y).toBeLessThan(560) }
    // el rótulo «CEREBRO» con las letras de la marca
    const logo = renderToStaticMarkup(createElement(BarraSuperior)).match(/<text[^>]*>ZERO RISK<\/text>/)![0]
    const rotulo = html.match(/<text class="nv-rotulo"[^>]*>CEREBRO<\/text>/)![0]
    const num = (s: string, k: string) => Number(s.match(new RegExp(`${k}="([\\d.]+)"`))![1])
    expect(num(rotulo, "letter-spacing") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "letter-spacing") / num(logo, "font-size"), 3)
    expect(num(rotulo, "stroke-width") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "stroke-width") / num(logo, "font-size"), 3)
  })
  it("marketing abierto sigue igual: su foto, su tablero, su óvalo; sin el arco de pantallas (que es de tu oficina). `inicial: true` = marketing (compatibilidad)", () => {
    for (const inicial of [true, "marketing"] as const) {
      const html = renderToStaticMarkup(createElement(EscenaViva, { inicial }))
      expect(html).toContain("/nuevo/marketing-2560.jpg"); expect(html).not.toContain("oficina-2560.jpg"); expect(html).toContain('data-departamento="marketing"')
      expect(html).toContain(`--nv-ovalo:${DEPARTAMENTOS.marketing.ovalo}`); expect(html).toContain('class="nv-tablero"'); expect(html).not.toContain("nv-pantallas\" data-zona")
    }
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain('class="nv-proy') // cerrada: no hay proyección
  })
  it("el cableado: el monolito abre tu oficina; el Cerebro se abre desde sus pantallas SIN cambiar la dirección y Esc lo cierra primero; la dirección directa y atrás/adelante distinguen los dos departamentos", () => {
    const v = leer("components/nuevo/EscenaViva.tsx")
    expect(v).toContain('alAbrirMarketing={() => abrir("marketing")} alAbrirOficina={() => abrir("oficina")}')
    expect(v).toContain("if (cambiarUrl) cambiarDireccion(DEPARTAMENTOS[clave].url)")
    expect(v).toContain("origen.current = cajaDeLaPlataforma(clave)") // crece desde el monolito (o la plataforma), medido en pantalla
    expect(v).toContain("const ruta = departamentoDeLaRuta(window.location.pathname)")
    expect(v).toContain("if (ruta && (!abierta || ruta !== depto)) abrir(ruta, false)")
    expect(v).toContain("abrirCerebro(false, false)") // desde tu oficina: sin tocar la dirección (como el Centro de campaña dentro de marketing)
    expect(v).toContain("if (cambiarUrl && cerebroConUrl.current) cambiarDireccion(\"/nuevo\")") // al cerrarlo solo vuelve a /nuevo si él puso /nuevo/cerebro
    expect(v).toContain('createPortal(<PanelCerebro onCerrar={() => cerrarCerebro()} elegirCliente />, document.body)') // el mismo explorador, con selector de cliente
    expect(leer("components/nuevo/PanelCerebro.tsx")).toMatch(/if \(e\.key !== "Escape"\) return\s*\n\s*e\.stopPropagation\(\)/) // Esc cierra el Cerebro y NO la oficina
    const e = leer("components/nuevo/EscenaNuevo.tsx")
    expect(e).toContain('z.clave === "oficina" ? alAbrirOficina'); expect(e).not.toContain("alAbrirCerebro")
    const p = leer("app/nuevo/oficina/page.tsx")
    expect(p).toContain("exigirAdmin()"); expect(p).toContain("<PantallaNuevo oficina />"); expect(p).toContain("/login?next=%2Fnuevo%2Foficina")
    expect(leer("components/nuevo/PantallaNuevo.tsx")).toContain('inicial={marketing ? "marketing" : oficina ? "oficina" : false}')
    expect(existsSync("app/nuevo/cerebro/page.tsx")).toBe(true) // la dirección directa del Cerebro sigue
  })
})
