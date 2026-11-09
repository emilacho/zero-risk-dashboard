// @vitest-environment node
/**
 * Cambiar una cifra antes de firmar (encargo Lenovo 5-nov · boceto 2) y una sola puerta de firma (certificación de CC6 a #282).
 * «Propuso X · firmas Y»: lo propuesto sale del servidor, no se firma sin ver cómo queda, y la firma solo pasa por Tu oficina › Decisiones.
 */
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { EditorDeCifra, estadoDelEditor, trasFirmar } from "@/components/nuevo/EditorDeCifra"
import { PanelDecisiones, TarjetaDelFrente } from "@/components/nuevo/PanelDecisiones"
import { contestarDecision, validarContestar } from "@/lib/decisiones-contestar"
import { accionesDe, cifrasQueCambian, leerNumero, normalizarDecisiones, numeroParaEscribir, textoDeCifra, type Decisiones } from "@/lib/direccion-decisiones"
import { ACCIONES } from "@/lib/tablero-acciones"

const T1 = "33333333-3333-4333-8333-333333333333"
const PRESUPUESTO = { clave: "total_mes", nombre: "Presupuesto al mes", valor: 1341.27, unidad: "US$", nota: "Instagram y Facebook" as string | null, editable: true }
const META = { clave: "meta_por_semana", nombre: "Meta", valor: 5, unidad: "ventas por semana", nota: null as string | null, editable: true }
const COSTO = { clave: "costo_por_venta", nombre: "Costo por venta", valor: 26, unidad: "US$", nota: null }
const AL_EDITAR = "El plan ya escrito no cambia. La próxima corrida usará la meta que firmes."
const cruda = { id: T1, tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: "cliente", cliente: "Cliente", titulo: "Tablero financiero: espera tu firma", desde: "2026-11-01T10:00:00Z", decidir: { ruta: null, accion: "firmar-tablero" }, permite: ["aceptar", "editar"], cifras: [PRESUPUESTO, META, COSTO], al_editar: AL_EDITAR }
const leida = (extra: Record<string, unknown> = {}): Decisiones => normalizarDecisiones({ ok: true, completo: true, decisiones: [{ ...cruda, ...extra }], fuentes: [], sin_fuente: [] })
const vacia: Decisiones = normalizarDecisiones({ ok: true, completo: true, decisiones: [], fuentes: [], sin_fuente: [] })
const lecturas = (...ds: Decisiones[]) => { let k = 0; return vi.fn(async () => ({ ok: true as const, datos: ds[Math.min(k++, ds.length - 1)] })) }
const nuevas = [{ ...PRESUPUESTO, valor: 939 }, { ...META, valor: 3.5 }, COSTO]
const firmarBien = () => vi.fn(async () => ({ status: 200, cuerpo: { ok: true, resultado: { ok: true, cifras: nuevas, alertas: ["Aviso de la oficina"] } } }))
const conflicto = (error: string, extra: Record<string, unknown> = {}) => vi.fn(async () => ({ status: 409, cuerpo: { ok: false, error: "conflicto", detalle: `«total_mes» detalle interno de ${error}`, plataforma: { error, ...extra } } }))
const deps = (firmar: unknown, leer = lecturas(leida(), vacia)) => ({ plataformaUrl: "https://plataforma.test", llave: "secreta", revisor: "emilio@x.com", leer: leer as never, firmar: firmar as never })

