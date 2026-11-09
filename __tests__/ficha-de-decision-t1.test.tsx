/** 09-nov · T1 de la ficha única de decisión (GO Lenovo, boceto v7 aprobado por Emilio 21:18Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { FichaDeDecision } from "@/components/nuevo/FichaDeDecision"
import { PanelDecisiones } from "@/components/nuevo/PanelDecisiones"
import { NOMBRE_DEL_VERBO, conNombresPropios, esPregunta, fichaDeLaPregunta, revisarFicha, type FichaDeDecision as Ficha } from "@/lib/ficha-de-decision"
import { normalizarDecisiones, type Decision } from "@/lib/direccion-decisiones"

// la fila real 5405751f de dueno_preguntas (Náufrago, 05-nov), la misma del boceto aprobado
const REAL = {
  id: "5405751f-0000-4000-8000-000000000001", tipo: "pregunta_al_dueno", subtipo: null, fuente: "dueno_preguntas", client_id: "c-naufrago", cliente: "Náufrago",
  titulo: "¿Tienes ya una fecha aproximada de cuándo vas a arrancar las entregas en Guayaquil?", desde: "2026-11-05T15:00:00Z", vence: null, vencida: false, prioridad: null,
  decidir: { ruta: null, accion: null }, costo_usd: null, costo_nota: null, permite: ["responder", "descartar"],
  pregunta_de: { oficina: "financiera", agente: "jefe-financiero" },
  para_que: "No tiene que ser exacta: con saber si es en las próximas 4 semanas, en 2 meses o todavía sin fecha definida, ya puedo ajustar qué parte del presupuesto de anuncios se destina a esa ciudad y cuándo.",
  para_que_corto: "Repartir anuncios",
}
const datos = (filas: unknown[]) => normalizarDecisiones({ ok: true, decisiones: filas, fuentes: [], completo: true })
const pintar = (filas: unknown[]) => renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: datos(filas) })).replace(/<!-- -->/g, "")
const dibujar = (f: Ficha) => renderToStaticMarkup(createElement(FichaDeDecision, { ficha: f, enviando: null, alVerbo: () => {}, alIr: () => {} })).replace(/<!-- -->/g, "")
const decision = (extra: Record<string, unknown> = {}): Decision => datos([{ ...REAL, ...extra }]).decisiones[0]
const traducir = (d: Decision, x: Partial<Parameters<typeof fichaDeLaPregunta>[1]> = {}) => fichaDeLaPregunta(d, { departamento: "Financiero", detiene: false, destraba: null, conAsumir: false, responder: true, descartar: true, ...x })
const ORDEN = ["quien", "que", "propuesta", "decisivo", "uso", "espera"]
const bloques = (h: string) => [...h.matchAll(/data-bloque="([a-z]+)"/g)].map((m) => m[1])

describe("1 · igualdad con la decisión de origen, CAMPO POR CAMPO (cuidado 2 de CC6: el guion rojo no puede tapar un dato que existe)", () => {
  const d = decision({ supuesto: "En 2 meses", criticos: ["Sin la fecha, el presupuesto de Guayaquil queda parado. Se reparte en cuanto contestes."], vence: "2026-11-16T00:00:00Z", destraba: "El reparto de anuncios por ciudad.", destraba_corto: "Reparto por ciudad" })
  const f = traducir(d, { detiene: true, destraba: d.destraba!, conAsumir: true })
  it("cada dato de la fila llega a la ficha tal cual", () => {
    expect(f.id).toBe(d.id); expect(f.que_se_decide).toBe(d.titulo)
    expect(f.cuenta).toEqual({ client_id: d.client_id, nombre: d.cliente })
    expect(f.uso).toEqual({ largo: d.para_que, corto: d.para_que_corto })
    expect(f.desbloquea).toEqual({ largo: d.destraba, corto: d.destraba_corto })
    expect(f.propuesta).toEqual({ supuesto: d.supuesto })
    expect(f.decisivo?.map((x) => x.largo)).toEqual(d.criticos)
    expect(f.espera).toEqual({ desde: d.desde, vence: d.vence })
    expect(f.detiene).toEqual({ que: "el plan" })
    expect(f.origen).toEqual({ fuente: d.fuente, ref: d.id })
    expect(f.acciones.map((a) => [a.verbo, a.destino])).toEqual([["descartar", "dueno-preguntas"], ["asumir", "dueno-preguntas"], ["responder", "dueno-preguntas"]])
  })
  it("y la pantalla muestra cada texto de la oficina carácter por carácter (sin guion rojo donde hay dato)", () => {
    const h = dibujar(f).replace(/<\/?span[^>]*>/g, "")
    for (const t of [d.titulo, d.para_que_corto!, d.destraba_corto!, d.supuesto!, decisivoFrase(d.criticos![0]), "Náufrago", "Financiero"]) expect(h, t).toContain(t)
    expect(dibujar(f)).not.toContain("data-sin-dato")
  })
  it("sin la fila, sin los datos: la misma pregunta sin supuesto ni plazo muestra el guion rojo justo ahí", () => {
    const h = dibujar(traducir(decision()))
    expect(h).toMatch(/data-bloque="propuesta".*?data-sin-dato/); expect(h).toMatch(/data-vence="true"><span data-sin-dato/)
  })
  it("toda pregunta nombra la misma puerta que la plataforma (CC1 #959: dueno-preguntas); la pausa financiera la sigue resolviendo el servidor del tablero", () => {
    for (const tipo of ["pregunta_al_dueno", "pregunta_de_finanzas"]) expect(traducir(decision({ tipo }), { conAsumir: true }).acciones.map((a) => a.destino)).toEqual(["dueno-preguntas", "dueno-preguntas", "dueno-preguntas"])
  })
})
const decisivoFrase = (t: string) => t.split(". ")[0]

describe("2 · los mismos bloques, en el mismo orden, siempre; lo que no tiene dato, guion rojo", () => {
  const vacia: Ficha = { version: 1, id: "x", cuenta: null, departamento: { oficina: "", nombre: "" }, que_se_decide: "Algo", espera: { desde: null }, origen: { fuente: "f", ref: "x" }, acciones: [] }
  it("una ficha sin nada dibuja los 6 bloques en orden, cada uno con su guion rojo", () => {
    const h = dibujar(vacia)
    expect(bloques(h)).toEqual(ORDEN)
    expect(h.match(/data-sin-dato/g)).toHaveLength(8) // cuenta · departamento · propuesta · decisivo · uso · desbloquea · espera · vence
  })
  it("la pregunta real dibuja los mismos 6 bloques en el mismo orden", () => { expect(bloques(pintar([REAL]))).toEqual(ORDEN) })
  it("sin acciones, la ficha dice que solo avisa", () => { expect(dibujar(vacia)).toContain("Esta ficha solo avisa: no hay nada que decidir aquí.") })
  it("«Sin fecha límite» solo si la oficina lo declara (sin_limite); vence en null no lo inventa", () => {
    expect(dibujar({ ...vacia, espera: { desde: null, vence: null } })).toMatch(/data-vence="true"><span data-sin-dato/)
    expect(dibujar({ ...vacia, espera: { desde: null, sin_limite: true } })).toContain('<span data-vence="true">Sin fecha límite</span>')
  })
  it("«Detiene el plan»: rótulo de 13 en alarma con su punto; sin el dato no hay rótulo", () => {
    const h = dibujar({ ...vacia, detiene: { que: "el plan" } })
    expect(h).toMatch(/<p data-estado="true" class="[^"]*text-dato[^"]*text-alarma[^"]*"><span data-detiene="true"[^>]*><span aria-hidden="true" class="[^"]*bg-alarma[^"]*"><\/span>Detiene el plan/)
    expect(dibujar(vacia)).not.toContain("data-estado")
  })
  it("sin línea «Origen» a la vista", () => { expect(dibujar(vacia)).not.toMatch(/Origen/) })
})

describe("3 · los botones: solo el vocabulario fijo, en su orden, una sola principal (ámbar) a la derecha", () => {
  const base: Ficha = { version: 1, id: "x", cuenta: null, departamento: { oficina: "", nombre: "Financiero" }, que_se_decide: "Algo", espera: { desde: null }, origen: { fuente: "f", ref: "x" }, acciones: [] }
  const A = (verbo: string, extra = {}) => ({ verbo, destino: "dueno-preguntas", ...extra }) as Ficha["acciones"][number]
  it("orden fijo aunque la oficina los mande desordenados", () => {
    const h = dibujar({ ...base, acciones: [A("responder", { principal: true }), A("asumir"), A("descartar")] })
    expect([...h.matchAll(/data-verbo="([a-z_]+)"[^>]*>([^<]+)</g)].map((m) => m[2])).toEqual(["Descartar", "Asumir", "Responder"])
    expect(h.match(/bg-ambar/g)).toHaveLength(1); expect(h).toMatch(/data-verbo="responder"[^>]*class="[^"]*bg-ambar/)
  })
  it("la principal va SIEMPRE a la derecha, aunque su verbo vaya antes en el orden fijo", () => {
    const r = revisarFicha({ ...base, acciones: [A("asumir", { principal: true }), A("responder")] })
    expect(r.ok && r.acciones.map((a) => a.verbo)).toEqual(["responder", "asumir"])
  })
  it("cada botón dice una palabra del vocabulario, nada más", () => {
    const h = dibujar({ ...base, acciones: [A("descartar"), A("aprobar", { principal: true })] })
    for (const m of h.matchAll(/data-verbo="[a-z_]+"[^>]*>([^<]+)</g)) expect(Object.values(NOMBRE_DEL_VERBO)).toContain(m[1])
  })
  it("mal armada: más de 3, dos principales o un verbo inventado se rechaza ENTERA (no se recorta)", () => {
    expect(revisarFicha({ ...base, acciones: [A("descartar"), A("asumir"), A("pedir_cambios"), A("aprobar")] }).ok).toBe(false)
    expect(revisarFicha({ ...base, acciones: [A("responder", { principal: true }), A("aprobar", { principal: true })] }).ok).toBe(false)
    const mala = { ...base, acciones: [A("firmar")] }
    expect(revisarFicha(mala).ok).toBe(false); expect(dibujar(mala)).toContain("Esta decisión llegó mal armada"); expect(dibujar(mala)).not.toContain("data-verbo")
  })
  it("una puerta fuera de la lista cerrada, o sin puerta hoy en el tablero, no da botón (nunca uno falso)", () => {
    const r = revisarFicha({ ...base, acciones: [{ verbo: "descartar", destino: "https://otro.lado" }, A("pedir_cambios"), A("responder", { principal: true })] })
    expect(r.ok && r.acciones.map((a) => a.verbo)).toEqual(["responder"]); expect(r.ok && r.omitidas.map((a) => a.verbo)).toEqual(["descartar", "pedir_cambios"])
  })
})

describe("4 · nombres propios del sistema (regla del estilo base de Emilio)", () => {
  it("dentro del texto: con su mayúscula y la línea dorada, aunque la oficina lo escriba en minúsculas", () => {
    expect(conNombresPropios("la campaña de marketing está detenida")).toEqual([{ texto: "la ", propio: false }, { texto: "Campaña de Marketing", propio: true }, { texto: " está detenida", propio: false }])
    const h = dibujar({ version: 1, id: "x", cuenta: null, departamento: { oficina: "", nombre: "oficina financiera" }, que_se_decide: "tablero financiero: espera tu firma", espera: { desde: null }, origen: { fuente: "f", ref: "x" }, acciones: [] })
    expect(h).toContain('<span data-nombre-propio="true" class="underline decoration-linea-oro decoration-1 underline-offset-4">Tablero Financiero</span>')
    expect(h).toContain('<span data-departamento="true">Oficina Financiera</span>') // en la fila de cuenta y departamento: con mayúscula, SIN línea
  })
  it("el enlace del pie usa el nombre de la lista cerrada, no el de la oficina", () => {
    const h = dibujar({ version: 1, id: "x", cuenta: null, departamento: { oficina: "", nombre: "x" }, que_se_decide: "x", espera: { desde: null }, origen: { fuente: "f", ref: "x" }, acciones: [], donde_se_hace: { pantalla: "plan" } })
    expect(h).toMatch(/data-ir="plan"[^>]*>Ir al <span data-nombre-propio="true"[^>]*>Plan de Marketing<\/span> →</)
  })
})

describe("5 · el dibujante no elige nada por tipo (lo que hará posible el T2)", () => {
  it("la ficha no lleva tipo ni clase, y el dibujante no lee tipo, fuente ni origen", () => {
    const fuente = readFileSync("components/nuevo/FichaDeDecision.tsx", "utf8")
    expect(fuente).not.toMatch(/\.(tipo|fuente|subtipo|clase)\b|\borigen\b(?!\s*:)/)
    expect(Object.keys(traducir(decision()))).not.toEqual(expect.arrayContaining(["tipo"]))
  })
  it("T1: solo las preguntas van por la ficha; una firma sigue en la tarjeta de siempre", () => {
    expect(esPregunta(decision())).toBe(true)
    expect(esPregunta(decision({ tipo: "firma_de_finanzas", cifras: [{ clave: "a", nombre: "A", valor: 1, unidad: null, nota: null }] }))).toBe(false)
    expect(pintar([REAL])).toContain("data-ficha=")
  })
})
