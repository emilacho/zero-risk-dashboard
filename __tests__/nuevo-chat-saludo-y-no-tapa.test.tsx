import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"

const chat = readFileSync("components/nuevo/ChatDeOficinas.tsx", "utf8")
const css = readFileSync("app/globals.css", "utf8")
const ruta = readFileSync("app/api/cowork/prompt/route.ts", "utf8")

describe("3-nov · el chat saluda como el asistente de Zero Risk y no tapa los paneles", () => {
  it("el asistente ya no se presenta con la lista genérica de cuentas y facturación", () => {
    expect(ruta).not.toMatch(/jefe de operaciones: cuentas, empleados, servicios, proveedores, entregas/)
    expect(ruta).toContain("eres el asistente de Zero Risk, la agencia de marketing")
    expect(ruta).toMatch(/NUNCA menciones «cuentas y facturación»/)
    for (const t of ["el manual de marca", "el plan", "decisiones pendientes", "anotar un pedido"]) expect(ruta).toContain(t)
  })
  it("con un panel abierto el chat se pliega solo a un botón chico que se abre al tocarlo", () => {
    expect(chat).toContain('document.querySelector(".nv-panel")')
    expect(chat).toContain("const plegado = panelAbierto && !desplegado")
    expect(chat).toContain("data-chat-boton")
    expect(chat).toContain("data-chat-plegar")
  })
  it("plegado, el cuadro deja de llevar data-chat-de-oficinas: el panel recupera todo su alto", () => {
    expect(chat).toContain('{...(plegado ? {} : { "data-chat-de-oficinas": "" })}')
    expect(chat).toContain('${plegado ? " hidden" : ""}')
  })
  it("el botón plegado vive en el cuerpo de la página por encima de los paneles (z-80 > z-70) y es de 56 px", () => {
    expect(chat).toMatch(/createPortal\(\s*<button[^>]*data-chat-boton/s)
    expect(chat).toContain("z-[80]")
    expect(chat).toContain("h-14 w-14")
  })
  it("al cambiar el estado del panel, el chat vuelve a plegarse (no queda desplegado de la vez anterior)", () => {
    expect(chat).toMatch(/if \(antes !== hay\) setDesplegado\(false\)/)
  })
  it("el botón de plegar mide 44 px y, con el chat plegado, el panel deja una franja libre para que el botón no tape nada", () => {
    expect(chat).toMatch(/data-chat-plegar[^]*?h-11 w-11/)
    expect(css).toContain("body:has([data-chat-boton]) .nv-panel { padding-bottom: 76px; }")
  })
})

describe("3-nov · el saludo viejo guardado no se presenta como la conversación de hoy", () => {
  const hist = readFileSync("app/api/cowork/prompt-history/route.ts", "utf8")
  it("el chat pide solo las últimas 12 horas", () => {
    expect(chat).toContain("&limit=20&max_edad_horas=12")
  })
  it("la ruta filtra por created_at cuando llega max_edad_horas y no borra nada", () => {
    expect(hist).toContain('url.searchParams.get("max_edad_horas")')
    expect(hist).toContain('consulta.gte("created_at", desde)')
    expect(hist).not.toMatch(/\.delete\(/)
  })
})