describe("cuándo se ofrece cambiar una cifra", () => {
  it("solo si la oficina lo permite y hay una cifra que se pueda cambiar", () => {
    expect(accionesDe(leida().decisiones[0])).toEqual(["aceptar", "editar"])
    expect(accionesDe(leida({ permite: ["aceptar"] }).decisiones[0])).toEqual(["aceptar"])
    expect(accionesDe(leida({ permite: undefined }).decisiones[0])).toEqual(["aceptar"])
    expect(accionesDe(leida({ cifras: [COSTO] }).decisiones[0])).toEqual(["aceptar"])
  })
  it("sin cifras no se ofrece nada, tampoco cambiar", () => {
    expect(accionesDe(leida({ cifras: [] }).decisiones[0])).toEqual([])
  })
  it("se lee qué cifra se puede cambiar y lo que hay que saber antes; sin nombre, la cifra no cuenta", () => {
    const d = leida({ cifras: [PRESUPUESTO, COSTO, { clave: "z", valor: 3 }, { ...COSTO, clave: "y", editable: "true" }] }).decisiones[0]
    expect(d.cifras?.map((c) => [c.clave, c.editable ?? false])).toEqual([["total_mes", true], ["costo_por_venta", false], ["y", false]])
    expect(d.al_editar).toBe(AL_EDITAR)
  })
  it("la tarjeta ofrece «Cambiar esta cifra» solo en las que se pueden cambiar, y sigue el Firmar de siempre", () => {
    const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: leida() }))
    expect(html).toContain('data-cambiar="total_mes"'); expect(html).toContain('data-cambiar="meta_por_semana"'); expect(html).not.toContain('data-cambiar="costo_por_venta"')
    expect(html).toContain("data-firmar")
    const sinPermiso = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: leida({ permite: ["aceptar"] }) }))
    expect(sinPermiso).not.toContain("data-cambiar")
  })
  // estilo base (05-nov · guía de Emilio, regla 6): cada tarjeta en el mismo orden · propuesta → aviso (lo que sigue abierto) → para qué → acciones
  it("Firmar va después de todo lo que hay que leer, y no va fijo (CC6 · #283)", () => {
    const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: leida({ para_que: "Para repartir el dinero", criticos: ["Dos hallazgos sin cerrar"] }) }))
    const orden = ["data-cifras", "data-criticos", "data-contexto", "data-pie", "data-firmar"].map((x) => html.indexOf(x))
    expect(orden.every((x) => x > -1)).toBe(true); expect(orden).toEqual([...orden].sort((x, y) => x - y))
    expect(html).not.toMatch(/data-pie="true" class="[^"]*sticky/)
  })
  it("lo que sigue abierto se lee entero, sin recortar", () => {
    const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: leida({ criticos: ["Dos hallazgos sin cerrar"] }) }))
    expect(html).toContain("Dos hallazgos sin cerrar"); expect(html).not.toContain("line-clamp-2"); expect(html).not.toContain("Leer completo")
  })
  it("09-nov · Decisiones igual a lo aprobado: ya no hay «Baja para leer todo y firmar» (quedan «1 de N» y las flechas)", () => {
    const pinta = (x: Record<string, unknown>) => renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: leida(x) }))
    expect(pinta({})).not.toContain("data-baja-para-firmar"); expect(pinta({})).not.toContain("Baja para leer")
    expect(pinta({ cifras: [] })).not.toContain("data-baja-para-firmar")
    expect(pinta({ tipo: "pregunta_al_dueno", fuente: "cerebro_dueno_preguntas", subtipo: "tema", permite: undefined, cifras: [] })).not.toContain("data-baja-para-firmar")
  })
  it("una firma sin cifras muestra su distintivo «Falta información» (CC6 · #282)", () => {
    const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: leida({ cifras: [] }) })).replace(/<!-- -->/g, "")
    expect(html).toMatch(/data-chip="falta"[^>]*>Falta información</)
  })
})

describe("lo que escribe Emilio", () => {
  it.each([["939", 939], ["1341,27", 1341.27], ["1341.27", 1341.27], ["1.341,27", 1341.27], ["1,341.27", 1341.27], ["1.341", 1341], ["1,341", 1341], ["US$ 939", 939], ["$939", 939], [" 5,5 ", 5.5]])("«%s» es %d", (t, n) => {
    expect(leerNumero(t as string)).toBe(n)
  })
  it.each(["", "abc", "-5", "12a", "US$"])("«%s» no es un número", (t) => { expect(leerNumero(t)).toBeNull() })
  it("la cifra propuesta se escribe como se lee, y vuelve a dar lo mismo", () => {
    expect(numeroParaEscribir(1341.27)).toBe("1341,27"); expect(leerNumero(numeroParaEscribir(1341.27))).toBe(1341.27)
  })
})

