// @vitest-environment jsdom
/**
 * Sprint 2 · PROPUESTAS (boceto aprobado por Emilio 16-nov 22:23 · `raw/evidencia/2026-11-16-sprint2-tarjeta-propuestas/`).
 * Contrato: ADENDA 1 de CC1 (`raw/tasks/2026-11-16-RESPUESTA-CC1-a-CC2-CC3-CC5-sprint2-hoja-fase-y-propuestas.md`) + los 3 campos de la decisión 22:23
 * (borrador en video, costo visible, varios cuadros por plano). La plataforma aún no lo publica: el fixture es la forma exacta del contrato.
 * Se prueba con dos clientes de rubros distintos (un restaurante y una clínica dental): nada del dibujo depende del cliente.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { contestarPropuestas, dolares, leerPropuestas, resumenDeLasPropuestas, rolLegible, tramo, type Propuestas } from "@/lib/propuestas"
import { dondeSeDecide, normalizarDecisiones, type Decision } from "@/lib/direccion-decisiones"
import { NOMBRE_DEL_VERBO, PUERTAS_DE_LA_FICHA, fichaDeLaDecision, revisarFicha } from "@/lib/ficha-de-decision"
import { ACCIONES, ejecutarAccion } from "@/lib/tablero-acciones"
import { decisionesPendientes, departamentoDeLaDecision, PROPUESTAS_ESPERAN } from "@/lib/escena-alertas"
import { PanelPropuestas } from "@/components/nuevo/PanelPropuestas"
import { TarjetaDelFrente } from "@/components/nuevo/PanelDecisiones"

afterEach(cleanup)
const ENCARGO = "6f1c2a90-3b7e-4d1a-9c55-0e2b7d4a8f11"
const CLINICA = "b7c9e2d4-1a3f-4e8b-9d6c-5f0a2b3c4d5e"
const IMG = (n: string) => `https://almacen.example/borradores/${n}.png`

/** la fila que devuelve `GET /api/direccion/decisiones` (ADENDA 1 de CC1 §1) */
const fila = (extra: Record<string, unknown> = {}, propuestas: Record<string, unknown> = {}) => ({
  id: ENCARGO, tipo: "propuestas", fuente: "oficina_turnos", client_id: CLINICA, cliente: "Clínica Dental Sonrisa", titulo: "Propuestas del video: elige una",
  desde: "2026-11-16T21:30:00Z", vence: null, decidir: { ruta: null, accion: "propuestas-aprobar" }, detiene: true,
  propuestas: {
    encargo_id: ENCARGO, brief_id: "brief-1", ronda: 1, quedan_vueltas: 3, avisos: ["El plano 3 no dice cómo termina el cuadro."],
    lista: [
      { id: "P1", nombre: "La sonrisa nueva", concepto: "Antes y después de un blanqueamiento, contado por la paciente.", segundos: 12, red: "Instagram", objetivo: "Citas nuevas", por_que: "La prueba visual convence más que el precio.",
        video_url: "https://almacen.example/borradores/p1.mp4", costo: { borrador_usd: 0.84, final_usd: 6.2 },
        planos: [
          { n: 1, desde: 0, hasta: 2, rol: "captar", dice: "una sonrisa", se_ve: "Primer plano de una sonrisa", texto_en_pantalla: null, producto: false, imagen_url: IMG("p1-1") },
          { n: 2, desde: 2, hasta: 7, rol: "prueba", dice: "el cambio", se_ve: "La paciente frente al espejo", texto_en_pantalla: "En una sola cita", producto: true, imagenes: [IMG("p1-2a"), IMG("p1-2b")] },
          { n: 3, desde: 7, hasta: 12, rol: "llamado", dice: null, se_ve: "El logo y la dirección", texto_en_pantalla: "Agenda hoy", producto: null, imagen_url: null },
        ] },
      { id: "P2", nombre: "Un día en la clínica", concepto: "El recorrido desde la recepción hasta el sillón.", segundos: 15, red: "TikTok", objetivo: "Confianza", por_que: "Quita el miedo al dentista.",
        video_url: null, costo: { borrador_usd: null, final_usd: null },
        planos: [{ n: 1, desde: 0, hasta: 15, rol: "ambiente", se_ve: "La recepción", imagen_url: IMG("p2-1") }] },
      { id: "P3", nombre: "Preguntas rápidas", concepto: "La doctora responde tres dudas.", segundos: 10, red: "YouTube", objetivo: "Confianza", por_que: "Responde lo que más preguntan.",
        video_url: "https://almacen.example/borradores/p3.mp4", costo: { borrador_usd: 0.5, final_usd: 4 }, planos: [] },
    ],
    ...propuestas,
  },
  ...extra,
})
const decision = (extra: Record<string, unknown> = {}, propuestas: Record<string, unknown> = {}) => {
  const d = normalizarDecisiones({ decisiones: [fila(extra, propuestas)], fuentes: [], sin_fuente: [], completo: true }).decisiones[0]
  return d as Decision & { propuestas: Propuestas }
}
const dibujar = (props: Record<string, unknown> = {}, d = decision()) => renderToStaticMarkup(createElement(PanelPropuestas, { decision: d, onCerrar: () => undefined, ...props }))
const respuesta = (status: number, cuerpo: unknown) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } }))

