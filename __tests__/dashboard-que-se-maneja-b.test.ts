/**
 * Tramo B de «el dashboard se maneja» (30-oct): botones que HACEN cosas por la plataforma. US$ 0, sin red (la plataforma es un doble).
 * Lo que se prueba: cada acción valida su pedido; la que gasta exige haber confirmado el tope; nada se simula si la plataforma no tiene la ruta (501);
 * la puerta es solo administrador con sesión; el tablero no escribe la base; y cada botón que pintan las pantallas nombra una acción que existe.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { ACCIONES, ejecutarAccion, esNombreDeAccion } from "@/lib/tablero-acciones"
import { botonesDeRevision } from "@/lib/revisiones"

const RAIZ = path.join(__dirname, "..")
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), "utf8")
const ID = "11111111-1111-1111-1111-111111111111"
const ID2 = "22222222-2222-2222-2222-222222222222"

function plataforma(status = 200, cuerpo: unknown = { ok: true }) {
  const llamadas: Array<{ url: string; metodo: string; llave: string | null; cuerpo: Record<string, unknown> }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), metodo: String(init?.method), llave: new Headers(init?.headers).get("x-api-key"), cuerpo: JSON.parse(String(init?.body ?? "{}")) })
    return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status })
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, llamadas }
}
/** 11-nov (GO Lenovo 20:28): «rehacer» manda el tope de la FAMILIA de la pieza; aquí, un video de 35 */
const TOPE_DE_LA_FAMILIA = 35
const deps = (p: ReturnType<typeof plataforma>, tope: number | null = TOPE_DE_LA_FAMILIA) => ({ revisor: "emilio@x.com", plataformaUrl: "https://plataforma.test/", llave: "llave-de-prueba", fetchImpl: p.fetchImpl, topeDeLaFamilia: async () => tope })

describe("cada acción valida lo que pide", () => {
  const casos: Array<[string, Record<string, unknown>, boolean]> = [
    ["rehacer-pieza", { encargo_id: ID, confirmo_gasto: true }, true],
    ["rehacer-pieza", { encargo_id: "no-es-uuid", confirmo_gasto: true }, false],
    ["plan-aprobar", { campana_id: ID }, true],
    ["plan-aprobar", {}, false],
    ["plan-cambios", { campana_id: ID, comentario: "Menos días de promoción" }, true],
    ["plan-cambios", { campana_id: ID, comentario: "no" }, false],
    ["plan-responder", { espera_id: ID, respuesta: "Sí, el lunes" }, true],
    ["plan-responder", { espera_id: ID, respuesta: "" }, false],
    ["firmar-tablero", { tablero_id: ID }, true],
    ["firmar-tablero", { tablero_id: "x" }, false],
    ["cliente-editar", { client_id: ID, campos: { rubro: "restaurante", redes: { instagram: "naufrago", tuiter: "x" } } }, true],
    ["cliente-editar", { client_id: ID, campos: { presupuesto: 300 } }, false],
    ["cliente-tope", { client_id: ID, tope_usd: 25 }, true],
    ["cliente-tope", { client_id: ID, tope_usd: 0 }, false],
    ["cliente-tope", { client_id: ID, tope_usd: 5000 }, false],
    ["cliente-tope", { tope_usd: 10 }, false],
    ["cliente-editar", { client_id: ID, campos: {} }, false],
    ["cliente-nuevo", { nombre: "La Esquina", rubro: "cafetería" }, true],
    ["cliente-nuevo", { nombre: "L", rubro: "cafetería" }, false],
    ["cliente-baja", { client_id: ID, comentario: "ya no es cliente" }, true],
    ["cliente-baja", { client_id: ID }, false],
    ["oficina-estado", { oficina: "creativa", estado: "apagada" }, true],
    ["oficina-estado", { oficina: "cerebro", estado: "apagada" }, false],
    ["oficina-estado", { oficina: "creativa", estado: "dormida" }, false],
    ["oficina-tope", { oficina: "financiera", tope_usd: 8 }, true],
    ["oficina-tope", { oficina: "financiera", tope_usd: 0 }, false],
    ["revision-resolver", { hitl_id: ID, decision: "aprobar" }, true],
    ["revision-resolver", { hitl_id: ID, decision: "rechazar" }, false],
    ["revision-resolver", { hitl_id: ID, decision: "rechazar", comentario: "la lista está mal" }, true],
    ["manual-campos", { client_id: ID, campos: { eslogan: "Del mar a tu mesa" } }, true],
    ["manual-campos", { client_id: ID, campos: { logo_interno: "x" } }, false],
    ["manual-campos", { client_id: ID, campos: {} }, false],
    ["manual-validar", { client_id: ID }, true],
  ]
  it.each(casos)("%s %j → %s", async (nombre, cuerpo, valido) => {
    const p = plataforma()
    const r = await ejecutarAccion(nombre, cuerpo, deps(p))
    if (valido) { expect(r.status, JSON.stringify(r.cuerpo)).toBe(200); expect(p.llamadas).toHaveLength(1) } else { expect(r.status).toBe(400); expect(p.llamadas).toHaveLength(0) }
  })
  it("una acción que no existe da 404 y no llama a nadie", async () => {
    const p = plataforma()
    expect((await ejecutarAccion("borrar-todo", {}, deps(p))).status).toBe(404)
    expect(esNombreDeAccion("constructor")).toBe(false)
    expect(p.llamadas).toHaveLength(0)
  })
})

