// @vitest-environment jsdom
/**
 * 17-nov · el banco de ideas de la Gran Idea (GO Lenovo «construir» + ADENDA de «Retirar» · boceto aprobado por Emilio · cuidados de CC6).
 *  · se ven las ideas mismas, por capítulo, y todas («ver todas»); las retiradas no se muestran ni se cuentan;
 *  · cada campo se edita como el renglón del manual; lo editado queda en «Tus cambios» y sale junto con «Pedir los cambios», que dice a qué alcanza;
 *  · «Retirar esta idea» pide confirmación; la plataforma reasigna sin avisar;
 *  · el tablero no escribe la base: todo va a `POST /api/cadena/concepto/banco` (contrato de CC1), solo sobre la versión APROBADA.
 * Clientes de dos rubros: una ferretería y Náufrago.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { detalleDelConcepto, resumenDelBanco, TIPO_CONCEPTO, type CapituloDelConcepto, type IdeaDelBanco } from "@/lib/concepto-datos"
import type { ContextoSinCodigos } from "@/lib/sin-codigos"
import {
  ALCANCE_DE_LOS_CAMBIOS, bancoEditable, bancoPorCapitulo, conEdicion, cuantosCambios, cuerpoDeEdicion, IDEAS_A_LA_VISTA, nombreDeRed, pedirAlBanco, TOPE_DEL_CAMPO,
  validarPedidoDelBanco,
} from "@/lib/banco-de-ideas"
import { BancoDeIdeas, rutaDelBanco } from "@/components/nuevo/gran-idea/BancoDeIdeas"

afterEach(cleanup)

const HITL = "6f1c2a7e-0b1d-4c3e-9a8f-1234567890ab"
const CAMP = "7a0c7a2e-2222-4333-8444-555566667777"
/** el texto de prueba sin códigos (la pantalla traduce «C2-I01» a palabras) */
const t = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "")
const idea = (id: string, capitulo: string | null, x: Partial<IdeaDelBanco> = {}): IdeaDelBanco => ({
  id, capitulo, red: "instagram", formato: "reel", idea: `idea ${t(id)}`, mensaje: `mensaje ${t(id)}`, gancho: `gancho ${t(id)}`, protagonista: `protagonista ${t(id)}`, serie: null, foto: null, ...x,
})
/** ferretería: «La caja de la casa» · capítulos por clave */
const CAPS_FERRE: CapituloDelConcepto[] = [
  { clave: "abrir", fase: "f1", nombre: "La caja se abre", que_cuenta: "", objetivo_cita: "", como_se_ve: "", series: [{ id: "S1", nombre: "Una herramienta por semana", que_cuenta: "", redes: ["instagram"] }] },
  { clave: "usar", fase: "f2", nombre: "Manos a la obra", que_cuenta: "", objetivo_cita: "", como_se_ve: "", series: [] },
]
const BANCO_FERRE = [
  idea("C1-I01", "abrir", { idea: "el martillo de tu abuelo sigue en la caja", mensaje: "lo que dura se compra aquí", gancho: "repite el ritual de C1-I02 con el martillo", serie: "S1", foto: "a1|foto:b2" }),
  idea("C1-I02", "f1", { red: "facebook", formato: "foto" }), // cita la fase, no la clave: igual entra al capítulo
  idea("C2-I01", "usar", { red: "whatsapp", formato: "estado" }),
  idea("C2-I02", "usar", { retirada: true }),
  idea("C9-I01", "no-existe"),
]
/** Náufrago: el capítulo «desbloquear» con más ideas de las que se ven de entrada */
const CAPS_NAUFRAGO: CapituloDelConcepto[] = [{ clave: "desbloquear", fase: "desbloquear", nombre: "La leyenda llega al barrio", que_cuenta: "", objetivo_cita: "", como_se_ve: "", series: [] }]
const BANCO_NAUFRAGO = Array.from({ length: 8 }, (_, n) => idea(`C1-I${String(n).padStart(2, "0")}`, "desbloquear", { idea: `pergamino ${n}: la esquina visible`, mensaje: `el náufrago dejó algo escrito ${n}` }))