describe("1 · el dato: lo que no cuadra con el contrato no se muestra", () => {
  it("lee la forma de la ADENDA 1 con los campos nuevos (video, costo, varios cuadros)", () => {
    const p = leerPropuestas(fila().propuestas)!
    expect(p.ronda).toBe(1); expect(p.quedan_vueltas).toBe(3); expect(p.lista.map((x) => x.id)).toEqual(["P1", "P2", "P3"])
    expect(p.lista[0].video_url).toBe("https://almacen.example/borradores/p1.mp4")
    expect(p.lista[0].costo).toEqual({ borrador_usd: 0.84, final_usd: 6.2 })
    expect(p.lista[0].planos[0].imagenes).toEqual([IMG("p1-1")]) // `imagen_url` cuando no hay `imagenes`
    expect(p.lista[0].planos[1].imagenes).toEqual([IMG("p1-2a"), IMG("p1-2b")]) // varios cuadros: plano de 5 s
    expect(p.lista[0].planos[2].imagenes).toEqual([]) // todavía sin imagen
    expect(p.lista[1].costo).toEqual({ borrador_usd: null, final_usd: null })
  })
  it("sin encargo válido, sin ronda o sin ninguna propuesta legible no hay nada que decidir", () => {
    const base = fila().propuestas
    expect(leerPropuestas({ ...base, encargo_id: "no-es-uuid" })).toBeNull()
    expect(leerPropuestas({ ...base, ronda: 0 })).toBeNull()
    expect(leerPropuestas({ ...base, ronda: 1.5 })).toBeNull()
    expect(leerPropuestas({ ...base, lista: [] })).toBeNull()
    expect(leerPropuestas({ ...base, lista: [{ id: "P1" }, { nombre: "sin id" }] })).toBeNull()
    expect(leerPropuestas(null)).toBeNull()
  })
  it("una propuesta repetida se queda una vez; un video o una imagen que no es dirección web no se pone", () => {
    const base = fila().propuestas
    const p = leerPropuestas({ ...base, lista: [{ id: "P1", nombre: "A", video_url: "javascript:alert(1)", planos: [{ imagen_url: "data:image/png;base64,xx", imagenes: ["ftp://x", 3] }] }, { id: "P1", nombre: "B" }] })!
    expect(p.lista).toHaveLength(1); expect(p.lista[0].nombre).toBe("A")
    expect(p.lista[0].video_url).toBeNull(); expect(p.lista[0].planos[0].imagenes).toEqual([])
  })
  it("costos negativos y rondas restantes raras quedan sin dato (nunca un número inventado)", () => {
    const base = fila().propuestas
    const p = leerPropuestas({ ...base, quedan_vueltas: -1, lista: [{ id: "P1", nombre: "A", costo: { borrador_usd: -2, final_usd: "5" } }] })!
    expect(p.quedan_vueltas).toBeNull(); expect(p.lista[0].costo).toEqual({ borrador_usd: null, final_usd: null })
  })
  it("Decisiones trae las propuestas; una decisión de propuestas sin propuestas legibles se descarta y la lista queda incompleta", () => {
    const d = decision()
    expect(d.tipo).toBe("propuestas"); expect(d.propuestas.lista).toHaveLength(3)
    const mala = normalizarDecisiones({ decisiones: [fila({ propuestas: { encargo_id: "x" } })], fuentes: [], sin_fuente: [], completo: true })
    expect(mala.decisiones).toHaveLength(0); expect(mala.completo).toBe(false)
  })
  it("en palabras: dinero, segundos, papel del plano y el resumen", () => {
    expect(dolares(0.84)).toBe("US$ 0,84"); expect(dolares(null)).toBeNull()
    expect(tramo({ desde: 2, hasta: 7 })).toBe("2–7 s"); expect(tramo({ desde: 2, hasta: null })).toBeNull()
    expect(rolLegible("conclusion")).toBe("Conclusión"); expect(rolLegible("dar giro")).toBe("Dar giro"); expect(rolLegible(null)).toBeNull()
    expect(resumenDeLasPropuestas({ lista: [1, 2, 3] as never })).toBe("3 propuestas en borrador")
    expect(resumenDeLasPropuestas({ lista: [1] as never })).toBe("1 propuesta en borrador")
  })
})