describe("lo que gasta exige confirmar; el servidor lo comprueba, no solo la pantalla (y sin montos a la vista: Emilio 11-nov 20:27)", () => {
  it("sin confirmo_gasto no sale nada hacia la plataforma", async () => {
    const p = plataforma()
    const r = await ejecutarAccion("rehacer-pieza", { encargo_id: ID }, deps(p))
    expect(r.status).toBe(400)
    expect(r.cuerpo).toMatchObject({ error: "falta_confirmar_gasto" }); expect(r.cuerpo).not.toHaveProperty("tope_usd"); expect(JSON.stringify(r.cuerpo)).not.toMatch(/US\$|\d+ ?d[oó]lares/)
    expect(p.llamadas).toHaveLength(0)
  })
  it("con la confirmación, rehacer una pieza manda a la plataforma el tope DE SU FAMILIA (no 5 fijos) y la marca", async () => {
    const p = plataforma()
    const pedidos: string[] = []
    await ejecutarAccion("rehacer-pieza", { encargo_id: ID, confirmo_gasto: true }, { ...deps(p), topeDeLaFamilia: async (id: string) => { pedidos.push(id); return TOPE_DE_LA_FAMILIA } })
    expect(pedidos).toEqual([ID]) // el tope es el del encargo que se rehace
    expect(p.llamadas[0].cuerpo).toMatchObject({ encargo_id: ID, confirmo_gasto: true, tope_usd: TOPE_DE_LA_FAMILIA, reviewer: "emilio@x.com", origen: "dashboard" })
    const foto = plataforma()
    await ejecutarAccion("rehacer-pieza", { encargo_id: ID, confirmo_gasto: true }, deps(foto, 2.5))
    expect(foto.llamadas[0].cuerpo.tope_usd).toBe(2.5)
  })
  it("si no se puede leer el tope de la familia, no se gasta a ciegas: 503 y nada sale hacia la plataforma", async () => {
    for (const d of [(p: ReturnType<typeof plataforma>) => deps(p, null), (p: ReturnType<typeof plataforma>) => ({ ...deps(p), topeDeLaFamilia: undefined }), (p: ReturnType<typeof plataforma>) => ({ ...deps(p), topeDeLaFamilia: async () => { throw new Error("base caída") } })]) {
      const p = plataforma()
      const r = await ejecutarAccion("rehacer-pieza", { encargo_id: ID, confirmo_gasto: true }, d(p))
      expect(r).toMatchObject({ status: 503, cuerpo: { ok: false, error: "sin_tope_de_la_familia" } }); expect(p.llamadas).toHaveLength(0)
    }
  })
  it("solo gasta «rehacer una pieza de la campaña»; el resto no puede costar", () => {
    expect(Object.entries(ACCIONES).filter(([, d]) => d.gasta).map(([n]) => n).sort()).toEqual(["rehacer-pieza"])
  })
})

