/**
 * LAS ALERTAS SE ABREN EN EL LUGAR (CC5 · 11-nov · boceto v2 aprobado por Emilio 20:47 Zúrich · GO Lenovo 20:49). US$ 0 · sin red.
 * Emilio (20:30): «que no me lleve a Decisiones en mi oficina, sino que abra esa instancia in situ».
 * 1) las piezas iguales (mismo tipo y mismo cliente) van en UN renglón «DECISIÓN N» que se despliega ahí mismo: nombre legible, miniatura, estado corto, sin precios;
 * 2) tocar una pieza abre su visor encima (el MISMO visor de Piezas, sin el explorador) con «Volver a las alertas»; una sola pieza se abre directo;
 * 3) abrirla la marca como vista. Lo que no es pieza sigue yendo a su lugar como antes.
 * Dos clientes de rubros distintos (restaurante y seguridad industrial): nada depende de un cliente.
 */
import { describe, expect, it, vi } from "vitest"
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ListaDeLasAlertas, escucharEscDeLaLista, estadoCortoDeLaPieza, leerLasPiezas, marcarVistaAlAbrir, VOLVER_A_LAS_ALERTAS } from "@/components/nuevo/escena/AntenaDeAlertas"
import { PanelPiezas, alCambiarElClienteDelVisor } from "@/components/nuevo/PanelPiezas"
import { armarAlertas, esPiezaDeLaBandeja, renglonesDeLaAntena, type AlertaDeLaAntena, type DecisionPendiente, type EntradaDeAlertas } from "@/lib/escena-alertas"
import { listarPiezas, type DetalleDeLaPieza, type FilaDeLaLista } from "@/lib/piezas-datos"

const AHORA = new Date("2026-11-11T20:36:00Z")
const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZR = "11111111-2222-4333-8444-555555555555"
// las 4 piezas reales pendientes de Náufrago (hitl_queue, leídas 11-nov ~20:36Z) + una de otro cliente y otro rubro
const REALES = [
  ["c3292641-5dae-4934-9142-3edcfaa159bf", "2026-11-11T18:45:13Z"],
  ["43097f11-d664-4e2b-830a-887b6914e213", "2026-11-11T16:35:35Z"],
  ["2b62b458-9789-44c3-8e4c-d51cd3e16a83", "2026-11-11T16:05:04Z"],
  ["319e8a8a-812e-4573-bbdd-d1a8566f3024", "2026-11-11T04:32:25Z"],
] as const
const OTRO = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const dec = (id: string, desde: string, extra: Partial<DecisionPendiente> = {}): DecisionPendiente => ({ id, tipo: "pieza", fuente: "hitl_queue", client_id: NAUFRAGO, desde, oficina: null, cliente: "Náufrago", alerta: { clave: `decision:hitl_queue:${id}`, estado: "nueva" }, ...extra })
const entrada = (decisiones: DecisionPendiente[]): EntradaDeAlertas => ({ cliente: null, ahora: AHORA, plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [], decisiones })
const fila = (id: string, titulo: string, extra: Partial<FilaDeLaLista> = {}): FilaDeLaLista => ({ id, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: titulo, carpeta: "Video corto Instagram", cliente_id: NAUFRAGO, cliente: "Náufrago", creada: "2026-11-11T18:45:13Z", gasto_usd: 5.12, incompleta: false, desacuerdos: 0, tiene_dibujo: true, es_video: true, ...extra })
const PIEZAS: Record<string, FilaDeLaLista> = {
  [REALES[0][0]]: fila(REALES[0][0], "Video corto Instagram · Náufrago · publica 14 nov"),
  [REALES[1][0]]: fila(REALES[1][0], "Pieza · Náufrago · publica 14 nov", { tiene_dibujo: false, es_video: false }),
  [REALES[2][0]]: fila(REALES[2][0], "Video corto Instagram · Náufrago · publica 21 nov"),
  [REALES[3][0]]: fila(REALES[3][0], "Video corto Instagram · Náufrago · publica 16 nov", { incompleta: true }),
  [OTRO]: fila(OTRO, "Carrusel LinkedIn · Zero Risk Seguridad Industrial · 3 dic", { cliente_id: ZR, cliente: "Zero Risk Seguridad Industrial", es_video: false }),
}
const cuatro = () => armarAlertas(entrada(REALES.map(([id, d]) => dec(id, d))))