describe("1 · la lectura", () => {
  it("por capítulo, en su orden; una idea que cita la fase entra; la que no calza va al final; las retiradas no", () => {
    const g = bancoPorCapitulo(BANCO_FERRE, CAPS_FERRE)
    expect(g.map((c) => [c.nombre, c.ideas.map((i) => i.id)])).toEqual([
      ["La caja se abre", ["C1-I01", "C1-I02"]],
      ["Manos a la obra", ["C2-I01"]],
      ["Sin capítulo", ["C9-I01"]],
    ])
  })
  it("el lector marca la retirada y el resumen no la cuenta", () => {
    const hitl = { id: HITL, type: TIPO_CONCEPTO, status: "approved", decision: { accion: "aprobar" }, title: "Gran idea", created_at: "2026-11-17T06:00:00Z", metadata: { campana_id: CAMP, version: 4 } }
    const d = detalleDelConcepto({ hitl, concepto: { campana_id: CAMP, version: 4, aprobacion: "aprobado", leido: { banco: BANCO_FERRE, capitulos: CAPS_FERRE } }, brief: null, cliente: "Ferretería El Clavo" })
    expect(d.banco.find((i) => i.id === "C2-I02")?.retirada).toBe(true)
    expect(d.banco.find((i) => i.id === "C2-I01")?.retirada).toBe(false)
    expect(d.resumen.total).toBe(4)
    expect(resumenDelBanco(BANCO_FERRE, []).por_red).toEqual({ instagram: 2, facebook: 1, whatsapp: 1 })
  })
  it("los nombres de las redes, como los lee Emilio", () => {
    expect(["instagram", "whatsapp", "YouTube", "tiktok", "pinterest", ""].map(nombreDeRed)).toEqual(["Instagram", "WhatsApp", "YouTube", "TikTok", "Pinterest", "Sin red"])
  })
  it("solo la versión aprobada se edita", () => {
    expect(bancoEditable({ estado: "aprobada", version: 4, campana_id: CAMP })).toBe(true)
    for (const estado of ["pendiente", "con_cambios", "rechazada", "otro"] as const) expect(bancoEditable({ estado, version: 4, campana_id: CAMP })).toBe(false)
    expect(bancoEditable({ estado: "aprobada", version: null, campana_id: CAMP })).toBe(false)
  })
})

describe("2 · las ediciones en espera", () => {
  const i = BANCO_FERRE[0]
  it("se agregan normalizadas, y volver al texto guardado (o vaciar) las quita", () => {
    let e = conEdicion({}, i, "mensaje", "  lo que dura   se compra en El Clavo ")
    expect(e).toEqual({ "C1-I01": { mensaje: "lo que dura se compra en El Clavo" } })
    e = conEdicion(e, i, "gancho", "¿todavía tienes el martillo?")
    expect(cuantosCambios(e)).toBe(2)
    e = conEdicion(e, i, "mensaje", i.mensaje)
    expect(e).toEqual({ "C1-I01": { gancho: "¿todavía tienes el martillo?" } })
    expect(conEdicion(e, i, "gancho", "   ")).toEqual({})
    expect(conEdicion({}, i, "idea", "x".repeat(TOPE_DEL_CAMPO + 50))["C1-I01"].idea).toHaveLength(TOPE_DEL_CAMPO)
  })
  it("el cuerpo del pedido lleva la versión y una entrada por idea", () => {
    expect(cuerpoDeEdicion(4, { "C1-I01": { mensaje: "a" }, "C2-I01": { gancho: "b", idea: "c" } })).toEqual({
      accion: "editar", version: 4, cambios: [{ idea_id: "C1-I01", campos: { mensaje: "a" } }, { idea_id: "C2-I01", campos: { gancho: "b", idea: "c" } }],
    })
  })
})