describe("la plataforma manda; el tablero cuenta la verdad", () => {
  it("va con la llave interna a /api/tablero/{accion} por POST", async () => {
    const p = plataforma()
    await ejecutarAccion("plan-aprobar", { campana_id: ID }, deps(p))
    expect(p.llamadas[0]).toMatchObject({ url: "https://plataforma.test/api/tablero/plan-aprobar", metodo: "POST", llave: "llave-de-prueba" })
  })
  it("el manual va por su ruta propia, con PATCH, y el cliente va en la dirección, no en el cuerpo", async () => {
    const p = plataforma()
    await ejecutarAccion("manual-campos", { client_id: ID2, campos: { eslogan: "Del mar a tu mesa" }, comentario: "lo dijo en la llamada" }, deps(p))
    expect(p.llamadas[0]).toMatchObject({ url: `https://plataforma.test/api/manual/${ID2}/campos`, metodo: "PATCH" })
    expect(p.llamadas[0].cuerpo.client_id).toBeUndefined()
    expect(p.llamadas[0].cuerpo).toMatchObject({ campos: { eslogan: "Del mar a tu mesa" }, comentario: "lo dijo en la llamada" })
  })
  it.each([404, 405])("si la plataforma no tiene la ruta (%s) responde 501 «todavía no disponible» y NO finge haber hecho algo", async (st) => {
    const r = await ejecutarAccion("firmar-tablero", { tablero_id: ID }, deps(plataforma(st, "")))
    expect(r.status).toBe(501)
    expect(r.cuerpo).toMatchObject({ ok: false, error: "todavia_no_disponible" })
  })
  it("una llave rechazada, un conflicto y una caída se dicen cada uno con su causa", async () => {
    expect((await ejecutarAccion("firmar-tablero", { tablero_id: ID }, deps(plataforma(401, { error: "unauthorized" })))).cuerpo).toMatchObject({ error: "la_plataforma_no_acepto_la_llave" })
    expect((await ejecutarAccion("firmar-tablero", { tablero_id: ID }, deps(plataforma(409, { detalle: "ya firmado" })))).status).toBe(409)
    expect((await ejecutarAccion("firmar-tablero", { tablero_id: ID }, deps(plataforma(500, { detalle: "boom" })))).cuerpo).toMatchObject({ error: "la_plataforma_rechazo", detalle: "boom" })
    const caida = { revisor: "x", plataformaUrl: "https://p.test", llave: "k", fetchImpl: (async () => { throw new Error("sin red") }) as unknown as typeof fetch }
    expect((await ejecutarAccion("firmar-tablero", { tablero_id: ID }, caida)).cuerpo).toMatchObject({ error: "plataforma_sin_respuesta" })
  })
  it("sin llave interna no sale nada (503)", async () => {
    const p = plataforma()
    const prev = { a: process.env.PLATFORM_INTERNAL_KEY, b: process.env.INTERNAL_API_KEY }
    delete process.env.PLATFORM_INTERNAL_KEY; delete process.env.INTERNAL_API_KEY
    try {
      const r = await ejecutarAccion("firmar-tablero", { tablero_id: ID }, { revisor: "x", plataformaUrl: "https://p.test", fetchImpl: p.fetchImpl })
      expect(r.status).toBe(503)
      expect(p.llamadas).toHaveLength(0)
    } finally { if (prev.a) process.env.PLATFORM_INTERNAL_KEY = prev.a; if (prev.b) process.env.INTERNAL_API_KEY = prev.b }
  })
})

describe("la puerta del tablero: solo administrador con sesión", () => {
  async function ruta(puerta: { ok: true; email: string | null } | { ok: false; status: 401 | 403 }) {
    vi.resetModules()
    vi.doMock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta }))
    const ejecutar = vi.fn(async () => ({ status: 200, cuerpo: { ok: true } }))
    vi.doMock("@/lib/tablero-acciones", () => ({ ejecutarAccion: ejecutar, SOLO_DESDE_DECISIONES: [] }))
    const { POST } = await import("@/app/api/acciones/[accion]/route")
    const pedir = () => POST(new Request("https://t.test/api/acciones/plan-aprobar", { method: "POST", body: JSON.stringify({ campana_id: ID }) }), { params: Promise.resolve({ accion: "plan-aprobar" }) })
    return { pedir, ejecutar }
  }
  it("sin sesión → 401, sin permiso → 403, y en ninguno se ejecuta nada", async () => {
    for (const st of [401, 403] as const) { const { pedir, ejecutar } = await ruta({ ok: false, status: st }); expect((await pedir()).status).toBe(st); expect(ejecutar).not.toHaveBeenCalled() }
  })
  it("con sesión de administrador se ejecuta a nombre de su correo", async () => {
    const { pedir, ejecutar } = await ruta({ ok: true, email: "emilio@x.com" })
    expect((await pedir()).status).toBe(200)
    expect(ejecutar).toHaveBeenCalledWith("plan-aprobar", { campana_id: ID }, { revisor: "emilio@x.com", topeDeLaFamilia: expect.any(Function) })
  })
})

