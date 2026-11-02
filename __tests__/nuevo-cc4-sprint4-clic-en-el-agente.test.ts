import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena, type EscenaDatos } from "@/lib/escena-avatares"
import { datosDelAgente, ElAgenteAhora } from "@/components/nuevo/escena/ElAgenteAhora"

const ahora = new Date("2026-11-03T15:00:00Z")
const base = armarEscena({ despachos: [], invocaciones: [], directorio: [], agentes: [], clientes: [], equipos: null, ahora })
const conAsiento = (): EscenaDatos => {
  const e = structuredClone(base)
  e.mesas[0].sentados = [{ agente: "growth-hacker", nombre: "Growth Hacker", mesa: e.mesas[0].clave, estado: "trabajando", cliente: "Náufrago", flujo: "Plan de 90 días", paso: "Paso 2 de 5", tarea: "Armar el calendario de TikTok", desde: "2026-11-03T14:50:00Z", hace: "hace 10 min", gasto_usd: null, fuente: "x", origen_de_la_mesa: "mapa", ejecucion: "exec-123" }]
  e.entregas = { entregas: [{ id: "e1", agente: "growth-hacker", titulo: "Cevichería · tiktok", cerrado_en: "2026-11-03T13:00:00Z" }, { id: "e0", agente: "growth-hacker", titulo: "Otra más vieja", cerrado_en: "2026-11-03T09:00:00Z" }], revisiones: [], firma: { pendientes: 0 } }
  return e
}

describe("sprint 4 · clic en el agente (cola de CC4 · 03-nov)", () => {
  it("junta del dato de la escena: en qué está (cliente, tarea, paso, desde cuándo), su última entrega y su corrida", () => {
    const d = datosDelAgente("growth-hacker", conAsiento(), ahora)
    expect(d.ahora).toMatchObject({ donde: "mesa", cliente: "Náufrago", tarea: "Armar el calendario de TikTok", paso: "Paso 2 de 5", hace: "hace 10 min", fallo: false })
    expect(d.ejecucion).toBe("exec-123")
    expect(d.entrega?.titulo).toBe("Cevichería · tiktok") // la más reciente
  })
  it("sin trabajo ni entregas no inventa nada; el nombre con otra grafía es el mismo empleado", () => {
    const d = datosDelAgente("alguien-que-no-esta", base, ahora)
    expect(d).toMatchObject({ ahora: null, ejecucion: null, entrega: null })
    expect(datosDelAgente("growth_hacker", conAsiento(), ahora).ahora?.cliente).toBe("Náufrago")
  })
  it("la tarjeta: ahora, última entrega, enlace a Observabilidad, ficha completa y los dos huecos reservados (sin construir)", () => {
    const html = renderToStaticMarkup(createElement(ElAgenteAhora, { datos: datosDelAgente("growth-hacker", conAsiento(), ahora), onCerrar: () => {}, onFicha: () => {} }))
    expect(html).toContain('data-el-agente-ahora="growth-hacker"')
    expect(html).toContain("nv-panel") // el chat de abajo sigue visible
    expect(html).toContain("Armar el calendario de TikTok")
    expect(html).toContain("Paso 2 de 5") // un paso legible sí; un identificador no
    expect(html).not.toContain("Plan de 90 días") // el flujo no se muestra (texto técnico)
    expect(renderToStaticMarkup(createElement(ElAgenteAhora, { datos: { ...datosDelAgente("growth-hacker", conAsiento(), ahora), ahora: { donde: "mesa", cliente: "Náufrago", flujo: "w1", tarea: null, paso: "calendario", hace: "hace 1 min", fallo: false } }, onCerrar: () => {}, onFicha: () => {} }))).not.toMatch(/w1|calendario/)
    expect(html).toContain("Cevichería · tiktok")
    expect(html).toContain("Ver su corrida en Observabilidad")
    expect(html).toContain("Ver su ficha completa")
    expect(html).toContain("data-rendimiento") // «Rendimiento» abre la ficha que ya existe (la de la flecha de CC6)
    expect(html).not.toContain("Rendimiento · pronto")
    expect(html).toContain('data-reservado="preguntarle"')
    expect(html).not.toContain("data-aporte") // fuera de la sala no hay «aporte»
    const vacia = renderToStaticMarkup(createElement(ElAgenteAhora, { datos: datosDelAgente("nadie", base, ahora), onCerrar: () => {}, onFicha: () => {} }))
    expect(vacia).toContain("sin trabajo en curso")
    expect(vacia).toContain("sin entregas en las últimas 24 h")
    expect(vacia).toContain("Sin corrida registrada")
  })
  it("el cuerpo de CUALQUIER silueta lo abre (con ratón y con teclado) y la flecha de CC6 no se toca; solo lectura", () => {
    const sil = readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")
    expect(sil).toMatch(/onClick=\{onTocar \?/)
    expect(sil).toContain('e.key === "Enter"')
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain("onTocar={(a) => setTocado(a)}")
    expect(av).toContain("<FlechasDeForma />")
    const tarjeta = readFileSync("components/nuevo/escena/ElAgenteAhora.tsx", "utf8")
    expect(tarjeta).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/)
    expect(tarjeta.match(/fetch\(/g)).toHaveLength(1) // lo único que pide: el rendimiento, por la ruta que ya lee la flecha
    expect(tarjeta).toContain('fetch("/api/rendimiento"')
    expect(tarjeta).toContain("FichaDeRendimiento") // su componente, sin tocar su código
  })
})
