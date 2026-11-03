/** LA BARRA LATERAL DEL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio): datos reales, nada de muestra; si falta, se dice. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { canalesDelCliente, estadoDelManual, fotosDeLaBarra, frasesDelCliente, logoDelManual, personalidadCorta, sedesDeLaBarra, urlDeLasTipografias } from "@/lib/manual-barra"
import { BarraDelManual } from "@/components/nuevo/manual/BarraDelManual"
import type { ManualDelCliente } from "@/lib/manual-datos"
import type { CampoLeido } from "@/lib/manual-lector"

const BUCKET = "https://abc.supabase.co/storage/v1/object/public/client-social-images/x"

describe("la lógica de la barra (pura)", () => {
  it("estado: validados por el dueño, lo que falta y qué tan completo", () => {
    expect(estadoDelManual([{ valor: "a", delDueno: true }, { valor: "b", delDueno: false }, { valor: null, delDueno: true }], ["Visión", "Valores"])).toEqual({ validados: 1, faltan: ["Visión", "Valores"], completo_pct: 50 })
  })
  it("personalidad en pocas palabras: lo de antes de la explicación, sin frases largas ni repetidos", () => {
    expect(personalidadCorta("Cálido y acogedor — el cliente dice «los esperamos» · Auténtico: sin poses · Cálido · Una marca que siempre habla con muchísima calma y paciencia")).toEqual(["cálido", "acogedor", "auténtico"])
    expect(personalidadCorta(null)).toEqual([])
  })
  it("frases del cliente: el eslogan y las opciones que no son propuesta del agente", () => {
    expect(frasesDelCliente(null, ["Cuando tengas esa hambre… Náufrago te espera", "PROPUESTA (no es dato del cliente): Fresco del mar"])).toEqual(["Cuando tengas esa hambre… Náufrago te espera"])
  })
  it("tipografías: una dirección de Google Fonts solo con nombres limpios", () => {
    expect(urlDeLasTipografias(["Alfa Slab One", "Inter", "x<script>"])).toBe("https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Inter&display=swap")
    expect(urlDeLasTipografias([])).toBeNull()
  })
  it("sedes: manda lo del dueño, después su web, Mapas e Instagram; una ficha ajena de Uber Eats no gana (caso real de Náufrago)", () => {
    const sedes = [{ id: "g", ciudad: "Guayaquil" }, { id: "o", ciudad: "Olon" }]
    const datos = [
      { sede_id: "g", campo: "horario", valor_texto: "lunes a viernes 07:00–14:45", fuente: "sitio", fuente_ref: "https://www.ubereats.com/store/aloha-cafe" },
      { sede_id: "g", campo: "horario", valor_texto: "jueves a lunes 07:00–15:00", fuente: "sitio", fuente_ref: "https://www.naufrago.ec" },
      { sede_id: "g", campo: "estado_de_la_sede", valor_texto: "por abrir", fuente: "dueno", fuente_ref: "firma" },
      { sede_id: "g", campo: "tipo_de_atencion", valor_texto: "solo domicilio (sin local)", fuente: "dueno" },
      { sede_id: "o", campo: "horario", valor_texto: "jueves a lunes 08:00–16:00 (bio: «📍Olon»)", fuente: "instagram", fuente_ref: "instagram.com/naufrago.ec" },
      { sede_id: "o", campo: "direccion", valor_texto: "663R+25G, Olon", fuente: "mapas" },
    ]
    expect(sedesDeLaBarra(sedes, datos, "https://www.naufrago.ec")).toEqual([
      { ciudad: "Guayaquil", estado: "por abrir", atencion: "solo domicilio (sin local)", horario: "jueves a lunes 07:00–15:00", direccion: null, fuentes: ["dicho por ti", "de la web"] },
      { ciudad: "Olón", estado: null, atencion: null, horario: "jueves a lunes 08:00–16:00", direccion: "663R+25G, Olon", fuentes: ["de su Instagram", "de Google Maps"] },
    ])
  })
  it("canales propios: sus cuentas y su sitio, con enlace", () => {
    expect(canalesDelCliente({ apify: { own_handles: { instagram: "@naufrago.ec" } } }, "https://www.naufrago.ec/")).toEqual([
      { red: "Instagram", cuenta: "@naufrago.ec", url: "https://instagram.com/naufrago.ec" }, { red: "Sitio web", cuenta: "naufrago.ec", url: "https://www.naufrago.ec/" }])
    expect(canalesDelCliente(null, null)).toEqual([])
  })
  it("fotos y logo: solo imágenes de nuestro almacén (nada de direcciones de afuera)", () => {
    expect(fotosDeLaBarra([{ url: `${BUCKET}/a.jpg`, que_muestra: "encebollado" }, { url: "https://scontent.cdninstagram.com/b.jpg" }, { url: `${BUCKET}/c.mp4` }])).toEqual([{ url: `${BUCKET}/a.jpg`, que_muestra: "encebollado" }])
    expect(logoDelManual({ visual: { capa_grafica: { logo_url: `${BUCKET}/logo.jpg`, logo_procedencia: "copia propia" } } })).toEqual({ url: `${BUCKET}/logo.jpg`, procedencia: "copia propia" })
    expect(logoDelManual({ visual: { capa_grafica: { logo_url: "https://otro.com/logo.png" } } })).toBeNull()
  })
})

const campo = (clave: string, etiqueta: string, valor: string | null): CampoLeido => ({ clave, etiqueta, valor, estado: valor ? "lleno" : "hueco", nota: null, explicacion: null, origen: null })
const manual = (barra: NonNullable<ManualDelCliente["manual"]>["barra"]): NonNullable<ManualDelCliente["manual"]> => ({
  version: 1, versiones: 1, lector: { campos: [], huecos: ["vision"], completo: false, validadoPor: "propuesta", rotulo: "", rotuloVisual: null } as never, fidelidad: "", origen: null,
  colores: [{ hex: "#1a0828", rol: "principal", procedencia: "sitio:hoja_de_estilo" }], tipografias: [{ familia: "Alfa Slab One", rol: null, procedencia: null }], opciones_eslogan: [], palabras_prohibidas: ["gourmet"],
  palabras: [{ texto: "gourmet", intencion: "estilo", porque: null, cita: null, origen: null, fecha: null, por: null }], terminos_propios: ["encebollado"], politica_competidores: null, creado_en: null, actualizado_en: null, barra,
})

describe("la barra en pantalla", () => {
  const dibujar = (barra: NonNullable<ManualDelCliente["manual"]>["barra"]) => renderToStaticMarkup(createElement(BarraDelManual, { m: manual(barra), nombre: "Náufrago", campos: new Map([["personalidad", campo("personalidad", "Personalidad", "Cálido · Costeño")]]), delDueno: () => false, faltan: ["Visión"], irA: () => {} }))
  it("todos los bloques del boceto, fija al bajar, «Tipografías» (no «Letras»), cada una en su letra y el nombre del cliente en la primera", () => {
    const h = dibujar({ logo: { url: `${BUCKET}/logo.jpg`, procedencia: null }, fotos: [{ url: `${BUCKET}/a.jpg`, que_muestra: "ceviche" }], sedes: [{ ciudad: "Guayaquil", estado: "por abrir", atencion: "solo domicilio", horario: "jueves a lunes", direccion: null, fuentes: ["dicho por ti"] }], canales: [{ red: "Instagram", cuenta: "@naufrago.ec", url: "https://instagram.com/naufrago.ec" }] })
    // 03-nov · manual limpio: sin «Estado del manual» (es del sistema); un bloque sin datos no se pinta (aquí no hay frases)
    expect([...h.matchAll(/data-barra="([a-z-]+)"/g)].map((x) => x[1])).toEqual(["colores", "tipografias", "logo-y-fotos", "personalidad", "palabras", "sedes-y-canales"])
    expect(h).not.toMatch(/dicho por ti|Tomados|hoja de estilo|Fotos reales|validados? por ti/) // ni de dónde salió cada dato
    expect(h).toMatch(/lg:sticky/); expect(h).toContain("Tipografías"); expect(h).not.toContain(">Letras<")
    expect(h).toContain('font-family:&quot;Alfa Slab One&quot;'); expect(h).toContain(">Náufrago<")
    expect(h).toContain("fonts.googleapis.com/css2?family=Alfa+Slab+One")
    expect(h).toContain("por abrir"); expect(h).toContain("@naufrago.ec"); expect(h).toContain(">cálido<")
    expect(h).not.toMatch(/muestra\)|\(muestra/) // nada de muestra
  })
  it("si un dato no existe, su bloque no se pinta (no se inventa, y tampoco se escribe «sin dato» en el documento · 03-nov)", () => {
    const h = dibujar({ logo: null, fotos: [], sedes: [], canales: [] })
    expect(h).not.toContain('data-barra="logo-y-fotos"'); expect(h).not.toContain('data-barra="sedes-y-canales"'); expect(h).not.toContain('data-barra="frases"')
    expect(h).not.toMatch(/Todavía no hay|Sin sedes|sin logo/)
  })
})
