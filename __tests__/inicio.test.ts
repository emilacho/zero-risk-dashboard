/** INICIO · lógica pura + puertas + chat. US$ 0, sin red. La prueba contra la base viva está en inicio-viva.test.ts. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { estadoDelSistema, porcentajeDelTope, teNecesitan, ultimosHechos } from "@/lib/inicio"
import type { TarjetaDeOficina } from "@/lib/oficinas"

const tarjeta = (clave: TarjetaDeOficina["clave"], semaforo: TarjetaDeOficina["semaforo"]): TarjetaDeOficina => ({ clave, nombre: clave, que_hace: "", semaforo, estado_texto: "", datos: [], ultima_actividad: null, espera: [], detalle: [] })

describe("Te necesitan", () => {
  it("solo aparece lo que tiene al menos uno; el plural sigue al número", () => {
    expect(teNecesitan({ piezas: 0, revisiones: 0, preguntas: 0 })).toEqual([])
    const t = teNecesitan({ piezas: 2, revisiones: 0, preguntas: 1 })
    expect(t.map((x) => [x.clave, x.cuantos, x.titulo])).toEqual([["piezas", 2, "piezas por aprobar"], ["preguntas", 1, "pregunta de la oficina financiera"]])
    expect(t[0].href).toBe("/piezas")
  })
  it("una pieza dice «pieza por aprobar» en singular", () => {
    expect(teNecesitan({ piezas: 1, revisiones: 0, preguntas: 0 })[0].titulo).toBe("pieza por aprobar")
  })
})

describe("Estado del sistema (una línea)", () => {
  it("todas verdes → «Todo funcionando»", () => {
    expect(estadoDelSistema([tarjeta("creativa", "verde"), tarjeta("cerebro", "gris")], null)).toMatchObject({ semaforo: "verde", texto: "Todo funcionando" })
  })
  it("una oficina en rojo gana sobre ámbar; el conteo va en singular y plural", () => {
    expect(estadoDelSistema([tarjeta("creativa", "rojo"), tarjeta("cerebro", "ambar")], null)).toMatchObject({ semaforo: "rojo", texto: "1 oficina con problema" })
    expect(estadoDelSistema([tarjeta("creativa", "rojo"), tarjeta("cerebro", "rojo")], null).texto).toBe("2 oficinas con problema")
  })
  it("ámbar → algo que mirar; todo apagado → gris", () => {
    expect(estadoDelSistema([tarjeta("creativa", "ambar")], null).semaforo).toBe("ambar")
    expect(estadoDelSistema([tarjeta("creativa", "gris")], null).semaforo).toBe("gris")
  })
  it("las alertas abiertas mandan y llevan a /alertas", () => {
    expect(estadoDelSistema([tarjeta("creativa", "verde")], 3)).toEqual({ semaforo: "rojo", texto: "3 alertas abiertas", href: "/alertas" })
    expect(estadoDelSistema([tarjeta("creativa", "verde")], 1).texto).toBe("1 alerta abierta")
    expect(estadoDelSistema([tarjeta("creativa", "verde")], 0).semaforo).toBe("verde")
  })
})

describe("Lo último que pasó", () => {
  it("los 5 más nuevos, del más reciente al más viejo; fechas ilegibles se descartan", () => {
    const h = ["2026-10-01", "2026-10-05", "2026-10-03", "no-es-fecha", "2026-10-04", "2026-10-02", "2026-10-06"].map((cuando) => ({ cuando, texto: cuando }))
    expect(ultimosHechos(h).map((x) => x.texto)).toEqual(["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03", "2026-10-02"])
  })
})

describe("barra del tope", () => {
  it("proporcional, sin pasar de 100 ni bajar de 0, y tolera basura", () => {
    expect(porcentajeDelTope(5, 10)).toBe(50)
    expect(porcentajeDelTope(25, 10)).toBe(100)
    expect(porcentajeDelTope(-1, 10)).toBe(0)
    expect(porcentajeDelTope(Number.NaN, 10)).toBe(0)
    expect(porcentajeDelTope(3, 0)).toBe(0)
  })
})

describe("puertas y chat de Inicio", () => {
  const leer = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8")
  it("la página llama a exigirAdmin antes de leer", () => {
    const t = leer("app/page.tsx")
    expect(t.indexOf("exigirAdmin()")).toBeGreaterThan(-1)
    expect(t.indexOf("exigirAdmin()")).toBeLessThan(t.indexOf("getServiceRoleClient()"))
  })
  it("las rutas del chat con Cowork están protegidas por la puerta de /api (deniega por omisión, sin lista blanca)", () => {
    expect(leer("lib/api-gate.ts")).toMatch(/API_PUBLICAS[^=]*= new Set<string>\(\[\]\)/)
    expect(fs.existsSync(path.join(__dirname, "..", "app/api/cowork/message/route.ts"))).toBe(true)
    expect(leer("middleware.ts")).toMatch(/pathname\.startsWith\("\/api\/"\)/)
  })
  it("el chat avisa que no es en vivo y manda al endpoint existente", () => {
    const t = leer("components/inicio/ChatConCowork.tsx")
    expect(t).toMatch(/\/api\/cowork\/message/)
    expect(t).toMatch(/\/api\/cowork\/messages/)
    expect(t).toMatch(/No es en vivo/)
  })
  it("no queda en el Inicio nada del panel viejo (feed en vivo, accesos técnicos, indicadores)", () => {
    const t = leer("app/page.tsx")
    for (const viejo of ["HomeControlPanel", "LiveAgentFeed", "OpsKpiGrid", "Sprint 6"]) expect(t, viejo).not.toContain(viejo)
  })
})