describe("2 · la ficha de siempre en Decisiones (estándar único)", () => {
  it("se decide en «Propuestas», que se abre en el mismo lugar; sin fecha límite; detiene la producción; la ficha no tiene verbos propios", () => {
    const d = decision()
    expect(dondeSeDecide(d)).toEqual({ panel: "propuestas", boton: "Ver las propuestas" })
    const f = fichaDeLaDecision(d, { departamento: "Departamento de Marketing", cuenta: "Clínica Dental Sonrisa", titulo: d.titulo, detiene: true, destraba: null, acciones: [], panel: "propuestas" })
    expect(f.propuesta).toEqual({ supuesto: "3 propuestas en borrador" })
    expect(f.espera.sin_limite).toBe(true); expect(f.detiene).toEqual({ que: "la producción" })
    expect(f.donde_se_hace).toEqual({ pantalla: "propuestas" }); expect(f.acciones).toEqual([])
    expect(revisarFicha(f).ok).toBe(true)
  })
  it("la tarjeta del frente lleva el enlace «Ver las Propuestas» y el «Se decide en Propuestas», sin precios ni códigos", () => {
    const h = renderToStaticMarkup(createElement(TarjetaDelFrente, { d: decision(), alDecidir: () => undefined, enPausa: null, detiene: true, contestar: async () => null, verCambio: async () => ({ ok: false }) as never, previa: null }))
    expect(h).toContain("Ver las"); expect(h).toContain("Propuestas"); expect(h).toContain('data-se-decide-en="propuestas"')
    expect(h).toContain("3 propuestas en borrador"); expect(h).toContain("Sin fecha límite"); expect(h).toContain("Detiene la producción")
    expect(h).toContain("Departamento de Marketing"); const visible = h.replace(/<[^>]+>/g, " ")
    expect(visible).not.toContain("US$"); expect(visible).not.toContain(ENCARGO)
  })
  it("las dos puertas nuevas están en la lista cerrada (la misma que `DESTINOS` de la plataforma, ADENDA 1 §3)", () => {
    expect(PUERTAS_DE_LA_FICHA).toContain("propuestas-aprobar"); expect(PUERTAS_DE_LA_FICHA).toContain("propuestas-cambios")
  })
  it("la antena de Marketing la cuenta, con su frase («esperan tu elección»)", () => {
    expect(departamentoDeLaDecision({ fuente: "oficina_turnos", oficina: null, tipo: "propuestas" })).toBe("marketing")
    expect(departamentoDeLaDecision({ fuente: "oficina_turnos", oficina: null, tipo: "pieza" })).toBeNull()
    const [a] = decisionesPendientes({ cliente: CLINICA, ahora: new Date("2026-11-16T22:00:00Z"), plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [],
      decisiones: [{ id: ENCARGO, tipo: "propuestas", fuente: "oficina_turnos", client_id: CLINICA, desde: "2026-11-16T21:30:00Z", oficina: null, cliente: "Clínica Dental Sonrisa" }] } as never)
    expect(a.texto).toBe(PROPUESTAS_ESPERAN); expect(a.departamento).toBe("marketing")
  })
})

