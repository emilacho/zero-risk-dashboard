// @vitest-environment jsdom
/**
 * Propuestas también en IMAGEN (GO Lenovo 17-nov · contrato `raw/tasks/2026-11-17-CONTRATO-CC5-a-CC1-CC6-CC7-propuestas-en-imagen.md` §2 y §3).
 * El mismo boceto aprobado: la primera lámina en lugar del video, «Lámina n» / «Pieza» en lugar de «Plano n · segundos», el texto de la publicación.
 * Sin `familia` todo sigue siendo video (las pruebas de `sprint2-propuestas.test.tsx` lo cuidan). Dos clientes de rubros distintos: nada depende del cliente.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { claseLegible, leerPropuestas, nombreDeLaLamina, type Propuestas } from "@/lib/propuestas"
import { normalizarDecisiones, type Decision } from "@/lib/direccion-decisiones"
import { PanelPropuestas } from "@/components/nuevo/PanelPropuestas"

afterEach(cleanup)
const ENCARGO = "2a7d4c10-8e5b-4f3a-b1c2-9d8e7f6a5b4c"
const LAMINA = (n: string) => `https://almacen.example/borradores/${n}.png`

/** un carrusel de una ferretería: 3 propuestas, la 2 sin borrador todavía */
const carrusel = (extra: Record<string, unknown> = {}) => ({
  encargo_id: ENCARGO, brief_id: "brief-9", ronda: 1, quedan_vueltas: 2, avisos: [], familia: "imagen", clase: "carrusel",
  lista: [
    { id: "P1", nombre: "Herramientas que duran", concepto: "Cinco herramientas que un maestro usa veinte años.", segundos: null, red: "Instagram", objetivo: "Visitas a la tienda", por_que: "El maestro confía en lo que dura.",
      video_url: null, costo: { borrador_usd: 0.06, final_usd: null },
      texto_de_la_publicacion: { texto_base: "Lo que dura no se cambia.", pie_de_foto: "Cinco que no fallan en obra.", hashtags: ["ferreteria", "#obra"], llamado: "Visítanos" },
      planos: [
        { n: 1, desde: null, hasta: null, rol: "portada", se_ve: "Un martillo gastado sobre madera", texto_en_pantalla: "Herramientas\nque duran", imagenes: [LAMINA("p1-1")], foto_propia: true },
        { n: 2, desde: null, hasta: null, rol: "prueba", se_ve: "Una llave inglesa", texto_en_pantalla: "La llave de toda la vida", imagen_url: LAMINA("p1-2"), foto_propia: false },
        { n: 3, desde: null, hasta: null, rol: "llamado", se_ve: "El mostrador", texto_en_pantalla: null, imagenes: [] },
      ] },
    { id: "P2", nombre: "Antes y después", concepto: "Una reparación casera paso a paso.", red: "Instagram", objetivo: "Confianza", por_que: "Enseñar vende.", costo: { borrador_usd: null, final_usd: null },
      planos: [{ n: 1, rol: "portada", se_ve: "Una puerta rota", texto_en_pantalla: "Antes" }] },
    { id: "P3", nombre: "El maestro recomienda", concepto: "Un maestro elige su herramienta.", red: "Facebook", objetivo: "Visitas", por_que: "La voz de un par.", costo: { borrador_usd: 0.04, final_usd: null },
      planos: [{ n: 1, rol: "portada", se_ve: "Un maestro sonriendo", texto_en_pantalla: "Mi favorita", imagenes: [LAMINA("p3-1")] }] },
  ],
  ...extra,
})
/** una foto de una panadería: una sola pieza por propuesta */
const foto = () => ({
  encargo_id: ENCARGO, brief_id: null, ronda: 2, quedan_vueltas: 0, avisos: ["La propuesta 2 usa la misma foto con otro encuadre."], familia: "imagen", clase: "post_img",
  lista: [
    { id: "P1", nombre: "Pan de la mañana", concepto: "El primer pan del día.", red: "Instagram", objetivo: "Ventas", por_que: "Huele a recién hecho.", costo: { borrador_usd: 0, final_usd: null },
      texto_de_la_publicacion: { pie_de_foto: "Sale a las 6:00.", hashtags: [] },
      planos: [{ n: 1, rol: "foto", se_ve: "Pan sobre la bandeja", texto_en_pantalla: "Recién salido", imagenes: [LAMINA("pan")], foto_propia: true }] },
    { id: "P2", nombre: "Manos que amasan", concepto: "El panadero trabajando.", red: "Instagram", objetivo: "Ventas", por_que: "Muestra el oficio.", costo: { borrador_usd: 0.02, final_usd: null },
      planos: [{ n: 1, rol: "foto", se_ve: "Manos con harina", imagenes: [LAMINA("manos")] }] },
  ],
})
const decision = (propuestas: Record<string, unknown>, cliente = "Ferretería El Maestro") => {
  const fila = { id: ENCARGO, tipo: "propuestas", fuente: "oficina_turnos", client_id: "c1", cliente, titulo: "Propuestas de la pieza: elige una", desde: "2026-11-17T13:00:00Z", vence: null, decidir: { ruta: null, accion: "propuestas-aprobar" }, detiene: true, propuestas }
  return normalizarDecisiones({ decisiones: [fila], fuentes: [], sin_fuente: [], completo: true }).decisiones[0] as Decision & { propuestas: Propuestas }
}
const dibujar = (d: Decision & { propuestas: Propuestas }) => renderToStaticMarkup(createElement(PanelPropuestas, { decision: d, onCerrar: () => undefined }))