describe("3 · la regla del pedido", () => {
  const ok = (cambios: unknown) => validarPedidoDelBanco({ accion: "editar", version: 4, cambios })
  it("editar: campos del boceto, recortados, sin vacíos ni largos ni repetidas; versión obligatoria", () => {
    expect(ok([{ idea_id: "C1-I01", campos: { mensaje: "  hola  barrio " } }])).toEqual({ ok: true, pedido: { accion: "editar", version: 4, cambios: [{ idea_id: "C1-I01", campos: { mensaje: "hola barrio" } }] } })
    expect(ok([{ idea_id: "C1-I01", campos: { red: "tiktok" } }])).toMatchObject({ ok: false, error: "campo_invalido" })
    expect(ok([{ idea_id: "C1-I01", campos: { gancho: "  " } }])).toMatchObject({ ok: false, error: "campo_vacio" })
    expect(ok([{ idea_id: "C1-I01", campos: { idea: "x".repeat(TOPE_DEL_CAMPO + 1) } }])).toMatchObject({ ok: false, error: "campo_largo" })
    expect(ok([{ idea_id: "C1-I01", campos: { idea: "a" } }, { idea_id: "C1-I01", campos: { gancho: "b" } }])).toMatchObject({ ok: false, error: "idea_invalida" })
    expect(ok([{ idea_id: "C1-I01", campos: {} }])).toMatchObject({ ok: false, error: "sin_cambios" })
    expect(ok([])).toMatchObject({ ok: false, error: "sin_cambios" })
    expect(ok(Array.from({ length: 201 }, (_, n) => ({ idea_id: `I${n}`, campos: { idea: "a" } })))).toMatchObject({ ok: false, error: "demasiados_cambios" })
    expect(validarPedidoDelBanco({ accion: "editar", cambios: [{ idea_id: "C1-I01", campos: { idea: "a" } }] })).toMatchObject({ ok: false, error: "version_falta" })
  })
  it("retirar: una idea reconocible; otra acción no vale", () => {
    expect(validarPedidoDelBanco({ accion: "retirar", version: 4, idea_id: "C2-I01" })).toEqual({ ok: true, pedido: { accion: "retirar", version: 4, idea_id: "C2-I01" } })
    expect(validarPedidoDelBanco({ accion: "retirar", version: 4, idea_id: "../x y" })).toMatchObject({ ok: false, error: "idea_invalida" })
    expect(validarPedidoDelBanco({ accion: "borrar", version: 4 })).toMatchObject({ ok: false, error: "accion_invalida" })
  })
})

