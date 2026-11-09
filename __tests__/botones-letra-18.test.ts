/** 09-nov · GO de Lenovo: la letra de TODOS los botones (ámbar y de borde oro) es 18, peso medio; el costo junto al botón sigue en 13. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO } from "@/components/nuevo/EstiloBase"
import { claseDelCosto } from "@/lib/estudio"

const clases = (s: string) => s.split(/\s+/)
const estudio = readFileSync("components/nuevo/PanelEstudio.tsx", "utf8")
const etiqueta = (src: string, marca: string) => { const i = src.indexOf(marca); const a = src.lastIndexOf("<button", i); return src.slice(a, src.indexOf(">", src.indexOf("className", a))) }

describe("el token y las constantes", () => {
  it("text-boton = 18 en el archivo único de tokens", () => {
    expect(readFileSync("app/estilo-base.css", "utf8")).toContain("--text-boton: 18px;")
  })
  it("los dos botones del estilo base: 18 y peso medio; ya no 15", () => {
    for (const b of [BOTON_PRINCIPAL, BOTON_SECUNDARIO]) { expect(clases(b)).toEqual(expect.arrayContaining(["text-boton", "font-medio"])); expect(clases(b)).not.toContain("text-cuerpo") }
  })
  it("«Baja para leer todo y firmar» (borde oro) también", () => {
    const editor = readFileSync("components/nuevo/EditorDeCifra.tsx", "utf8")
    expect(clases(etiqueta(editor, "data-baja-para-firmar"))).toEqual(expect.arrayContaining(["text-boton", "font-medio"]))
  })
})

describe("el Estudio (archivos de CC3, con su visto)", () => {
  it("«Crear»: 18 medio, sin la excepción vieja y sin perder el centrado", () => {
    const t = etiqueta(estudio, "data-crear ")
    expect(clases(t)).toEqual(expect.arrayContaining(["text-boton", "font-medio", "rounded-control"]))
    expect(t).not.toMatch(/text-\[15px\]|font-bold|estilo-ok/); expect(t).toContain("${claseDelCentrado(boton.costo)}")
  })
  it("«Animar»: 18 medio", () => {
    const t = etiqueta(estudio, "data-animar-crear")
    expect(clases(t)).toEqual(expect.arrayContaining(["text-boton", "font-medio"])); expect(t).not.toMatch(/text-\[14px\]|font-bold/)
  })
  it("el costo junto al botón queda en 13 (dato), en los dos", () => {
    expect(clases(claseDelCosto("≈ US$ 0,014"))).toContain("text-dato")
    expect(estudio).toContain('<span data-costo-animar className="text-dato font-medio opacity-90">')
  })
})

describe("en todo /nuevo ningún botón ámbar o de borde oro queda fuera de 18", () => {
  it("la revisión completa no encuentra ninguno", () => {
    const r = JSON.parse(execFileSync(process.execPath, ["scripts/revisar-estilo.mjs", "todo"], { encoding: "utf8" }))
    expect(Object.keys(r.porRegla).filter((k) => k.startsWith("botón"))).toEqual([])
  }, 60_000)
})