describe("1 · el dato: imagen solo con `familia: 'imagen'`; lo demás es video como hoy", () => {
  it("lee familia, clase, el texto de la publicación y la foto propia", () => {
    const p = leerPropuestas(carrusel())!
    expect(p.familia).toBe("imagen"); expect(p.clase).toBe("carrusel")
    expect(p.lista[0].texto_de_la_publicacion).toEqual({ texto_base: "Lo que dura no se cambia.", pie_de_foto: "Cinco que no fallan en obra.", hashtags: ["ferreteria", "#obra"], llamado: "Visítanos" })
    expect(p.lista[0].planos.map((x) => x.foto_propia)).toEqual([true, false, null])
    expect(p.lista[0].planos.map((x) => x.desde)).toEqual([null, null, null])
    expect(p.lista[0].planos[1].imagenes).toEqual([LAMINA("p1-2")])
  })
  it("sin `familia`, o con cualquier otra cosa, es video y no tiene clase", () => {
    expect(leerPropuestas(carrusel({ familia: undefined }))!).toMatchObject({ familia: "video", clase: null })
    expect(leerPropuestas(carrusel({ familia: "IMAGEN" }))!).toMatchObject({ familia: "video", clase: null })
    expect(leerPropuestas(carrusel({ familia: "video", clase: "kit" }))!.clase).toBeNull()
  })
  it("una clase que no es del contrato queda null (no se adivina)", () => {
    expect(leerPropuestas(carrusel({ clase: "afiche" }))!.clase).toBeNull()
    expect(leerPropuestas(carrusel({ clase: "kit" }))!.clase).toBe("kit")
  })
  it("un texto de la publicación vacío o mal formado es null; los hashtags vacíos se descartan", () => {
    const base = carrusel()
    const con = (t: unknown) => leerPropuestas({ ...base, lista: [{ ...base.lista[0], texto_de_la_publicacion: t }] })!.lista[0].texto_de_la_publicacion
    expect(con({ texto_base: "  ", hashtags: ["", 3] })).toBeNull()
    expect(con("Un pie suelto")).toBeNull()
    expect(con(undefined)).toBeNull()
    expect(con({ hashtags: ["", "obra"] })).toEqual({ texto_base: null, pie_de_foto: null, hashtags: ["obra"], llamado: null })
  })
  it("los nombres: «Lámina n» en carrusel/kit, «Pieza» en foto o con una sola; la clase en palabras", () => {
    expect(nombreDeLaLamina("carrusel", 2, 5)).toBe("Lámina 2")
    expect(nombreDeLaLamina("kit", 1, 3)).toBe("Lámina 1")
    expect(nombreDeLaLamina("post_img", 1, 1)).toBe("Pieza")
    expect(nombreDeLaLamina(null, 1, 1)).toBe("Pieza")
    expect(claseLegible("carrusel", 5)).toBe("Carrusel · 5 láminas")
    expect(claseLegible("kit", 1)).toBe("Historia · 1 lámina")
    expect(claseLegible("post_img", 1)).toBe("Foto")
    expect(claseLegible(null, 2)).toBe("Imagen · 2 láminas")
  })
})

