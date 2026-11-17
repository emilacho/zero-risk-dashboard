// @vitest-environment jsdom
/**
 * La tarjeta «Propuestas» vuelve a la forma de `2-visor.png` (GO Lenovo 17-nov · BOCETO `raw/tasks/2026-11-17-BOCETO-CC5-a-LENOVO-tarjeta-propuestas-volver-al-visor.md`,
 * APROBADO por Emilio 16:38 Zúrich · capturas `raw/evidencia/2026-11-17-volver-al-boceto/b1`–`b4`).
 * El guion con 4 cuadros grandes a lo ancho; con más, flechas junto al rótulo («1–4 de N»); bajo el guion, el costo y «Ver el video ›» (video) o el texto de la
 * publicación completo (imagen). Lo que mide CC7 (`NOTA-CC7-a-CC5-LENOVO-tarjeta-volver-al-boceto-lo-que-voy-a-medir.md`). Dos clientes de rubros distintos.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { normalizarDecisiones, type Decision } from "@/lib/direccion-decisiones"
import type { Propuestas } from "@/lib/propuestas"
import { CUADROS_A_LO_ANCHO, PanelPropuestas, celdasDelGuion, ventanaAnterior, ventanaSiguiente } from "@/components/nuevo/PanelPropuestas"

afterEach(cleanup)
const ENCARGO = "6f1e2d3c-4b5a-4968-8776-655443322110"
const IMG = (n: string) => `https://almacen.example/borradores/${n}.jpg`
const pl = (n: number, desde: number, hasta: number, rol: string, imagenes: string[], texto: string | null, se_ve: string) => ({ n, desde, hasta, rol, se_ve, texto_en_pantalla: texto, imagenes })

/** video de un taller mecánico: P1 con 6 cuadros (los planos 2 y 3 traen 2 cada uno), P2 con 4 justos, P3 sin video todavía */
const video = (extra: Record<string, unknown> = {}) => ({
  encargo_id: ENCARGO, brief_id: "b-1", ronda: 1, quedan_vueltas: 2, avisos: [],
  lista: [
    { id: "P1", nombre: "El motor como nuevo", concepto: "Un motor sucio que sale limpio.", segundos: 14, red: "Instagram", objetivo: "Citas", por_que: "El cambio se ve.",
      video_url: "https://almacen.example/borradores/p1.mp4", costo: { borrador_usd: 1.35, final_usd: 7.8 },
      planos: [pl(1, 0, 2, "captar", [IMG("1")], null, "El capó"), pl(2, 2, 8, "informar", [IMG("2a"), IMG("2b")], "Sin trucos", "El mecánico"), pl(3, 8, 12, "prueba", [IMG("3a"), IMG("3b")], "Como nuevo", "El motor limpio"), pl(4, 12, 14, "llamado", [IMG("4")], "Agenda hoy", "El logo")] },
    { id: "P2", nombre: "Un día en el taller", concepto: "Del portón al auto listo.", segundos: 12, red: "TikTok", objetivo: "Confianza", por_que: "Quita el miedo.",
      video_url: "https://almacen.example/borradores/p2.mp4", costo: { borrador_usd: 0.6, final_usd: 7.2 },
      planos: [pl(1, 0, 3, "ambiente", [IMG("p2-1")], null, "El portón"), pl(2, 3, 6, "situar", [IMG("p2-2")], "Aquí", "El taller"), pl(3, 6, 9, "prueba", [IMG("p2-3")], "Listo", "El auto"), pl(4, 9, 12, "llamado", [IMG("p2-4")], "Ven", "El logo")] },
    { id: "P3", nombre: "La llanta", concepto: "Cambiar una llanta en un minuto.", segundos: 10, red: "TikTok", objetivo: "Visitas", por_que: "Rápido y útil.",
      video_url: null, costo: { borrador_usd: 0.55, final_usd: null },
      planos: [pl(1, 0, 3, "situar", [IMG("p3-1")], null, "La llanta"), pl(2, 3, 7, "prueba", [], "Un minuto", "El reloj"), pl(3, 7, 10, "llamado", [IMG("p3-3")], "Te esperamos", "El logo")] },
  ],
  ...extra,
})
/** historia de una floristería: P1 con 5 láminas (flecha) y el texto de la publicación completo */
const historia = () => ({
  encargo_id: ENCARGO, brief_id: null, ronda: 1, quedan_vueltas: 2, avisos: [], familia: "imagen", clase: "kit",
  lista: [
    { id: "P1", nombre: "Ramos del día", concepto: "Cinco ramos recién armados.", red: "WhatsApp", objetivo: "Pedidos", por_que: "Lo fresco vende.", costo: { borrador_usd: 0.02, final_usd: null },
      texto_de_la_publicacion: { pie_de_foto: "Recién armados.", llamado: "Pide por WhatsApp", hashtags: ["flores", "#ramos"] },
      planos: [1, 2, 3, 4, 5].map((n) => ({ n, rol: n === 5 ? "llamado" : "prueba", se_ve: `Ramo ${n}`, texto_en_pantalla: `Ramo ${n}`, imagenes: n === 5 ? [] : [IMG(`r${n}`)], foto_propia: n === 2 })) },
    { id: "P2", nombre: "La rosa", concepto: "Una rosa sola.", red: "WhatsApp", objetivo: "Pedidos", por_que: "Menos es más.", costo: { borrador_usd: null, final_usd: null },
      planos: [{ n: 1, rol: "gancho", se_ve: "Una rosa", texto_en_pantalla: "Para ti", imagenes: [IMG("rosa")] }] },
  ],
})
const decision = (propuestas: Record<string, unknown>, cliente: string) => {
  const fila = { id: ENCARGO, tipo: "propuestas", fuente: "oficina_turnos", client_id: "c1", cliente, titulo: "Propuestas: elige una", desde: "2026-11-17T13:00:00Z", vence: null, decidir: { ruta: null, accion: "propuestas-aprobar" }, detiene: true, propuestas }
  return normalizarDecisiones({ decisiones: [fila], fuentes: [], sin_fuente: [], completo: true }).decisiones[0] as Decision & { propuestas: Propuestas }
}
const dibujar = (d: Decision & { propuestas: Propuestas }) => renderToStaticMarkup(createElement(PanelPropuestas, { decision: d, onCerrar: () => undefined, elegidaInicial: "P1" }))
const abrir = (d: Decision & { propuestas: Propuestas }) => render(createElement(PanelPropuestas, { decision: d, onCerrar: () => undefined, elegidaInicial: "P1" })).container
const tarjeta = (c: HTMLElement, id: string) => c.querySelector(`[data-propuesta="${id}"]`) as HTMLElement
const fuentes = (t: HTMLElement) => [...t.querySelectorAll("[data-guion-grafico] [data-cuadro]")].map((i) => i.getAttribute("src"))