describe("3 · la puerta del tablero: valida y pasa a la plataforma (ADENDA 1 §2)", () => {
  it("aprobar pide encargo, ronda y propuesta; no pide confirmación de gasto aparte (la aprobación es el «dale»)", () => {
    const a = ACCIONES["propuestas-aprobar"]
    expect(a.gasta).toBeNull()
    expect(a.validar({ encargo_id: ENCARGO, ronda: 1, propuesta_id: "P2" })).toEqual({ ok: true, cuerpo: { encargo_id: ENCARGO, ronda: 1, propuesta_id: "P2" } })
    expect(a.validar({ encargo_id: "x", ronda: 1, propuesta_id: "P2" }).ok).toBe(false)
    expect(a.validar({ encargo_id: ENCARGO, ronda: "1", propuesta_id: "P2" }).ok).toBe(false)
    expect(a.validar({ encargo_id: ENCARGO, ronda: 1, propuesta_id: "" }).ok).toBe(false)
    expect(a.validar({ encargo_id: ENCARGO, ronda: 1, propuesta_id: "P 1; drop" }).ok).toBe(false)
  })
  it("pedir cambios pide observaciones de 1 a 2.000 caracteres", () => {
    const c = ACCIONES["propuestas-cambios"]
    expect(c.gasta).toBeNull()
    expect(c.validar({ encargo_id: ENCARGO, ronda: 2, observaciones: "  El cierre debe mostrar la cita.  " })).toEqual({ ok: true, cuerpo: { encargo_id: ENCARGO, ronda: 2, observaciones: "El cierre debe mostrar la cita." } })
    expect(c.validar({ encargo_id: ENCARGO, ronda: 2, observaciones: "   " }).ok).toBe(false)
    expect(c.validar({ encargo_id: ENCARGO, ronda: 2, observaciones: "x".repeat(2001) }).ok).toBe(false)
    expect(c.validar({ encargo_id: ENCARGO, ronda: 2, observaciones: "x".repeat(2000) }).ok).toBe(true)
  })
  it("va a `POST /api/tablero/propuestas-aprobar` con la llave interna y el cuerpo validado; un 409 trae el motivo de la plataforma", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => respuesta(200, { ok: true, encargo_id: ENCARGO, propuesta_id: "P2", estado: "aprobada" }))
    const r = await ejecutarAccion("propuestas-aprobar", { encargo_id: ENCARGO, ronda: 1, propuesta_id: "P2" }, { revisor: "emilio", plataformaUrl: "https://plataforma.example/", llave: "k", fetchImpl: f as never })
    expect(r.status).toBe(200)
    const [u, init] = f.mock.calls[0]
    expect(u).toBe("https://plataforma.example/api/tablero/propuestas-aprobar")
    expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("k")
    expect(JSON.parse(String(init!.body))).toEqual({ encargo_id: ENCARGO, ronda: 1, propuesta_id: "P2", reviewer: "emilio", origen: "dashboard" })
    const g = vi.fn(() => respuesta(409, { ok: false, error: "ronda_vieja", detalle: "la ronda 1 ya pasó" }))
    const v = await ejecutarAccion("propuestas-cambios", { encargo_id: ENCARGO, ronda: 1, observaciones: "otra" }, { revisor: "emilio", plataformaUrl: "https://p", llave: "k", fetchImpl: g as never })
    expect(v.status).toBe(409); expect((v.cuerpo.plataforma as Record<string, unknown>).error).toBe("ronda_vieja")
  })
  it("los motivos se dicen en palabras; los que muestran algo que ya pasó piden volver a leer", async () => {
    const con = (status: number, cuerpo: unknown) => contestarPropuestas("propuestas-aprobar", { encargo_id: ENCARGO, ronda: 1, propuesta_id: "P1" }, (() => respuesta(status, cuerpo)) as never)
    expect(await con(200, { ok: true })).toEqual({ ok: true, estado: "aprobada" })
    const vieja = await con(409, { ok: false, error: "conflicto", plataforma: { error: "ronda_vieja" } })
    expect(vieja.ok).toBe(false); if (!vieja.ok) { expect(vieja.recargar).toBe(true); expect(vieja.motivo).not.toMatch(/ronda_vieja|409/) }
    const sin = await con(409, { ok: false, error: "conflicto", plataforma: { error: "sin_vueltas" } })
    if (!sin.ok) expect(sin.recargar).toBe(false)
    const nd = await con(501, { ok: false, error: "todavia_no_disponible" })
    if (!nd.ok) expect(nd.motivo).toMatch(/no se hizo ningún cambio/)
    const caida = await contestarPropuestas("propuestas-cambios", { encargo_id: ENCARGO, ronda: 1, observaciones: "x" }, (() => Promise.reject(new Error("red"))) as never)
    if (!caida.ok) expect(caida.motivo).toMatch(/no hubo conexión/)
  })
})

