import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, statSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { ENCENDIDOS, EscenaNuevo, VISTA, ZONAS } from "@/components/nuevo/EscenaNuevo"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"
import { ANCHO_MARKETING_ABIERTO, ESCALA_FONDO_ABIERTO, EscenaViva, FUNDIDO_BORDES, OPACIDAD_FONDO_ABIERTO, OVALO_SALA, RETARDO_ESCENA_MS, SALA_EN_LA_FOTO, TABLERO, cajaDeLaMiniatura, huecoParaLaMiniatura, opacidadDeSalida, suavizado, transformacionDesdeLaPlataforma } from "@/components/nuevo/EscenaViva"
import {
  CAMARA_Z, DESFASES, ESCENA_SPLINE, NOMBRES, PERIODOS, RUTAS, aMundo, conviene, deFoto, distanciaARuta, largoRuta, poseDePulso, puntoEnRuta,
} from "@/lib/vida-spline"

const leer = (p: string) => readFileSync(p, "utf8")
const dentro = (x: number, y: number) => x >= VISTA.x && x <= VISTA.x + VISTA.w && y >= VISTA.y && y <= VISTA.y + VISTA.h

describe("dashboard nuevo · sprint 5 · vida sobre la foto con Spline (la imagen no cambia)", () => {
  it("la foto es la misma de siempre y la escena se agranda un 30 % (58 % → 75 % del ancho), no a pantalla completa", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).toContain("/nuevo/escena-2560.webp")
    expect(html).toContain("width:min(100%,75vw,")
    expect(html).not.toContain("58vw")
    expect(Math.round(58 * 1.3)).toBe(75)
  })
  it("5.2/5.8 · la iluminación es la de la foto original: sin viñeta radial; la escena va sobre negro puro y solo sus bordes de arriba y abajo se funden con la página (sin halo)", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).not.toMatch(/radial-gradient/)
    expect(html).not.toMatch(/box-shadow/)
    expect(html).not.toMatch(/<img[^>]*(filter|opacity)/)
    expect(html).toContain(".nv-escena{width:min(100%,75vw,calc((100dvh - 15rem) * 3264 / 1766));background:#000;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)}")
    // la pantalla entera va sobre negro puro (las esquinas de las dos fotos miden 0-2 de 255); antes #141414 y se veían los bordes de las imágenes
    const pantalla = readFileSync("components/nuevo/PantallaNuevo.tsx", "utf8")
    expect(pantalla).toContain('className="fixed inset-0 z-[60] overflow-hidden bg-black"')
    expect(pantalla).not.toContain("#141414")
  })
  it("5.8 · la imagen de marketing SALE DE ADENTRO de la plataforma en la que se hizo clic, ocupa casi todo el escenario y sus bordes se funden con el negro (sin viñeta radial)", () => {
    const abierta = renderToStaticMarkup(createElement(EscenaViva, { inicial: true }))
    // la foto abierta (B) no lleva viñeta radial: el único radial es el óvalo de la copia A, que solo se ve mientras aparece chica (5.9)
    expect(abierta.split("radial-gradient").length - 1).toBe(1) // 6.12: el óvalo viaja como variable (--nv-ovalo) en el estilo de la proyección: una sola vez
    expect(abierta).toContain("width:min(120vw, calc((100dvh - 4rem) * 16 / 9))")
    expect(ANCHO_MARKETING_ABIERTO).toContain("120vw")
    expect(FUNDIDO_BORDES).toBe("linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)")
    // la entrada arranca con la transformación medida en pantalla (variables --nv-x/--nv-y/--nv-s) y termina en su sitio; la salida es la inversa
    // 5.11: UN solo movimiento continuo: crece y se hace visible a la vez (opacidad escalonada a lo largo del crecimiento), arranque lento con impulso; la escena arranca 200 ms después
    expect(RETARDO_ESCENA_MS).toBe(200)
    expect(abierta).toContain("@keyframes nvEntra{from{opacity:0;transform:translate(var(--nv-x,0px),var(--nv-y,0px)) scale(var(--nv-s,.3))}20%{opacity:.35}55%{opacity:.85}to{opacity:1;transform:none}}")
    // 5.13: la salida ya no es una animación fija hacia el sitio final: se calcula cuadro a cuadro hacia donde la plataforma está (la hoja de estilo solo deja el fundido de respaldo)
    expect(abierta).toContain("@keyframes nvSale{from{opacity:1}to{opacity:0}}")
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('data-atenuado={fase === "entra" || fase === "abierto"}') // la escena vuelve DURANTE la salida, no después (se lee la fuente: la fase «sale» no se renderiza en servidor)
    expect(abierta).toContain('.nv-proy[data-fase="sale"]{animation:nvSale 1200ms linear both}')
    expect(abierta).not.toContain("transform:none}45%")
    // misma curva que la escena: arranca lenta, toma impulso, llega suave; monótona
    expect(suavizado(0)).toBe(0); expect(suavizado(1)).toBe(1)
    expect(suavizado(0.1)).toBeLessThan(0.05); expect(suavizado(0.5)).toBeGreaterThan(0.45); expect(suavizado(0.5)).toBeLessThan(0.8); expect(suavizado(0.9)).toBeGreaterThan(0.97)
    for (let p = 0.05; p < 1; p += 0.05) expect(suavizado(p)).toBeGreaterThan(suavizado(p - 0.05))
    // visible hasta llegar a la plataforma; se apaga en el último tramo
    expect(opacidadDeSalida(0)).toBe(1); expect(opacidadDeSalida(0.5)).toBe(1); expect(opacidadDeSalida(0.9)).toBeCloseTo(0.75, 5); expect(opacidadDeSalida(1)).toBe(0)
    expect(abierta).toContain('.nv-proy[data-fase="entra"]{animation:nvEntra 1700ms cubic-bezier(.55,0,.15,1) both}')
    // geometría: con la imagen final en 0,0 1000×562,5 y la plataforma en 600,200 150×120, la sala (76,6 % del ancho) queda del ancho de la plataforma y centrada en ella
    const t = transformacionDesdeLaPlataforma({ x: 600, y: 200, w: 150, h: 120 }, { x: 0, y: 0, w: 1000, h: 562.5 })
    expect(t.s).toBeCloseTo(150 / (1000 * SALA_EN_LA_FOTO.ancho), 6)
    expect(t.x + t.s * 1000 * SALA_EN_LA_FOTO.cx).toBeCloseTo(675, 6)
    expect(t.y + t.s * 562.5 * SALA_EN_LA_FOTO.cy).toBeCloseTo(260, 6)
    // la capa de la imagen cubre toda la ventana (fixed) para que la foto pueda ser más grande que el hueco de la escena
    // 5.9 · dos copias de la foto: A recortada en óvalo suave (lo que se ve mientras aparece chica sobre la plataforma) y B completa que se funde encima al crecer
    expect(abierta.match(/src="\/nuevo\/marketing-2560\.webp"/g)?.length).toBe(2)
    expect(abierta).toContain(".nv-foto-a{-webkit-mask-image:var(--nv-ovalo);mask-image:var(--nv-ovalo)}"); expect(abierta).toContain(`--nv-ovalo:${OVALO_SALA}`) // 6.12: el óvalo de cada departamento viaja como variable
    expect(OVALO_SALA).toContain("radial-gradient(ellipse 40% 46% at 48.8% 40.5%")
    expect(abierta).toContain("@keyframes nvFotoBEntra{from{opacity:0}50%{opacity:0}to{opacity:1}}")
    expect(abierta).toContain("@keyframes nvFotoBSale{from{opacity:1}35%{opacity:0}to{opacity:0}}")
    expect(abierta).toMatch(/<img[^>]*alt=""[^>]*class="nv-foto-a/); expect(abierta).toMatch(/<img[^>]*alt="El interior del departamento de marketing"[^>]*class="nv-foto-b/)
  })
  it("5.3/5.4 · al pasar por Dept. Marketing se enciende la ESTRUCTURA ENTERA con una imagen real generada (no una figura pintada); sin campo naranja ni línea dura", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).not.toMatch(/drop-shadow/)
    expect(html).not.toMatch(/stroke:rgba\(255,1[67]0/)
    expect(html).toMatch(/\.nv-zona polygon\{[^}]*stroke:none/)
    // la versión encendida: un recorte con alfa en su lugar exacto, oculto hasta el hover (CSS :has, sin JavaScript)
    const mkt = ENCENDIDOS.find((e) => e.zona === "marketing")!
    expect(mkt.src).toBe("/nuevo/marketing-encendido.webp")
    expect(existsSync("public" + mkt.src)).toBe(true)
    expect(statSync("public" + mkt.src).size).toBeLessThan(400 * 1024)
    expect(mkt.caja.x).toBeGreaterThanOrEqual(0); expect(mkt.caja.y).toBeGreaterThanOrEqual(0); expect(mkt.caja.x + mkt.caja.w).toBeLessThanOrEqual(2560); expect(mkt.caja.y + mkt.caja.h).toBeLessThanOrEqual(1385)
    expect(html).toMatch(/<img[^>]*data-encendido="marketing"[^>]*class="nv-encendido pointer-events-none absolute select-none \[transform:translateZ\(0\)\]"[^>]*style="left:56\.7969%;top:14\.0794%;width:23\.4375%;height:36\.6065%"/)
    expect(html).toMatch(/\.nv-encendido\{opacity:0;transition:opacity \.45s/)
    expect(html).toMatch(/\.nv-escena:has\(\.nv-zona\[data-zona="marketing"\]:hover\) \.nv-encendido\[data-encendido="marketing"\][^{]*\{opacity:1\}/)
    // la caja encendida cubre la zona del ratón de Marketing (en píxeles de la foto)
    const z = ZONAS.find((zz) => zz.clave === "marketing")!
    for (const par of z.formas[0].split(" ")) {
      const [vx, vy] = par.split(",").map(Number); const px = ((vx - VISTA.x) * 2560) / VISTA.w, py = ((vy - VISTA.y) * 1385) / VISTA.h
      expect(px).toBeGreaterThanOrEqual(mkt.caja.x - 1); expect(px).toBeLessThanOrEqual(mkt.caja.x + mkt.caja.w + 1); expect(py).toBeGreaterThanOrEqual(mkt.caja.y - 1); expect(py).toBeLessThanOrEqual(mkt.caja.y + mkt.caja.h + 1)
    }
    expect(z.superficie).toBeUndefined() // Marketing ya no lleva luz pintada
    // el monolito (6.12: tu oficina; antes el cerebro) conserva su luz suave recortada a su cara
    const cer = ZONAS.find((zz) => zz.clave === "oficina")!
    expect(html).toContain(`<clipPath id="nv-sup-oficina"><polygon points="${cer.superficie}"`)
    expect(html).toMatch(/polygon\.nv-luz\{[^}]*mix-blend-mode:screen/)
  })
  it("5.14 · dentro de la oficina, el pizarrón de piezas se enciende al pasar el ratón (recorte con alfa en su lugar exacto) y muestra su rótulo con las letras de la marca", () => {
    const html = renderToStaticMarkup(createElement(EscenaViva, { inicial: true }))
    expect(existsSync("public/nuevo/marketing-tablero-encendido.webp")).toBe(true)
    expect(statSync("public/nuevo/marketing-tablero-encendido.webp").size).toBeLessThan(60 * 1024)
    expect(TABLERO.encendido.caja).toEqual({ x: 820, y: 250, w: 320, h: 340 })
    expect(html).toMatch(/<img[^>]*data-encendido="tablero"[^>]*class="nv-tablero-luz pointer-events-none absolute select-none"[^>]*style="left:32\.0313%;top:17\.3611%;width:12\.5000%;height:23\.6111%"/)
    expect(html).toContain(".nv-tablero-luz{opacity:0;transition:opacity .45s ease}")
    expect(html).toContain('.nv-proy:has(.nv-tablero:hover) .nv-tablero-luz,.nv-proy:has(.nv-tablero:focus-visible) .nv-tablero-luz{opacity:1}')
    expect(html).toMatch(/<g class="nv-tablero" data-zona="tablero" role="button" tabindex="0" aria-label="Centro de campaña"[^>]*><polygon points="856,392 1098,286 1098,450 856,548"><\/polygon>/)
    const logo = renderToStaticMarkup(createElement(BarraSuperior)).match(/<text[^>]*>ZERO RISK<\/text>/)![0]
    const rotulo = html.match(/<text class="nv-rotulo"[^>]*>CENTRO DE CAMPAÑA<\/text>/)![0]
    const num = (s: string, k: string) => Number(s.match(new RegExp(`${k}="([\\d.]+)"`))![1])
    for (const s of [logo, rotulo]) { expect(s).toContain('fill="none"'); expect(s).toContain('stroke="#e8731a"'); expect(s).toContain('font-weight="500"') }
    expect(num(rotulo, "letter-spacing") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "letter-spacing") / num(logo, "font-size"), 3)
    expect(num(rotulo, "stroke-width") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "stroke-width") / num(logo, "font-size"), 3)
    expect(num(rotulo, "font-size") * (1486 / 2560)).toBeCloseTo(26 * (1200 / 1700), 0) // mismo tamaño en pantalla que «DEPT. MARKETING» (1600×900)
  })

  it("5.5 · el rótulo del departamento lleva las MISMAS letras que la marca «ZERO RISK» de la barra: mayúsculas, contorno ámbar sin relleno, peso 500, espaciado y trazo proporcionales", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    const marca = renderToStaticMarkup(createElement(BarraSuperior))
    const logo = marca.match(/<text[^>]*>ZERO RISK<\/text>/)![0]
    const rotulo = html.match(/<text class="nv-rotulo"[^>]*>DEPT\. MARKETING<\/text>/)![0]
    for (const s of [logo, rotulo]) { expect(s).toContain('fill="none"'); expect(s).toContain('stroke="#e8731a"'); expect(s).toContain('font-weight="500"'); expect(s).toContain('font-family="system-ui, Arial, sans-serif"') }
    const num = (s: string, a: string) => Number(s.match(new RegExp(`${a}="([0-9.]+)"`))![1])
    expect(num(rotulo, "letter-spacing") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "letter-spacing") / num(logo, "font-size"), 3)
    expect(num(rotulo, "stroke-width") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "stroke-width") / num(logo, "font-size"), 3)
    expect(rotulo).not.toMatch(/fill="#/)
  })
  it("5.6/5.7 · con el departamento abierto, la escena principal se va a la esquina inferior izquierda, reducida un 70 % (al 30 %) y translúcida, sin desenfoque", () => {
    expect(ESCALA_FONDO_ABIERTO).toBe(0.3)
    expect(OPACIDAD_FONDO_ABIERTO).toBeGreaterThan(0.2); expect(OPACIDAD_FONDO_ABIERTO).toBeLessThan(0.5)
    const abierta = renderToStaticMarkup(createElement(EscenaViva, { inicial: true }))
    // 5.8: por encima de la imagen de marketing (que ahora cubre la ventana), para que la miniatura se vea; sigue translúcida y sin recibir clics
    expect(abierta).toContain(`.nv-fondo[data-atenuado="true"]{opacity:0.35;transform:scale(0.3);pointer-events:none;position:relative;transition-delay:${RETARDO_ESCENA_MS}ms}`) // 5.9: la escena espera a que la oficina aparezca
    // 5.10 · la escena queda SIEMPRE debajo (sin cambio de capa ni salto): la foto la deja ver por un hueco suave en su esquina (segunda capa de máscara, intersección)
    expect(abierta).not.toContain("data-abierto"); expect(abierta).not.toContain("nvMiniatura")
    expect(abierta).toContain('class="nv-capa fixed inset-0 z-[5] flex items-center justify-center"')
    expect(abierta).toContain(".nv-capa{-webkit-mask-image:var(--nv-hueco,none);mask-image:var(--nv-hueco,none)}") // el hueco va en la capa fija, no en la foto que se transforma
    expect(abierta).toContain(`.nv-proy{transform-origin:0 0;will-change:transform,opacity;-webkit-mask-image:${FUNDIDO_BORDES};mask-image:${FUNDIDO_BORDES}}`)
    // geometría del hueco: marco 0,0 1000×600 con la escena 800×450 centrada → encogida al 30 % desde la esquina inferior izquierda queda en x 30..270 · y 442,5..577,5; foto final en 0,0
    const hueco = huecoParaLaMiniatura({ x: 0, y: 0, w: 1000, h: 600 }, { w: 800, h: 450 }, { x: 0, y: 0, w: 1500, h: 843 })
    expect(cajaDeLaMiniatura({ x: 0, y: 0, w: 1000, h: 600 }, { w: 800, h: 450 })).toEqual({ x: 30, y: 442.5, w: 240, h: 135 })
    // 5.12: hueco apenas mayor que la miniatura (1,12× · 1,15×) y que se cierra desde el 55 %: la foto cubre la franja exterior de la miniatura y no se le ven los bordes
    expect(hueco).toBe(`radial-gradient(ellipse ${(120 * 1.12).toFixed(1)}px ${(67.5 * 1.15).toFixed(1)}px at 150.0px 510.0px,transparent 55%,#000 100%)`)
    // 5.12: la miniatura es clicable y vuelve a la sala principal (botón invisible encima, con sus medidas por variables), y se aclara al pasar el ratón
    expect(abierta).toMatch(/<button[^>]*class="nv-volver fixed z-\[6\][^"]*"[^>]*aria-label="Volver a la sala principal"/)
    expect(abierta).toContain("left:var(--nv-mini-x);top:var(--nv-mini-y);width:var(--nv-mini-w);height:var(--nv-mini-h)")
    expect(abierta).toContain('.nv-fondo[data-atenuado="true"][data-resaltada="true"]{opacity:.6;transition:opacity .3s ease}')
    // el origen de la transformación en la esquina inferior izquierda es lo que manda la miniatura ahí al encoger
    expect(abierta).toContain(".nv-fondo{transition:opacity 1.1s ease,transform 1.2s cubic-bezier(.55,0,.15,1);transform-origin:0% 100%}") // 5.11: mismo impulso que la oficina
    expect(abierta).not.toMatch(/blur\(/)
  })
  it("la foto va en su propia capa de composición: con un lienzo WebGL encima Chrome la redibujaba distinta (medido 31-oct) · no quitar", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).toMatch(/<img[^>]*\[transform:translateZ\(0\)\]/)
  })
  it("la capa de vida va ENTRE la foto y las zonas clicables, y no atrapa el ratón", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo, { fondo: createElement("i", { "data-prueba": "vida" }) }))
    const foto = html.indexOf("<img"), vida = html.indexOf('data-prueba="vida"'), zonas = html.indexOf("<svg")
    expect(foto).toBeGreaterThan(-1); expect(vida).toBeGreaterThan(foto); expect(zonas).toBeGreaterThan(vida)
    const capa = leer("components/nuevo/VidaSpline.tsx")
    expect(capa).toContain('"use client"')
    expect(capa).toContain("pointer-events-none absolute inset-0")
    expect(capa).toContain('aria-hidden="true"')
    expect(capa).toMatch(/lazy\(\(\) => import\("@splinetool\/react-spline"\)\)/) // la biblioteca solo baja cuando se monta
    expect(capa).toContain("renderOnDemand={false}")
    expect(capa).toContain('setBackgroundColor("rgba(0,0,0,0)")') // el lienzo transparente: la foto está debajo
  })
  it("en pantalla SOLO hay pulsos: el polvo, los discos sobre las ventanas y los halos quedan ocultos al cargar (Emilio 31-oct)", () => {
    const capa = leer("components/nuevo/VidaSpline.tsx")
    expect(capa).toMatch(/for \(const n of NOMBRES\.ocultos\) \{ const o = busca\(n\); if \(o\) o\.visible = false \}/)
    expect(NOMBRES.ocultos).toHaveLength(7 + 36 + 2)
    expect(NOMBRES.ocultos).toContain("Polvo 36"); expect(NOMBRES.ocultos).toContain("Brillo 7"); expect(NOMBRES.ocultos).toContain("Halo Marketing")
    expect(capa).not.toMatch(/poseDePolvo|escalaDeBrillo|escalaDeHalo|HALOS/)
    for (const z of ZONAS) expect(renderToStaticMarkup(createElement(EscenaNuevo))).toContain(`data-zona="${z.clave}"`)
  })
  it("la escena de Spline es una dirección de Spline fija; la foto y las zonas siguen siendo de servidor (sin JavaScript de navegador)", () => {
    expect(ESCENA_SPLINE).toMatch(/^https:\/\/prod\.spline\.design\/[A-Za-z0-9]+\/scene\.splinecode$/)
    expect(leer("components/nuevo/EscenaNuevo.tsx")).not.toContain('"use client"')
    expect(leer("components/nuevo/EscenaNuevo.tsx")).not.toContain("spline.design")
    const pkg = JSON.parse(leer("package.json"))
    expect(pkg.dependencies["@splinetool/react-spline"]).toBeTruthy()
    expect(pkg.dependencies["@splinetool/runtime"]).toBeTruthy()
  })
  it("las rutas son trazos del SUELO de la foto, en las mismas coordenadas que las zonas: 10 rutas, dentro del recorte, de 90 a 320 unidades", () => {
    expect(RUTAS).toHaveLength(10)
    expect(RUTAS).toHaveLength(NOMBRES.pulsos.length)
    for (const r of RUTAS) {
      expect(r.length).toBeGreaterThanOrEqual(2)
      for (const [x, y] of r) expect(dentro(x, y)).toBe(true)
      expect(largoRuta(r)).toBeGreaterThan(90); expect(largoRuta(r)).toBeLessThan(320)
    }
    // la conversión píxel de foto → VISTA es la misma que usan las zonas (la foto 2560×1385 llena el recorte 1700×920 desde 150,40)
    expect(deFoto(0, 0)).toEqual([VISTA.x, VISTA.y]); expect(deFoto(2560, 1385)).toEqual([VISTA.x + VISTA.w, VISTA.y + VISTA.h])
    expect(deFoto(1332, 383)).toEqual(RUTAS[0][0]) // el primer trazo medido en la foto
    expect(aMundo(VISTA.x + VISTA.w / 2, VISTA.y + VISTA.h / 2)).toEqual({ x: 0, y: 0 }) // el centro de la foto es el origen de Spline
    expect(aMundo(VISTA.x, VISTA.y)).toEqual({ x: -VISTA.w / 2, y: VISTA.h / 2 }) // la esquina superior izquierda
    expect(CAMARA_Z).toBeGreaterThan(0)
  })
  it("un pulso sale apagado, se enciende a mitad de camino, llega apagado y vuelve por el mismo tramo; nunca se sale de su trazo", () => {
    const P = PERIODOS[0], d0 = DESFASES[0]
    const ruta = RUTAS[0]
    expect(d0).toBe(0)
    expect(puntoEnRuta(ruta, 0)).toEqual(ruta[0]); expect(puntoEnRuta(ruta, 1)).toEqual(ruta[ruta.length - 1])
    const salida = poseDePulso(0, 0), mitad = poseDePulso(P / 2, 0), llegada = poseDePulso(P - 1e-6, 0), vuelta = poseDePulso(P + P / 2, 0)
    expect(salida.s).toBeLessThan(0.01); expect(llegada.s).toBeLessThan(0.01); expect(mitad.s).toBeCloseTo(1, 3)
    expect([salida.x, salida.y]).toEqual(ruta[0])
    expect(Math.hypot(llegada.x - ruta[1][0], llegada.y - ruta[1][1])).toBeLessThan(0.1)
    expect([mitad.x, mitad.y]).toEqual([(ruta[0][0] + ruta[1][0]) / 2, (ruta[0][1] + ruta[1][1]) / 2])
    expect([vuelta.x, vuelta.y]).toEqual([mitad.x, mitad.y]) // el viaje de vuelta pasa por el mismo punto medio
    // antes de su desfase, el pulso espera apagado en el arranque de su ruta
    const i = 3
    expect(poseDePulso(DESFASES[i] / 2, i).s).toBeLessThan(0.01); expect([poseDePulso(DESFASES[i] / 2, i).x, poseDePulso(DESFASES[i] / 2, i).y]).toEqual(RUTAS[i][0])
    for (let t = 0; t < 60; t += 0.23) for (let k = 0; k < RUTAS.length; k++) {
      const p = poseDePulso(t, k)
      expect(dentro(p.x, p.y)).toBe(true); expect(p.s).toBeGreaterThan(0); expect(p.s).toBeLessThanOrEqual(1)
      expect(distanciaARuta(RUTAS[k], p.x, p.y)).toBeLessThan(1e-6) // SOBRE el trazo, siempre
    }
  })
  it("los ritmos son todos distintos (nada se mueve al unísono) y van a velocidad parecida (≈ 30 unidades/s): vida sentida, no mareo", () => {
    expect(new Set(PERIODOS).size).toBe(PERIODOS.length)
    expect(new Set(DESFASES).size).toBe(DESFASES.length)
    for (let i = 0; i < RUTAS.length; i++) {
      const v = largoRuta(RUTAS[i]) / PERIODOS[i]
      expect(v).toBeGreaterThan(20); expect(v).toBeLessThan(45)
    }
  })
  it("la capa 3D solo se monta en escritorio, con WebGL y sin «reducir movimiento»; si no, queda la foto sola (móvil = foto)", () => {
    expect(conviene(1600, true, false)).toBe(true)
    expect(conviene(699, true, false)).toBe(false)
    expect(conviene(1600, false, false)).toBe(false)
    expect(conviene(1600, true, true)).toBe(false)
    // la escena de Spline está exportada solo para WebGPU: sin adaptador no se monta la capa (la foto queda sola, nunca un lienzo negro encima)
    const capa = leer("components/nuevo/VidaSpline.tsx")
    expect(capa).toMatch(/gpu\.requestAdapter\(\)/)
    expect(capa).toMatch(/if \(!\(await hayWebGPU\(\)\)\) return/)
  })
  it("barra superior: tres grupos en fila (el buscador ya no flota en absoluto), así «Seleccionar cliente» y «Buscar» no se encimán a ningún ancho", () => {
    const html = renderToStaticMarkup(createElement(BarraSuperior))
    expect(html).toContain("Seleccionar cliente"); expect(html).toContain("Buscar")
    expect(html).not.toMatch(/absolute left-1\/2 top-1\/2[^"]*md:block/)
    expect(html).toMatch(/mx-auto hidden w-\[min\(34vw,420px\)\] md:block/)
    expect(html).toContain("whitespace-nowrap")
  })
})