describe("el servidor: «propuso» sale de su lectura, nunca de la pantalla", () => {
  it("ver cómo queda: llama a recalcular con lo propuesto del servidor, no firma y no sale de la lista", async () => {
    const f = firmarBien()
    const r = await contestarDecision({ id: T1, accion: "recalcular", cambio: { clave: "total_mes", firmado: 939, propuesto: 1 } }, deps(f))
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0].slice(0, 2)).toEqual(["recalcular-tablero", { tablero_id: T1, cambios: [{ clave: "total_mes", propuesto: 1341.27, firmado: 939 }] }])
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, sale: false, recalculo: { alertas: ["Aviso de la oficina"] } } })
    expect((r.cuerpo as { recalculo: { cifras: { clave: string; valor: number }[] } }).recalculo.cifras.find((c) => c.clave === "meta_por_semana")?.valor).toBe(3.5)
  })
  it("firmar con el cambio: va con `cambios`, sale de la lista y el registro dice qué propuso la oficina y qué firmaste", async () => {
    const f = firmarBien()
    const r = await contestarDecision({ id: T1, accion: "editar", cambio: { clave: "total_mes", firmado: 939 } }, deps(f))
    expect(f.mock.calls[0].slice(0, 2)).toEqual(["firmar-tablero", { tablero_id: T1, cambios: [{ clave: "total_mes", propuesto: 1341.27, firmado: 939 }] }])
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, sale: true } })
    const pasos = (r.cuerpo as { registro: { estado: string; texto: string }[] }).registro
    expect(pasos.find((p) => p.estado === "pregunto")?.texto).toContain("US$ 1.341,27")
    expect(pasos.find((p) => p.estado === "firmaste")?.texto).toContain("US$ 939")
  })
  it("si tras firmar el tablero sigue en la lista, no dice que salió", async () => {
    const r = await contestarDecision({ id: T1, accion: "editar", cambio: { clave: "total_mes", firmado: 939 } }, deps(firmarBien(), lecturas(leida(), leida())))
    expect(r).toMatchObject({ status: 200, cuerpo: { sale: false } })
  })
  it.each([["costo_por_venta"], ["no_existe"]])("una cifra que no se puede cambiar (%s) → 409 y no se llama a nadie", async (clave) => {
    const f = firmarBien()
    for (const accion of ["recalcular", "editar"]) expect(await contestarDecision({ id: T1, accion, cambio: { clave, firmado: 10 } }, deps(f, lecturas(leida())))).toMatchObject({ status: 409, cuerpo: { error: "accion_no_permitida" } })
    expect(f).not.toHaveBeenCalled()
  })
  it("si la oficina no lo permite → 409, aunque la pantalla lo pida", async () => {
    const f = firmarBien()
    for (const accion of ["recalcular", "editar"]) expect(await contestarDecision({ id: T1, accion, cambio: { clave: "total_mes", firmado: 10 } }, deps(f, lecturas(leida({ permite: ["aceptar"] }))))).toMatchObject({ status: 409, cuerpo: { error: "accion_no_permitida" } })
    expect(f).not.toHaveBeenCalled()
  })
  it("sin cifras no se firma de ninguna forma", async () => {
    const f = firmarBien()
    expect(await contestarDecision({ id: T1, accion: "editar", cambio: { clave: "total_mes", firmado: 10 } }, deps(f, lecturas(leida({ cifras: [] }))))).toMatchObject({ status: 409, cuerpo: { error: "falta_informacion" } })
    expect(f).not.toHaveBeenCalled()
  })
  it.each([[undefined], [{ clave: "total_mes" }], [{ clave: "total_mes", firmado: 0 }], [{ clave: "total_mes", firmado: -3 }], [{ clave: "total_mes", firmado: "939" }], [{ firmado: 939 }]])("cifra mal escrita %j → no pasa", (cambio) => {
    expect(validarContestar({ id: T1, accion: "editar", cambio }).ok).toBe(false)
    expect(validarContestar({ id: T1, accion: "recalcular", cambio }).ok).toBe(false)
  })
  it("un rechazo se dice en palabras de negocio, con la cifra alcanzable si la hay, y nunca con el nombre interno", async () => {
    const r = await contestarDecision({ id: T1, accion: "recalcular", cambio: { clave: "total_mes", firmado: 500 } }, deps(conflicto("presupuesto_no_cuadra", { alcanzable: 512.4 }), lecturas(leida())))
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: false, sale: false, alcanzable: 512.4, motivo: "Con ese dinero el reparto entre canales no cuadra." } })
    expect(JSON.stringify(r.cuerpo)).not.toContain("total_mes")
  })
  it("una firma rechazada dice que no se firmó y se queda en la lista", async () => {
    const r = await contestarDecision({ id: T1, accion: "editar", cambio: { clave: "total_mes", firmado: 500 } }, deps(conflicto("cifras_cambiaron"), lecturas(leida())))
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: false, sale: false } })
    expect((r.cuerpo as { motivo: string }).motivo).toMatch(/^No se firmó\. Las cifras cambiaron/)
  })
  it("un rechazo desconocido no enseña el detalle interno", async () => {
    const r = await contestarDecision({ id: T1, accion: "recalcular", cambio: { clave: "total_mes", firmado: 500 } }, deps(conflicto("algo_nuevo"), lecturas(leida())))
    expect((r.cuerpo as { motivo: string }).motivo).toBe("La plataforma no aceptó el cambio.")
  })
  it("los cambios llegan de verdad a la plataforma (la acción no los recorta)", async () => {
    const cuerpos: Array<[string, Record<string, unknown>]> = []
    const fetchImpl = vi.fn(async (u: string, init: RequestInit) => { cuerpos.push([u, JSON.parse(String(init.body))]); return new Response(JSON.stringify({ ok: true, cifras: nuevas, alertas: [] }), { status: 200 }) })
    await contestarDecision({ id: T1, accion: "recalcular", cambio: { clave: "total_mes", firmado: 939 } }, { plataformaUrl: "https://plataforma.test", llave: "secreta", revisor: "emilio@x.com", leer: lecturas(leida()) as never, fetchImpl: fetchImpl as never })
    await contestarDecision({ id: T1, accion: "editar", cambio: { clave: "total_mes", firmado: 939 } }, { plataformaUrl: "https://plataforma.test", llave: "secreta", revisor: "emilio@x.com", leer: lecturas(leida(), vacia) as never, fetchImpl: fetchImpl as never })
    const esperado = [{ clave: "total_mes", propuesto: 1341.27, firmado: 939 }]
    expect(cuerpos[0][0]).toBe("https://plataforma.test/api/tablero/recalcular-tablero"); expect(cuerpos[0][1]).toMatchObject({ tablero_id: T1, cambios: esperado, reviewer: "emilio@x.com" })
    expect(cuerpos[1][0]).toBe("https://plataforma.test/api/tablero/firmar-tablero"); expect(cuerpos[1][1]).toMatchObject({ tablero_id: T1, cambios: esperado, reviewer: "emilio@x.com" })
  })
})