describe("4 · la pantalla Propuestas (boceto aprobado + borrador en video + costo)", () => {
  it("las 3 lado a lado, cada una con su video (o el aviso de que falta), su costo y su guion gráfico", () => {
    const h = dibujar()
    expect(h.match(/data-propuesta="/g)).toHaveLength(3)
    expect(h.match(/data-borrador-video/g)).toHaveLength(2); expect(h).toContain('src="https://almacen.example/borradores/p1.mp4"')
    expect(h).toContain("data-sin-video"); expect(h).toContain("El borrador en video todavía no está")
    expect(h).toContain("US$ 0,84"); expect(h).toContain("US$ 6,20")
    expect(h).toContain("Propuesta 1 de 3"); expect(h).toContain("La sonrisa nueva"); expect(h).toContain("12 s"); expect(h).toContain("Instagram"); expect(h).toContain("Citas nuevas")
    expect(h).toContain("Clínica Dental Sonrisa · ronda 1 · en borrador · quedan 3 rondas de cambios")
  })
  it("los planos: varios cuadros si dura más de 3 s; sin imagen, el cuadro vacío dice qué se verá; papel, segundos y texto en pantalla", () => {
    const h = dibujar()
    const p1 = h.slice(h.indexOf('data-propuesta="P1"'), h.indexOf('data-propuesta="P2"'))
    expect(p1.match(/data-cuadro="true"/g)).toHaveLength(3)
    expect(p1).toContain("data-cuadro-vacio"); expect(p1).toContain("El logo y la dirección")
    expect(p1).toContain("1 · Captar"); expect(p1).toContain("2 · Prueba"); expect(p1).toContain("3 · Llamado")
    expect(p1).toContain("2–7 s"); expect(p1).toContain("«En una sola cita»"); expect(p1).toContain("sin texto")
    const p3 = h.slice(h.indexOf('data-propuesta="P3"'))
    expect(p3).not.toContain("data-guion-grafico"); expect(p3).toContain("data-sin-dato")
  })
  it("lo que falta es guion rojo (costo, video), nunca un número", () => {
    const h = dibujar()
    const p2 = h.slice(h.indexOf('data-propuesta="P2"'), h.indexOf('data-propuesta="P3"'))
    expect(p2.match(/data-sin-dato/g)!.length).toBeGreaterThanOrEqual(3) // video + borrador + final
    expect(p2).not.toContain("US$")
  })
  it("solo las palabras fijas en los botones de decisión; sin elegir, Aprobar está apagado", () => {
    const h = dibujar()
    expect(h).toContain(`>${NOMBRE_DEL_VERBO.aprobar}<`); expect(h).toContain(`>${NOMBRE_DEL_VERBO.pedir_cambios}<`)
    expect(h).toMatch(/data-verbo="aprobar"[^>]*disabled=""/); expect(h).toContain("Elige una propuesta para aprobarla.")
    expect(h).not.toMatch(/Enviar observaciones|Rechazar|Elegir y aprobar/)
  })
  it("sin rondas de cambios, «Pedir cambios» no está y se dice por qué", () => {
    const h = dibujar({}, decision({}, { quedan_vueltas: 0 }))
    expect(h).not.toContain('data-verbo="pedir_cambios"'); expect(h).toContain("Ya no quedan rondas de cambios")
    expect(h).not.toContain("quedan 0 rondas")
  })
  it("las notas de la mesa van plegadas, no como errores", () => {
    const h = dibujar()
    expect(h).toContain("Notas de la mesa (1)"); expect(h).not.toContain("No salió")
  })
  it("una sola propuesta ya viene marcada", () => {
    const d = decision({}, { lista: [fila().propuestas.lista[1]] })
    const h = dibujar({}, d)
    expect(h).toContain("data-marca-elegida"); expect(h).not.toMatch(/data-verbo="aprobar"[^>]*disabled=""/)
  })
})

describe("5 · elegir y contestar (con un doble de la plataforma)", () => {
  it("elegir la propuesta 2 y aprobar manda `propuesta_id: P2` de la ronda que se ve, y dice qué pasa ahora", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => respuesta(200, { ok: true, accion: "propuestas-aprobar" }))
    const cerrar = vi.fn()
    const v = render(createElement(PanelPropuestas, { decision: decision(), onCerrar: cerrar, fetchImpl: f as never }))
    fireEvent.click(v.container.querySelector('[data-elegir="P2"]')!)
    expect(v.container.querySelector('[data-propuesta="P2"][data-elegida]')).not.toBeNull()
    expect(v.container.querySelector("[data-que-pasa]")!.textContent).toContain("«Un día en la clínica»")
    fireEvent.click(v.container.querySelector('[data-verbo="aprobar"]')!)
    await waitFor(() => expect(v.container.querySelector('[data-contestada="aprobada"]')).not.toBeNull())
    expect(f.mock.calls[0][0]).toBe("/api/acciones/propuestas-aprobar")
    expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ encargo_id: ENCARGO, ronda: 1, propuesta_id: "P2" })
    expect(v.container.textContent).toContain("Aprobaste «Un día en la clínica»")
    fireEvent.click(v.container.querySelector("[data-volver]")!); expect(cerrar).toHaveBeenCalled()
  })
  it("pedir cambios: primero abre la caja (Aprobar se esconde); sin texto no sale; con texto manda las observaciones", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => respuesta(200, { ok: true }))
    const v = render(createElement(PanelPropuestas, { decision: decision({}, { ronda: 2 }), onCerrar: () => undefined, fetchImpl: f as never }))
    fireEvent.click(v.container.querySelector('[data-verbo="pedir_cambios"]')!)
    expect(v.container.querySelector("[data-observaciones]")).not.toBeNull(); expect(v.container.querySelector('[data-verbo="aprobar"]')).toBeNull()
    expect((v.container.querySelector('[data-verbo="pedir_cambios"]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(v.container.querySelector("[data-observaciones]")!, { target: { value: "  Que el cierre muestre la agenda.  " } })
    fireEvent.click(v.container.querySelector('[data-verbo="pedir_cambios"]')!)
    await waitFor(() => expect(v.container.querySelector('[data-contestada="observaciones"]')).not.toBeNull())
    expect(f.mock.calls[0][0]).toBe("/api/acciones/propuestas-cambios")
    expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ encargo_id: ENCARGO, ronda: 2, observaciones: "Que el cierre muestre la agenda." })
  })
  it("«Volver» cierra la caja sin mandar nada", () => {
    const f = vi.fn()
    const v = render(createElement(PanelPropuestas, { decision: decision(), onCerrar: () => undefined, fetchImpl: f as never }))
    fireEvent.click(v.container.querySelector('[data-verbo="pedir_cambios"]')!)
    fireEvent.click(v.container.querySelector("[data-volver]")!)
    expect(v.container.querySelector("[data-observaciones]")).toBeNull(); expect(f).not.toHaveBeenCalled()
  })
  it("si la ronda ya pasó: «No salió» con el motivo en palabras y «Volver a Decisiones» (que vuelve a leer)", async () => {
    const f = vi.fn(() => respuesta(409, { ok: false, error: "conflicto", plataforma: { error: "ronda_vieja" } }))
    const cerrar = vi.fn()
    const v = render(createElement(PanelPropuestas, { decision: decision(), onCerrar: cerrar, fetchImpl: f as never, elegidaInicial: "P1" }))
    fireEvent.click(v.container.querySelector('[data-verbo="aprobar"]')!)
    await waitFor(() => expect(v.container.querySelector("[data-no-salio]")).not.toBeNull())
    expect(v.container.textContent).toContain("Estas propuestas ya cambiaron")
    fireEvent.click(v.container.querySelector("[data-volver-a-decisiones]")!); expect(cerrar).toHaveBeenCalled()
  })
  it("mientras sale, los botones se apagan y dicen «Aprobando…»", async () => {
    let soltar: (r: Response) => void = () => undefined
    const f = vi.fn(() => new Promise<Response>((ok) => { soltar = ok }))
    const v = render(createElement(PanelPropuestas, { decision: decision(), onCerrar: () => undefined, fetchImpl: f as never, elegidaInicial: "P1" }))
    fireEvent.click(v.container.querySelector('[data-verbo="aprobar"]')!)
    await waitFor(() => expect(v.container.querySelector('[data-verbo="aprobar"]')!.textContent).toBe("Aprobando…"))
    expect((v.container.querySelector('[data-elegir="P2"]') as HTMLButtonElement).disabled).toBe(true)
    soltar(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await waitFor(() => expect(v.container.querySelector('[data-contestada="aprobada"]')).not.toBeNull())
  })
})

