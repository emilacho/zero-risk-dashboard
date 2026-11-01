/**
 * Sprint 6.7 · Piezas como explorador de carpetas (macro → micro) + textos editables + botones grandes.
 * Lo que Emilio pidió (31-oct): «como un explorador de carpetas de windows de macro a micro pero con nuestro estilo», «los campos … debe ser editable», «los botones … más grandes».
 * La plataforma NO tiene ruta para cambiar el texto de una pieza ya dibujada: cada texto editado se suma a UN pedido de cambios (la puerta de siempre) con el texto exacto,
 * y la oficina creativa vuelve a dibujar. Estas pruebas no escriben ni gastan.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CARPETA_OTRAS, arbolDeLaBandeja, comentarioDeEdiciones, conEdicion, cuentaDeLaCarpeta, laminasDeLasEdiciones, type Edicion } from "@/lib/bandeja"
import { CARPETA_OTRAS as CARPETA_OTRAS_DATOS, type DetalleDeLaPieza, type FilaDeLaLista } from "@/lib/piezas-datos"
import { COMENTARIO_MAXIMO } from "@/lib/piezas"
import type { Bandeja } from "@/lib/bandeja-datos"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const PEREZ = "5a2a0b8e-6c0e-4d4f-9f2a-1b2c3d4e5f60"
const PIEZA = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
const fila = (x: Partial<FilaDeLaLista> & Pick<FilaDeLaLista, "id" | "estado" | "status" | "carpeta">): FilaDeLaLista => ({
  tipo: "content_piece_review", es_pieza: true, titulo: "crudo", titulo_legible: "Historias Instagram · Náufrago · 31 oct", cliente_id: NAUFRAGO, cliente: "Náufrago", creada: "2026-10-31T13:38:01.926Z",
  gasto_usd: 1.02988, incompleta: false, desacuerdos: 2, tiene_dibujo: true, ...x,
})
const PIEZAS = [
  fila({ id: "a1", estado: "aprobada", status: "approved", carpeta: "Carrusel Facebook", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial" }),
  fila({ id: PIEZA, estado: "pendiente", status: "pending", carpeta: "Historias Instagram" }),
  fila({ id: "s1", estado: "superada", status: "rejected", carpeta: "Carrusel Facebook", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial" }),
  fila({ id: "p2", estado: "pendiente", status: "pending", carpeta: "Carrusel Facebook", cliente_id: PEREZ, cliente: "Zero Risk Seguridad Industrial" }),
  fila({ id: "h2", estado: "con_cambios", status: "edited", carpeta: "Historias Instagram" }),
  fila({ id: "x1", estado: "aprobada", status: "approved", carpeta: "Carrusel Instagram", cliente_id: null, cliente: null }),
]
const OTRAS = [fila({ id: "plan", estado: "pendiente", status: "pending", carpeta: CARPETA_OTRAS, tipo: "plan_con_pendientes", es_pieza: false, tiene_dibujo: false, gasto_usd: null })]
const BANDEJA: Bandeja = { estado: "todas", por_aprobar: 2, piezas: PIEZAS, otras: OTRAS, clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }, { id: PEREZ, nombre: "Zero Risk Seguridad Industrial" }], leido_en: "x" }
const DETALLE: DetalleDeLaPieza = {
  id: PIEZA, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "Historias Instagram · Náufrago · 31 oct", cliente: "Náufrago", creada: "2026-10-31T13:38:01.926Z",
  familia: "kit_historias", brief_id: "BRF-0002", encargo_id: "db7c2d8b", gasto_usd: 1.02988,
  laminas: [
    { n: 1, nombre: "01.png", ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: "¿Sabes la respuesta?", titular: "¿Qué lleva el encebollado?", cuerpo: "Responde y descubre si eres un experto del mar", pie: null, glifos_riesgosos: false },
    { n: 2, nombre: "02.png", ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: null, titular: "¿Encebollado o ceviche hoy?", cuerpo: "Los dos son frescos.", pie: null, glifos_riesgosos: false },
  ],
  pie: "Tú dices. Nosotros lo servimos fresco en Olón", avisos: [], exige_casilla: true,
  jefatura: { resultado: "limpia", desacuerdos: ["imagen: no cumple el brief"], opinion_externa: null, revision_id: "r" }, aportes: [], version: 1, resumen_de_la_bandeja: "x",
}
const dibujar = (props: Partial<Parameters<typeof PanelPiezas>[0]> = {}) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA, piezaInicialDatos: DETALLE, ...props }))

describe("sprint 6.7 · el árbol de la bandeja (macro → micro)", () => {
  it("agrupa por cliente y por carpeta (tipo de pieza); el cliente con más por aprobar va primero, «Otras revisiones» al final y las pendientes arriba dentro de cada carpeta", () => {
    const arbol = arbolDeLaBandeja(PIEZAS, OTRAS)
    expect(arbol.map((c) => [c.nombre, c.por_aprobar, c.total])).toEqual([["Náufrago", 2, 3], ["Zero Risk Seguridad Industrial", 1, 3], ["Sin cliente", 0, 1]])
    expect(arbol[0].carpetas.map((k) => k.nombre)).toEqual(["Historias Instagram", CARPETA_OTRAS])
    expect(arbol[1].carpetas.map((k) => [k.nombre, k.por_aprobar, k.filas.map((f) => f.id)])).toEqual([["Carrusel Facebook", 1, ["p2", "a1", "s1"]]])
    expect(arbol[2]).toMatchObject({ id: null, nombre: "Sin cliente" })
    expect(CARPETA_OTRAS).toBe(CARPETA_OTRAS_DATOS) // la lectura y el panel usan el mismo nombre de carpeta
    expect(arbolDeLaBandeja([], [])).toEqual([])
  })
  it("la cuenta de una carpeta se dice en palabras", () => {
    expect(cuentaDeLaCarpeta({ por_aprobar: 2, total: 6 })).toBe("2 por aprobar · 6 en total")
    expect(cuentaDeLaCarpeta({ por_aprobar: 0, total: 1 })).toBe("1 pieza")
    expect(cuentaDeLaCarpeta({ por_aprobar: 0, total: 6 })).toBe("6 piezas")
  })
})

describe("sprint 6.7 · los textos editables viajan como UN pedido de cambios", () => {
  const e = (lamina: number | null, campo: Edicion["campo"], antes: string | null, despues: string): Edicion => ({ lamina, campo, antes, despues })
  it("una edición reemplaza la del mismo campo de la misma lámina; igual al original o vacía se descarta; quedan ordenadas por lámina y el pie al final", () => {
    let l = conEdicion([], e(2, "titular", "a", "b"))
    l = conEdicion(l, e(null, "pie", "p", "q"))
    l = conEdicion(l, e(1, "cuerpo", "c", "  d  "))
    expect(l.map((x) => [x.lamina, x.campo, x.despues])).toEqual([[1, "cuerpo", "d"], [2, "titular", "b"], [null, "pie", "q"]])
    expect(conEdicion(l, e(2, "titular", "a", "z")).find((x) => x.lamina === 2)?.despues).toBe("z")
    expect(conEdicion(l, e(2, "titular", "a", "a")).some((x) => x.lamina === 2)).toBe(false) // volvió al original: ya no es cambio
    expect(conEdicion(l, e(1, "cuerpo", "c", "   ")).some((x) => x.campo === "cuerpo")).toBe(false)
    expect(laminasDeLasEdiciones(l)).toEqual([1, 2]) // el pie no es de una lámina
  })
  it("el pedido lleva cada texto exacto (antes → después) y respeta el mínimo y el máximo del servidor", () => {
    const r = comentarioDeEdiciones([e(2, "titular", "¿Encebollado o ceviche hoy?", "¿Encebollado o ceviche?"), e(null, "pie", null, "Fresco en Olón")], "y la foto más cerca")
    expect(r).toEqual({ comentario: "Cambios de texto pedidos por el dueño (el texto final va exacto, sin reinterpretar):\n- Lámina 2 · Titular: cambiar «¿Encebollado o ceviche hoy?» por «¿Encebollado o ceviche?»\n- Pie de la publicación: poner «Fresco en Olón»\nAdemás: y la foto más cerca" })
    expect(comentarioDeEdiciones([], "corto")).toEqual({ error: expect.stringContaining("al menos 10 letras") })
    expect(comentarioDeEdiciones([e(1, "cuerpo", "a", "x".repeat(COMENTARIO_MAXIMO))], "")).toEqual({ error: expect.stringContaining(`${COMENTARIO_MAXIMO}`) })
    expect(comentarioDeEdiciones([], "la foto de la primera historia, más cerca")).toEqual({ comentario: "la foto de la primera historia, más cerca" })
  })
})

describe("sprint 6.7 · el panel", () => {
  it("cada texto de la lámina y el pie llevan «Editar» solo cuando la pieza sigue pendiente; nada se edita en el lugar: se suma al pedido de cambios", () => {
    const html = dibujar()
    expect([...html.matchAll(/data-campo-editar="([^"]+)"/g)].map((m) => m[1])).toEqual(["1-encabezado", "1-titular", "1-cuerpo", "pie-pie"])
    expect(html).toContain('data-campo="1-titular" data-editado="false"'); expect(html).toContain("¿Qué lleva el encebollado?"); expect(html).not.toContain("data-editor=") // el editor abre al pulsar
    const aprobada = dibujar({ piezaInicialDatos: { ...DETALLE, estado: "aprobada", status: "approved" } })
    expect(aprobada).not.toContain('data-accion="editar-texto"'); expect(aprobada).toContain("¿Qué lleva el encebollado?") // se lee igual, sin editar
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain("comentarioDeEdiciones(ediciones, comentario)") // el texto exacto va en el pedido de cambios
    expect(c).toContain("laminasDeLasEdiciones(ediciones)") // las láminas tocadas por una edición entran al alcance del pedido
    expect(c).toContain('data-accion="quitar-edicion"'); expect(c).toContain("El texto va exacto a la oficina creativa, que vuelve a dibujar la lámina.")
    expect(c).toContain("aprobar no los aplica") // aprobar con ediciones pendientes avisa que no se aplican
    expect(c).not.toMatch(/PATCH|laminas_armadas|\.update\(/) // ninguna escritura directa: solo la puerta de decidir
  })
  it("el explorador: árbol a la izquierda (el cliente enfocado y sus carpetas, con cuentas), barra de ruta, carpetas y tarjetas a la derecha; la pieza elegida ubica la ruta en su carpeta", () => {
    const carpeta = dibujar({ piezaInicialDatos: null, clienteInicial: PEREZ, carpetaInicial: "Carrusel Facebook" })
    expect(carpeta).toContain('data-nodo="cliente"'); expect(carpeta).not.toContain("data-nodo-cliente="); expect(carpeta).not.toContain("Todos los clientes") // el cliente lo elige la oficina, no este panel
    expect(carpeta).toContain('data-vista="piezas"'); expect([...carpeta.matchAll(/data-pieza="([^"]+)"/g)].map((m) => m[1])).toEqual(["p2", "a1", "s1"])
    expect(carpeta).toContain('data-nodo-carpeta="Carrusel Facebook" aria-current="true"'); expect(carpeta).toContain("Abre una para verla lámina por lámina.")
    const pieza = dibujar()
    expect(pieza).toMatch(/data-miga="cliente"[^>]*>Náufrago<\/button>.*data-miga="carpeta"[^>]*>Historias Instagram<\/button>.*data-miga="pieza"[^>]*>Historias Instagram · Náufrago · 31 oct<\/span>.*data-miga="lamina"[^>]*>lámina 1 de 2</s)
    expect(pieza).toContain('data-accion="volver-a-la-carpeta"'); expect(pieza).not.toContain('data-vista=')
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain("@media (prefers-reduced-motion:reduce)"); expect(c).toContain('window.addEventListener("keydown", tecla, true)')
  })
  it("los tres botones de la decisión son grandes y los secundarios no", () => {
    const c = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(c).toContain("const GRANDE = `${BOTON} px-6 py-3 text-[15px] font-medium`")
    for (const b of ["B_AMBAR", "B_SUAVE", "B_ROJO"]) expect(c).toMatch(new RegExp(`const ${b} = \`\\$\\{GRANDE\\}`))
    expect(c).toContain('data-accion="pieza-aprobar" onClick={() => abrir("aprobar")} className={B_AMBAR}')
    expect(c).toContain('data-accion="pieza-rechazar" onClick={() => abrir("rechazar")} className={B_ROJO}')
    expect(c).toMatch(/data-accion="pieza-pedir-cambios"[^\n]*className=\{`\$\{B_SUAVE\}/)
    const html = dibujar()
    expect(html).toMatch(/data-accion="pieza-aprobar" class="[^"]*px-6 py-3 text-\[15px\] font-medium/)
  })
})