describe("4 · el pedido va a la plataforma (el tablero no escribe la base)", () => {
  function base(hitl: Record<string, unknown> | null, concepto: Record<string, unknown> | null) {
    const tabla = (nombre: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q
      q.maybeSingle = async () => ({ data: nombre === "hitl_queue" ? hitl : nombre === "clients" ? { name: "Ferretería El Clavo" } : nombre === "cadena_conceptos" ? concepto : null, error: null })
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
      return q
    }
    return { from: (n: string) => tabla(n) } as never
  }
  const hitl = (status = "approved") => ({ id: HITL, type: TIPO_CONCEPTO, status, decision: status === "approved" ? { accion: "aprobar" } : null, title: "Gran idea", created_at: "2026-11-17T06:00:00Z", client_id: null, metadata: { campana_id: CAMP, version: 4 } })
  const concepto = { campana_id: CAMP, version: 4, estado: "lista", aprobacion: "aprobado", leido: { banco: BANCO_FERRE, capitulos: CAPS_FERRE } }
  const respuesta = (status: number, cuerpo: unknown) => vi.fn(async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch
  const deps = (b: unknown, f: typeof fetch, llave = "llave") => ({ supabase: b as never, revisor: "emilio@correo", plataformaUrl: "https://plataforma.test/", llave, fetchImpl: f, ahora: () => "2026-11-17T06:40:00.000Z" })
  const enviado = (f: typeof fetch) => { const c = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { body: string; headers: Record<string, string> }]; return { url: c[0], cuerpo: JSON.parse(c[1].body), llave: c[1].headers["x-api-key"] } }
  const EDITAR = { accion: "editar", version: 4, cambios: [{ idea_id: "C1-I01", campos: { mensaje: "lo que dura se compra en El Clavo" } }] }

  it("editar: a `/api/cadena/concepto/banco` con campaña, autor y workflow «tablero»; la respuesta dice a qué alcanza", async () => {
    const f = respuesta(200, { ok: true, version: 4, ideas: [], historial: [] })
    const r = await pedirAlBanco(HITL, EDITAR, deps(base(hitl(), concepto), f))
    expect(r.status, JSON.stringify(r.cuerpo)).toBe(200)
    expect(enviado(f)).toEqual({
      url: "https://plataforma.test/api/cadena/concepto/banco", llave: "llave",
      cuerpo: { ...EDITAR, campana_id: CAMP, autor: "emilio@correo", workflow_id: "tablero", workflow_execution_id: `tablero:banco:${HITL}:2026-11-17T06:40:00.000Z` },
    })
    expect(r.cuerpo).toMatchObject({ ok: true, accion: "editar", version: 4 })
    expect(String(r.cuerpo.nota)).toContain(ALCANCE_DE_LOS_CAMBIOS)
  })
  it("retirar: va igual y la pantalla solo confirma el retiro (la reasignación no se le anuncia)", async () => {
    const f = respuesta(200, { ok: true, version: 4, ideas: [], historial: [], reasignadas: [{ fila_id: "f1", idea_vieja: "C2-I01", idea_nueva: "C2-I03" }] })
    const r = await pedirAlBanco(HITL, { accion: "retirar", version: 4, idea_id: "C2-I01" }, deps(base(hitl(), concepto), f))
    expect(enviado(f).cuerpo).toMatchObject({ accion: "retirar", version: 4, idea_id: "C2-I01", campana_id: CAMP })
    expect(r.cuerpo).toMatchObject({ ok: true, nota: "Idea retirada del banco." })
  })
  it("no se manda nada si: no existe · no está aprobada · la versión cambió · la idea ya no está · falta la llave · el pedido no vale", async () => {
    const nunca = respuesta(200, { ok: true })
    expect((await pedirAlBanco(HITL, EDITAR, deps(base(null, null), nunca))).status).toBe(404)
    expect(await pedirAlBanco(HITL, EDITAR, deps(base(hitl("pending"), { ...concepto, aprobacion: "pendiente" }), nunca))).toMatchObject({ status: 409, cuerpo: { error: "no_aprobada" } })
    expect(await pedirAlBanco(HITL, { ...EDITAR, version: 3 }, deps(base(hitl(), concepto), nunca))).toMatchObject({ status: 409, cuerpo: { error: "version_cambio" } })
    expect(await pedirAlBanco(HITL, { accion: "retirar", version: 4, idea_id: "C2-I02" }, deps(base(hitl(), concepto), nunca))).toMatchObject({ status: 409, cuerpo: { error: "idea_no_vigente" } })
    expect(await pedirAlBanco(HITL, { accion: "retirar", version: 4, idea_id: "C7-I99" }, deps(base(hitl(), concepto), nunca))).toMatchObject({ status: 409, cuerpo: { error: "idea_no_vigente" } })
    expect(await pedirAlBanco(HITL, EDITAR, deps(base(hitl(), concepto), nunca, ""))).toMatchObject({ status: 503, cuerpo: { error: "llave_interna_sin_poner" } })
    expect(await pedirAlBanco(HITL, { accion: "editar", version: 4, cambios: [] }, deps(base(hitl(), concepto), nunca))).toMatchObject({ status: 400 })
    expect(nunca).not.toHaveBeenCalled()
  })
  it("lo que dice la plataforma: sin ruta = 501 sin simular · 409 se pasa · un rechazo o un ok:false nunca es ok", async () => {
    const b = base(hitl(), concepto)
    expect(await pedirAlBanco(HITL, EDITAR, deps(b, respuesta(404, {})))).toMatchObject({ status: 501, cuerpo: { ok: false, error: "plataforma_sin_ruta" } })
    expect(await pedirAlBanco(HITL, EDITAR, deps(b, respuesta(409, { ok: false, codigo: "version_cambio", error: "la versión aprobada es otra" })))).toEqual({ status: 409, cuerpo: { ok: false, error: "version_cambio", detalle: "la versión aprobada es otra" } })
    expect(await pedirAlBanco(HITL, EDITAR, deps(b, respuesta(500, { error: "se_rompio" })))).toMatchObject({ status: 502, cuerpo: { ok: false, plataforma_status: 500 } })
    expect(await pedirAlBanco(HITL, EDITAR, deps(b, respuesta(200, { ok: false, error: "raro" })))).toMatchObject({ status: 502, cuerpo: { ok: false } })
    const caida = vi.fn(async () => { throw new Error("sin red") }) as unknown as typeof fetch
    expect(await pedirAlBanco(HITL, EDITAR, deps(b, caida))).toMatchObject({ status: 502, cuerpo: { error: "plataforma_sin_respuesta" } })
  })
})