describe("una firma rechazada se lee sin bajar (CC6 · #283)", () => {
  const rechazo = { ok: false, sale: false, texto: "No salió: sigue en tu lista.", motivo: "No se firmó. La oficina financiera está trabajando en este cliente: prueba cuando termine.", registro: [] }
  it("firmando con un cambio: el motivo pasa a la caja del problema y lo calculado deja de valer", () => {
    expect(trasFirmar(rechazo)).toEqual({ problema: { motivo: rechazo.motivo, alcanzable: null }, quedaLoVisto: false })
    expect(trasFirmar({ ...rechazo, alcanzable: 512.4 })?.problema.alcanzable).toBe(512.4)
  })
  it("si salió, no queda ningún problema", () => {
    expect(trasFirmar({ ok: true, sale: true, texto: "Firmado.", registro: [] })).toBeNull()
  })
  it("guardada pero sin salir de la lista: dice por qué y lo visto sigue valiendo", () => {
    const r = trasFirmar({ ok: true, sale: false, texto: "Firmado.", motivo: "Se guardó, pero sigue abierta.", registro: [] })
    expect(r).toEqual({ problema: { motivo: "Se guardó, pero sigue abierta.", alcanzable: null }, quedaLoVisto: true })
  })
  it("sin respuesta también dice algo", () => {
    expect(trasFirmar(null)?.problema.motivo).toContain("No se pudo firmar")
  })
  it("el «Firmar» normal: el motivo va antes de las cifras, no debajo del pie", () => {
    const d = leida().decisiones[0]
    const previa = { d, resultado: rechazo, accion: "aceptar" as const, en: "2026-11-05T12:00:00Z" }
    const html = renderToStaticMarkup(createElement(TarjetaDelFrente, { d, alDecidir: () => {}, enPausa: null, detiene: false, contestar: async () => null, verCambio: async () => rechazo, previa }))
    const motivo = html.indexOf("data-por-que-volvio")
    expect(motivo).toBeGreaterThan(-1); expect(motivo).toBeLessThan(html.indexOf("data-cifras")); expect(html).toContain(rechazo.motivo)
  })
})

