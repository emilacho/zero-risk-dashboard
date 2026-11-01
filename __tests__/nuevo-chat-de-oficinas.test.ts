import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { causaDelFallo, leerEventos, leerPedido, textoParaVoz } from "@/lib/chat-oficinas"

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
  it("sigue siempre visible: el cuadro nunca se oculta ni se tapa", () => {
    expect(c).toContain("data-chat-de-oficinas")
    expect(c).toContain("Habla con tus oficinas…")
    expect(c).not.toContain("absolute bottom-full")
  })
  it("las respuestas van AL LADO del cuadro: solo texto blanco, sin ventana, borde, fondo, desenfoque ni botón de cerrar", () => {
    const zona = c.slice(c.indexOf("data-chat-respuestas"), c.indexOf("<form onSubmit"))
    expect(zona.length).toBeGreaterThan(200)
    expect(zona).toContain("text-white")
    expect(zona).toContain("overflow-y-auto")
    expect(zona).toContain("min-[1100px]:left-full")
    expect(zona).not.toMatch(/bg-(?!transparent)|border|border-|rounded-|backdrop|shadow|role="dialog"|aria-modal/)
    expect(c).not.toContain("data-chat-conversacion")
    expect(c).not.toContain("Cerrar la conversación")
  })
  it("una respuesta larga se ve completa: nada la corta (sin line-clamp, sin truncate, sin altura que esconda texto)", () => {
    const zona = c.slice(c.indexOf("data-chat-respuestas"), c.indexOf("<form onSubmit"))
    expect(zona).not.toMatch(/line-clamp|truncate|text-ellipsis|overflow-hidden/)
  })
  it("el error se dice con su causa en vez del genérico, y un fallo que no es del flujo (500, 404) también", () => {
    expect(c).toContain("causaDelFallo(fallo)")
    expect(c).not.toContain("No pude responder ahora. Inténtalo")
    expect(c).toMatch(/!r\.ok && !\(r\.headers\.get\("content-type"\)/)
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

describe("chat de /nuevo · la causa del fallo", () => {
  it("sesión vencida, sin permiso y sin llave se dicen claro", () => {
    expect(causaDelFallo({ message: "unauthenticated" })).toMatch(/sesión venció/)
    expect(causaDelFallo({ message: "forbidden" })).toMatch(/permiso de administrador.*403/)
    expect(causaDelFallo({ message: "anthropic_api_key_missing" })).toMatch(/no tiene la llave/)
  })
  it("el proveedor: llave rechazada, sin saldo, límite, saturado, modelo y permiso", () => {
    const e = (status: number, type: string, message = "x") => causaDelFallo({ message: "anthropic_api_error", status, details: JSON.stringify({ type: "error", error: { type, message } }) })
    expect(e(401, "authentication_error")).toMatch(/rechazó la llave.*401/)
    expect(e(400, "invalid_request_error", "Your credit balance is too low to access the API")).toMatch(/no hay saldo/)
    expect(e(403, "permission_error")).toMatch(/no permite esta llave.*403/)
    expect(e(404, "not_found_error")).toMatch(/no encuentra el modelo/)
    expect(e(429, "rate_limit_error")).toMatch(/429/)
    expect(e(529, "overloaded_error")).toMatch(/saturado/)
    expect(e(500, "api_error")).toMatch(/saturado o caído \(500\)/)
  })
  it("un detalle que no es JSON no rompe la explicación y nunca deja pasar una llave", () => {
    expect(causaDelFallo({ message: "anthropic_api_error", status: 400, details: "<html>" })).toMatch(/respondió 400/)
    const t = causaDelFallo({ message: "anthropic_api_error", status: 400, details: JSON.stringify({ error: { type: "invalid_request_error", message: "bad key sk-ant-api03-ABCDEF" } }) })
    expect(t).not.toMatch(/sk-ant/)
    expect(t).toContain("***")
  })
  it("un fallo que no vino del flujo se dice con el código; sin conexión y corte también", () => {
    expect(causaDelFallo({ http: 500 })).toMatch(/dashboard falló \(500\)/)
    // el control de acceso del dashboard corta con 401/403 en JSON antes de llegar a la ruta
    expect(causaDelFallo({ http: 401 })).toMatch(/sesión venció/)
    expect(causaDelFallo({ http: 403 })).toMatch(/permiso de administrador/)
    expect(causaDelFallo({ http: 404 })).toMatch(/rechazó el mensaje \(404\)/)
    expect(causaDelFallo({ message: "sin_conexion" })).toMatch(/revisa tu conexión/)
    expect(causaDelFallo({ message: "stream_interrupted" })).toMatch(/se cortó/)
    expect(causaDelFallo({ message: "algo raro" })).toContain("algo raro")
    expect(causaDelFallo({})).toMatch(/No pude responder/)
  })
})
