/** 09-nov · DECISIONES EN ESCRITORIO IGUAL A LA IMAGEN APROBADA (firma de Emilio 15:20Z). US$ 0 · sin red.
 *  10-nov · T2 de la ficha única (SEÑAL Lenovo 01:10Z · boceto v7): la firma ya se dibuja con la ficha. Lo que cambia frente a la tarjeta vieja:
 *  sin corto de la oficina, «Uso» y «Desbloquea» se ven ENTEROS (contrato v7: nunca se recortan); las cifras de más y el texto entero salen al tocar
 *  «Decisivo» o «Uso» (los mismos bloques, sin botón nuevo). */
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
/** el texto que se lee (sin etiquetas): la ficha parte los nombres propios en trozos */
const texto = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
const dentro = (h: string, marca: string) => { const i = h.indexOf(marca); if (i < 0) return ""; const j = h.indexOf("</span></dd>", i); return texto(h.slice(h.indexOf(">", i) + 1, j < 0 ? undefined : j)) }

describe("1 · solo 2 recuadros de propuesta: las dos cifras que decide el dueño", () => {
  it("son las que deja cambiar (meta y monto al mes); las demás van al detalle, en su orden", () => {
    expect(cifrasDelFrente([PAUTA, META, CPV, TOTAL, CPV_PLAN])).toEqual({ frente: [META, TOTAL], detalle: [PAUTA, CPV, CPV_PLAN] })
    expect(cifrasDelFrente([PAUTA, CPV, CPV_PLAN])).toEqual({ frente: [PAUTA, CPV], detalle: [CPV_PLAN] }) // sin editables: las dos primeras
    expect(cifrasDelFrente([META])).toEqual({ frente: [META], detalle: [] })
  })
  it("el frente pinta 2 recuadros; abierto, las otras 3 en la misma Propuesta; ninguna cifra se pierde", () => {
    const h = pinta(firma())
    expect(h.match(/data-cifra="/g)).toHaveLength(2); expect(h).toContain('data-cifra="meta_ventas_semana"'); expect(h).toContain('data-cifra="presupuesto_total_mes"')
    expect(h).not.toContain("data-cifra-del-detalle")
    const a = pinta(firma(), true)
    expect([...a.matchAll(/data-cifra-del-detalle="([^"]+)"/g)].map((m) => m[1])).toEqual(["pauta_dia", "cpv_pauta", "cpv_plan"])
    expect(a.indexOf("data-demas-cifras")).toBeLessThan(a.indexOf('data-bloque="decisivo"')) // dentro de Propuesta, antes de Decisivo
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
  it("el frente lleva esas dos líneas (v7: el porqué en gris); el bloque es el que abre (sin botón nuevo) y abierto trae TODO el texto de la oficina", () => {
    const h = pinta(firma())
    expect(h).toMatch(/<button type="button" data-abre-el-largo="true" aria-expanded="false"/)
    const li = [...h.matchAll(/<li data-decisivo="true">([\s\S]*?)<\/li>/g)].map((m) => m[1])
    expect(texto(li[0])).toBe("Instagram @zeroriskgye lleva 6 años inactivo…El 60% del presupuesto mensual ($804.78) va a Meta/IG.")
    expect(li[0]).toMatch(/<span data-porque="true" class="block font-normal text-gris">/)
    expect(texto(h)).not.toContain("canal principal"); expect(texto(h)).not.toContain(PRECIOS)
    expect(h).toMatch(/data-bloque="decisivo" data-alarma="true" class="border-y border-linea-alarma/) // v7: entre dos líneas rojas
    const a = pinta(firma(), true)
    expect(a).toContain('data-abre-el-largo="true" aria-expanded="true"')
    expect([...a.matchAll(/<li data-decisivo="true">([\s\S]*?)<\/li>/g)].map((m) => texto(m[1]))).toEqual([INSTAGRAM, PRECIOS])
    const t = readFileSync("components/nuevo/FichaDeDecision.tsx", "utf8")
    expect(t.match(/onClick=\{\(\) => setAbierto\(\(x\) => !x\)\}/g)).toHaveLength(1) // un solo abridor: los bloques Decisivo y Uso/Desbloquea; ningún botón más
  })
})

describe("3 · «Uso» y «Desbloquea»: el corto de la oficina; sin corto, el texto ENTERO (contrato v7: nunca se recorta)", () => {
  it("la primera frase sigue existiendo para quien la use, sin cortar ni agregar «…»", () => {
    expect(primeraFrase(USO)).toBe(USO); expect(primeraFrase(DESBLOQUEA)).toBe(DESBLOQUEA)
    expect(primeraFrase("  Campañas ")).toBe("Campañas")
    expect(primeraFrase("Reparte la pauta. Después mide el costo por venta.")).toBe("Reparte la pauta.")
    expect(primeraFrase("Importa (ver D4. Precios) para el plan. Lo demás después.")).toBe("Importa (ver D4. Precios) para el plan.")
    expect(primeraFrase("")).toBe(""); expect(primeraFrase("   ")).toBe("")
  })
  it("una sola frase: entera, una sola vez (cerrada y abierta)", () => {
    const h = pinta(firma())
    // la ficha escribe los nombres propios con su mayúscula («Oficina Financiera»): por lo demás, el texto tal cual
    expect(dentro(h, "data-uso=").toLowerCase()).toBe(USO.toLowerCase()); expect(dentro(h, "data-desbloquea=")).toBe(DESBLOQUEA)
    const a = pinta(firma(), true)
    expect(texto(a).toLowerCase().split(USO.toLowerCase())).toHaveLength(2)
  })
  it("varias frases sin corto: el texto entero, sin «…» (nada se esconde)", () => {
    const LARGO = "Reparte la pauta. Después mide el costo por venta."
    const h = pinta(firma({ para_que: LARGO, destraba: LARGO }))
    expect(dentro(h, "data-uso=")).toBe(LARGO); expect(dentro(h, "data-desbloquea=")).toBe(LARGO)
  })
})

describe("4 · fuera «Baja para leer todo y firmar» y el pie «Sin dato»; quedan «1 de N» y las flechas", () => {
  it("aunque la lectura venga incompleta y haya «sin dato»", () => {
    const h = pinta(firma())
    expect(h).not.toContain("Baja para leer"); expect(h).not.toContain("data-baja-para-firmar")
    expect(h).not.toContain("gastos por aprobar"); expect(h).not.toContain("no se pudo leer")
    expect(h).toContain("1 de 1"); expect(h).toContain('data-verbo="aprobar"')
  })
})

describe("CC6 #290 · ninguna información se pierde aunque la firma no traiga textos", () => {
  it("sin «Decisivo», «Uso» ni «Desbloquea», los bloques igual abren las demás cifras (con su guion rojo al frente)", () => {
    const h = pinta(firma({ criticos: [], para_que: null, destraba: null }))
    expect(h).toContain('data-abre-el-largo="true"'); expect(h.match(/data-sin-dato="true"/g)?.length).toBeGreaterThanOrEqual(3)
    const a = pinta(firma({ criticos: [], para_que: null, destraba: null }), true)
    expect([...a.matchAll(/data-cifra-del-detalle="([^"]+)"/g)].map((m) => m[1])).toEqual(["pauta_dia", "cpv_pauta", "cpv_plan"])
  })
  it("sin nada de más que abrir, los bloques son texto: nunca un botón que abre lo mismo", () => {
    expect(pinta(firma({ criticos: [], destraba: null, cifras: [META, TOTAL] }))).not.toContain("data-abre-el-largo") // solo «Uso», sin corto
    expect(pinta(firma({ criticos: [], para_que: null, destraba: null, cifras: [META, TOTAL] }))).not.toContain("data-abre-el-largo")
  })
  it("una tercera cifra que se puede cambiar sigue cambiándose abierta", () => {
    const TERCERA: CifraDeFirma = { ...PAUTA, editable: true }
    const h = pinta(firma({ cifras: [META, TOTAL, TERCERA, CPV] }), true)
    expect(h).toMatch(/<button type="button" data-cifra-del-detalle="pauta_dia" data-cambiar="pauta_dia"/)
    expect(h).not.toMatch(/<button[^>]*data-cifra-del-detalle="cpv_pauta"/)
  })
})

describe("CC6 #290 (e145a7c) · nunca un abridor vacío", () => {
  const SOLA = "El Plan de Marketing de Náufrago sigue en cuanto contestes sus preguntas."
  it("«Uso» y «Desbloquea» sin corto, sin «Decisivo» ni cifras de más: texto entero, no un botón", () => {
    for (const det of [false, true]) {
      const h = pinta(firma({ criticos: [], cifras: [META, TOTAL], para_que: SOLA, destraba: SOLA }), det)
      expect(dentro(h, "data-uso=")).toBe(SOLA); expect(h).not.toContain("data-abre-el-largo"); expect(h).not.toContain("Leer el texto entero")
    }
  })
  it("basta algo que abrir (Decisivo cortado, un corto de la oficina o una cifra de más) para que el bloque sea botón", () => {
    const casos = [
      firma({ cifras: [META, TOTAL], para_que: SOLA, destraba: SOLA }),
      firma({ criticos: [], cifras: [META, TOTAL], para_que: SOLA, para_que_corto: "Seguir", destraba: SOLA }),
      firma({ criticos: [], para_que: SOLA, destraba: SOLA }),
    ]
    for (const f of casos) expect(pinta(f)).toContain('data-abre-el-largo="true"')
  })
  it("un texto con espacio al final no se repite", async () => {
    const { TarjetaDelFrente } = await import("@/components/nuevo/PanelDecisiones")
    const d = { ...firma().decisiones[0], para_que: "Una frase. ", destraba: "Otra frase.  " }
    const h = renderToStaticMarkup(createElement(TarjetaDelFrente, { d, alDecidir: () => {}, enPausa: null, detiene: false, contestar: async () => ({ sale: true }) as never, verCambio: async () => null as never, previa: null, detalleInicial: true })).replace(/<!-- -->/g, "")
    expect(texto(h).split("Una frase.")).toHaveLength(2); expect(texto(h).split("Otra frase.")).toHaveLength(2)
  })
})
