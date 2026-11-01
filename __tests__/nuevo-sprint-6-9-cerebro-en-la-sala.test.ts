/**
 * DASHBOARD NUEVO · SPRINT 6.9 (Emilio, 1-nov): «el cerebro es la estructura central de la página principal, tal cual Dept. Marketing es una estructura; es ahí donde
 * debe ir lo que has creado para cerebro; en vez de cerebro poner informes» + «el nombre de pizarrón quítalo» (encargo 01-nov: «Centro de campaña»).
 *  · el monolito de la sala principal abre el explorador del Cerebro ENCIMA (/nuevo/cerebro), con selector de cliente; ya no lleva al dashboard viejo
 *  · en el Centro de campaña, el cuadro «Cerebro» se va y entra «Informes» (lo que la oficina le reporta al cliente · `client_reports` · hoy vacía → se dice)
 *  · «Pizarrón de piezas» deja de existir como nombre: el tablero es «Centro de campaña» y el cuadro del calendario se llama Calendario
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EscenaNuevo, ZONAS } from "@/components/nuevo/EscenaNuevo"
import { EscenaViva, TABLERO } from "@/components/nuevo/EscenaViva"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { PanelCerebro } from "@/components/nuevo/PanelCerebro"
import { PanelInformes } from "@/components/nuevo/PanelInformes"
import { APLICACIONES } from "@/lib/aplicaciones-marketing"
import type { CerebroDelCliente } from "@/lib/cerebro-datos"
import { bloquesDelResumen, detalleDeInformes, diaDePeriodo, estadoLegible, informeDesdeFila, ordenarInformes, periodoLegible, porTipo, tipoLegible, tituloDelInforme } from "@/lib/informes"
import { leerInformesDelCliente, type InformesDelCliente } from "@/lib/informes-datos"

const leer = (p: string) => readFileSync(p, "utf8")
const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const OTRO = "11111111-1111-1111-1111-111111111111"

describe("6.9 · el Cerebro es una estructura de la sala principal (el monolito)", () => {
  it("6.12: el monolito es TU OFICINA (/nuevo/oficina); el Cerebro tendrá estructura propia (hoy solo /nuevo/cerebro); nada enlaza ya al dashboard viejo", () => {
    expect(ZONAS.some((x) => x.clave === "cerebro")).toBe(false)
    const z = ZONAS.find((x) => x.clave === "oficina")!
    expect(z.href).toBe("/nuevo/oficina")
    expect(z.rotulo?.texto).toBe("TU OFICINA")
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect([...html.matchAll(/<a [^>]*?href="([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["/nuevo/marketing", "/nuevo/oficina"])
    expect(html).toContain(">TU OFICINA</text>")
    expect(html).not.toContain("/oficinas#cerebro")
    const oficina = renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))
    expect(oficina).not.toContain(">CEREBRO</text>"); expect(oficina).not.toContain('aria-label="Cerebro"') // 6.12b: el Cerebro NO está en tu oficina
  })
  it("la escena viva lo abre encima como portal (con selector de cliente), cambia la dirección y atiende atrás/adelante; la entrada directa existe y pide administrador", () => {
    const v = leer("components/nuevo/EscenaViva.tsx")
    expect(v).toContain('createPortal(<PanelCerebro onCerrar={() => cerrarCerebro()} elegirCliente />, document.body)')
    expect(v).toContain('cambiarDireccion("/nuevo/cerebro")')
    expect(v).toContain('window.location.pathname.startsWith("/nuevo/cerebro")')
    expect(v).toContain('alAbrirOficina={() => abrir("oficina")}') // 6.12: el monolito abre tu oficina
    const p = leer("app/nuevo/cerebro/page.tsx")
    expect(p).toContain("exigirAdmin()"); expect(p).toContain("<PantallaNuevo cerebro />")
    expect(leer("components/nuevo/PantallaNuevo.tsx")).toContain("cerebroInicial={cerebro}")
  })
  it("desde la sala el Cerebro trae el selector de cliente (aquí no hay departamento que lo enfoque); desde el departamento, no", () => {
    const datos: CerebroDelCliente = { clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }, { id: OTRO, nombre: "Otro" }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, fichas: [], perfiles: [], preguntas: [], sedes: [], trozos: 0, retiradas: 0, descartadas: 0, leido_en: "x" }
    const conSelector = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: datos, elegirCliente: true }))
    expect(conSelector).toContain("data-elegir-cliente"); expect(conSelector).toContain(">Náufrago</option>"); expect(conSelector).toContain(">Otro</option>")
    const sinSelector = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: datos }))
    expect(sinSelector).not.toContain("data-elegir-cliente")
  })
})

describe("6.9 · «Centro de campaña» (ya no «Pizarrón de piezas») e «Informes» en lugar de «Cerebro»", () => {
  it("el tablero de la oficina se llama Centro de campaña y el cuadro del calendario, Calendario; «pizarrón» no se le muestra a nadie", () => {
    expect(TABLERO.nombre).toBe("Centro de campaña"); expect(TABLERO.rotulo.texto).toBe("CENTRO DE CAMPAÑA")
    // lo que se le MUESTRA a alguien: la oficina abierta y la pantalla de aplicaciones, pintadas; y los textos del calendario que decían «pizarrón»
    const oficina = renderToStaticMarkup(createElement(EscenaViva, { inicial: true }))
    expect(oficina).toContain('aria-label="Centro de campaña"'); expect(oficina).toContain(">CENTRO DE CAMPAÑA</text>"); expect(oficina).not.toMatch(/pizarr[oó]n/i)
    expect(renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {} }))).not.toMatch(/pizarr[oó]n/i)
    const cal = leer("components/nuevo/PanelPizarron.tsx")
    for (const t of ["Pizarrón de piezas", "el pizarrón", "Colores del pizarrón", "Leyendo el pizarrón"]) expect(cal, t).not.toContain(t)
    expect(cal).toContain(">Calendario</h2>")
    expect(leer("components/nuevo/PanelAplicaciones.tsx")).toContain(">Centro de campaña</h2>")
  })
  it("el Centro de campaña tiene Informes (abre encima) y ya no tiene Cerebro", () => {
    expect(APLICACIONES.map((a) => a.clave)).toContain("informes")
    expect(APLICACIONES.some((a) => (a.clave as string) === "cerebro")).toBe(false)
    expect(APLICACIONES.find((a) => a.clave === "informes")!.enlace(NAUFRAGO)).toBeNull()
    const c = leer("components/nuevo/PanelAplicaciones.tsx")
    expect(c).toContain('if (vista === "informes") return <PanelInformes onCerrar={volverAlInicio} clienteInicial={cliente} />')
    expect(c).not.toContain("PanelCerebro")
  })
})

const FILA = { id: "r1", client_id: NAUFRAGO, period_start: "2026-10-26", period_end: "2026-11-01", kind: "weekly", status: "awaiting_review", summary: { narrative: "Semana de arranque de la campaña.", kpis: { alcance: 1200, interacciones: 85 }, highlights: ["Primer carrusel publicado", "Reseña nueva en Mapas"], next_week_focus: ["Historias de la sede Olón"] }, pdf_url: null, delivered_to: [], delivered_at: null, created_at: "2026-11-01T12:00:00.000Z" }
const FILA2 = { ...FILA, id: "r2", period_start: "2026-10-01", period_end: "2026-10-31", kind: "monthly", status: "delivered", summary: { texto: "Octubre cerró con 4 publicaciones." }, pdf_url: "https://ejemplo.test/oct.pdf", delivered_to: ["dueno@naufrago.ec"], delivered_at: "2026-11-01T13:00:00.000Z" }

describe("6.9 · informes · lógica pura", () => {
  it("convierte la fila real de client_reports, traduce tipo y estado, y arma el período sin correr el día (columnas DATE)", () => {
    const i = informeDesdeFila(FILA)
    expect(i).toMatchObject({ id: "r1", tipo: "weekly", desde: "2026-10-26", hasta: "2026-11-01", estado: "awaiting_review", pdf_url: null, entregado_a: [], entregado_en: null })
    expect(tipoLegible("weekly")).toBe("Semanal"); expect(tipoLegible("ad_hoc")).toBe("Especial")
    expect(estadoLegible("awaiting_review")).toEqual({ texto: "Espera tu revisión", tono: "ambar" }); expect(estadoLegible("failed").tono).toBe("rojo")
    expect(diaDePeriodo("2026-11-01")).toBe("1 nov") // NO «31 oct»: la fecha de período es un día, no un instante en UTC
    expect(periodoLegible("2026-10-26", "2026-11-01")).toBe("26 oct → 1 nov"); expect(periodoLegible("2026-11-01", "2026-11-01")).toBe("1 nov")
    expect(tituloDelInforme(i)).toBe("Informe semanal · 26 oct → 1 nov")
  })
  it("aplana el resumen libre en bloques legibles (párrafo, viñetas, pares) y agrupa por tipo del más nuevo al más viejo", () => {
    const b = bloquesDelResumen(FILA.summary)
    expect(b.map((x) => [x.clave, x.titulo])).toEqual([["narrative", "Lo que pasó"], ["kpis", "Indicadores"], ["highlights", "Puntos altos"], ["next_week_focus", "En qué se enfoca la próxima semana"]])
    expect(b[1].pares).toEqual([{ clave: "Alcance", valor: "1200" }, { clave: "Interacciones", valor: "85" }]); expect(b[2].vinetas).toHaveLength(2)
    const xs = ordenarInformes([informeDesdeFila(FILA2), informeDesdeFila(FILA)])
    expect(xs.map((x) => x.id)).toEqual(["r1", "r2"])
    expect(porTipo(xs).map((g) => [g.tipo, g.nombre, g.informes.length, g.esperan])).toEqual([["weekly", "Semanal", 1, 1], ["monthly", "Mensual", 1, 0]])
    expect(detalleDeInformes([])).toEqual({ texto: "Todavía no hay informes de este cliente", aviso: false })
    expect(detalleDeInformes(xs)).toEqual({ texto: "1 informe espera tu revisión", aviso: true })
    expect(detalleDeInformes([informeDesdeFila(FILA2)])).toEqual({ texto: "1 informe · último 1 oct → 31 oct", aviso: false })
  })
})

/** una base falsa con la forma de supabase-js (select/eq/is/not/order/limit/maybeSingle encadenables) */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, rota?: string) {
  const from = (t: string) => {
    const filtros: Array<[string, unknown]> = []; let unico = false
    const q: Record<string, unknown> = {}
    const enc = () => q
    Object.assign(q, {
      select: enc, order: enc, limit: enc, is: enc, not: enc,
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return q },
      maybeSingle: () => { unico = true; return q },
      then: (res: (x: unknown) => unknown) => {
        if (t === rota) return res({ data: null, error: { message: `la tabla ${t} se cayó` } })
        const data = (tablas[t] ?? []).filter((f) => filtros.every(([c, v]) => f[c] === v))
        return res({ data: unico ? data[0] ?? null : data, error: null, count: data.length })
      },
    })
    return q
  }
  return { from } as never
}
const CLIENTES = [{ id: NAUFRAGO, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }, { id: OTRO, name: "Otro", industry: "retail", status: "active", archived_at: null }]