/** busca en el árbol que devuelve la lista (sin dibujar) el elemento cuyo atributo vale eso */
function buscar(n: ReactNode, attr: string, valor: string): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(n)) { for (const x of n) { const r = buscar(x, attr, valor); if (r) return r } return null }
  if (!isValidElement(n)) return null
  const p = n.props as Record<string, unknown>
  if (p[attr] === valor) return n as ReactElement<Record<string, unknown>>
  return buscar(p.children as ReactNode, attr, valor)
}
const lista = (alertas: AlertaDeLaAntena[], extra: Partial<Parameters<typeof ListaDeLasAlertas>[0]> = {}) =>
  ListaDeLasAlertas({ alertas, onAbrir: () => undefined, onCerrar: () => undefined, ahora: AHORA.getTime(), ...extra })

describe("1 · las iguales en un renglón", () => {
  it("las 4 piezas de Náufrago: UN grupo con las 4, en el lugar de la más reciente", () => {
    const r = renglonesDeLaAntena(cuatro())
    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe("grupo")
    if (r[0].tipo !== "grupo") return
    expect(r[0].alertas.map((a) => a.pieza)).toEqual(REALES.map(([id]) => id))
    expect(r[0].texto).toBe("Piezas de la Campaña de Marketing esperan tu aprobación")
  })
  it("otro cliente u otro tipo de decisión no se juntan; una sola queda como renglón propio; el orden se respeta", () => {
    const al = armarAlertas(entrada([
      dec(REALES[0][0], REALES[0][1]), dec(REALES[2][0], REALES[2][1]),
      dec(OTRO, "2026-11-11T19:00:00Z", { client_id: ZR, cliente: "Zero Risk Seguridad Industrial" }),
      dec("gi-1", "2026-11-11T17:00:00Z", { tipo: "gran_idea", fuente: "cadena_campanas" }),
    ]))
    const r = renglonesDeLaAntena(al)
    expect(r.map((x) => (x.tipo === "grupo" ? `grupo:${x.alertas.length}` : x.alerta.cliente ?? x.alerta.tipo))).toEqual(["Zero Risk Seguridad Industrial", "grupo:2", "Náufrago"])
    // el aviso que no trae grupo (plan, pregunta…) nunca se junta
    expect(renglonesDeLaAntena([{ clave: "fallida:1", tipo: "fallida", texto: "El plan falló", cuando: AHORA.toISOString(), abre: "envivo", departamento: "marketing" }, { clave: "fallida:2", tipo: "fallida", texto: "El plan falló", cuando: AHORA.toISOString(), abre: "envivo", departamento: "marketing" }]).map((x) => x.tipo)).toEqual(["solo", "solo"])
    expect(renglonesDeLaAntena(undefined)).toEqual([])
  })
  it("solo la pieza de la bandeja trae `pieza` (se abre en el lugar); la gran idea, no", () => {
    const [gi] = armarAlertas(entrada([dec("gi-1", "2026-11-11T17:00:00Z", { tipo: "gran_idea", fuente: "cadena_campanas" })]))
    expect(gi.pieza).toBeUndefined(); expect(gi.abre).toBe("decisiones")
    const [p] = armarAlertas(entrada([dec(OTRO, "2026-11-11T19:00:00Z", { client_id: ZR })]))
    expect(p.pieza).toBe(OTRO)
  })
})