describe("1 · el guion de `2-visor.png`: 4 cuadros grandes a lo ancho, sin vista previa arriba", () => {
  it("cada cuadro es una celda: un plano de varios cuadros da varias, y un plano sin imagen da una vacía", () => {
    const p = decision(video(), "Taller El Pistón").propuestas.lista[0]
    expect(celdasDelGuion(p.planos).map((c) => `${c.p.n}.${c.i}`)).toEqual(["1.0", "2.0", "2.1", "3.0", "3.1", "4.0"])
    const p3 = decision(video(), "Taller El Pistón").propuestas.lista[2]
    expect(celdasDelGuion(p3.planos).map((c) => c.src)).toEqual([IMG("p3-1"), null, IMG("p3-3")])
  })
  it("se ven 4 cuadros a lo ancho, en una rejilla de 4 columnas iguales, y nada grande encima del guion", () => {
    const h = dibujar(decision(video(), "Taller El Pistón"))
    expect(CUADROS_A_LO_ANCHO).toBe(4)
    const p1 = h.match(/<article data-propuesta="P1"[\s\S]*?<\/article>/)?.[0] ?? ""
    expect(p1).toMatch(/<ol data-guion-grafico="true" class="grid grid-cols-4 gap-2">/)
    expect(p1.match(/<img[^>]*data-cuadro[^>]*>/g)).toHaveLength(4)
    expect(p1).not.toContain("data-portada"); expect(p1).not.toContain("<video")
    // el orden de la tarjeta: idea, línea de datos, guion, costo, porqué
    const orden = ["data-concepto", "data-ficha-tecnica", "data-guion-grafico", "data-costo", "data-por-que"].map((a) => p1.indexOf(`${a}="true"`))
    expect(orden.every((x, i) => x > 0 && (i === 0 || x > orden[i - 1]))).toBe(true)
  })
  it("un plano de varios cuadros lleva su nombre en cada uno; los segundos y el texto van en el primero y el resto dice «sigue el plano»", () => {
    const c = abrir(decision(video(), "Taller El Pistón"))
    const cuadros = [...tarjeta(c, "P1").querySelectorAll("[data-plano]")] as HTMLElement[]
    expect(cuadros.map((x) => x.dataset.plano)).toEqual(["1", "2", "2", "3"])
    expect(cuadros[1].textContent).toContain("2 · Informar"); expect(cuadros[1].textContent).toContain("2–8 s"); expect(cuadros[1].textContent).toContain("«Sin trucos»")
    expect(cuadros[2].textContent).toContain("2 · Informar"); expect(cuadros[2].querySelector("[data-continua]")?.textContent).toBe("sigue el plano")
    expect(cuadros[2].textContent).not.toContain("2–8 s"); expect(cuadros[2].textContent).not.toContain("Sin trucos")
  })
})