describe("6.9 · informes · lectura y puerta", () => {
  it("lee los informes del cliente pedido (o del primero), los ordena, y con la tabla vacía devuelve cero informes (no un error)", async () => {
    const r = await leerInformesDelCliente(baseFalsa({ clients: CLIENTES, client_reports: [FILA2, FILA, { ...FILA, id: "ajeno", client_id: OTRO }] }), { cliente: NAUFRAGO })
    expect(r.cliente).toEqual({ id: NAUFRAGO, nombre: "Náufrago" }); expect(r.clientes).toHaveLength(2)
    expect(r.informes.map((x) => x.id)).toEqual(["r1", "r2"])
    const vacio = await leerInformesDelCliente(baseFalsa({ clients: CLIENTES, client_reports: [] }))
    expect(vacio.cliente?.id).toBe(NAUFRAGO); expect(vacio.informes).toEqual([])
  })
  it("un error de la base lanza (nunca «sin informes»); la ruta exige administrador antes de leer y no guarda caché", async () => {
    await expect(leerInformesDelCliente(baseFalsa({ clients: CLIENTES }, "client_reports"), { cliente: NAUFRAGO })).rejects.toThrow(/se cayó/)
    const ruta = leer("app/api/informes/route.ts")
    expect(ruta.indexOf("exigirAdmin()")).toBeGreaterThan(-1); expect(ruta.indexOf("exigirAdmin()")).toBeLessThan(ruta.indexOf("leerInformesDelCliente("))
    expect(ruta).toContain('"Cache-Control": "no-store"'); expect(ruta).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
  })
})