describe("cómo se escribe el dinero", () => {
  it("con decimales, siempre dos; entero, sin ellos; las otras unidades no se tocan", () => {
    expect(textoDeCifra({ valor: 512.4, unidad: "US$" })).toBe("US$ 512,40"); expect(textoDeCifra({ valor: 939, unidad: "US$" })).toBe("US$ 939")
    expect(textoDeCifra({ valor: 3.5, unidad: "ventas" })).toBe("3,5 ventas")
  })
})

describe("la validación de las acciones", () => {
  const ID = T1
  it("firmar sin cambios sigue valiendo; con cambios los pasa; con cambios mal hechos, no", () => {
    expect(ACCIONES["firmar-tablero"].validar({ tablero_id: ID })).toEqual({ ok: true, cuerpo: { tablero_id: ID } })
    expect(ACCIONES["firmar-tablero"].validar({ tablero_id: ID, cambios: [{ clave: "total_mes", propuesto: 2, firmado: 1, otra: "x" }] })).toEqual({ ok: true, cuerpo: { tablero_id: ID, cambios: [{ clave: "total_mes", propuesto: 2, firmado: 1 }] } })
    for (const cambios of [[], "x", null, [{ clave: "a" }], [{ clave: "", propuesto: 1, firmado: 2 }], Array(6).fill({ clave: "a", propuesto: 1, firmado: 2 })]) expect(ACCIONES["firmar-tablero"].validar({ tablero_id: ID, cambios }).ok).toBe(false)
  })
  it("recalcular siempre pide cambios", () => {
    expect(ACCIONES["recalcular-tablero"].validar({ tablero_id: ID }).ok).toBe(false)
    expect(ACCIONES["recalcular-tablero"].validar({ cambios: [{ clave: "a", propuesto: 1, firmado: 2 }] }).ok).toBe(false)
    expect(ACCIONES["recalcular-tablero"].validar({ tablero_id: ID, cambios: [{ clave: "a", propuesto: 1, firmado: 2 }] }).ok).toBe(true)
  })
})

describe("una sola puerta de firma (CC6 · #282)", () => {
  async function ruta(accion: string) {
    vi.resetModules()
    vi.doMock("@/lib/admin-guard", () => ({ exigirAdmin: async () => ({ ok: true, email: "emilio@x.com" }) }))
    const ejecutar = vi.fn(async () => ({ status: 200, cuerpo: { ok: true } }))
    vi.doMock("@/lib/tablero-acciones", async (real) => ({ ...(await real<typeof import("@/lib/tablero-acciones")>()), ejecutarAccion: ejecutar }))
    const { POST } = await import("@/app/api/acciones/[accion]/route")
    const r = await POST(new Request(`https://t.test/api/acciones/${accion}`, { method: "POST", body: JSON.stringify({ tablero_id: T1 }) }), { params: Promise.resolve({ accion }) })
    vi.doUnmock("@/lib/admin-guard"); vi.doUnmock("@/lib/tablero-acciones"); vi.resetModules()
    return { r, ejecutar }
  }
  it.each(["firmar-tablero", "recalcular-tablero"])("la ruta genérica rechaza %s sin llamar a la plataforma", async (accion) => {
    const { r, ejecutar } = await ruta(accion)
    expect(r.status).toBe(409); expect(ejecutar).not.toHaveBeenCalled()
    expect((await r.json()).detalle).toContain("Decisiones")
  })
  it("las demás acciones siguen pasando por la ruta genérica", async () => {
    const { r, ejecutar } = await ruta("plan-aprobar")
    expect(r.status).toBe(200); expect(ejecutar).toHaveBeenCalledTimes(1)
  })
  it("Oficinas ya no firma: enlaza a Decisiones", () => {
    const fuente = readFileSync("app/oficinas/page.tsx", "utf8")
    expect(fuente).not.toContain('accion="firmar-tablero"')
    expect(fuente).toContain('href="/nuevo?panel=decisiones"')
  })
})