describe("2 · las flechas", () => {
  it("la ventana: avanza de a 4, la última muestra los 4 finales, nunca pasa del final ni del principio", () => {
    expect(ventanaSiguiente(0, 6)).toBe(2); expect(ventanaSiguiente(2, 6)).toBe(2)
    expect(ventanaSiguiente(0, 10)).toBe(4); expect(ventanaSiguiente(4, 10)).toBe(6); expect(ventanaSiguiente(6, 10)).toBe(6)
    expect(ventanaSiguiente(0, 3)).toBe(0)
    expect(ventanaAnterior(6)).toBe(2); expect(ventanaAnterior(2)).toBe(0); expect(ventanaAnterior(0)).toBe(0)
  })
  it("solo con más de 4: P1 (6) tiene «1–4 de 6» y la flecha siguiente; P2 (4 justos) y P3 (3) no tienen flechas ni cuenta", () => {
    const c = abrir(decision(video(), "Taller El Pistón"))
    expect(tarjeta(c, "P1").querySelector("[data-cuantos]")?.textContent).toBe("1–4 de 6")
    expect(tarjeta(c, "P1").querySelector('[data-flecha="despues"]')).not.toBeNull()
    expect(tarjeta(c, "P1").querySelector('[data-flecha="antes"]')).toBeNull()
    for (const id of ["P2", "P3"]) { expect(tarjeta(c, id).querySelector("[data-flecha]")).toBeNull(); expect(tarjeta(c, id).querySelector("[data-cuantos]")).toBeNull() }
  })
  it("la flecha recorre todos los cuadros (ninguno queda sin verse) y vuelve; la de antes aparece solo cuando hay algo antes", () => {
    const c = abrir(decision(video(), "Taller El Pistón"))
    const t = tarjeta(c, "P1")
    expect(fuentes(t)).toEqual([IMG("1"), IMG("2a"), IMG("2b"), IMG("3a")])
    fireEvent.click(t.querySelector('[data-flecha="despues"]')!)
    expect(fuentes(t)).toEqual([IMG("2b"), IMG("3a"), IMG("3b"), IMG("4")])
    expect(t.querySelector("[data-cuantos]")?.textContent).toBe("3–6 de 6")
    expect(t.querySelector('[data-flecha="despues"]')).toBeNull()
    fireEvent.click(t.querySelector('[data-flecha="antes"]')!)
    expect(fuentes(t)).toEqual([IMG("1"), IMG("2a"), IMG("2b"), IMG("3a")])
    expect(t.querySelector('[data-flecha="antes"]')).toBeNull()
  })
  it("la flecha es un botón con nombre (se usa con teclado), va junto al rótulo y no dentro del guion, y no cambia la propuesta elegida", () => {
    const c = abrir(decision(video(), "Taller El Pistón"))
    const f = tarjeta(c, "P1").querySelector('[data-flecha="despues"]') as HTMLButtonElement
    expect(f.tagName).toBe("BUTTON"); expect(f.type).toBe("button")
    expect(f.getAttribute("aria-label")).toBe("Ver las imágenes siguientes de El motor como nuevo")
    expect(f.closest("[data-guion-grafico]")).toBeNull(); expect(f.closest("[data-paso]")).not.toBeNull()
    fireEvent.click(f)
    expect(tarjeta(c, "P1").dataset.elegida).toBe("true"); expect(tarjeta(c, "P2").dataset.elegida).toBeUndefined()
    expect(c.textContent).toContain("Aprobar fabrica «El motor como nuevo»")
  })
  it("cada propuesta pasa sus propias imágenes: la flecha de una no mueve a otra", () => {
    const c = abrir(decision(historia(), "Floristería Pétalo"))
    fireEvent.click(tarjeta(c, "P1").querySelector('[data-flecha="despues"]')!)
    expect(fuentes(tarjeta(c, "P2"))).toEqual([IMG("rosa")])
    expect(tarjeta(c, "P1").querySelector("[data-cuantos]")?.textContent).toBe("2–5 de 5")
  })
})