describe("5 · en pantalla", () => {
  const D = (estado: "aprobada" | "pendiente", banco = BANCO_NAUFRAGO, capitulos = CAPS_NAUFRAGO) => ({ hitl_id: HITL, estado, version: 4, campana_id: CAMP, banco, capitulos })
  const CTX: ContextoSinCodigos = { fotos: [], aportes: {}, series: {} }
  const abrirCapitulo = (nombre: RegExp) => fireEvent.click(screen.getByRole("button", { name: nombre }))

  it("las ideas se ven: el capítulo abre con 5 y «ver todas» muestra el resto (Náufrago)", () => {
    const { container } = render(<BancoDeIdeas d={D("aprobada")} ctx={CTX} onGuardado={() => {}} />)
    expect(container.querySelectorAll("[data-idea]")).toHaveLength(0)
    abrirCapitulo(/La leyenda llega al barrio · 8 ideas/)
    expect(container.querySelectorAll("[data-idea]")).toHaveLength(IDEAS_A_LA_VISTA)
    expect(screen.getByText("pergamino 0: la esquina visible")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /y 3 ideas más de este capítulo · ver todas/ }))
    expect(container.querySelectorAll("[data-idea]")).toHaveLength(8)
  })
  it("una idea abierta muestra sus campos con «Editar», la serie, la foto y «Retirar esta idea» (ferretería)", () => {
    const { container } = render(<BancoDeIdeas d={D("aprobada", BANCO_FERRE, CAPS_FERRE)} ctx={CTX} onGuardado={() => {}} />)
    abrirCapitulo(/La caja se abre/)
    fireEvent.click(screen.getByText("el martillo de tu abuelo sigue en la caja"))
    const abierta = container.querySelector('[data-idea="C1-I01"][data-abierta]') as HTMLElement
    expect([...abierta.querySelectorAll("[data-campo]")].map((x) => x.getAttribute("data-campo"))).toEqual(["idea", "mensaje", "gancho", "protagonista"])
    expect(within(abierta).getAllByRole("button", { name: /^Editar / })).toHaveLength(4)
    expect(abierta.textContent).toContain("Una herramienta por semana")
    expect(abierta.textContent).toContain("2 fotos del expediente")
    expect(within(abierta).getByRole("button", { name: "Retirar esta idea" })).toBeTruthy()
    expect(abierta.textContent).not.toMatch(/C\d+-I\d+/) // los códigos de la cadena se leen en palabras
    expect(abierta.querySelector('[data-campo="gancho"]')?.textContent).toContain("repite el ritual de")
  })
  it("sin aprobar: se lee igual, sin «Editar» ni «Retirar»", () => {
    const { container } = render(<BancoDeIdeas d={D("pendiente", BANCO_FERRE, CAPS_FERRE)} ctx={CTX} onGuardado={() => {}} />)
    abrirCapitulo(/La caja se abre/)
    fireEvent.click(screen.getByText("el martillo de tu abuelo sigue en la caja"))
    expect(container.textContent).toContain("lo que dura se compra aquí")
    expect(screen.queryByRole("button", { name: /^Editar / })).toBeNull()
    expect(screen.queryByRole("button", { name: "Retirar esta idea" })).toBeNull()
  })
  it("editar → «Tus cambios» con el alcance → «Pedir los cambios» manda la tanda y vuelve a leer", async () => {
    const onGuardado = vi.fn()
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, nota: "Cambios guardados en 1 idea." }), { status: 200 })) as unknown as typeof fetch
    const { container } = render(<BancoDeIdeas d={D("aprobada", BANCO_FERRE, CAPS_FERRE)} ctx={CTX} onGuardado={onGuardado} fetchImpl={f} />)
    abrirCapitulo(/La caja se abre/)
    fireEvent.click(screen.getByText("el martillo de tu abuelo sigue en la caja"))
    fireEvent.click(screen.getByRole("button", { name: /^Editar «lo que dura/ }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lo que dura se compra en El Clavo" } })
    fireEvent.click(screen.getByRole("button", { name: "Listo" }))
    const tus = container.querySelector("[data-tus-cambios]") as HTMLElement
    expect(tus.textContent).toContain("Tus cambios · 1")
    expect(tus.textContent).toContain("«La caja se abre» · Mensaje: lo que dura se compra en El Clavo")
    expect(tus.textContent).toContain(ALCANCE_DE_LOS_CAMBIOS)
    expect(f).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Pedir los cambios" }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { body: string }]
    expect(url).toBe(rutaDelBanco(HITL))
    expect(JSON.parse(init.body)).toEqual({ accion: "editar", version: 4, cambios: [{ idea_id: "C1-I01", campos: { mensaje: "lo que dura se compra en El Clavo" } }] })
    expect(container.querySelector("[data-tus-cambios]")).toBeNull()
    expect(screen.getByRole("status").textContent).toBe("Cambios guardados en 1 idea.")
  })
  it("el ✕ deshace un cambio; si la plataforma dice que no, los cambios quedan y se lee el porqué", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "version_cambio", detalle: "la gran idea cambió mientras la mirabas: recarga" }), { status: 409 })) as unknown as typeof fetch
    const { container } = render(<BancoDeIdeas d={D("aprobada", BANCO_FERRE, CAPS_FERRE)} ctx={CTX} onGuardado={() => {}} fetchImpl={f} />)
    abrirCapitulo(/La caja se abre/)
    fireEvent.click(screen.getByText("el martillo de tu abuelo sigue en la caja"))
    for (const [nombre, nuevo] of [[/^Editar «lo que dura/, "otro mensaje"], [/^Editar «repite el ritual/, "otro gancho"]] as const) {
      fireEvent.click(screen.getByRole("button", { name: nombre }))
      fireEvent.change(screen.getByRole("textbox"), { target: { value: nuevo } })
      fireEvent.click(screen.getByRole("button", { name: "Listo" }))
    }
    expect(container.querySelector("[data-tus-cambios]")?.textContent).toContain("Tus cambios · 2")
    fireEvent.click(screen.getByRole("button", { name: "Deshacer el cambio de gancho" }))
    expect(container.querySelector("[data-tus-cambios]")?.textContent).toContain("Tus cambios · 1")
    fireEvent.click(screen.getByRole("button", { name: "Pedir los cambios" }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("la gran idea cambió mientras la mirabas: recarga"))
    expect(container.querySelector("[data-tus-cambios]")?.textContent).toContain("Tus cambios · 1")
  })
  it("retirar pide confirmación, manda la idea y vuelve a leer", async () => {
    const onGuardado = vi.fn()
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, nota: "Idea retirada del banco." }), { status: 200 })) as unknown as typeof fetch
    render(<BancoDeIdeas d={D("aprobada", BANCO_FERRE, CAPS_FERRE)} ctx={CTX} onGuardado={onGuardado} fetchImpl={f} />)
    abrirCapitulo(/Manos a la obra/)
    fireEvent.click(screen.getByText("idea c2i01"))
    fireEvent.click(screen.getByRole("button", { name: "Retirar esta idea" }))
    expect(f).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Sí, retirar" }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { body: string }])[1].body)).toEqual({ accion: "retirar", version: 4, idea_id: "C2-I01" })
  })
})
