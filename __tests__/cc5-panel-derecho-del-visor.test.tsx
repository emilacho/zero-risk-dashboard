/**
 * EL PANEL DERECHO DEL VISOR (CC5 · 11-nov · boceto `2-panel-despues.png` aprobado por Emilio 21:54 Zúrich · GO Lenovo 21:55). US$ 0 · sin red.
 * De lo macro a lo micro: chips de estado y avisos · Cuándo/Dónde/Video-o-Láminas/Sede · Tema · Texto · (Lámina N) · Revisión/Equipo/Detalle plegados.
 * La cabecera de una pieza queda solo con el título. Fuera: «Míralo entero…», precios, nombres técnicos e ids.
 * Dos piezas REALES de dos clientes de rubros distintos (`fixtures/cc5-panel-derecho-piezas-reales.json`, producción 11-nov):
 *   el reel W47 de Náufrago (restaurante · video pendiente, revisión incompleta, 2 desacuerdos) y un carrusel de Zero Risk Seguridad Industrial
 *   (láminas · aprobado · sin fila del calendario · aviso rojo). Nada depende de un cliente.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { alternarAviso } from "@/components/nuevo/BarraDeLaPieza"
import { avisosDeLaPieza, type Lamina, type VideoDeLaPieza } from "@/lib/piezas"
import { chipDelAviso, chipsDeLosAvisos, cuandoDeLaFila, dondeDeLaFila, resumenDelDetalle, resumenDelEquipo, resumenDeLaRevision, temaPartido, valorDeLasLaminas, valorDelVideo } from "@/lib/panel-de-la-pieza"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import REALES from "./fixtures/cc5-panel-derecho-piezas-reales.json"

const REEL = REALES.reel as unknown as DetalleDeLaPieza
const CARRUSEL = REALES.carrusel as unknown as DetalleDeLaPieza
const bandeja = (d: DetalleDeLaPieza) => ({ estado: "todas" as const, por_aprobar: 1, piezas: [], otras: [], clientes: [{ id: "c", nombre: d.cliente ?? "" }], leido_en: "x" })
const dibujar = (d: DetalleDeLaPieza) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(d) as never, piezaInicialDatos: d, piezaInicial: d.id }))
/** lo que se ve, sin etiquetas (para buscar frases que cruzan elementos) */
const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
/** la cabecera del visor: del título al comienzo de la columna de la pieza */
const cabecera = (h: string) => h.slice(h.indexOf("data-titulo-pieza"), h.indexOf("data-video-de-la-pieza") > 0 ? h.indexOf("data-video-de-la-pieza") : h.indexOf("data-barra-de-la-pieza"))
const barra = (h: string) => h.slice(h.indexOf("data-barra-de-la-pieza"), h.indexOf("data-decision="))
const VIDEO: VideoDeLaPieza = { nombre: "v.mp4", bytes: 1, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-18T04:28:33Z", url_proveedor: "https://proveedor.test/v.mp4" }
const lamina = (extra: Partial<Lamina> = {}): Lamina => ({ n: 1, nombre: "1.png", ancho: 1080, alto: 1350, origen: "generada", eyebrow: null, titular: "t", cuerpo: null, pie: null, glifos_riesgosos: false, ...extra })

describe("1 · cada aviso de la pieza tiene su chip (con los textos REALES de avisosDeLaPieza)", () => {
  const cortos = (fila: Parameters<typeof avisosDeLaPieza>[0], laminas: Lamina[] = [], video: VideoDeLaPieza | null = null) => avisosDeLaPieza(fila, laminas, video).map((a) => chipDelAviso(a)?.corto ?? null)
  it("los informativos no son chip (los dicen el recuadro «Video» y «Detalle»)", () => {
    expect(cortos({ metadata: {} }, [], VIDEO)).toEqual([null, null])
  })
  it("ensayo, solo en el proveedor, sin video y sin dibujo", () => {
    expect(cortos({ metadata: {} }, [], { ...VIDEO, simulado: true })).toEqual([null, "Ensayo"])
    expect(cortos({ metadata: {} }, [], { ...VIDEO, solo_en_proveedor: true })).toEqual([null, "Solo en el proveedor"])
    expect(cortos({ metadata: { familia: "video_mesa" } })).toEqual(["Sin video"])
    expect(cortos({ metadata: { familia: "carrusel_mesa" } })).toEqual(["Sin dibujo"])
  })
  it("la revisión incompleta (fallida, por tope o sin terminar) y los desacuerdos, con su número", () => {
    expect(cortos({ metadata: { jefatura_resultado: "fallida" } }, [lamina()])).toEqual(["Revisión incompleta"])
    expect(cortos({ metadata: { jefatura_resultado: "incompleta_por_tope" } }, [lamina()])).toEqual(["Revisión incompleta"])
    expect(cortos({ metadata: { revision_incompleta: true } }, [lamina()])).toEqual(["Revisión incompleta"])
    expect(cortos({ metadata: { desacuerdos: ["a"] } }, [lamina()])).toEqual(["1 desacuerdo"])
    expect(cortos({ metadata: { desacuerdos: ["a", "b", "c"] } }, [lamina()])).toEqual(["3 desacuerdos"])
  })
  it("los signos que salen vacíos, cerrada sin dibujar y las imágenes que faltan", () => {
    expect(cortos({ metadata: {} }, [lamina({ glifos_riesgosos: true })])).toEqual(["Signos que salen vacíos"])
    expect(cortos({ metadata: { sin_dibujar: true } }, [lamina()])).toEqual(["Sin dibujar"])
    expect(cortos({ output_preview: "3 imágenes generadas con IA", metadata: {} }, [lamina({ origen: "tipografia" })])).toEqual(["Faltan imágenes"])
  })
  it("un aviso que no se reconoce NO se pierde: «Aviso» con su texto entero; lo rojo sigue rojo", () => {
    expect(chipDelAviso({ nivel: "rojo", texto: "Algo nuevo que pasó." })).toEqual({ corto: "Aviso", detalle: "Algo nuevo que pasó.", nivel: "rojo" })
    expect(chipsDeLosAvisos(REEL.avisos).map((c) => c.corto)).toEqual(["Revisión incompleta", "2 desacuerdos"])
    expect(chipsDeLosAvisos(CARRUSEL.avisos)).toEqual([{ corto: "Faltan imágenes", detalle: CARRUSEL.avisos[0].texto, nivel: "rojo" }])
  })
  it("tocar un chip abre su detalle; tocarlo otra vez lo cierra; tocar otro cambia", () => {
    expect(alternarAviso(null, 0)).toBe(0); expect(alternarAviso(0, 0)).toBeNull(); expect(alternarAviso(0, 1)).toBe(1)
  })
})

describe("2 · las frases del panel", () => {
  it("Cuándo, Dónde, Video, Láminas y Sede", () => {
    expect(cuandoDeLaFila(REEL.acompana!.fila)).toBe("Lun 16 nov · 10:00"); expect(cuandoDeLaFila(null)).toBe("Sin fecha")
    expect(dondeDeLaFila(REEL.acompana!.fila)).toBe("Instagram · Reel"); expect(dondeDeLaFila(null)).toBe("—")
    expect(valorDelVideo(VIDEO)).toBe("12 s · generado"); expect(valorDelVideo({ ...VIDEO, simulado: true })).toBe("12 s · ensayo")
    expect(valorDelVideo({ ...VIDEO, solo_en_proveedor: true, segundos: null })).toBe("En el proveedor")
    expect(valorDeLasLaminas(7, 1080, 1350)).toBe("7 · 1080×1350"); expect(valorDeLasLaminas(3, null, null)).toBe("3")
  })
  it("el tema se parte en los dos puntos: título corto y la línea gris", () => {
    expect(temaPartido(REEL.acompana!.fila!.tema)).toEqual({ corto: "Historia de origen", linea: "Fachada de Olón, manos con el caldo, bowl; el encebollado de Olón llega a la zona norte" })
    expect(temaPartido("Quiz")).toEqual({ corto: "Quiz", linea: null }); expect(temaPartido("  ")).toBeNull(); expect(temaPartido(null)).toBeNull()
    expect(temaPartido(": solo detalle")).toEqual({ corto: ": solo detalle", linea: "Solo detalle" })
  })
  it("los resúmenes de los plegados", () => {
    expect(resumenDeLaRevision(2)).toBe("2 desacuerdos"); expect(resumenDeLaRevision(1)).toBe("1 desacuerdo"); expect(resumenDeLaRevision(0)).toBe("Sin desacuerdos")
    expect(resumenDelEquipo(2, 18)).toBe("2 personas · 18 aportes"); expect(resumenDelEquipo(1, 1)).toBe("1 persona · 1 aporte"); expect(resumenDelEquipo(0, 0)).toBe("0 aportes")
    expect(resumenDelDetalle(REEL.video!.vence, REEL.creada)).toBe("vence 17 nov a las 23:28")
    expect(resumenDelDetalle(null, "2026-10-30T15:00:00Z")).toMatch(/^entró /); expect(resumenDelDetalle("basura", "2026-10-30T15:00:00Z")).toMatch(/^entró /)
  })
})

describe("3 · el reel real de Náufrago (video · por aprobar · revisión incompleta · 2 desacuerdos)", () => {
  const h = dibujar(REEL), b = barra(h), t = texto(b)
  it("la cabecera queda solo con el título: ni «por aprobar» ni «jefatura falló»", () => {
    expect(h).toContain("Video corto Instagram · Náufrago · publica 16 nov")
    expect(cabecera(h)).not.toMatch(/por aprobar|jefatura/i)
  })
  it("de lo macro a lo micro: chips › recuadros › tema › texto › Revisión › Equipo › Detalle", () => {
    const orden = ['data-chip="estado"', 'data-recuadro="Cuándo"', 'data-recuadro="Dónde"', 'data-recuadro="Video"', 'data-recuadro="Sede"', "data-tema", "data-texto-de-la-pieza", 'data-plegado="Revisión"', 'data-plegado="Equipo"', 'data-plegado="Detalle"'].map((x) => b.indexOf(x))
    expect(orden.every((x) => x > -1)).toBe(true); expect([...orden].sort((x, y) => x - y)).toEqual(orden)
  })
  it("los datos que se ven son los del boceto aprobado", () => {
    for (const x of ["Por aprobar", "Revisión incompleta", "2 desacuerdos", "Lun 16 nov · 10:00", "Instagram · Reel", "12 s · generado", "Guayaquil", "Historia de origen", "Fachada de Olón, manos con el caldo", "El encebollado de Olón ya está en zona norte", "2 personas · 18 aportes", "vence 17 nov a las 23:28"]) expect(t, x).toContain(x)
  })
  it("los avisos son chips que se tocan; su texto entero no se ve hasta tocarlos; los plegados empiezan cerrados", () => {
    expect(b).toMatch(/<button[^>]*data-chip-aviso="ambar"[^>]*aria-expanded="false"[^>]*>Revisión incompleta/)
    expect(b).not.toContain("data-detalle-del-aviso"); expect(b).not.toMatch(/<details[^>]*open/)
  })
  it("fuera: «Míralo entero…», los nombres técnicos, el código de la idea y los precios; el pie se puede editar porque está pendiente", () => {
    expect(b).not.toContain("Míralo entero"); expect(b).not.toContain("content-creator"); expect(b).not.toContain("video-editor"); expect(b).not.toContain("C1-I09"); expect(t).not.toMatch(/US\$|\$\s?\d/)
    expect(b).toContain('data-campo-editar="pie-pie"')
  })
  it("lo que estaba en la barra sigue, dentro de los plegados: desacuerdos, quién la hizo (con nombre legible), archivo, vencimiento, pilar, fase, cuándo entró", () => {
    for (const x of REEL.jefatura.desacuerdos) expect(t).toContain(x)
    expect(t).toContain("Redactor · texto"); expect(t).toContain(REEL.video!.nombre!); expect(t).toContain("11,8 MB"); expect(t).toContain("17 nov a las 23:28 (hora de Ecuador)")
    expect(t).toContain("Pilar · Producto"); expect(t).toContain("Fase · Desbloquear"); expect(t).toContain("Entró a la bandeja · ")
  })
})

describe("4 · un carrusel real de Zero Risk Seguridad Industrial (láminas · aprobado · sin fila · aviso rojo)", () => {
  const h = dibujar(CARRUSEL), b = barra(h), t = texto(b)
  it("el estado, la versión y el aviso rojo (que se anuncia aunque no se toque)", () => {
    expect(t).toContain("Aprobada"); expect(t).toContain("Versión 2")
    expect(b).toMatch(/data-chip-aviso="rojo"[^>]*>Faltan imágenes/)
    expect(b).toContain(`role="alert" class="sr-only">${CARRUSEL.avisos[0].texto}`)
  })
  it("sin fila del calendario no inventa: «Sin fecha», «—» y lo dice en Detalle; el cuarto recuadro son las láminas", () => {
    expect(t).toContain("Cuándo Sin fecha"); expect(t).toContain("Dónde —"); expect(t).toContain("Sede —"); expect(b).not.toContain("data-tema")
    expect(t).toContain("Láminas 7 · 1080×1350"); expect(b).not.toContain('data-recuadro="Video"')
    expect(t).toContain("no está atada a una fila del calendario")
  })
  it("el bloque «Lámina N» se queda, debajo de «Texto» y antes de los plegados; aprobada, nada se edita", () => {
    const i = (x: string) => b.indexOf(x)
    expect(i("data-texto-de-la-pieza")).toBeLessThan(i('data-bloque="lamina"')); expect(i('data-bloque="lamina"')).toBeLessThan(i('data-plegado="Revisión"'))
    expect(t).toContain("Lámina 1 · imagen generada con IA"); expect(b).not.toContain("data-campo-editar")
  })
})

describe("5 · lo que no es pieza sigue con su barra de siempre", () => {
  it("una revisión que no es pieza: cabecera con su estado, la ficha con «Qué es», sin el panel nuevo", () => {
    const h = dibujar({ ...CARRUSEL, es_pieza: false, tipo: "editor_escalation", status: "pending", laminas: [], resumen_de_la_bandeja: "El editor revisó el texto." })
    expect(cabecera(h)).toContain("espera tu decisión"); expect(h).not.toContain("data-panel-derecho")
    expect(h).toContain('data-bloque="ficha"'); expect(texto(h)).toContain("Qué es · ")
  })
})
