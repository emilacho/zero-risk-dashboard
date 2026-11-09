import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaNuevo, ZONAS, VISTA } from "@/components/nuevo/EscenaNuevo"
import { BarraDeChat, BarraSuperior, MENU, MenuLateral } from "@/components/nuevo/MarcoNuevo"

const leer = (p: string) => readFileSync(p, "utf8")
const enlaces = (html: string) => [...html.matchAll(/<a [^>]*?href="([^"]+)"/g)].map((m) => m[1])

describe("dashboard nuevo · sprint 1 (/nuevo)", () => {
  it("de la escena solo son clicables DOS cosas: el monolito (tu oficina) y las pantallas y el proyector (Dept. Marketing)", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(enlaces(html).sort()).toEqual(["/nuevo/marketing", "/nuevo/oficina"]) // 6.12: el monolito es tu oficina (6.9 abría el Cerebro; ahora el Cerebro vive adentro)
    expect(ZONAS.map((z) => z.clave)).toEqual(["oficina", "marketing"])
    expect(ZONAS[1].formas.length).toBe(1) // la plataforma de marketing (la pantalla de pie queda libre para «En vivo»)
  })
  it("las zonas caen dentro del recorte de la imagen (si no, el clic no coincidiría con el dibujo)", () => {
    for (const z of ZONAS) for (const f of z.formas) for (const par of f.split(" ")) {
      const [x, y] = par.split(",").map(Number)
      expect(x).toBeGreaterThanOrEqual(VISTA.x); expect(x).toBeLessThanOrEqual(VISTA.x + VISTA.w)
      expect(y).toBeGreaterThanOrEqual(VISTA.y); expect(y).toBeLessThanOrEqual(VISTA.y + VISTA.h)
    }
  })
  it("las imágenes de la escena existen y son livianas (< 500 KB la grande)", () => {
    for (const [f, max] of [["public/nuevo/escena-2560.jpg", 500_000], ["public/nuevo/escena-1280.jpg", 200_000]] as const) {
      expect(existsSync(f), f).toBe(true)
      expect(readFileSync(f).length, f).toBeLessThan(max)
    }
  })
  it("barra superior (03-nov · nada decorativo, nada al dashboard viejo): Zero Risk · Seleccionar cliente · Buscar con «/» · campana, $ y Salir que hacen algo", () => {
    const html = renderToStaticMarkup(createElement(BarraSuperior))
    for (const t of ["Zero Risk", "Elige un cliente", "Buscar"]) expect(html).toContain(t) // 06-nov selector único: el botón dice el cliente elegido
    expect(html).toContain("<kbd")
    expect(html).toMatch(/<button[^>]*data-accion="abrir-buscador"/) // un botón de verdad, ya no una forma
    expect(html).toMatch(/data-abre-panel="riesgos"[^>]*aria-label="Riesgos y alarmas"/); expect(html).toMatch(/data-abre-panel="dinero"[^>]*aria-label="Dinero"/)
    expect(html).toMatch(/data-accion="salir"/)
    for (const e of ["Nuevo", "Claro u oscuro", "Menú"]) expect(html).not.toContain(`aria-label="${e}"`) // no hacían nada: fuera
    expect(enlaces(html)).toEqual([]) // ningún enlace al dashboard viejo (/alertas, /gasto)
    expect(html).not.toMatch(/role="img" aria-label="(Nuevo|Alertas|Gasto|Salir)"/)
  })
  it("menú lateral (03-nov): cada lugar lleva a algo; Inicio es la escena y los demás abren su panel; sin Guías ni Oficinas", () => {
    expect(MENU.map((m) => [m.etiqueta, m.href ?? m.panel])).toEqual([["Inicio", "/nuevo"], ["Aplicaciones", "aplicaciones"], ["Piezas", "piezas"], ["Empleados", "organizacion"], ["Flujos", "observabilidad"], ["Actividad", "envivo"]])
    const html = renderToStaticMarkup(createElement(MenuLateral))
    expect(enlaces(html)).toEqual(["/nuevo"]) // nada a /mapa, /oficinas ni /piezas
    expect(html).not.toMatch(/role="img"/) // ningún icono sin acción
    expect((html.match(/data-abre-panel=/g) ?? []).length).toBe(5)
  })
  it("adenda 4: riel sin teléfono (con el flujo y la onda al final), logo en contorno, escena ya sin viñeta (5.2)", () => {
    expect(MENU.map((m) => m.etiqueta).slice(-2)).toEqual(["Flujos", "Actividad"]) // el flujo y la onda siguen al final
    const marca = renderToStaticMarkup(createElement(BarraSuperior))
    expect(marca).toMatch(/<text[^>]*fill="none"[^>]*stroke="#e8731a"/) // solo trazo, interior transparente
    expect(marca).not.toMatch(/font-display/)
    // 5.2 (31-oct): la viñeta se quitó a pedido de Emilio («iguala la iluminación a la de la foto original»); ver nuevo-sprint-5-vida-spline.test.ts
    // 5.8 (31-oct): vuelve UNA máscara, pero solo un fundido corto arriba y abajo (nunca radial) para que los bordes se mezclen con el negro de la página
    const escena = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(escena).not.toMatch(/radial-gradient/)
    expect(escena).toContain("mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)")
  })
  it("la barra de chat conserva su diseño y ahora tiene campo de texto, micrófono y envío (01-nov)", () => {
    const html = renderToStaticMarkup(createElement(BarraDeChat))
    expect(html).toContain("Habla con tus oficinas…")
    expect(html).toMatch(/<textarea/)
    expect(html).toContain('aria-label="Enviar"')
    expect(html).toMatch(/Hablar por voz|La voz no está disponible/)
  })
  it("es dibujo propio y de servidor: sin recursos externos ni JavaScript de navegador; la marca es la nuestra", () => {
    const todo = ["components/nuevo/EscenaNuevo.tsx", "components/nuevo/MarcoNuevo.tsx", "app/nuevo/page.tsx", "app/nuevo/marketing/page.tsx", "components/nuevo/PantallaNuevo.tsx"].map(leer).join("\n")
    expect(todo).not.toContain('"use client"')
    expect(todo.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "")).not.toMatch(/https?:\/\//i)
    const html = [createElement(EscenaNuevo), createElement(BarraSuperior), createElement(MenuLateral), createElement(BarraDeChat)].map((e) => renderToStaticMarkup(e)).join("")
    expect(html).not.toMatch(/airrived/i)
    expect(html).toContain("Zero Risk")
  })
  it("la página pide sesión de administrador y no lee la base", () => {
    const p = leer("app/nuevo/page.tsx")
    expect(p).toContain("exigirAdmin")
    expect(p).not.toMatch(/leerInicio|getServiceRoleClient|TrabajoEnVivo/)
  })
})