describe("2 · el renglón agrupado y su despliegue", () => {
  it("cerrado: «DECISIÓN» + 4 + la frase en plural + cliente y la última; sin «abre Decisiones», sin «Revisar», sin las piezas", () => {
    const h = renderToStaticMarkup(lista(cuatro(), { piezas: PIEZAS }))
    expect(h).toContain(">Decisión<"); expect(h).toMatch(/data-cuantas[^>]*>4</)
    expect(h).toContain("Piezas de la"); expect(h).toContain("esperan tu aprobación")
    expect(h).toContain("Náufrago · la última hace 2 horas")
    expect(h).not.toContain("abre Decisiones"); expect(h).not.toContain("data-revisar"); expect(h).not.toContain("data-desplegado")
    expect(h).toContain('aria-expanded="false"')
  })
  it("desplegado: una fila por pieza con su nombre legible, su miniatura y su estado corto; sin precios", () => {
    const al = cuatro()
    const clave = al[0].grupo!.clave
    const h = renderToStaticMarkup(lista(al, { piezas: PIEZAS, desplegados: { [clave]: true } }))
    expect(h).toContain('aria-expanded="true"')
    for (const [id] of REALES) { expect(h).toContain(`data-abre-pieza="${id}"`); expect(h).toContain(PIEZAS[id].titulo_legible) }
    expect(h).toContain(`src="/api/piezas/${REALES[0][0]}/video#t=1"`)
    expect(h).toContain('data-miniatura="sin-dibujo"'); expect(h).toContain("Sin dibujo: la decide una persona")
    expect(h).toContain("La revisión no terminó"); expect(h).toContain("Lista para tu aprobación")
    expect(h).not.toMatch(/US\$|5,12|abre Decisiones/)
  })
  it("sin la bandeja (no se pudo leer): la fila dice lo que trae el aviso, sin miniatura inventada", () => {
    const al = cuatro()
    const h = renderToStaticMarkup(lista(al, { piezas: null, desplegados: { [al[0].grupo!.clave]: true } }))
    expect(h).toContain('data-miniatura="sin-dato"'); expect(h).not.toContain("<video"); expect(h).toContain("Espera tu aprobación")
  })
  it("otro cliente, otra red: su miniatura es la lámina 1", () => {
    const al = armarAlertas(entrada([dec(OTRO, "2026-11-11T19:00:00Z", { client_id: ZR, cliente: "Zero Risk Seguridad Industrial" }), dec("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-11-11T18:00:00Z", { client_id: ZR, cliente: "Zero Risk Seguridad Industrial" })]))
    const h = renderToStaticMarkup(lista(al, { piezas: PIEZAS, desplegados: { [al[0].grupo!.clave]: true } }))
    expect(h).toContain(`src="/api/piezas/${OTRO}/lamina/1"`); expect(h).toContain("Carrusel LinkedIn · Zero Risk Seguridad Industrial · 3 dic")
    expect(h).toContain("Zero Risk Seguridad Industrial · la última")
  })
})

describe("3 · tocar abre en el lugar", () => {
  it("el renglón agrupado se despliega; una pieza del despliegue se abre en el lugar (no va a Decisiones)", () => {
    const al = cuatro(), clave = al[0].grupo!.clave
    const alDesplegar = vi.fn(), alAbrirPieza = vi.fn(), onAbrir = vi.fn()
    ;(buscar(lista(al, { alDesplegar }), "data-desplegar", clave)!.props.onClick as () => void)()
    expect(alDesplegar).toHaveBeenCalledWith(clave)
    const el = lista(al, { desplegados: { [clave]: true }, alAbrirPieza, onAbrir, piezas: PIEZAS })
    ;(buscar(el, "data-abre-pieza", REALES[3][0])!.props.onClick as () => void)()
    expect(alAbrirPieza).toHaveBeenCalledTimes(1); expect(alAbrirPieza.mock.calls[0][0].pieza).toBe(REALES[3][0]); expect(onAbrir).not.toHaveBeenCalled()
  })
  it("una sola pieza: se abre directo, sin «abre Decisiones»; conserva su «Revisar»", () => {
    const al = armarAlertas(entrada([dec(OTRO, "2026-11-11T19:00:00Z", { client_id: ZR, cliente: "Zero Risk Seguridad Industrial" })]))
    const alAbrirPieza = vi.fn(), onAbrir = vi.fn()
    const el = lista(al, { alAbrirPieza, onAbrir })
    const h = renderToStaticMarkup(el)
    expect(h).not.toContain("abre Decisiones"); expect(h).toContain(`data-revisar="decision:hitl_queue:${OTRO}"`)
    ;(buscar(el, "data-abre-pieza", OTRO)!.props.onClick as () => void)()
    expect(alAbrirPieza).toHaveBeenCalledTimes(1); expect(onAbrir).not.toHaveBeenCalled()
  })
  it("sin quien la abra en el lugar (otro panel), la pieza va a su lugar como antes", () => {
    const al = armarAlertas(entrada([dec(OTRO, "2026-11-11T19:00:00Z")]))
    const onAbrir = vi.fn()
    const h = renderToStaticMarkup(lista(al, { onAbrir }))
    expect(h).toContain("abre Decisiones")
  })
})