describe("6 · desde Decisiones: la tarjeta abre Propuestas en el mismo lugar y, al volver, se vuelve a leer", () => {
  it("«Ver las Propuestas» abre la pantalla encima; «Volver» tras aprobar vuelve a Decisiones y relee la lista", async () => {
    const { PanelDecisiones } = await import("@/components/nuevo/PanelDecisiones")
    const datos = normalizarDecisiones({ decisiones: [fila()], fuentes: [], sin_fuente: [], completo: true })
    const f = vi.fn((u: string, _i?: RequestInit) => u.startsWith("/api/acciones/")
      ? respuesta(200, { ok: true })
      : respuesta(200, { ok: true, ...normalizarDecisiones({ decisiones: [], fuentes: [], sin_fuente: [], completo: true }) }))
    const v = render(createElement(PanelDecisiones, { onCerrar: () => undefined, datosIniciales: datos, fetchImpl: f as never }))
    fireEvent.click(v.container.querySelector('[data-ir="propuestas"]')!)
    expect(v.container.querySelector('[data-seccion="propuestas"]')).not.toBeNull()
    expect(v.container.querySelectorAll("[data-propuesta]")).toHaveLength(3)
    fireEvent.click(v.container.querySelector('[data-elegir="P3"]')!)
    fireEvent.click(v.container.querySelector('[data-verbo="aprobar"]')!)
    await waitFor(() => expect(v.container.querySelector('[data-contestada="aprobada"]')).not.toBeNull())
    fireEvent.click(v.container.querySelector("[data-volver]")!)
    await waitFor(() => expect(f.mock.calls.some(([u]) => u === "/api/direccion/decisiones")).toBe(true))
    expect(v.container.querySelector('[data-seccion="propuestas"]')).toBeNull()
  })
})
