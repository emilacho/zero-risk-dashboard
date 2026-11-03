/** EL MANUAL LIMPIO PARA EL CLIENTE (CC6 · 03-nov · corrección de Lenovo tras la revisión de Emilio: «ese documento debe verse limpio y presentable a un cliente»).
 *  Textos REALES de los manuales de Náufrago y ZR SI (03-nov). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { campoLimpio, elementoLimpio, juntarLista, limpiarTexto, partirLista, sinCodigosDeSegmento, soloLaFrase } from "@/lib/manual-limpio"
import { PanelManual, elementosDelCampo } from "@/components/nuevo/PanelManual"
import { BarraDelManual } from "@/components/nuevo/manual/BarraDelManual"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import { ejecutarAccion } from "@/lib/tablero-acciones"
import type { ManualDelCliente } from "@/lib/manual-datos"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
// recortes de los textos reales
const VALORES = "Frescura — El cliente dice «encebollados frescos» y usa #mariscofresco. La frescura no es un adjetivo. (Evidencia: publicación Instagram DAjARyZxg8N · 2026-10-14; objeción S3 del ICP) · Autenticidad ecuatoriana — El cliente dice «autentico sabor». (Evidencia: publicación Instagram observada · 2026-10-14) · Accesibilidad — Encebollado Junior a $3,50 · ticket promedio $10,27. La propuesta funciona para todos."
const PERSONALIDAD = "Cálido y acogedor — el cliente dice: «los esperamos» y «ven a compartir esta experiencia gastronómica»\nCercano e informal — lenguaje llano, sin jerga culinaria"
const MENSAJES = "Pídelo por WhatsApp, sin salir de casa — activa el delivery para neutralizar la objeción de S1 · El cliente dice: «ven a compartir esta experiencia gastronómica» — activa el motivador social de S3/S5"
const ESLOGAN_OPCION = "«Frescos desde la costa» — responde directamente a la objeción central de S3/S5 sobre la frescura del marisco"
const FOTO = "LUZ — Natural costera preferida: mañana temprana (8-10 h) o media tarde"
const MISION = "Náufrago sirve mariscos frescos de la costa ecuatoriana — encebollado, ceviche y platos del mar — a residentes locales"
const LOGO = "TAMAÑO MÍNIMO — Digital: 120 px de ancho. Por debajo de esos umbrales, usar solo el isotipo (sin logotipo) [propuesta del agente — umbrales estándar para logos con isotipo + texto"

describe("la limpieza: solo el contenido del manual", () => {
  it("el eslogan con su justificación pegada queda en la frase (el ejemplo de Emilio)", () => {
    expect(soloLaFrase(ESLOGAN_OPCION)).toBe("Frescos desde la costa")
    expect(campoLimpio("eslogan", ESLOGAN_OPCION)).toBe("Frescos desde la costa")
    expect(soloLaFrase("Seguridad industrial completa para tu empresa. Sin vueltas.")).toBe("Seguridad industrial completa para tu empresa. Sin vueltas.") // sin comillas, tal cual
  })
  it("una lista se parte en sus elementos sin cortar dentro de un paréntesis, y un trozo en minúscula sigue al anterior", () => {
    expect(partirLista(VALORES)).toHaveLength(3)
    expect(partirLista(VALORES)[2]).toContain("ticket promedio $10,27")
    expect(partirLista(PERSONALIDAD)).toHaveLength(2) // separada por salto de línea
    expect(juntarLista(["a", "b"])).toBe("a\nb")
  })
  it("en valores, personalidad, mensajes y «nunca», lo que va tras la raya (evidencia o por qué) no se ve", () => {
    expect(partirLista(VALORES).map((x) => elementoLimpio("valores", x))).toEqual(["Frescura", "Autenticidad ecuatoriana", "Accesibilidad"])
    expect(partirLista(PERSONALIDAD).map((x) => elementoLimpio("personalidad", x))).toEqual(["Cálido y acogedor", "Cercano e informal"])
    expect(partirLista(MENSAJES).map((x) => elementoLimpio("mensajes_clave", x))).toEqual(["Pídelo por WhatsApp, sin salir de casa", "ven a compartir esta experiencia gastronómica"])
    expect(elementoLimpio("propuestas_de_valor", "Desayuno saludable de mar: el cliente comunica #desyunosaludable en Instagram")).toBe("Desayuno saludable de mar")
  })
  it("lo que NO se corta: un rótulo en mayúsculas con su contenido, y una raya normal dentro de un texto", () => {
    expect(elementoLimpio("direccion_de_fotografia", FOTO)).toBe(FOTO)
    expect(campoLimpio("mision", MISION)).toBe(MISION)
    expect(elementoLimpio("valores", "VERSIÓN PRINCIPAL — Logo completo sobre fondo oscuro")).toBe("VERSIÓN PRINCIPAL — Logo completo sobre fondo oscuro")
  })
  it("fuera: paréntesis de evidencia, corchetes de propuesta (también sin cerrar), «—evidencia: …—» y el prefijo PROPUESTA", () => {
    expect(limpiarTexto("Trato en plural. (Evidencia: bio y publicación de Instagram)")).toBe("Trato en plural.")
    expect(limpiarTexto("Nunca llama al marisco congelado. (Deducido de: «encebollados frescos»)")).toBe("Nunca llama al marisco congelado.")
    expect(limpiarTexto(LOGO)).toBe("TAMAÑO MÍNIMO — Digital: 120 px de ancho. Por debajo de esos umbrales, usar solo el isotipo (sin logotipo)")
    expect(limpiarTexto("Lema real del cliente [frase propia del cliente, verbatim — escrita por el dueño]")).toBe("Lema real del cliente")
    expect(limpiarTexto("Cobertura nacional con envíos a todo Ecuador —evidencia: «🚚a todo ECUADOR»—, frente a competidores")).toBe("Cobertura nacional con envíos a todo Ecuador, frente a competidores")
    expect(limpiarTexto("PROPUESTA (no es dato del cliente): Demostrar que el mar es para todos")).toBe("Demostrar que el mar es para todos")
  })
  it("CC3 · «el cliente dice» en medio del texto corrido: fuera la oración o el inciso, sin partir dentro de las comillas (Voz y Posicionamiento reales)", () => {
    expect(limpiarTexto("Voz cálida, informal y de invitación directa. El cliente dice: «ven a compartir esta experiencia gastronómica» y «los esperamos» — verbos de convocatoria. Lenguaje llano sin tecnicismos culinarios; el cliente dice: «nos especializamos en deliciosos encebollados frescos ceviches», descripción directa sin adorno. Identidad costera."))
      .toBe("Voz cálida, informal y de invitación directa. Lenguaje llano sin tecnicismos culinarios. Identidad costera.")
    expect(limpiarTexto("ceviche fresco de Olón. El cliente dice: «nos especializamos. en ceviches» y opera «a pocos metros de la playa». Las variantes dominan")).toBe("ceviche fresco de Olón. Las variantes dominan")
    expect(limpiarTexto("El mensaje clave del cliente —el cliente dice: «autentico sabor»— responde a la búsqueda")).toBe("El mensaje clave del cliente responde a la búsqueda")
  })
  it("CC3 · tras la raya: los EJEMPLOS se quedan (su primera oración); el porqué se va", () => {
    expect(elementoLimpio("nunca", "Nunca usa lenguaje formal, distante o corporativo — ni «estimado cliente», ni «nos complace comunicarle». La marca habla como el dueño."))
      .toBe("Nunca usa lenguaje formal, distante o corporativo — ni «estimado cliente», ni «nos complace comunicarle».")
    expect(elementoLimpio("nunca", "Nunca publica contenido de martes ni miércoles anunciando atención en el local — el restaurante está cerrado esos días"))
      .toBe("Nunca publica contenido de martes ni miércoles anunciando atención en el local")
  })
})

describe("08:20Z · fuera los códigos de segmento (S1…S5) y la sigla ICP, sin romper la frase (textos reales de Náufrago)", () => {
  it("cada forma real", () => {
    expect(sinCodigosDeSegmento("el canal de retención del segmento local habitual (S1); un mensaje sin respuesta")).toBe("el canal de retención del segmento local habitual; un mensaje sin respuesta")
    expect(sinCodigosDeSegmento("la preocupación explícita del segmento S4 (trabajadores locales) es")).toBe("la preocupación explícita de los trabajadores locales es")
    expect(sinCodigosDeSegmento("del cliente para S4 (trabajadores) y S1 (locales habituales)")).toBe("del cliente para trabajadores y locales habituales")
    expect(sinCodigosDeSegmento("para neutralizar la objeción de S1 «prefiero cocinar en casa»")).toBe("para neutralizar la objeción «prefiero cocinar en casa»")
    expect(sinCodigosDeSegmento("el turista extranjero (S2) que usa TripAdvisor como canal de decisión según señales ICP.")).toBe("el turista extranjero que usa TripAdvisor como canal de decisión.")
    expect(sinCodigosDeSegmento("Cada ancla cierra una objeción del ICP (frescura para S3/S5, autenticidad para S2): usarlas")).toBe("Cada ancla cierra una objeción (frescura, autenticidad): usarlas")
    expect(sinCodigosDeSegmento("grupo de amigos (S3/S5 del ICP); perfiles locales")).toBe("grupo de amigos; perfiles locales")
    expect(sinCodigosDeSegmento("el motivador social de S3/S5 en grupo o familia")).toBe("el motivador social en grupo o familia")
  })
  it("lo que no es un código se queda (S23, SSL, 5S)", () => {
    expect(sinCodigosDeSegmento("el modelo S23, el SSL y las 5S")).toBe("el modelo S23, el SSL y las 5S")
    expect(sinCodigosDeSegmento("Lo que el ICP pide primero")).toBe("Lo que el público pide primero") // la sigla suelta se dice en palabras
  })
})

// lo que Emilio pidió quitar del todo (corrección 03-nov, punto 1, y lo que faltaba a las 08:20Z)
const PROHIBIDO = /dicho por el cliente|dicho por el dueño|propuesta del agente|propuesta del sistema|sin validar|Sin dato|sin dato|de origen|de la web|de Google Maps|tomados de la hoja de estilo|Tomados|data-notas-del-campo|lo marc[oó]|Por qué se propone|Evidencia|responde directamente|El cliente dice|Incompleto|fidelidad|sin decidir|>falta<|\bS[1-5]\b|\bICP\b|Lo que falta/

describe("el panel del manual, limpio", () => {
  const borrador = {
    tagline_opciones: [ESLOGAN_OPCION],
    historia_y_origen: "Abrió en 1998 frente al mar",
    uso_del_logo: [LOGO, "FONDOS PERMITIDOS — Solo fondos oscuros de la paleta"],
    tono_por_canal: ["TripAdvisor: mismo tono — refuerza confianza para el turista extranjero (S2) que usa TripAdvisor según señales ICP.", "WhatsApp: conversacional y ágil"],
    _field_meta: { valores: { fuente: "Instagram post del cliente", notas_del_juez: [{ dato: "1998", motivo: "año sin fuente" }] }, historia_y_origen: { notas_del_juez: [{ dato: "1998", motivo: "año sin fuente" }] } },
  }
  const fila = { client_id: C, version: 2, auto_generated: true, human_validated: false, brand_purpose: "PROPUESTA (no es dato del cliente): Demostrar que el mar es para todos", brand_mission: MISION, brand_values: VALORES, voice_description: "Voz cálida, informal y de invitación directa. (Evidencia: bio y publicación de Instagram observada)", content_text: JSON.stringify({ brand_book_draft: borrador }) }
  const datos = (): ManualDelCliente => ({ clientes: [{ id: C, nombre: "Náufrago", con_manual: true }], cliente: { id: C, nombre: "Náufrago" }, manual: { version: 2, versiones: 2, lector: leerManual(fila)!, fidelidad: "Pasó la revisión de fidelidad", origen: "Construido en el alta", colores: [{ hex: "#1a0828", rol: "principal", procedencia: "sitio:hoja_de_estilo" }], tipografias: [], opciones_eslogan: [ESLOGAN_OPCION], palabras_prohibidas: [], palabras: [{ texto: "barato", intencion: "del_dueno", porque: null, cita: "No quiero esa palabra", origen: null, fecha: "2026-11-01", por: null }], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador(borrador) }, leido_en: "x" })

  it("ningún rótulo de origen, de validación, «sin dato», nota del juez, evidencia ni «por qué»; el eslogan, solo la frase", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos() }))
    expect(h).not.toMatch(PROHIBIDO)
    expect(h).toContain("«Frescos desde la costa»"); expect(h).toContain("Demostrar que el mar es para todos")
    expect(h).toContain(">Frescura<"); expect(h).toContain(">Accesibilidad<")
    expect(h).toContain("Voz cálida, informal y de invitación directa.</p>") // un campo de texto, sin su paréntesis de evidencia
    expect(h).toContain("Abrió en 1998 frente al mar") // el texto queda; la nota del juez no
    expect(h).toContain("TAMAÑO MÍNIMO — Digital: 120 px de ancho"); expect(h).not.toContain("[propuesta")
  })
  it("la barra lateral también: sin «Estado del manual», sin de dónde salió cada color o foto, y la frase sola", () => {
    const m = datos().manual!
    const h = renderToStaticMarkup(createElement(BarraDelManual, { m, nombre: "Náufrago", campos: new Map(m.lector.campos.map((c) => [c.clave, c])), delDueno: () => false, faltan: [], irA: () => {} }))
    expect(h).not.toMatch(PROHIBIDO); expect(h).not.toContain('data-barra="estado"')
    expect(h).toContain("«Frescos desde la costa»")
  })
  it("08:20Z · opciones de eslogan con ✓ para elegir una (sin «sin decidir»); lo que falta, en una línea del lateral y no arriba", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos() }))
    const eslogan = h.slice(h.indexOf('data-campo="eslogan"'), h.indexOf('data-campo="posicionamiento"') > 0 ? h.indexOf('data-campo="posicionamiento"') : h.indexOf('data-campo="eslogan"') + 3000)
    expect(eslogan).toContain("Opciones de eslogan"); expect(eslogan).not.toContain("sin decidir")
    expect((eslogan.match(/data-accion="elegir-opcion"/g) ?? []).length).toBe(1); expect(eslogan).toContain("✓ Elegir")
    expect(eslogan).not.toContain(">falta<") // vacío: su título y «Editar», sin etiqueta
    const portada = h.slice(h.indexOf('aria-label="La portada del manual"'), h.indexOf('aria-label="Lo esencial del manual"'))
    expect(portada).not.toMatch(/Lo que falta|data-lo-que-falta|data-ir-campo/)
    expect(h).toMatch(/data-barra="estado"[^>]*><span[^>]*>Por completar: <\/span>/)
  })
  it("tres niveles de título: sección (grande) · campo (claramente más grande que el cuerpo) · subtítulo", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos() }))
    expect(h).toMatch(/<h3 class="mb-4 font-display text-\[22px\] font-semibold[^"]*">Lo que la marca es<\/h3>/)
    expect(h).toMatch(/<h4 class="text-\[17px\] font-semibold[^"]*">Valores<\/h4>/)
    expect(h).toMatch(/<h5 class="text-\[14px\] font-medium[^"]*">Opciones de eslogan<\/h5>/)
    expect(h).toMatch(/class="[^"]*text-\[15px\] leading-relaxed/) // el cuerpo, más chico que el título del campo
    expect(h).not.toMatch(/uppercase tracking-\[0\.08em\] text-zinc-300">Valores/) // ya no el «VALORES» chico de antes
  })
  it("botones: en cada elemento «Retirar»; «Editar» y «Pedir cambios» se mantienen; nada de «Validar» por campo; abajo, «Guardar cambios»", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos() }))
    const valores = h.slice(h.indexOf('data-campo="valores"'), h.indexOf('data-campo="eslogan"'))
    expect((valores.match(/data-accion="retirar"/g) ?? []).length).toBe(3)
    expect(h).toContain('data-campo-editar="valores"')
    expect(h).not.toMatch(/data-campo-validar|data-campo-desvalidar/)
    expect(h).toMatch(/data-accion="guardar-cambios"[^>]*disabled=""/) // sin cambios todavía: no hay qué guardar
    expect(h).not.toContain("data-cambios-guardados")
    // las secciones nuevas: Retirar por elemento de su lista
    const logo = h.slice(h.indexOf('data-campo="uso_del_logo"'), h.indexOf('data-campo="jerarquia_tipografica"'))
    expect((logo.match(/data-accion="retirar"/g) ?? []).length).toBe(2)
  })
  it("Retirar quita SOLO ese elemento y deja el texto de los demás como estaba guardado (no borra lo del agente)", () => {
    const els = elementosDelCampo("valores", VALORES)!
    expect(els.map((e) => e.limpio)).toEqual(["Frescura", "Autenticidad ecuatoriana", "Accesibilidad"])
    const queda = juntarLista(els.filter((_, i) => i !== 1).map((e) => e.crudo))
    expect(queda.split("\n")).toHaveLength(2); expect(queda).toContain("(Evidencia: publicación Instagram DAjARyZxg8N · 2026-10-14; objeción S3 del ICP)"); expect(queda).not.toContain("Autenticidad")
    expect(elementosDelCampo("proposito", "a · b")).toBeNull() // un texto corrido no tiene elementos
  })
  it("Guardar cambios manda TODOS los cambios en una sola llamada por la puerta de siempre, y la plataforma acepta un texto largo (tope 100.000, no 2.000)", async () => {
    const llamadas: Array<Record<string, unknown>> = []
    const f: typeof fetch = async (_u, i) => { llamadas.push(JSON.parse(String(i?.body))); return new Response(JSON.stringify({ ok: true }), { status: 200 }) }
    const largo = "Frescura — ".concat("x".repeat(5000))
    const r = await ejecutarAccion("manual-campos", { client_id: C, campos: { valores: largo, eslogan: "Frescos desde la costa" } }, { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: f })
    expect(r.status).toBe(200); expect(llamadas).toHaveLength(1)
    expect(llamadas[0]).toMatchObject({ campos: { valores: largo, eslogan: "Frescos desde la costa" } })
    expect((await ejecutarAccion("manual-campos", { client_id: C, campos: { valores: "" } }, { revisor: "e", plataformaUrl: "https://p.test", llave: "k", fetchImpl: f })).status).toBe(400) // vacío: todavía no (la plataforma no vacía un campo)
  })
})