describe("2 · el dibujo de imagen: el mismo boceto, sin video ni segundos", () => {
  const html = dibujar(decision(carrusel()))
  it("la primera lámina en lugar del video; sin video ni «el borrador en video todavía no está»", () => {
    expect(html.match(/<img[^>]*data-portada[^>]*>/)?.[0]).toContain(`src="${LAMINA("p1-1")}"`)
    expect(html).not.toContain("<video")
    expect(html).not.toContain("data-sin-video")
    expect(html).not.toContain("Guion gráfico")
    expect(html).toContain("Láminas · borrador")
  })
  it("la ficha dice la clase y cuántas láminas, no segundos", () => {
    expect(html).toContain("Carrusel · 3 láminas")
    expect(html).not.toMatch(/\d+ s</)
  })
  it("cada lámina con su nombre, su papel, su texto, y la marca de foto propia solo donde la hay", () => {
    expect(html).toContain("Lámina 1 · Portada")
    expect(html).toContain("Lámina 3 · Llamado")
    expect(html.match(/data-foto-propia/g)).toHaveLength(1)
    expect(html).toContain("«Herramientas\nque duran»")
    expect(html).toContain("data-cuadro-vacio")
    expect(html).not.toMatch(/–\d+ s/)
  })
  it("el texto de la publicación: el pie y los hashtags con un solo #", () => {
    expect(html).toContain("Cinco que no fallan en obra.")
    expect(html).toContain("#ferreteria #obra")
    expect(html).not.toContain("##obra")
  })
  it("una propuesta sin borrador ni texto lo dice (sin dato), no inventa", () => {
    expect(html).toContain("data-sin-portada")
    expect(html.match(/data-texto-publicacion/g)).toHaveLength(3)
  })
  it("una foto: «Foto» y «Pieza · Foto», y sin rondas de cambios solo se aprueba", () => {
    const f = dibujar(decision(foto(), "Panadería La Espiga"))
    expect(f).toContain(">Foto<")
    expect(f).toContain("Pieza · Foto")
    expect(f).not.toContain("Lámina 1")
    expect(f).toContain("data-sin-vueltas")
    expect(f).not.toContain('data-verbo="pedir_cambios"')
    expect(f).toContain("Sale a las 6:00.")
    expect(f).not.toContain("data-hashtags")
  })
  it("el video no cambia: sin `familia` no hay portada ni láminas", () => {
    const v = dibujar(decision(carrusel({ familia: undefined })))
    expect(v).not.toContain("data-portada")
    expect(v).not.toContain("data-lamina")
    expect(v).not.toContain("data-texto-publicacion")
    expect(v).toContain("Guion gráfico · borrador")
  })
})

describe("3 · decidir: las mismas acciones que el video", () => {
  it("aprobar la propuesta elegida manda `propuestas-aprobar` con su id y la ronda", async () => {
    const f = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })))
    const r = render(createElement(PanelPropuestas, { decision: decision(carrusel()), onCerrar: () => undefined, fetchImpl: f as unknown as typeof fetch }))
    fireEvent.click(r.container.querySelector('[data-elegir="P3"]')!)
    fireEvent.click(r.container.querySelector('[data-verbo="aprobar"]')!)
    await waitFor(() => expect(r.container.querySelector('[data-contestada="aprobada"]')).not.toBeNull())
    expect(f).toHaveBeenCalledWith("/api/acciones/propuestas-aprobar", expect.objectContaining({ body: JSON.stringify({ encargo_id: ENCARGO, ronda: 1, propuesta_id: "P3" }) }))
  })
})