describe("3 · la línea de información bajo el guion", () => {
  it("video: «Borrador · Final · Ver el video ›»; el video se abre en el lugar del guion y «‹ Volver al guion» regresa", () => {
    const c = abrir(decision(video(), "Taller El Pistón"))
    const t = tarjeta(c, "P1")
    const linea = t.querySelector("[data-costo]") as HTMLElement
    expect(linea.textContent).toContain("Borrador US$ 1,35"); expect(linea.textContent).toContain("Final US$ 7,80"); expect(linea.textContent).toContain("Ver el video ›")
    expect(t.querySelector("video")).toBeNull()
    fireEvent.click(t.querySelector("[data-boton-video]")!)
    expect(t.querySelector("video[data-borrador-video]")?.getAttribute("src")).toBe("https://almacen.example/borradores/p1.mp4")
    expect(t.querySelector("[data-guion-grafico]")).toBeNull()
    expect(t.querySelector("[data-boton-video]")?.textContent).toBe("‹ Volver al guion"); expect(t.querySelector("[data-boton-video]")?.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(t.querySelector("[data-boton-video]")!)
    expect(t.querySelector("video")).toBeNull(); expect(t.querySelector("[data-guion-grafico]")).not.toBeNull()
    // abrir el video de una no abre el de otra
    expect(tarjeta(c, "P2").querySelector("video")).toBeNull()
  })
  it("sin video, la línea dice «Video —» en rojo (no se pierde sin aviso) y no hay enlace", () => {
    const c = abrir(decision(video(), "Taller El Pistón"))
    const linea = tarjeta(c, "P3").querySelector("[data-costo]") as HTMLElement
    expect(linea.querySelector("[data-boton-video]")).toBeNull()
    expect(linea.querySelector("[data-sin-video] [data-sin-dato]")?.className).toContain("text-alarma")
    // el final que falta también es el «sin dato» rojo, nunca vacío
    expect(linea.querySelectorAll("[data-sin-dato]")).toHaveLength(2)
  })
  it("imagen: el costo y, debajo, el texto de la publicación COMPLETO (pie, llamado y hashtags), antes del porqué; sin enlace de video", () => {
    const h = dibujar(decision(historia(), "Floristería Pétalo"))
    const p1 = h.match(/<article data-propuesta="P1"[\s\S]*?<\/article>/)?.[0] ?? ""
    expect(p1).not.toContain("data-boton-video"); expect(p1).not.toContain("data-sin-video")
    const orden = ["data-guion-grafico", "data-costo", "data-texto-publicacion", "data-por-que"].map((a) => p1.indexOf(`${a}="true"`))
    expect(orden.every((x, i) => x > 0 && (i === 0 || x > orden[i - 1]))).toBe(true)
    const texto = p1.match(/<div data-texto-publicacion[\s\S]*?<\/div>/)?.[0] ?? ""
    expect(texto).toContain("Recién armados."); expect(texto).toContain("Pide por WhatsApp"); expect(texto).toContain("#flores #ramos")
    const p2 = h.match(/<article data-propuesta="P2"[\s\S]*?<\/article>/)?.[0] ?? ""
    expect(p2.match(/<p data-costo[\s\S]*?<\/p>/)?.[0].match(/data-sin-dato/g)).toHaveLength(2)
  })
})

describe("4 · imagen con la misma tarjeta: nada de lo que hoy se muestra se pierde", () => {
  it("la historia de 5: «Historia · 5 láminas», «1–4 de 5», foto propia donde la hay, y la 5 (sin imagen) dice qué se verá tras la flecha", () => {
    const c = abrir(decision(historia(), "Floristería Pétalo"))
    const t = tarjeta(c, "P1")
    expect(t.textContent).toContain("Historia · 5 láminas")
    expect(t.querySelector("[data-cuantos]")?.textContent).toBe("1–4 de 5")
    expect(t.querySelectorAll("[data-foto-propia]")).toHaveLength(1)
    fireEvent.click(t.querySelector('[data-flecha="despues"]')!)
    const quinta = t.querySelector('[data-lamina="5"]') as HTMLElement
    expect(quinta.textContent).toContain("Lámina 5 · Llamado"); expect(quinta.querySelector("[data-cuadro-vacio]")?.textContent).toBe("Ramo 5"); expect(quinta.querySelector("img")).toBeNull()
  })
  it("las láminas no se recortan (contain) y llevan la proporción de su clase; el video sí se encuadra (cover) en 9:16", () => {
    const h = dibujar(decision(historia(), "Floristería Pétalo"))
    expect(h.match(/<img[^>]*data-cuadro[^>]*>/)?.[0]).toMatch(/aspect-\[9\/16\][^"]*object-contain/)
    const v = dibujar(decision(video(), "Taller El Pistón"))
    expect(v.match(/<img[^>]*data-cuadro[^>]*>/)?.[0]).toMatch(/aspect-\[9\/16\][^"]*object-cover/)
    const carrusel = { ...historia(), clase: "carrusel" }
    expect(dibujar(decision(carrusel, "Floristería Pétalo")).match(/<img[^>]*data-cuadro[^>]*>/)?.[0]).toContain("aspect-[4/5]")
  })
})
