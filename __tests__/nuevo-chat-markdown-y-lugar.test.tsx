import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TextoMarkdown } from "@/components/nuevo/TextoMarkdown"

const leer = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n")
const html = (t: string) => renderToStaticMarkup(<TextoMarkdown texto={t} />)

describe("chat de /nuevo · el markdown de las respuestas se ve aplicado", () => {
  it("las negritas, listas y numeradas se convierten en formato, no quedan los asteriscos", () => {
    const h = html("Hola **Emilio**\n\n- uno\n- dos\n\n1. a\n2. b")
    expect(h).toContain("<strong")
    expect(h).toContain("Emilio</strong>")
    expect(h).toContain("<ul")
    expect(h).toContain("<ol")
    expect(h).not.toContain("**")
  })
  it("los títulos con # se dicen como texto en negrita, sin tamaños grandes", () => {
    const h = html("## Estado\ntexto")
    expect(h).toContain("font-semibold")
    expect(h).not.toContain("<h2")
  })
  it("el HTML crudo no se ejecuta ni se deja pasar", () => {
    const h = html('<script>alert(1)</script><img src=x onerror=alert(1)>texto')
    expect(h).not.toContain("<script")
    expect(h).not.toContain("<img")
    expect(h).toContain("&lt;script&gt;") // queda como texto escapado, inerte
  })
  it("solo se abren enlaces http(s); javascript: queda como texto sin enlace", () => {
    expect(html("[sitio](https://zero.test/a)")).toMatch(/<a href="https:\/\/zero\.test\/a" target="_blank" rel="noopener noreferrer"/)
    const mal = html("[clic](javascript:alert(1))")
    expect(mal).not.toContain("<a")
    expect(mal).not.toContain("javascript:")
    expect(mal).toContain("clic")
  })
  it("una tabla se muestra como tabla de texto", () => {
    const h = html("| a | b |\n|---|---|\n| 1 | 2 |")
    expect(h).toContain("<table")
    expect(h).toContain("<th")
  })
  it("un texto a medias (mientras llega) no rompe nada", () => {
    expect(() => html("**negrita sin cerrar y [enlace sin")).not.toThrow()
  })
})

describe("chat de /nuevo · el estilo del texto y el lugar de las respuestas", () => {
  const md = leer("components/nuevo/TextoMarkdown.tsx")
  const c = leer("components/nuevo/ChatDeOficinas.tsx")
  const zona = c.slice(c.indexOf("data-chat-respuestas"), c.indexOf("<form onSubmit"))
  it("el formato sigue siendo solo texto: sin fondo, borde, sombra ni esquinas redondeadas", () => {
    expect(md).not.toMatch(/bg-(?!transparent)|border|rounded-|backdrop|shadow/)
  })
  it("la zona usa el markdown, ya sin conservar los saltos crudos", () => {
    expect(zona).toContain("<TextoMarkdown")
    expect(zona).not.toContain("whitespace-pre-wrap")
  })
  it("en pantalla angosta las respuestas van ENCIMA del cuadro y nunca lo tapan; en ancha, al lado y más altas", () => {
    expect(zona).toContain("bottom-[calc(100%+0.5rem)]")
    expect(zona).not.toMatch(/absolute bottom-0 left-0 right-0/)
    expect(zona).toContain("min-[1100px]:left-full")
    expect(zona).toContain("min-[1100px]:h-[min(55vh,26rem)]")
    expect(zona).toContain("overflow-y-auto")
  })
})