describe("la pantalla de cambiar una cifra (boceto 2)", () => {
  const pintar = (cifra = PRESUPUESTO) => renderToStaticMarkup(createElement(EditorDeCifra, { cifra, todas: [PRESUPUESTO, META, COSTO], alEditar: AL_EDITAR, ver: async () => ({ ok: true, sale: false, texto: "", registro: [] }), firmar: async () => null, volver: () => {} })).replace(/<!-- -->/g, "")
  it("muestra lo propuesto, la caja con la cifra para cambiarla, «Volver a X» y lo que hay que saber", () => {
    const html = pintar()
    expect(html).toContain(">Propuso<"); expect(html).toContain(">Firmas<"); expect(html).toContain("US$ 1.341,27") // estilo base: rótulos de una palabra (guía, regla 2)
    expect(html).toContain('value="1341,27"'); expect(html).toContain('inputMode="decimal"'); expect(html).toContain("Volver a US$ 1.341,27"); expect(html).toContain(AL_EDITAR)
  })
  it("al entrar, sin cambiar nada, no se puede firmar: solo «Ver cómo queda», apagado", () => {
    const html = pintar()
    expect(html).not.toContain("data-firmar-cambio"); expect(html).toMatch(/<button[^>]*data-ver-cambio[^>]*disabled/)
  })
  it("lo que sigue abierto se ve también mientras se cambia la cifra", () => {
    const html = renderToStaticMarkup(createElement(EditorDeCifra, { cifra: PRESUPUESTO, todas: [PRESUPUESTO], alEditar: null, criticos: ["Dos hallazgos sin cerrar"], ver: async () => ({ ok: true, sale: false, texto: "", registro: [] }), firmar: async () => null, volver: () => {} }))
    expect(html).toContain("Sigue abierto"); expect(html).toContain("Dos hallazgos sin cerrar")
    expect(pintar()).not.toContain("Sigue abierto")
  })
  it("al entrar se calcula a la mano: «Ver cómo queda» va antes de lo que hay que leer, sin indicación de firmar", () => {
    const html = pintar()
    expect(html.indexOf("data-ver-cambio")).toBeLessThan(html.indexOf("data-al-editar")); expect(html).not.toContain("data-baja-para-firmar"); expect(html).not.toContain("sticky")
  })
  it("una meta en ventas lleva su unidad después de la caja", () => {
    const html = pintar(META)
    expect(html).toContain("Volver a 5 ventas por semana"); expect(html).toContain("ventas por semana</span>")
  })
  it("solo se firma lo que se vio: si la cifra cambia, hay que volver a verla", () => {
    const vista = { firmado: 939, cifras: nuevas, alertas: [] }
    expect(estadoDelEditor("939", 1341.27, vista)).toMatchObject({ firmado: 939, distinta: true, vigente: vista })
    expect(estadoDelEditor("940", 1341.27, vista)).toMatchObject({ firmado: 940, distinta: true, vigente: null })
    expect(estadoDelEditor("940", 1341.27, null)).toMatchObject({ distinta: true, vigente: null })
  })
  it("sin número, en cero o igual a lo propuesto no hay nada que ver", () => {
    for (const t of ["", "abc", "0", "1341,27"]) expect(estadoDelEditor(t, 1341.27, null).distinta).toBe(false)
  })
  it("«Así queda todo» muestra solo lo que se mueve", () => {
    expect(cifrasQueCambian([PRESUPUESTO, META, COSTO], nuevas).map((x) => [x.cifra.clave, x.antes, x.cifra.valor])).toEqual([["total_mes", 1341.27, 939], ["meta_por_semana", 5, 3.5]])
  })
})