describe("4 · el visor en el lugar es el mismo visor, sin el explorador", () => {
  const VIDEO = { nombre: "v.mp4", bytes: 1, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-18T04:28:33Z", url_proveedor: null }
  const detalle = (id: string, cliente: string, titulo: string): DetalleDeLaPieza => ({
    id, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo, cliente, creada: "2026-11-11T04:32:25Z",
    familia: "video_mesa", brief_id: "b", encargo_id: "86ae3cd3-3490-4225-9dc6-1e8e8029a615", gasto_usd: 1, laminas: [], pie: null, video: VIDEO, guion: null, avisos: [], exige_casilla: false,
    jefatura: { resultado: "limpia", desacuerdos: [], opinion_externa: null, revision_id: null }, aportes: [], version: 1, resumen_de_la_bandeja: null,
    acompana: { fila: null, productores: [], decidida_en: null, rehechura: null },
  } as unknown as DetalleDeLaPieza)
  const bandeja = (d: DetalleDeLaPieza) => ({ estado: "todas" as const, por_aprobar: 1, piezas: [fila(d.id, d.titulo, { cliente: d.cliente })], otras: [], clientes: [{ id: NAUFRAGO, nombre: d.cliente }], leido_en: "x" })
  it("sin cabecera, sin migas, sin carpetas; con «Volver a las alertas» y los botones de decidir (dos clientes)", () => {
    for (const d of [detalle(REALES[3][0], "Náufrago", "Video corto Instagram · Náufrago · publica 16 nov"), detalle(OTRO, "Zero Risk Seguridad Industrial", "Video TikTok · Zero Risk Seguridad Industrial · publica 3 dic")]) {
      const h = renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(d) as never, piezaInicialDatos: d, piezaInicial: d.id, soloLaPieza: { volverA: VOLVER_A_LAS_ALERTAS } }))
      expect(h).toContain('data-en-el-lugar="true"')
      expect(h).not.toContain("data-cliente-cabecera"); expect(h).toMatch(/<h2 id="piezas-titulo" class="sr-only">/); expect(h).not.toContain("data-ruta"); expect(h).not.toContain('aria-label="Las carpetas del cliente"')
      expect(h).toContain('data-accion="volver-a-las-alertas"'); expect(h).toContain("Volver a las alertas"); expect(h).not.toContain('data-accion="volver-a-la-carpeta"')
      expect(h).toContain(d.titulo); expect(h).toContain('data-accion="pieza-aprobar"'); expect(h).toContain(`src="/api/piezas/${d.id}/video"`)
    }
  })
  it("el explorador de siempre no cambia", () => {
    const d = detalle(REALES[3][0], "Náufrago", "Video corto Instagram · Náufrago · publica 16 nov")
    const h = renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(d) as never, piezaInicialDatos: d }))
    expect(h).toContain('id="piezas-titulo"'); expect(h).toContain("data-ruta"); expect(h).toContain('data-accion="volver-a-la-carpeta"'); expect(h).not.toContain("data-en-el-lugar")
  })
})

