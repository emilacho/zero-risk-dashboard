/** 06-nov · SELECTOR ÚNICO DE CLIENTE (boceto 2, aprobado tal cual por Emilio). US$ 0 · sin red. */
import { afterEach, describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { elegirTodosLosClientes, escucharClienteDeTrabajo, guardarClienteDeTrabajo, leerClienteDeTrabajo, EVENTO_CLIENTE_DE_TRABAJO, type ClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { conIdYCampana } from "@/lib/cliente-financiero"
import { ESTADOS_VIVOS } from "@/lib/pizarron-datos"
import { SelectorDeCliente, estadoJuntoAlNombre, type ClienteDeLaLista } from "@/components/nuevo/SelectorDeCliente"
import { ClienteComoTexto, NotaDeTodos } from "@/components/nuevo/ClienteComoTexto"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZR = "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5"
const g = globalThis as unknown as { window?: unknown }

/** una ventana falsa con almacenamiento y avisos de verdad (EventTarget) */
function ventana() {
  const mem = new Map<string, string>(), t = new EventTarget(), avisos: ClienteDeTrabajo[] = []
  t.addEventListener(EVENTO_CLIENTE_DE_TRABAJO, (e) => avisos.push((e as CustomEvent<ClienteDeTrabajo>).detail))
  const w = Object.assign(t, { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } })
  g.window = w
  return { w, mem, avisos }
}

describe("el cliente de trabajo: uno solo, elegido arriba", () => {
  afterEach(() => { delete g.window })
  it("elegir un cliente lo guarda y avisa a los paneles UNA vez; repetir el mismo no avisa", () => {
    const { avisos } = ventana()
    guardarClienteDeTrabajo({ id: NAUFRAGO, nombre: "Náufrago", todos: false })
    expect(leerClienteDeTrabajo()).toEqual({ id: NAUFRAGO, nombre: "Náufrago", todos: false })
    guardarClienteDeTrabajo({ id: NAUFRAGO, nombre: "Náufrago", todos: false })
    expect(avisos).toEqual([{ id: NAUFRAGO, nombre: "Náufrago", todos: false }])
    guardarClienteDeTrabajo({ id: ZR, nombre: "Zero Risk", todos: false })
    expect(avisos.map((a) => a.id)).toEqual([NAUFRAGO, ZR])
  })
  it("«Todos los clientes» recuerda el último cliente (los paneles de uno solo siguen con ese); un panel que recuerda su cliente no apaga «Todos»", () => {
    const { avisos } = ventana()
    guardarClienteDeTrabajo({ id: NAUFRAGO, nombre: "Náufrago", todos: false })
    elegirTodosLosClientes()
    expect(leerClienteDeTrabajo()).toEqual({ id: NAUFRAGO, nombre: "Náufrago", todos: true })
    elegirTodosLosClientes()
    expect(avisos).toHaveLength(2) // el segundo «Todos» no avisa otra vez
    guardarClienteDeTrabajo({ id: ZR, nombre: "Zero Risk" }) // sin decir nada de «todos»
    expect(leerClienteDeTrabajo()?.todos).toBe(true)
    guardarClienteDeTrabajo({ id: ZR, nombre: "Zero Risk", todos: false }) // el selector de arriba sí lo apaga
    expect(leerClienteDeTrabajo()?.todos).toBe(false)
  })
  it("los paneles se enteran en esta pestaña (aviso) y en otra (almacenamiento); dejar de escuchar corta los dos", () => {
    const { w, mem } = ventana()
    const vistos: Array<ClienteDeTrabajo | null> = []
    const soltar = escucharClienteDeTrabajo(w as never, (c) => vistos.push(c))
    guardarClienteDeTrabajo({ id: NAUFRAGO, nombre: "Náufrago", todos: false })
    mem.set("nv-cliente-de-trabajo", JSON.stringify({ id: ZR, nombre: "Zero Risk", todos: false }))
    const otra = Object.assign(new Event("storage"), { key: "nv-cliente-de-trabajo" }); w.dispatchEvent(otra)
    const ajena = Object.assign(new Event("storage"), { key: "otra-clave" }); w.dispatchEvent(ajena)
    expect(vistos.map((c) => c?.id)).toEqual([NAUFRAGO, ZR])
    soltar()
    guardarClienteDeTrabajo({ id: NAUFRAGO, nombre: "Náufrago", todos: false }); w.dispatchEvent(otra)
    expect(vistos).toHaveLength(2)
  })
  it("sin almacenamiento no rompe nada", () => {
    g.window = Object.assign(new EventTarget(), { localStorage: { getItem: () => { throw new Error("x") }, setItem: () => { throw new Error("x") } } })
    expect(() => { guardarClienteDeTrabajo({ id: ZR }); elegirTodosLosClientes() }).not.toThrow()
    expect(leerClienteDeTrabajo()).toBeNull()
  })
})

describe("la lista de arriba: id de cada cliente y el estado que dice el panel", () => {
  const lista = [{ nombre: "Náufrago", ruta: "/nuevo/cliente/naufrago" }, { nombre: "Zero Risk", ruta: "/nuevo/cliente/zero-risk" }, { nombre: "Nuevo", ruta: "/nuevo/cliente/nuevo" }]
  const filas = [{ id: NAUFRAGO }, { id: ZR }, { id: "n3" }], nombres = ["Náufrago", "Zero Risk", "Nuevo"]
  it("la ÚLTIMA campaña da el estado; una viva (aunque no sea la última) cuenta como «con campaña»", () => {
    const r = conIdYCampana(lista, filas, nombres, [
      { client_id: NAUFRAGO, estado: "reemplazada" }, { client_id: NAUFRAGO, estado: "activa" }, { client_id: ZR, estado: "borrador" },
    ], ESTADOS_VIVOS)
    expect(r).toEqual([
      { nombre: "Náufrago", ruta: "/nuevo/cliente/naufrago", id: NAUFRAGO, con_campana: true, estado_campana: "reemplazada" },
      { nombre: "Zero Risk", ruta: "/nuevo/cliente/zero-risk", id: ZR, con_campana: false, estado_campana: "borrador" },
      { nombre: "Nuevo", ruta: "/nuevo/cliente/nuevo", id: "n3", con_campana: false, estado_campana: null },
    ])
    expect(r.map((c) => estadoJuntoAlNombre(c))).toEqual(["", "campaña en borrador", "sin campaña"])
  })
  it("si las campañas no se leen, la lista sale igual SIN estado (nunca uno inventado); un nombre sin fila queda sin id", () => {
    const r = conIdYCampana(lista, filas.slice(0, 2), nombres.slice(0, 2), null, ESTADOS_VIVOS)
    expect(r[0]).toEqual({ nombre: "Náufrago", ruta: "/nuevo/cliente/naufrago", id: NAUFRAGO })
    expect(r[2]).toEqual({ nombre: "Nuevo", ruta: "/nuevo/cliente/nuevo", id: null })
    expect(r.map((c) => estadoJuntoAlNombre(c))).toEqual(["", "", ""])
  })
  it("la ruta solo lee: clientes y campañas reales (sin las de ensayo)", () => {
    const ruta = readFileSync("app/api/direccion/clientes/route.ts", "utf8")
    expect(ruta).toContain('.from("cadena_campanas")'); expect(ruta).toContain('.eq("seco", false)')
    expect(ruta).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})

describe("cómo se ve", () => {
  const clientes: ClienteDeLaLista[] = [
    { nombre: "Náufrago", ruta: "/nuevo/cliente/naufrago", id: NAUFRAGO, con_campana: false, estado_campana: "reemplazada" },
    { nombre: "Zero Risk", ruta: "/nuevo/cliente/zero-risk", id: ZR, con_campana: true, estado_campana: "activa" },
  ]
  it("el botón dice el cliente elegido; abierto, marca ese, dice su estado y ofrece «Todos» solo para Dinero y Observabilidad", () => {
    const cerrado = renderToStaticMarkup(createElement(SelectorDeCliente, { inicial: clientes, elegidoInicial: { id: NAUFRAGO, nombre: "Náufrago" } }))
    expect(cerrado).toMatch(/data-cliente-elegido[^>]*>Náufrago</); expect(cerrado).not.toContain("data-lista-de-clientes")
    const h = renderToStaticMarkup(createElement(SelectorDeCliente, { inicial: clientes, abiertoInicial: true, elegidoInicial: { id: NAUFRAGO, nombre: "Náufrago" } }))
    expect(h).toMatch(/role="menuitemradio" aria-checked="true" data-cliente-del-selector="Náufrago"/)
    expect(h).toMatch(/role="menuitemradio" aria-checked="false" data-cliente-del-selector="Zero Risk"/)
    expect(h).toContain(">campaña archivada<"); expect(h.match(/data-estado-del-cliente/g)).toHaveLength(1)
    expect(h).toMatch(/data-todos-los-clientes[^>]*>.*Todos los clientes <span[^>]*>\(Dinero, Observabilidad\)/)
    expect(h).not.toContain("href=") // elegir ya no navega: la vista financiera se abre desde Dinero
  })
  it("con «Todos» arriba el botón lo dice y queda marcado; sin elección, «Elige un cliente»", () => {
    const h = renderToStaticMarkup(createElement(SelectorDeCliente, { inicial: clientes, abiertoInicial: true, elegidoInicial: { id: NAUFRAGO, nombre: "Náufrago", todos: true } }))
    expect(h).toMatch(/data-cliente-elegido[^>]*>Todos los clientes</)
    expect(h).toMatch(/aria-checked="true" data-todos-los-clientes/); expect(h).not.toMatch(/aria-checked="true" data-cliente-del-selector/)
    expect(renderToStaticMarkup(createElement(SelectorDeCliente, { inicial: clientes }))).toContain(">Elige un cliente<")
  })
  it("los paneles de un solo cliente lo dicen como texto; con «Todos», aclaran que siguen con el último", () => {
    expect(renderToStaticMarkup(createElement(ClienteComoTexto, { nombre: "Náufrago" }))).toMatch(/Cliente · <span data-cliente-nombre[^>]*>Náufrago<\/span><\/p>$/)
    expect(renderToStaticMarkup(createElement(ClienteComoTexto, { nombre: "Náufrago", todos: true }))).toContain("data-sigue-el-ultimo")
    expect(renderToStaticMarkup(createElement(ClienteComoTexto, { nombre: null }))).toContain(">sin elegir<")
    expect(renderToStaticMarkup(createElement(NotaDeTodos, {}))).toBe("")
    expect(renderToStaticMarkup(createElement(NotaDeTodos, { todos: true }))).toContain("aquí sigue el último cliente")
  })
  it("Esc cierra solo la lista y no se cuela a la escena", () => {
    const s = readFileSync("components/nuevo/SelectorDeCliente.tsx", "utf8")
    expect(s).toContain('e.stopPropagation(); e.preventDefault(); setAbierto(false)'); expect(s).toContain('window.addEventListener("keydown", tecla, true)')
  })
})