describe("cada botón que pintan las pantallas nombra una acción que existe, y el tablero no escribe la base", () => {
  const PANTALLAS = ["app/oficinas/page.tsx", "app/alertas/page.tsx", "app/clientes/page.tsx", "app/clientes/[id]/page.tsx", "app/piezas/VisorDePieza.tsx", "components/TopeDelCliente.tsx", /* CC6 · 01-nov · el tablero del dueño vive en /nuevo */ "components/nuevo/PalabrasDelManual.tsx"]
  it("todas las acciones de los botones están en el catálogo", () => {
    const usadas = new Set<string>()
    for (const p of PANTALLAS) for (const m of leer(p).matchAll(/accion="([a-z-]+)"/g)) usadas.add(m[1])
    expect(usadas.size).toBeGreaterThanOrEqual(12)
    for (const a of usadas) expect(esNombreDeAccion(a), a).toBe(true)
  })
  it("cada acción del catálogo tiene su botón en alguna pantalla (ninguna queda sin usar)", () => {
    // CC6 · 02-nov: «validar un campo» vive en el manual de /nuevo (su botón lleva data-tablero-accion)
    const todo = [...PANTALLAS, "components/nuevo/PanelManual.tsx", "components/nuevo/PanelPiezas.tsx"].map(leer).join("\n") // CC6 · 03-nov: «Recuperar» del archivo vive en Piezas de /nuevo
    // CC6 · 03-nov · manual limpio (Emilio: «dos botones claros, nada más»): «validar un campo» quedó sin botón; la acción sigue en el catálogo (contrato de la plataforma)
    // 05-nov · firmar y ver una cifra cambiada viven en Tu oficina › Decisiones, que las llama desde el servidor (la ruta genérica las rechaza)
    const SIN_BOTON_POR_DECISION = ["manual-validar-campo", "firmar-tablero", "recalcular-tablero"]
    for (const a of Object.keys(ACCIONES)) if (!SIN_BOTON_POR_DECISION.includes(a)) expect(todo.includes(`accion="${a}"`) || todo.includes(`/api/acciones/${a}"`), a).toBe(true)
    expect(todo).not.toContain('accion="manual-validar-campo"')
  })
// ADENDA 4 (30-oct): las piezas salen SOLO de la campaña (planeación → brief → oficina). Desde el tablero no se puede crear una fuera de ella.
  it("no existe ningún camino del tablero para pedir una pieza nueva fuera de la campaña", async () => {
    expect(Object.keys(ACCIONES)).not.toContain("pieza-nueva")
    expect(esNombreDeAccion("pieza-nueva")).toBe(false)
    const todo = PANTALLAS.map(leer).join("\n")
    expect(todo).not.toMatch(/pieza-nueva|Pedir una pieza nueva/)
  })
  it("la acción que gasta se confirma en su botón, pero SIN montos (Emilio 11-nov 20:27: «no me interesa precios»)", () => {
    const todo = PANTALLAS.map(leer).join("\n")
    const botones = [...todo.matchAll(/accion="rehacer-pieza"[^\n]*/g)].map((m) => m[0])
    expect(botones.length).toBe(2) // alertas y el visor de la pieza
    for (const b of botones) { expect(b).toMatch(/ gasta /); expect(b).not.toMatch(/tope_usd|TOPE_POR_PIEZA_USD/) }
    const boton = leer("components/AccionBoton.tsx")
    expect(boton).not.toMatch(/US\$|puede costar|Confirmar \(hasta/); expect(boton).toContain('"Confirmar"')
  })
  it("ni la puerta de acciones ni el botón escriben en la base: nada de supabase ni de .insert/.update", () => {
    for (const f of ["app/api/acciones/[accion]/route.ts", "lib/tablero-acciones.ts", "components/AccionBoton.tsx"]) {
      const t = leer(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
      expect(t, f).not.toMatch(/supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(/i)
    }
  })
  it("cada otra revisión tiene sus botones propios y los tipos nuevos caen en Aprobar/Rechazar", () => {
    expect(botonesDeRevision("confirm_competitor_list").aprobar).toBe("Confirmar la lista")
    expect(botonesDeRevision("editor_escalation").rechazar).toBe("Devolver al equipo")
    expect(botonesDeRevision("plan_con_pendientes").aprobar).toBe("Aprobar el plan así")
    expect(botonesDeRevision("algo_nuevo")).toMatchObject({ aprobar: "Aprobar", rechazar: "Rechazar" })
  })
})
