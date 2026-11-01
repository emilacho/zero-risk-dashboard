/**
 * DASHBOARD NUEVO · SPRINT 6.11 (encargo Lenovo 01-nov ADENDA 3 + ADENDA 7): el Kanban (Calendario ↔ Kanban en el Centro de campaña · Carpetas ↔ Kanban en Piezas),
 * el equipo de cada empleado leído del DATO (`oficina_equipos` + `oficina_directorio.equipo`) y los botones de decisión de la gran idea (la ruta de CC#1, tal cual).
 * «Publicada» no existe: la columna se ve atenuada con su leyenda; no se inventa.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { COLUMNAS, COLUMNA_DEL_TABLERO, COLUMNA_DE_LA_PIEZA, LEYENDA_PUBLICADA, armarKanban, resumenDelKanban, tarjetaDeFila, tarjetaDePieza } from "@/lib/kanban"
import { ESTADOS_DEL_TABLERO, type FilaDelTablero } from "@/lib/pizarron"
import type { EstadoPieza } from "@/lib/piezas"
import type { FilaDeLaLista } from "@/lib/piezas-datos"
import type { Pizarron } from "@/lib/pizarron-datos"
import type { Bandeja } from "@/lib/bandeja-datos"
import { Kanban } from "@/components/nuevo/Kanban"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelEquipo } from "@/components/nuevo/PanelEquipo"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { EQUIPOS_DE_MARKETING, FUENTE_DEL_DATO, armarEquipos, equiposDesdeElDato, nombreLegibleDelAgente, resumenDelEquipo, type FilaDeAgente, type FilaDeDirectorio, type FilaDeEquipoDelDato, type Invocacion } from "@/lib/organigrama"
import type { EquipoDelCliente } from "@/lib/equipo-datos"
import type { DetalleDelConcepto } from "@/lib/concepto-datos"
import { NOTA_MINIMA } from "@/lib/concepto-decision"
import { avisoTrasDecidirGranIdea, cuerpoDeDecisionDeGranIdea, errorTrasDecidirGranIdea, rutaDeDecisionDeGranIdea } from "@/lib/gran-idea"

const leer = (p: string) => readFileSync(p, "utf8")
const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CLIENTE = { id: NAUFRAGO, nombre: "Náufrago" }
const AHORA = new Date("2026-11-01T12:00:00Z")

const fila = (p: Partial<FilaDelTablero>): FilaDelTablero => ({
  id: "f1", fecha: "2026-11-05", hora: "10:00", red: "instagram", formato: "carrusel", pilar: null, tema: "Ceviche de temporada", sede: null, pieza_fija: false, tanda: 1, semana: 1,
  estado_fila: "validada", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "validada", ...p,
})
const pieza = (p: Partial<FilaDeLaLista>): FilaDeLaLista => ({
  id: "h1", estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: "Carrusel Instagram · Náufrago · 30 oct", carpeta: "Carrusel Instagram",
  cliente_id: NAUFRAGO, cliente: "Náufrago", creada: "2026-10-30T15:00:00Z", gasto_usd: 0.4, incompleta: false, desacuerdos: 0, tiene_dibujo: true, ...p,
})

describe("6.11 · el Kanban (ADENDA 3): columnas genéricas que salen de estados reales", () => {
  it("son 7 columnas en el orden de la cadena; «Publicada» está atenuada con su leyenda porque el sistema todavía no publica (ADENDA 7.3)", () => {
    expect(COLUMNAS.map((c) => c.clave)).toEqual(["por_hacer", "en_el_estudio", "en_revision", "por_aprobar", "aprobada", "publicada", "vencida"])
    const pub = COLUMNAS.find((c) => c.clave === "publicada")!
    expect(pub.activa).toBe(false); expect(pub.leyenda).toBe(LEYENDA_PUBLICADA); expect(LEYENDA_PUBLICADA).toMatch(/publicación esté conectada/)
    expect(COLUMNAS.filter((c) => c.activa).length).toBe(6)
  })
  it("cada estado del calendario y cada estado de una pieza caen en UNA columna (nada queda sin lugar; nada cae en «publicada»)", () => {
    for (const e of ESTADOS_DEL_TABLERO) expect(COLUMNAS.some((c) => c.clave === COLUMNA_DEL_TABLERO[e.clave])).toBe(true)
    expect(COLUMNA_DEL_TABLERO).toMatchObject({ idea: "por_hacer", mesa: "en_el_estudio", jefatura: "en_revision", emilio: "por_aprobar", aprobada: "aprobada", cambios: "en_el_estudio", rechazada: "vencida", vencida: "vencida", descartada: "vencida" })
    const estados: EstadoPieza[] = ["pendiente", "aprobada", "con_cambios", "rechazada", "superada", "archivada", "otro"]
    for (const e of estados) expect(COLUMNAS.some((c) => c.clave === COLUMNA_DE_LA_PIEZA[e])).toBe(true)
    expect(COLUMNA_DE_LA_PIEZA).toMatchObject({ pendiente: "por_aprobar", aprobada: "aprobada", con_cambios: "en_el_estudio", rechazada: "vencida" })
    expect(Object.values(COLUMNA_DEL_TABLERO)).not.toContain("publicada"); expect(Object.values(COLUMNA_DE_LA_PIEZA)).not.toContain("publicada")
  })
  it("las tarjetas: una fila del calendario (clave id|fecha, por fecha) y una pieza de la bandeja (las nuevas arriba); armar llena las 7 columnas", () => {
    const t1 = tarjetaDeFila(fila({ tablero: "emilio", motivo: "la pieza está en tu bandeja" }))
    expect(t1).toMatchObject({ id: "f1|2026-11-05", columna: "por_aprobar", titulo: "Ceviche de temporada", detalle: "Instagram · Carrusel", cuando: "5 nov · 10:00", destacada: true, estado: "Esperando tu aprobación" })
    const t2 = tarjetaDeFila(fila({ id: "f2", fecha: "2026-11-03", tablero: "idea" }))
    const p1 = tarjetaDePieza(pieza({}))
    const p2 = tarjetaDePieza(pieza({ id: "h2", estado: "rechazada", status: "rejected", creada: "2026-10-31T15:00:00Z" }))
    expect(p1).toMatchObject({ id: "h1", columna: "por_aprobar", titulo: "Carrusel Instagram · Náufrago · 30 oct", detalle: "Carrusel Instagram", cuando: "30 oct", destacada: true })
    expect(p2.columna).toBe("vencida")
    const cols = armarKanban([t1, t2, p1, p2])
    expect(cols.length).toBe(7)
    expect(cols.find((c) => c.clave === "por_hacer")!.tarjetas.map((t) => t.id)).toEqual(["f2|2026-11-03"])
    expect(cols.find((c) => c.clave === "por_aprobar")!.tarjetas.map((t) => t.id)).toEqual(["f1|2026-11-05", "h1"])
    expect(cols.find((c) => c.clave === "publicada")!.tarjetas).toEqual([])
    expect(armarKanban([tarjetaDePieza(pieza({ id: "vieja", creada: "2026-10-01T00:00:00Z" })), p1]).find((c) => c.clave === "por_aprobar")!.tarjetas.map((t) => t.id)).toEqual(["h1", "vieja"])
    expect(resumenDelKanban(cols)).toBe("1 por hacer · 2 por aprobar · 1 vencida / rechazada")
  })
  it("el componente pinta las 7 columnas, la de «publicada» con data-activa=false y su leyenda, y una tarjeta por ítem (solo lectura: nada se arrastra)", () => {
    const html = renderToStaticMarkup(createElement(Kanban, { columnas: armarKanban([tarjetaDeFila(fila({ tablero: "emilio" }))]), etiqueta: "prueba", onElegir: () => {} }))
    expect(html.match(/data-columna="/g)!.length).toBe(7)
    expect(html).toContain('data-columna="publicada" data-activa="false"'); expect(html).toContain("data-leyenda"); expect(html).toContain("publicación esté conectada")
    expect(html).toContain('data-tarjeta="f1|2026-11-05"'); expect(html).toContain('data-columna-tarjeta="por_aprobar"'); expect(html).toContain('data-destacada="true"')
    expect(html).not.toContain("draggable")
  })
  it("el Calendario del Centro de campaña tiene el cambio Calendario ↔ Kanban (mismas publicaciones)", () => {
    const f = fila({ tablero: "emilio" })
    const datos: Pizarron = { clientes: [{ ...CLIENTE, con_campana: true }], cliente: CLIENTE, campana: { id: "c", estado: "pausada", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1 }, fases: [], fase_activa: { situacion: "antes", fase: null, dia: -1, dias_para_empezar: 1 }, gran_idea: { texto: null, nota: "sin gran idea" }, esperas: [], filas: [f], semanas: [{ desde: "2026-11-02", hasta: "2026-11-08", dias: [{ fecha: "2026-11-05", publicaciones: [f] }] }], totales: { emilio: 1 }, hoy: "2026-11-01", leido_en: "x" }
    const cal = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos }))
    expect(cal).toContain('data-vista-tablero="calendario" aria-pressed="true"'); expect(cal).toContain('data-vista-tablero="kanban" aria-pressed="false"'); expect(cal).toContain('role="grid"'); expect(cal).not.toContain("data-kanban")
    const kb = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos, vistaInicial: "kanban" }))
    expect(kb).toContain('data-vista-activa="kanban"'); expect(kb).toContain("data-kanban"); expect(kb).not.toContain('role="grid"')
    expect(kb).toContain('data-tarjeta="f1|2026-11-05"'); expect(kb).toContain('data-columna="publicada" data-activa="false"')
  })
  it("Piezas tiene el cambio Carpetas ↔ Kanban; el Kanban muestra las piezas del cliente por columna", () => {
    const bandeja: Bandeja = { estado: "todas", por_aprobar: 1, piezas: [pieza({}), pieza({ id: "h2", estado: "aprobada", status: "approved" })], otras: [], clientes: [CLIENTE], leido_en: "x" }
    const lista = renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja, clienteInicial: NAUFRAGO }))
    expect(lista).toContain('data-vista-piezas="lista" aria-pressed="true"'); expect(lista).toContain('data-vista="carpetas"'); expect(lista).not.toContain('data-vista="kanban"')
    const kb = renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja, clienteInicial: NAUFRAGO, vistaInicial: "kanban" }))
    expect(kb).toContain('data-vista="kanban"'); expect(kb).toContain('data-tarjeta="h1"'); expect(kb).toContain('data-tarjeta="h2"')
    expect(kb).toContain('data-columna="por_aprobar" data-activa="true" data-total="1"'); expect(kb).toContain('data-columna="aprobada" data-activa="true" data-total="1"')
    expect(kb).toContain("Kanban del Centro de campaña")
  })
})

describe("6.11 · el equipo de cada empleado viene del DATO (ADENDA 7.1 · oficina_equipos + oficina_directorio.equipo)", () => {
  const TABLA: FilaDeEquipoDelDato[] = [
    { clave: "creativo", nombre: "Creativo", sistema: "mesa de creativos · mesa de piezas y video", descripcion: "La gran idea y cada pieza", etapa: "activo", bloqueo: null, orden: 3 },
    { clave: "direccion", nombre: "Dirección", sistema: "jefatura de marketing", descripcion: "Dirige el departamento", etapa: "activo", bloqueo: null, orden: 1 },
    { clave: "estrategia", nombre: "Estrategia", sistema: "mesa de análisis · plan · brief · calendario", descripcion: "Investiga y escribe el plan", etapa: "activo", bloqueo: null, orden: 2 },
    { clave: "web", nombre: "Web y búsqueda", sistema: "landings · CRO · SEO · GEO/AEO", descripcion: "Que la web convierta", etapa: "segunda_etapa", bloqueo: "se activa con firma", orden: 4 },
    { clave: "medios", nombre: "Medios y Performance", sistema: "pauta · email · medición", descripcion: "Anuncios pagados", etapa: "segunda_etapa", bloqueo: "espera las métricas de Meta", orden: 5 },
    { clave: "relaciones", nombre: "Relaciones", sistema: "comunidad · PR", descripcion: "La conversación con la gente", etapa: "segunda_etapa", bloqueo: "se activa con firma", orden: 6 },
  ]
  const agentes: FilaDeAgente[] = [
    { name: "jefe-marketing", display_name: "Jefe de marketing", role: "x", model: "claude-opus", is_active: true, status: "active" },
    { name: "creative-director-mesa", display_name: "Director creativo", role: "x", model: "claude-sonnet", is_active: true, status: "active" },
    { name: "content-creator", display_name: null, role: "x", model: null, is_active: true, status: null },
    { name: "cfo_agent", display_name: "CFO", role: "x", model: null, is_active: true, status: null },
  ]
  const directorio: FilaDeDirectorio[] = [
    { agente: "creative-director-mesa", rol: "direccion", especialidad: "Dirige la mesa", sabe_hacer: ["a"], necesita: [], entrega: ["b"], pertinente_en: ["gran idea"], activo: true, equipo: "creativo" },
    { agente: "content-creator", rol: "miembro", especialidad: "Textos", sabe_hacer: [], necesita: [], entrega: [], pertinente_en: [], activo: true, equipo: "creativo" },
    { agente: "campaign-brief-agent", rol: "direccion", especialidad: "Escribe el brief", sabe_hacer: [], necesita: [], entrega: [], pertinente_en: ["brief"], activo: true, equipo: "estrategia" },
    { agente: "portero", rol: "portero", especialidad: "La puerta del cerebro", sabe_hacer: [], necesita: [], entrega: [], pertinente_en: [], activo: true, equipo: null },
  ]
  const t = AHORA.getTime()
  const inv: Invocacion[] = [
    { agent_name: "portero-del-cerebro", command: "escucha", started_at: new Date(t - 60_000).toISOString(), ended_at: null, status: "running", client_id: NAUFRAGO, cost_usd: 0.01 },
    { agent_name: "content-creator", command: "pieza", started_at: new Date(t - 60_000).toISOString(), ended_at: null, status: "running", client_id: NAUFRAGO, cost_usd: 0.01 },
  ]
  it("los equipos salen de la tabla (nombre · etapa · bloqueo · orden) y la gente de su tarjeta del directorio; nada del mapa", () => {
    const eqs = equiposDesdeElDato(TABLA)
    expect(eqs.map((e) => e.clave)).toEqual(EQUIPOS_DE_MARKETING)
    expect(eqs.find((e) => e.clave === "medios")).toMatchObject({ nombre: "Medios y Performance", etapa: "segunda_etapa", bloqueo: "espera las métricas de Meta", fuente: FUENTE_DEL_DATO })
    const eq = armarEquipos(agentes, directorio, inv, { cliente: NAUFRAGO, ahora: AHORA, equiposDelDato: TABLA })
    expect(eq.map((e) => e.clave)).toEqual([...EQUIPOS_DE_MARKETING, "proveedores", "otros"])
    expect(eq.every((e) => e.origen === "directorio" && e.por_instalar_total === 0)).toBe(true)
    const creativo = eq.find((e) => e.clave === "creativo")!
    expect(creativo.miembros.map((m) => m.nombre)).toEqual(["creative-director-mesa", "content-creator"]) // el que dirige primero
    expect(creativo.trabajando).toBe(1); expect(creativo.areas.length).toBe(1); expect(creativo.areas[0].miembros.length).toBe(2)
    // una tarjeta del directorio sin ficha en `agents` se lista igual (sin inventarle modelo)
    const estrategia = eq.find((e) => e.clave === "estrategia")!
    expect(estrategia.miembros.map((m) => [m.nombre, m.instalado, m.en_directorio, m.nombre_visible])).toEqual([["campaign-brief-agent", false, true, "Campaign brief agent"]])
    expect(estrategia.miembros[0].equipos).toEqual(["estrategia"])
    // Dirección sin tarjetas en el directorio: vacía y honesta (jefe-marketing NO se le asigna por el mapa)
    expect(eq.find((e) => e.clave === "direccion")!.miembros).toEqual([])
    // el portero: sin equipo a propósito → proveedores
    expect(eq.find((e) => e.clave === "proveedores")!.miembros.map((m) => m.nombre)).toEqual(["portero"])
    // lo instalado o visto trabajar sin tarjeta: aparte, sin equipo
    const otros = eq.find((e) => e.clave === "otros")!
    expect(otros.miembros.map((m) => m.nombre).sort()).toEqual(["cfo_agent", "jefe-marketing", "portero-del-cerebro"])
    expect(otros.miembros.find((m) => m.nombre === "portero-del-cerebro")!.instalado).toBe(false)
    expect(otros.miembros.every((m) => m.equipos.length === 0)).toBe(true)
    expect(resumenDelEquipo(eq)).toMatchObject({ equipos: 6, activos: 3, miembros: 3, trabajando: 1, por_instalar: 0 })
    expect(nombreLegibleDelAgente("marketing_instagram_curator")).toBe("Marketing instagram curator")
  })
  it("sin la tabla (otra base) sigue el mapa de respaldo; la clave de la tabla se normaliza", () => {
    expect(armarEquipos(agentes, directorio, inv, { cliente: NAUFRAGO, ahora: AHORA, equiposDelDato: [] })[0].origen).toBe("directorio") // el directorio trae equipo: el mapa ya lo respeta
    expect(armarEquipos(agentes, [], inv, { cliente: NAUFRAGO, ahora: AHORA })[0].origen).toBe("mapa")
    expect(equiposDesdeElDato([{ clave: "Web", nombre: null, sistema: null, descripcion: null, etapa: "raro", bloqueo: "", orden: null }])[0]).toMatchObject({ clave: "web", nombre: "Web", etapa: "segunda_etapa", bloqueo: null })
  })
  it("el panel dice que el equipo viene del directorio y, en un equipo sin tarjetas, que el directorio todavía no las tiene", () => {
    const eq = armarEquipos(agentes, directorio, inv, { cliente: NAUFRAGO, ahora: AHORA, equiposDelDato: TABLA })
    const datos: EquipoDelCliente = { clientes: [CLIENTE], cliente: CLIENTE, equipos: eq, origen: "directorio", resumen: resumenDelEquipo(eq), ventana: { desde: "x", corridas: 2 }, leido_en: "x" }
    const html = renderToStaticMarkup(createElement(PanelEquipo, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('data-origen="directorio"'); expect(html).toContain("viene del directorio de la oficina (dato de la plataforma)")
    expect(html).toContain("Los 6 equipos del departamento"); expect(html).not.toContain("por instalar")
    for (const k of EQUIPOS_DE_MARKETING) expect(html).toContain(`data-equipo="${k}"`)
    expect(html).toContain('data-equipo="proveedores"'); expect(html).toContain('data-equipo="otros"'); expect(html).toContain("Sin tarjeta en el directorio")
    expect(leer("lib/equipo-datos.ts")).toContain('from("oficina_equipos")')
  })
})

describe("6.11 · la decisión de la gran idea (ADENDA 7.2): la ruta de CC#1, reutilizada tal cual", () => {
  const concepto = (p: Partial<DetalleDelConcepto> = {}): DetalleDelConcepto => ({
    hitl_id: "11111111-2222-4333-8444-555555555555", status: "pending", estado: "pendiente", titulo: "Gran idea v1", cliente: "Náufrago", cliente_id: NAUFRAGO, creada: "2026-11-01T10:00:00Z", campana_id: "c", version: 1, concepto_id: "k",
    seco: false, costo_usd: 0.9, vueltas_restantes: 2, avisos: [], gran_idea: { nombre: "El mar en la mesa", frase: "Cada plato es una marea." }, por_que_funciona: "Porque sí", como_se_ve: "Azul", como_suena: "Olas", fotos_citadas: [],
    capitulos: [], banco: [], resumen: { total: 0, por_red: {}, por_capitulo: {}, ejemplos: {}, parcial: [] }, caminos_descartados: "", devolucion_del_brief: null, brief: null, aprobacion: null, nota_de_emilio: null, apunta_a: null, decidido_en: null, sin_concepto: null, ...p,
  })
  it("el cuerpo es el que exige la ruta: aprobar con nota opcional; cambios con nota (misma regla que la plataforma) y a qué apunta; estado_visto siempre", () => {
    expect(rutaDeDecisionDeGranIdea("abc")).toBe("/api/piezas/abc/gran-idea")
    expect(cuerpoDeDecisionDeGranIdea({ accion: "aprobar", nota: "  ", apunta_a: "concepto", estado_visto: "pending" })).toEqual({ cuerpo: { accion: "aprobar", estado_visto: "pending" } })
    expect(cuerpoDeDecisionDeGranIdea({ accion: "aprobar", nota: "me gusta", apunta_a: "concepto", estado_visto: "pending" })).toEqual({ cuerpo: { accion: "aprobar", nota: "me gusta", estado_visto: "pending" } })
    expect(cuerpoDeDecisionDeGranIdea({ accion: "cambios", nota: "corto", apunta_a: "concepto", estado_visto: "pending" })).toEqual({ error: `Escribe qué quieres distinto (mínimo ${NOTA_MINIMA} letras).` })
    expect(cuerpoDeDecisionDeGranIdea({ accion: "cambios", nota: "Menos azul, más gente comiendo", apunta_a: "brief", estado_visto: "pending" })).toEqual({ cuerpo: { accion: "cambios", nota: "Menos azul, más gente comiendo", apunta_a: "brief", estado_visto: "pending" } })
    expect(avisoTrasDecidirGranIdea("aprobar", {})).toMatch(/aprobada/); expect(avisoTrasDecidirGranIdea("cambios", { nota: "x" })).toBe("x")
    expect(errorTrasDecidirGranIdea(409, { detalle: "la tarjeta cambió" })).toBe("la tarjeta cambió Se actualizó la pantalla.")
    expect(errorTrasDecidirGranIdea(501, {})).toMatch(/no se envió nada/); expect(errorTrasDecidirGranIdea(401, {})).toMatch(/administrador/)
  })
  it("con una propuesta pendiente el panel tiene los dos botones grandes; ya decidida, no; y nunca llama a la plataforma directo", () => {
    const base = { clientes: [CLIENTE], cliente: CLIENTE, campana: { id: "c", estado: "activa" }, publicado: true, leido_en: "x" }
    const d = concepto()
    const html = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [{ hitl_id: d.hitl_id, status: "pending", estado: "pendiente", titulo: d.titulo, creada: d.creada, version: 1 }], detalle: d } }))
    expect(html).toContain('data-bloque="decision"'); expect(html).toContain('data-accion="aprobar-gran-idea"'); expect(html).toContain('data-accion="pedir-cambios-gran-idea"')
    expect(html).toContain("Aprobar la gran idea"); expect(html).toContain("Pedir cambios…"); expect(html).not.toContain("data-dialogo") // el diálogo se abre al tocar
    const roto = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [], detalle: concepto({ sin_concepto: "la cadena no tiene la fila del concepto" }) } }))
    expect(roto).toContain('data-accion="aprobar-gran-idea" disabled=""'); expect(roto).toContain("No se puede decidir")
    const decidida = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [], detalle: concepto({ status: "approved", estado: "aprobada", aprobacion: "aprobar", decidido_en: "2026-11-01T12:00:00Z" }) } }))
    expect(decidida).not.toContain('data-accion="aprobar-gran-idea"'); expect(decidida).toContain('data-bloque="decidido"')
    const src = leer("components/nuevo/PanelGranIdea.tsx")
    expect(src).not.toContain("/api/cadena/concepto"); expect(src).not.toContain("PLATFORM_INTERNAL_KEY"); expect(src).toContain('method: "POST"'); expect(src).toContain("rutaDeDecisionDeGranIdea(")
    expect(leer("app/api/piezas/[id]/gran-idea/route.ts")).toContain("decidirConcepto(") // la ruta de CC#1 (PR #77), sin copiar
  })
})

describe("6.11 · nada del arnés local queda en lo publicable", () => {
  it("las puertas de las rutas que usa el arnés son las reales", () => {
    for (const r of ["equipo", "brief", "gran-idea", "centro", "informes", "cerebro", "bandeja", "pizarron"]) expect(leer(`app/api/${r}/route.ts`)).not.toContain("ARNÉS LOCAL")
    expect(leer("middleware.ts")).not.toContain("ARNÉS LOCAL")
  })
})