describe("5 · lecturas y palabras", () => {
  it("leerLasPiezas: la bandeja por aprobar, por id; si falla, null (no se inventa)", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ ok: true, piezas: [PIEZAS[OTRO]] }), { status: 200 }))
    const m = await leerLasPiezas(ok as never)
    expect(ok).toHaveBeenCalledWith("/api/bandeja?estado=pendiente", { cache: "no-store" }); expect(m?.[OTRO]?.titulo_legible).toBe(PIEZAS[OTRO].titulo_legible)
    expect(await leerLasPiezas((async () => new Response("{}", { status: 401 })) as never)).toBeNull()
    expect(await leerLasPiezas((async () => { throw new Error("red") }) as never)).toBeNull()
    expect(await leerLasPiezas((async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as never)).toBeNull()
  })
  it("estadoCortoDeLaPieza", () => {
    expect(estadoCortoDeLaPieza(null)).toBe("Espera tu aprobación")
    expect(estadoCortoDeLaPieza({ tiene_dibujo: false, incompleta: true })).toBe("Sin dibujo: la decide una persona")
    expect(estadoCortoDeLaPieza({ tiene_dibujo: true, incompleta: true })).toBe("La revisión no terminó")
    expect(estadoCortoDeLaPieza({ tiene_dibujo: true, incompleta: false })).toBe("Lista para tu aprobación")
  })
})

