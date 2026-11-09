/** 09-nov · DECISIONES EN ESCRITORIO IGUAL A LA IMAGEN APROBADA (firma de Emilio 15:20Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { PanelDecisiones } from "@/components/nuevo/PanelDecisiones"
import { cifrasDelFrente, cortarSinInventar, decisivoCorto, frasesDe, primeraFrase, normalizarDecisiones, type CifraDeFirma, type Decisiones } from "@/lib/direccion-decisiones"

// la firma de Finanzas de hoy (Zero Risk SI), con sus textos tal como los manda la oficina
const INSTAGRAM = "Instagram @zeroriskgye lleva 6 años inactivo (últimos posts: junio 2020) y el Business Manager de Meta no está confirmado como activo. El 60% del presupuesto mensual ($804.78) va a Meta/IG. Si el BM está deshabilitado o la cuenta suspendida, ese presupuesto no puede ejecutarse en absoluto y el modelo colapsa en su canal principal."
const PRECIOS = "Precios reales sin dato: D4 y D6 son nulos. Ticket ($280) y margen (38%) son supuestos de mercado."
const USO = "La oficina financiera dejó 2 hallazgos críticos abiertos: tu firma da por buenas sus cifras."
const DESBLOQUEA = "El plan no espera esta firma: queda constancia de que diste por buenas estas cifras."
const META: CifraDeFirma = { clave: "meta_ventas_semana", nombre: "Meta de ventas por semana", valor: 5, unidad: "ventas", nota: "Dato", editable: true }
const TOTAL: CifraDeFirma = { clave: "presupuesto_total_mes", nombre: "Presupuesto total al mes", valor: 1341.27, unidad: "US$", nota: "Supuesto", editable: true }
const PAUTA: CifraDeFirma = { clave: "pauta_dia", nombre: "Pauta por día", valor: 26, unidad: "US$", nota: "Supuesto" }
const CPV: CifraDeFirma = { clave: "cpv_pauta", nombre: "Costo por venta, solo con la pauta", valor: 26, unidad: "US$", nota: "Supuesto" }
const CPV_PLAN: CifraDeFirma = { clave: "cpv_plan", nombre: "Costo por venta, con todo el plan", valor: 61.9, unidad: "US$", nota: "Calculado" }
const firma = (extra: Record<string, unknown> = {}): Decisiones => normalizarDecisiones({ ok: true, completo: false, fuentes: [{ fuente: "Gastos", estado: "error" }], sin_fuente: [{ que: "gastos por aprobar", motivo: "x" }], decisiones: [{
  id: "33333333-3333-4333-8333-333333333333", tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: "c", cliente: "Zero Risk Seguridad Industrial",
  titulo: "Tablero financiero: espera tu firma", desde: "2026-10-23T10:00:00Z", decidir: { ruta: null, accion: "firmar-tablero" }, permite: ["aceptar", "editar"],
  cifras: [META, TOTAL, PAUTA, CPV, CPV_PLAN], criticos: [INSTAGRAM, PRECIOS], para_que: USO, destraba: DESBLOQUEA, ...extra,
}] })
const pinta = (d: Decisiones, detalleInicial = false) => renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: d, detalleInicial })).replace(/<!-- -->/g, "")

describe("1 · solo 2 recuadros de propuesta: las dos cifras que decide el dueño", () => {
  it("son las que deja cambiar (meta y monto al mes); las demás van al detalle, en su orden", () => {
    expect(cifrasDelFrente([PAUTA, META, CPV, TOTAL, CPV_PLAN])).toEqual({ frente: [META, TOTAL], detalle: [PAUTA, CPV, CPV_PLAN] })
    expect(cifrasDelFrente([PAUTA, CPV, CPV_PLAN])).toEqual({ frente: [PAUTA, CPV], detalle: [CPV_PLAN] }) // sin editables: las dos primeras
    expect(cifrasDelFrente([META])).toEqual({ frente: [META], detalle: [] })
  })
  it("el frente pinta 2 recuadros; el detalle abierto, las otras 3; ninguna cifra se pierde", () => {
    const h = pinta(firma())
    expect(h.match(/data-cifra="/g)).toHaveLength(2); expect(h).toContain('data-cifra="meta_ventas_semana"'); expect(h).toContain('data-cifra="presupuesto_total_mes"')
    expect(h).not.toContain("data-cifra-del-detalle"); expect(h).not.toContain("data-detalle")
    const a = pinta(firma(), true)
    expect([...a.matchAll(/data-cifra-del-detalle="([^"]+)"/g)].map((m) => m[1])).toEqual(["pauta_dia", "cpv_pauta", "cpv_plan"])
  })
})

describe("2 · «Decisivo»: una frase y su porqué en dos líneas; el texto largo se abre al tocar el bloque", () => {
  it("corta sin inventar: en borde de palabra, con «…», y nunca deja un paréntesis abierto", () => {
    expect(cortarSinInventar("corto", 70)).toBe("corto")
    expect(cortarSinInventar("uno dos tres cuatro", 9)).toBe("uno dos…")
    expect(cortarSinInventar("lleva 6 años inactivo (últimos posts: junio 2020) y más", 40)).toBe("lleva 6 años inactivo…")
  })
  it("las frases no se parten dentro de un paréntesis ni en un decimal", () => {
    expect(frasesDe(INSTAGRAM)).toHaveLength(3)
    expect(frasesDe(INSTAGRAM)[1]).toBe("El 60% del presupuesto mensual ($804.78) va a Meta/IG.")
    expect(frasesDe("Falta la cuenta (ver nota. Sin ella no hay pauta) y el pixel. Después, todo.")).toEqual(["Falta la cuenta (ver nota. Sin ella no hay pauta) y el pixel.", "Después, todo."])
    expect(frasesDe("Cuesta 3 dólares p. ej. por día. Luego sube.")).toEqual(["Cuesta 3 dólares p. ej. por día.", "Luego sube."]) // tras el punto, minúscula: no es otra frase
  })
  it("el caso de hoy: la primera frase corta y la segunda como porqué; con «:» manda el «:»", () => {
    expect(decisivoCorto(INSTAGRAM)).toEqual({ frase: "Instagram @zeroriskgye lleva 6 años inactivo…", porque: "El 60% del presupuesto mensual ($804.78) va a Meta/IG.", cortado: true })
    expect(decisivoCorto(PRECIOS)).toEqual({ frase: "Precios reales sin dato", porque: "D4 y D6 son nulos.", cortado: true })
    expect(decisivoCorto("Faltan datos: sin ellos no se firma.")).toEqual({ frase: "Faltan datos", porque: "Sin ellos no se firma.", cortado: false })
    expect(decisivoCorto("Dos hallazgos sin cerrar")).toEqual({ frase: "Dos hallazgos sin cerrar", porque: null, cortado: false })
  })
  it("el frente lleva esas dos líneas; el bloque es el que abre (sin botón nuevo) y el detalle trae TODO el texto de la oficina", () => {
    const h = pinta(firma())
    expect(h).toMatch(/<button type="button" data-criticos="true" aria-expanded="false"[^>]*>.*?<span data-frase="true"[^>]*>Instagram @zeroriskgye lleva 6 años inactivo…<\/span><span data-porque="true"[^>]*>El 60% del presupuesto mensual \(\$804\.78\) va a Meta\/IG\.<\/span>/)
    expect(h).not.toContain("canal principal"); expect(h).not.toContain(PRECIOS)
    const a = pinta(firma(), true)
    expect(a).toContain('data-criticos="true" aria-expanded="true"')
    expect([...a.matchAll(/<li data-critico-entero="true">([^<]+)<\/li>/g)].map((m) => m[1].replace(/&#x27;/g, "'"))).toEqual([INSTAGRAM, PRECIOS])
    const t = readFileSync("components/nuevo/PanelDecisiones.tsx", "utf8")
    expect(t.match(/onClick=\{\(\) => setVerDetalle\(\(v\) => !v\)\}/g)).toHaveLength(2) // el bloque Decisivo y el de Uso/Desbloquea; ningún botón más
  })
})

describe("3 · «Uso» y «Desbloquea»: la primera frase ENTERA, nunca palabras cortadas (Lenovo 09-nov)", () => {
  it("la primera frase, sin cortar ni agregar «…»", () => {
    expect(primeraFrase(USO)).toBe(USO); expect(primeraFrase(DESBLOQUEA)).toBe(DESBLOQUEA)
    expect(primeraFrase("  Campañas ")).toBe("Campañas")
    expect(primeraFrase("Reparte la pauta. Después mide el costo por venta.")).toBe("Reparte la pauta.")
    expect(primeraFrase("Importa (ver D4. Precios) para el plan. Lo demás después.")).toBe("Importa (ver D4. Precios) para el plan.")
    expect(primeraFrase("")).toBe(""); expect(primeraFrase("   ")).toBe("")
  })
  it("una sola frase: entera al frente y no se repite en el detalle", () => {
    const h = pinta(firma())
    expect(h).toContain(`<span data-uso="true">${USO}</span>`); expect(h).toContain(`<span data-destraba="true">${DESBLOQUEA}</span>`)
    expect(h).not.toContain("…</span></dd>")
    const a = pinta(firma(), true)
    expect(a).not.toContain("data-uso-entero"); expect(a).not.toContain("data-destraba-entero"); expect(a.split(USO)).toHaveLength(2)
  })
  it("varias frases: la primera al frente y el texto entero en el detalle", () => {
    const LARGO = "Reparte la pauta. Después mide el costo por venta."
    const h = pinta(firma({ para_que: LARGO, destraba: LARGO }))
    expect(h).toContain('<span data-uso="true">Reparte la pauta.</span>'); expect(h).toContain('<span data-destraba="true">Reparte la pauta.</span>'); expect(h).not.toContain("Después mide")
    const a = pinta(firma({ para_que: LARGO, destraba: LARGO }), true)
    expect(a).toContain(`<p data-uso-entero="true" class="mt-1.5 text-dato text-hueso">${LARGO}</p>`); expect(a).toContain(`<p data-destraba-entero="true" class="mt-1.5 text-dato text-hueso">${LARGO}</p>`)
  })
})

describe("4 · fuera «Baja para leer todo y firmar» y el pie «Sin dato»; quedan «1 de N» y las flechas", () => {
  it("aunque la lectura venga incompleta y haya «sin dato»", () => {
    const h = pinta(firma())
    expect(h).not.toContain("Baja para leer"); expect(h).not.toContain("data-baja-para-firmar")
    expect(h).not.toContain("data-sin-dato"); expect(h).not.toContain("gastos por aprobar"); expect(h).not.toContain("no se pudo leer")
    expect(h).toContain("1 de 1"); expect(h).toContain("data-firmar")
  })
})

describe("CC6 #290 · ninguna información se pierde aunque la firma no traiga textos", () => {
  it("sin «Decisivo», «Uso» ni «Desbloquea», las demás cifras se ven sin tocar nada", () => {
    const h = pinta(firma({ criticos: [], para_que: null, destraba: null }))
    expect(h).not.toContain("data-criticos"); expect(h).not.toContain("data-contexto")
    expect(h).toContain("data-detalle"); expect(h).toContain("Las demás cifras")
    expect([...h.matchAll(/data-cifra-del-detalle="([^"]+)"/g)].map((m) => m[1])).toEqual(["pauta_dia", "cpv_pauta", "cpv_plan"])
  })
  it("con algún texto, el detalle sigue cerrado hasta tocarlo; sin cifras de más, no hay detalle vacío", () => {
    expect(pinta(firma({ criticos: [], destraba: null }))).not.toContain("data-detalle") // solo «Uso»
    expect(pinta(firma({ para_que: null, destraba: null }))).not.toContain("data-detalle") // solo «Decisivo»
    expect(pinta(firma({ criticos: [], para_que: null }))).not.toContain("data-detalle") // solo «Desbloquea»
    expect(pinta(firma({ criticos: [], para_que: null, destraba: null, cifras: [META, TOTAL] }))).not.toContain("data-detalle")
  })
  it("una tercera cifra que se puede cambiar sigue cambiándose en el detalle", () => {
    const TERCERA: CifraDeFirma = { ...PAUTA, editable: true }
    const h = pinta(firma({ cifras: [META, TOTAL, TERCERA, CPV] }), true)
    expect(h).toMatch(/data-cifra-del-detalle="pauta_dia"><button type="button" data-cambiar="pauta_dia"/)
    expect(h).not.toMatch(/data-cifra-del-detalle="cpv_pauta"><button/)
  })
})

describe("CC6 #290 (e145a7c) · el detalle nunca se abre vacío", () => {
  const SOLA = "El plan de 90 días de Náufrago sigue en cuanto contestes sus preguntas."
  it("una sola frase en «Uso» y «Desbloquea», sin «Decisivo» ni cifras de más: los pares son texto, no un botón, y no hay detalle", () => {
    for (const det of [false, true]) {
      const h = pinta(firma({ criticos: [], cifras: [META, TOTAL], para_que: SOLA, destraba: SOLA }), det)
      expect(h).toContain(`<span data-uso="true">${SOLA}</span>`); expect(h).toContain("data-contexto-solo")
      expect(h).not.toContain("data-contexto="); expect(h).not.toContain("data-detalle"); expect(h).not.toContain("Leer el detalle completo")
    }
  })
  it("basta una cosa de más (Decisivo, una frase de más o una cifra) para que sea botón y el detalle la muestre", () => {
    const casos = [
      firma({ cifras: [META, TOTAL], para_que: SOLA, destraba: SOLA }),
      firma({ criticos: [], cifras: [META, TOTAL], para_que: SOLA + " Y algo más.", destraba: SOLA }),
      firma({ criticos: [], cifras: [META, TOTAL], para_que: SOLA, destraba: SOLA + " Y algo más." }),
      firma({ criticos: [], para_que: SOLA, destraba: SOLA }),
    ]
    for (const f of casos) {
      expect(pinta(f)).toContain('data-contexto="true"')
      expect(pinta(f, true)).toMatch(/data-detalle="true"[^>]*><div>/)
    }
  })
  it("una sola frase con un espacio al final no se repite en el detalle", () => {
    const a = pinta(firma({ para_que: "Una frase. ", destraba: "Otra frase.  " }), true)
    expect(a).toContain('<span data-uso="true">Una frase.</span>'); expect(a).not.toContain("data-uso-entero"); expect(a).not.toContain("data-destraba-entero")
  })
})

describe("CC6 #290 · la tarjeta sola, con texto sin normalizar, tampoco repite la frase", () => {
  it("«Una frase. » con espacio al final: al frente entera, sin repetirse en el detalle", async () => {
    const { TarjetaDelFrente } = await import("@/components/nuevo/PanelDecisiones")
    const d = { ...firma().decisiones[0], para_que: "Una frase. ", destraba: "Otra frase.  " }
    const h = renderToStaticMarkup(createElement(TarjetaDelFrente, { d, alDecidir: () => {}, enPausa: null, detiene: false, contestar: async () => ({ sale: true }) as never, verCambio: async () => null as never, previa: null, detalleInicial: true })).replace(/<!-- -->/g, "")
    expect(h).toContain('<span data-uso="true">Una frase.</span>'); expect(h).toContain('<span data-destraba="true">Otra frase.</span>')
    expect(h).not.toContain("data-uso-entero"); expect(h).not.toContain("data-destraba-entero")
  })
})