describe("4 · lo que mide CC7 (`NOTA-CC7-a-CC5-tarjeta-propuestas-imagen-lo-que-voy-a-medir.md`)", () => {
  it("una historia (kit) rotula «Lámina n» y dice «Historia · n láminas»", () => {
    const h = dibujar(decision(carrusel({ clase: "kit" })))
    expect(h).toContain("Historia · 3 láminas")
    expect(h).toContain("Lámina 2 · Prueba")
  })
  it("sin texto de la publicación, el «sin dato» rojo se ve (nunca vacío en silencio)", () => {
    const h = dibujar(decision(carrusel()))
    const bloques = h.match(/<p data-texto-publicacion[\s\S]*?<\/p>/g) ?? []
    expect(bloques).toHaveLength(3)
    expect(bloques[0]).not.toContain("data-sin-dato")
    expect(bloques[1]).toContain("data-sin-dato")
  })
  it("las notas de la mesa (`avisos[]`) se ven también en imagen", () => {
    const f = dibujar(decision(foto(), "Panadería La Espiga"))
    expect(f).toContain("data-avisos")
    expect(f).toContain("Notas de la mesa (1)")
    expect(f).toContain("La propuesta 2 usa la misma foto con otro encuadre.")
  })
  it("una lámina sin imagen dice qué se verá, sin un <img> roto", () => {
    const h = dibujar(decision(carrusel()))
    const lamina3 = h.match(/<li data-lamina="3"[\s\S]*?<\/li>/)?.[0] ?? ""
    expect(lamina3).toContain("data-cuadro-vacio")
    expect(lamina3).toContain("El mostrador")
    expect(lamina3).not.toContain("<img")
    expect(h.match(/<img[^>]*data-cuadro[^>]*>/g)?.every((t) => /src="https:\/\//.test(t))).toBe(true)
  })
  it("el texto que escribe la mesa se muestra como texto, nunca como HTML", () => {
    const base = carrusel()
    const malo = { ...base, lista: [{ ...base.lista[0], texto_de_la_publicacion: { pie_de_foto: "<b>gratis</b><script>x()</script>" },
      planos: [{ n: 1, rol: "portada", se_ve: "<img src=x onerror=y>", texto_en_pantalla: "<i>ya</i>", imagenes: [] }] }, ...base.lista.slice(1)] }
    const h = dibujar(decision(malo))
    expect(h).not.toContain("<script>"); expect(h).not.toContain("<b>gratis"); expect(h).not.toContain("<i>ya"); expect(h).not.toContain("<img src=x")
    expect(h).toContain("&lt;i&gt;ya&lt;/i&gt;")
  })
  it("con rondas de cambios se ofrece «Pedir cambios» y manda `propuestas-cambios` con las observaciones", async () => {
    const f = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })))
    const r = render(createElement(PanelPropuestas, { decision: decision(carrusel()), onCerrar: () => undefined, fetchImpl: f as unknown as typeof fetch }))
    fireEvent.click(r.container.querySelector('[data-verbo="pedir_cambios"]')!)
    fireEvent.change(r.container.querySelector("[data-observaciones]")!, { target: { value: "La portada necesita el logo." } })
    fireEvent.click(r.container.querySelector('[data-verbo="pedir_cambios"]')!)
    await waitFor(() => expect(r.container.querySelector('[data-contestada="observaciones"]')).not.toBeNull())
    expect(f).toHaveBeenCalledWith("/api/acciones/propuestas-cambios", expect.objectContaining({ body: JSON.stringify({ encargo_id: ENCARGO, ronda: 1, observaciones: "La portada necesita el logo." }) }))
  })
  it("si la plataforma rechaza (409) o falla (500), lo dice en palabras y no da por aprobada", async () => {
    for (const [status, cuerpo, frase] of [
      [409, { ok: false, plataforma: { error: "ronda_vieja" } }, "la mesa presentó una ronda nueva"],
      [500, { ok: false }, "la plataforma no respondió bien"],
    ] as const) {
      const f = vi.fn(() => Promise.resolve(new Response(JSON.stringify(cuerpo), { status })))
      const r = render(createElement(PanelPropuestas, { decision: decision(carrusel()), onCerrar: () => undefined, fetchImpl: f as unknown as typeof fetch, elegidaInicial: "P1" }))
      fireEvent.click(r.container.querySelector('[data-verbo="aprobar"]')!)
      await waitFor(() => expect(r.container.querySelector("[data-no-salio]")).not.toBeNull())
      expect(r.container.textContent).toContain(frase)
      expect(r.container.querySelector("[data-contestada]")).toBeNull()
      cleanup()
    }
  })
})