describe("6 · lo que pidió CC6 (certificación de fcba87b6)", () => {
  const ventana = () => {
    const oyentes = new Map<string, unknown>()
    return { oyentes, w: { addEventListener: (t: string, f: unknown) => oyentes.set(t, f), removeEventListener: (t: string, f: unknown) => { if (oyentes.get(t) === f) oyentes.delete(t) } } }
  }
  it("Esc con una pieza abierta encima NO cierra la lista; sin pieza, sí (y se suelta)", () => {
    const a = ventana(), cerrar = vi.fn()
    expect(escucharEscDeLaLista(a.w as never, cerrar, true)).toBeUndefined(); expect(a.oyentes.has("keydown")).toBe(false)
    const b = ventana(), soltar = escucharEscDeLaLista(b.w as never, cerrar, false)
    expect(b.oyentes.has("keydown")).toBe(true)
    ;(b.oyentes.get("keydown") as (e: unknown) => void)({ key: "Escape", stopPropagation: () => {}, preventDefault: () => {} }); expect(cerrar).toHaveBeenCalledTimes(1)
    soltar!(); expect(b.oyentes.has("keydown")).toBe(false)
  })
  it("abrir una pieza nueva la marca como vista (POST /api/alertas/visto con su clave) y la escena lo anota; una ya vista no se vuelve a guardar", async () => {
    const [a] = armarAlertas(entrada([dec(OTRO, "2026-11-11T19:00:00Z", { client_id: ZR, cliente: "Zero Risk Seguridad Industrial" })]))
    const llamadas: Array<{ url: string; cuerpo: string }> = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => { llamadas.push({ url, cuerpo: String(init?.body) }); return new Response(JSON.stringify({ ok: true, en: "2026-11-11T20:40:00Z" }), { status: 200 }) })
    const alRevisar = vi.fn()
    expect(await marcarVistaAlAbrir(a, { revisadasAqui: {}, fetchImpl: fetchImpl as never, alRevisar })).toBe(true)
    expect(llamadas).toHaveLength(1); expect(llamadas[0].url).toBe("/api/alertas/visto"); expect(JSON.parse(llamadas[0].cuerpo)).toEqual({ clave: `decision:hitl_queue:${OTRO}` })
    expect(alRevisar).toHaveBeenCalledTimes(1); expect(alRevisar.mock.calls[0][0]).toBe(`decision:hitl_queue:${OTRO}`)
    // ya marcada en esta visita, o ya revisada en la plataforma: nada sale
    expect(await marcarVistaAlAbrir(a, { revisadasAqui: { [`decision:hitl_queue:${OTRO}`]: "x" }, fetchImpl: fetchImpl as never, alRevisar })).toBe(false)
    const [r] = armarAlertas(entrada([dec(OTRO, "2026-11-11T19:00:00Z", { alerta: { clave: `decision:hitl_queue:${OTRO}`, estado: "revisada" } })]))
    expect(await marcarVistaAlAbrir(r, { revisadasAqui: {}, fetchImpl: fetchImpl as never, alRevisar })).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(alRevisar).toHaveBeenCalledTimes(1)
    // si no se guardó, la escena no la anota
    const mal = vi.fn(async () => new Response("{}", { status: 500 }))
    expect(await marcarVistaAlAbrir(a, { revisadasAqui: {}, fetchImpl: mal as never, alRevisar })).toBe(false); expect(alRevisar).toHaveBeenCalledTimes(1)
  })
  it("listarPiezas pone es_video desde la familia (video_mesa sí · carrusel_mesa no)", async () => {
    const filaDeLaBase = (id: string, familia: string, cliente: string) => ({ id, status: "pending", client_id: cliente, created_at: "2026-11-11T18:45:13Z", title: "t", type: "content_piece_review", agent_name: "oficina", output_preview: null, decision: {}, archivada_en: null, metadata: { familia } })
    const tablas: Record<string, Array<Record<string, unknown>>> = {
      hitl_queue: [filaDeLaBase(REALES[0][0], "video_mesa", NAUFRAGO), filaDeLaBase(OTRO, "carrusel_mesa", ZR)],
      clients: [{ id: NAUFRAGO, name: "Náufrago", industry: "restaurante" }, { id: ZR, name: "Zero Risk Seguridad Industrial", industry: "seguridad industrial" }],
      oficina_encargos: [],
    }
    const from = (t: string) => {
      let filas = [...(tablas[t] ?? [])]
      const b: Record<string, unknown> = {}
      for (const m of ["select", "order", "not", "neq"]) b[m] = () => b
      b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
      b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
      b.is = (c: string, v: unknown) => { filas = filas.filter((f) => (f[c] ?? null) === v); return b }
      b.limit = () => b
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok)
      return b
    }
    const l = await listarPiezas({ from } as never, { estado: "pendiente" })
    expect(l.find((x) => x.id === REALES[0][0])?.es_video).toBe(true)
    expect(l.find((x) => x.id === OTRO)?.es_video).toBe(false)
  })
  it("otro cliente elegido arriba con la pieza abierta en el lugar la cierra; en el explorador vuelve a la raíz", () => {
    const cerrar = vi.fn(), irA = vi.fn()
    alCambiarElClienteDelVisor(true, { cerrar, irA }); expect(cerrar).toHaveBeenCalledTimes(1); expect(irA).not.toHaveBeenCalled()
    alCambiarElClienteDelVisor(false, { cerrar, irA }); expect(irA).toHaveBeenCalledWith(null); expect(cerrar).toHaveBeenCalledTimes(1)
  })
  it("menores: solo la pieza de la bandeja se abre en el lugar; la bandeja con ok:false no se usa", async () => {
    expect(esPiezaDeLaBandeja({ tipo: "pieza", fuente: "hitl_queue" })).toBe(true)
    expect(esPiezaDeLaBandeja({ tipo: "pieza", fuente: "otra_tabla" })).toBe(false)
    expect(esPiezaDeLaBandeja({ tipo: "gran_idea", fuente: "hitl_queue" })).toBe(false)
    expect(await leerLasPiezas((async () => new Response(JSON.stringify({ ok: false, piezas: [PIEZAS[OTRO]] }), { status: 200 })) as never)).toBeNull()
  })
})

describe("7 · los paneles usan esas piezas (no una copia)", () => {
  it("la lista suelta Esc con la pieza abierta, marca vista al abrir y el visor se cierra al cambiar de cliente", async () => {
    const { readFileSync } = await import("node:fs")
    const antena = readFileSync("components/nuevo/escena/AntenaDeAlertas.tsx", "utf8"), visor = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(antena).toContain("useEffect(() => escucharEscDeLaLista(window, onCerrar, !!abierta), [onCerrar, abierta])")
    expect(antena).toMatch(/setAbierta\(a\)\s+void marcarVistaAlAbrir\(a, \{ revisadasAqui, fetchImpl: fetchImpl \?\? fetch, alRevisar \}\)/)
    expect(visor).toContain("useAlCambiarElCliente(clienteId, () => alCambiarElClienteDelVisor(!!soloLaPieza, { cerrar: onCerrar, irA }))")
  })
})
