import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { leerEventos, leerPedido, textoParaVoz } from "@/lib/chat-oficinas"

const leer = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n")

/** solo el código: los comentarios pueden NOMBRAR lo que está prohibido (para explicarlo) sin que cuente como uso */
const codigo = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("chat de /nuevo · leer el flujo de eventos", () => {
  it("separa eventos completos y deja lo que falta para la próxima lectura", () => {
    const { eventos, resto } = leerEventos('event: text\ndata: {"value":"Ho"}\n\nevent: text\ndata: {"value":"la"}\n\nevent: do')
    expect(eventos).toEqual([{ event: "text", data: { value: "Ho" } }, { event: "text", data: { value: "la" } }])
    expect(resto).toBe("event: do")
  })
  it("un evento cortado a la mitad se completa en la lectura siguiente", () => {
    const a = leerEventos('event: text\ndata: {"val')
    expect(a.eventos).toEqual([])
    const b = leerEventos(a.resto + 'ue":"ok"}\n\n')
    expect(b.eventos).toEqual([{ event: "text", data: { value: "ok" } }])
  })
  it("un evento roto o sin datos no tumba la conversación", () => {
    const { eventos } = leerEventos('event: text\ndata: {no es json}\n\n: comentario\n\nevent: done\ndata: {"stop_reason":"end_turn"}\n\n')
    expect(eventos).toEqual([{ event: "done", data: { stop_reason: "end_turn" } }])
  })
  it("acepta saltos de línea de Windows", () => {
    const { eventos } = leerEventos('event: error\r\ndata: {"message":"x"}\r\n\r\n')
    expect(eventos).toEqual([{ event: "error", data: { message: "x" } }])
  })
})

describe("chat de /nuevo · texto para leer en voz alta", () => {
  it("quita marcas de markdown, viñetas y enlaces", () => {
    const v = textoParaVoz("## Estado\n- **Náufrago** tiene `2` avisos\n- Mira [el panel](https://x.test/a)\n\n```js\ncodigo()\n```")
    expect(v).toBe("Estado Náufrago tiene 2 avisos Mira el panel")
  })
  it("recorta una respuesta larga en un final de frase", () => {
    const largo = "Una frase corta. ".repeat(80)
    const v = textoParaVoz(largo, 100)
    expect(v.length).toBeLessThanOrEqual(100)
    expect(v.endsWith(".")).toBe(true)
  })
  it("un texto vacío o solo de símbolos no deja nada que leer", () => {
    expect(textoParaVoz("  ** __ ")).toBe("")
  })
})

describe("chat de /nuevo · el pedido propuesto", () => {
  it("lee título y detalle y acota el largo", () => {
    expect(leerPedido({ titulo: "  Arreglar X ", detalle: "y" })).toEqual({ titulo: "Arreglar X", detalle: "y" })
    expect(leerPedido({ titulo: "a".repeat(500), detalle: "b".repeat(5000) })).toEqual({ titulo: "a".repeat(140), detalle: "b".repeat(1500) })
  })
  it("sin título o sin detalle, o con tipos raros, no hay pedido", () => {
    expect(leerPedido(undefined)).toBeNull()
    expect(leerPedido({ titulo: "x" })).toBeNull()
    expect(leerPedido({ titulo: 3, detalle: {} })).toBeNull()
  })
})

describe("chat de /nuevo · lo que el servidor puede y no puede hacer", () => {
  const ruta = leer("app/api/cowork/prompt/route.ts")
  it("la única herramienta es proponer un pedido; no hay manera de despachar un flujo", () => {
    expect(ruta).toContain("const TOOLS = [PEDIDO_TOOL]")
    expect(ruta).not.toMatch(/trigger_workflow|TRIGGER_WORKFLOW|suggest_form_update/)
    expect(codigo(ruta)).not.toMatch(/n8n|N8N_/i)
  })
  it("pide sesión de administrador antes de gastar y no baja direcciones que mande el navegador", () => {
    expect(ruta).toMatch(/unauthenticated[\s\S]*forbidden/)
    expect(ruta).toContain("const attachments: Attachment[] = []")
  })
  it("el asistente habla con tuteo, sin avisos de gasto, y se le dice cuándo la respuesta se lee en voz alta", () => {
    expect(ruta).toContain("con tuteo (nunca voseo)")
    expect(ruta).toContain("LEER EN VOZ ALTA")
    expect(ruta).not.toMatch(/gasto|costo|US\$/i)
  })
  it("el pedido solo anota: sin Slack, sin n8n, sin agentes, y solo para el administrador", () => {
    const p = leer("app/api/cowork/pedido/route.ts")
    expect(p).toContain('status: "pending"')
    expect(p).toContain("pedido_para_lenovo")
    expect(p).toMatch(/forbidden/)
    expect(codigo(p)).not.toMatch(/SLACK|fetch\(|n8n/i)
  })
})

describe("chat de /nuevo · el cuadro", () => {
  const c = leer("components/nuevo/ChatDeOficinas.tsx")
  it("sigue siempre visible: la conversación se abre encima y el cuadro se queda", () => {
    expect(c).toContain("data-chat-de-oficinas")
    expect(c).toContain("absolute bottom-full")
    expect(c).toContain("Habla con tus oficinas…")
  })
  it("el micrófono usa solo el navegador (sin costo) y se corta al tocarlo de nuevo", () => {
    expect(c).toMatch(/SpeechRecognition/)
    expect(c).toMatch(/speechSynthesis/)
    expect(c).toContain("alternarVoz")
    expect(c).toContain("apagarVoz")
    expect(c).toContain("speechSynthesis?.cancel()")
    expect(c).toContain('"Hola, te escucho."')
  })
  it("la llave del modelo nunca está en el navegador", () => {
    expect(c).not.toMatch(/ANTHROPIC|api\.anthropic\.com|x-api-key/)
  })
  it("lo que pide construir se anota como pedido solo al tocar el botón", () => {
    expect(c).toContain("/api/cowork/pedido")
    expect(c).toContain("Dejar como pedido")
  })
})