describe("6.9 · el panel de informes", () => {
  const base: InformesDelCliente = { clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, informes: [], analisis: [], leido_en: "x" }
  it("sin informes lo dice tal cual, dentro del cliente enfocado, sin inventar nada", () => {
    const html = renderToStaticMarkup(createElement(PanelInformes, { onCerrar: () => {}, datosIniciales: base }))
    expect(html).toContain('data-seccion="informes"'); expect(html).toContain('data-vista="vacio"')
    expect(html).toContain("Todavía no hay informes de Náufrago"); expect(html).toContain("todavía sin informes")
    expect(html).not.toContain("<select") // el explorador no cambia de cliente: para eso está la ventana de selección
    expect(html).toContain('data-miga="cliente"')
  })
  it("con informes: tipos a la izquierda, tarjetas agrupadas por tipo con su estado, y el aviso de los que esperan revisión", () => {
    const datos = { ...base, informes: ordenarInformes([informeDesdeFila(FILA), informeDesdeFila(FILA2)]) }
    const html = renderToStaticMarkup(createElement(PanelInformes, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('data-vista="informes"'); expect(html).toContain('data-grupo-tipo="weekly"'); expect(html).toContain('data-grupo-tipo="monthly"')
    expect(html).toContain('data-informe="r1"'); expect(html).toContain('data-estado="awaiting_review"'); expect(html).toContain("Espera tu revisión")
    expect(html).toContain('data-nodo-tipo="weekly"'); expect(html).toContain("2 informes · 1 esperan tu revisión")
    expect(html).toContain("Informe semanal · 26 oct → 1 nov"); expect(html).toContain("Semana de arranque de la campaña.")
  })
})
