/**
 * Tramo A de «el dashboard se maneja» (30-oct): login en español sin ruido, Inicio sin chat, Clientes sin bajas ni prácticas, Gasto con cliente y enlace, Alertas sin duplicados y con acción.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { deCerebro, deOficina } from "@/lib/alertas"
import { esDeBaja, esDePractica, estadoDeLaLista, visibles, type ResumenDeCliente } from "@/lib/clientes"

const leer = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8")

describe("A1 · el login habla español y no enseña nada interno", () => {
  const archivos = ["app/login/page.tsx", "components/auth/LoginForm.tsx", "components/auth/TotpChallengeForm.tsx"]
  it.each(archivos)("%s no menciona el canon, a Xavier, ni textos en inglés ni voseo", (a) => {
    const t = leer(a).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
    for (const malo of ["canon 2026", "xavier", "Single-operator", "Sign in", "Magic link", "Backup code", "inbox", "setear", "recovery email", "recovery link"]) expect(t.toLowerCase(), malo).not.toContain(malo.toLowerCase())
    expect(t).not.toMatch(/\b(Ingresá|Revisá|tocá|usá|podés)\b/)
  })
})

describe("A4 · la lista de clientes", () => {
  const c = (o: Partial<ResumenDeCliente>): ResumenDeCliente => ({ id: "x", nombre: "N", rubro: "restaurante", estado: "active", piezas_por_aprobar: 0, gasto_30d: 0, trozos_del_cerebro: 0, campana: null, de_baja: false, de_practica: false, ...o })
  it("dado de baja = churned, archivado o con nombre «ARCHIVADA…»", () => {
    expect(esDeBaja({ estado: "churned" })).toBe(true)
    expect(esDeBaja({ estado: "active", archivado: true })).toBe(true)
    expect(esDeBaja({ estado: "active", nombre: "ARCHIVADA 2026-10-12 · ficha de práctica" })).toBe(true)
    expect(esDeBaja({ estado: "onboarding", nombre: "Náufrago" })).toBe(false)
  })
  it("práctica = rubro «prueba» o nombre de prueba; un cliente real con «prueba» en medio no cuenta", () => {
    expect(esDePractica({ rubro: "prueba", nombre: "Lo que sea" })).toBe(true)
    expect(esDePractica({ rubro: "x", nombre: "zz prueba puerta 21:22" })).toBe(true)
    expect(esDePractica({ rubro: "x", nombre: "Prueba Seca Alta 2200" })).toBe(true)
    expect(esDePractica({ rubro: "restaurante", nombre: "Náufrago" })).toBe(false)
    expect(esDePractica({ rubro: "x", nombre: "La Prueba del Chef" })).toBe(false)
  })
  it("por omisión se esconden bajas y prácticas; «ver dados de baja» muestra las bajas pero nunca las prácticas", () => {
    const l = [c({ nombre: "A" }), c({ nombre: "B", de_baja: true }), c({ nombre: "P", de_baja: true, de_practica: true })]
    expect(visibles(l, false).map((x) => x.nombre)).toEqual(["A"])
    expect(visibles(l, true).map((x) => x.nombre)).toEqual(["A", "B"])
  })
  it("un cliente nuevo con campaña en marcha no dice «en preparación»", () => {
    expect(estadoDeLaLista("onboarding", "activa")).toBe("En servicio · campaña en marcha")
    expect(estadoDeLaLista("onboarding", null)).toBe("Cliente nuevo, en preparación")
    expect(estadoDeLaLista("churned", "activa")).toBe("Dado de baja")
  })
})

describe("A8 · alertas sin duplicados y con acción", () => {
  const CLI = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
  it("la misma alarma del portero en días distintos es UNA: la más reciente, repeticiones sumadas, con «Ver el cliente»", () => {
    const r = deCerebro([
      { clave: `aviso-del-dia:${CLI}:2026-10-28`, titulo: "Portero · gasto 3.10", ultimo_detalle: "d1", repeticiones: 2, abierto_en: "2026-10-28T10:00:00Z", ultima_en: "2026-10-28T12:00:00Z", cerrado_en: null },
      { clave: `aviso-del-dia:${CLI}:2026-10-29`, titulo: "Portero · gasto 4.02", ultimo_detalle: "d2", repeticiones: 1, abierto_en: "2026-10-29T10:00:00Z", ultima_en: "2026-10-29T12:00:00Z", cerrado_en: null },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ clave: `cerebro:aviso-del-dia:${CLI}`, titulo: "Portero · gasto 4.02", repeticiones: 3, desde: "2026-10-28T10:00:00.000Z", cerrada: false })
    expect(r[0].acciones).toEqual([{ texto: "Ver el cliente", href: `/clientes/${CLI}` }])
  })
  it("una alarma sola conserva su clave; alarmas distintas no se juntan", () => {
    const r = deCerebro([{ clave: "a", ultima_en: "2026-10-28T00:00:00Z" }, { clave: "b", ultima_en: "2026-10-28T00:00:00Z" }])
    expect(r.map((x) => x.clave).sort()).toEqual(["cerebro:a", "cerebro:b"])
  })
  it("una alerta de pieza lleva «Ver la pieza» (a la pieza si tiene bandeja, si no al mapa) y su encargo para rehacer", () => {
    const base = { id: "e1", brief_id: "B", familia: "carrusel_mesa", estado: "fallido", con_desacuerdo: false, gasto_usd: 1, tope_usd: 5, dry_run: false, prueba: false, creado_en: "2026-10-29T10:00:00Z", cerrado_en: "2026-10-29T11:00:00Z" }
    const [con] = deOficina([{ ...base, hitl_queue_id: "h-1" }], new Date("2026-10-30T00:00:00Z"))
    expect(con.acciones).toEqual([{ texto: "Ver la pieza", href: "/piezas?id=h-1&estado=todas" }])
    expect(con.encargo_id).toBe("e1")
    const [sin] = deOficina([{ ...base, hitl_queue_id: null }], new Date("2026-10-30T00:00:00Z"))
    expect(sin.acciones[0].href).toBe("/mapa")
  })
})

describe("A7 · el gasto de cada pieza dice de quién es y lleva a la pieza", () => {
  it("la lectura trae el cliente y la bandeja de cada pieza, y la pantalla los muestra", () => {
    const d = leer("lib/gasto-datos.ts"), p = leer("app/gasto/page.tsx")
    expect(d).toMatch(/client_id, hitl_queue_id/)
    expect(p).toMatch(/\/piezas\?id=\$\{p\.hitl_queue_id\}/)
    expect(p).toMatch(/p\.cliente/)
  })
})
