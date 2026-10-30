/**
 * 30-oct · la ficha del cliente cayó en producción con «Functions cannot be passed directly to Client Components» (digest 3045634972):
 * una página SERVIDOR le pasó una función (`alTerminar`) a un componente cliente. Esta prueba lee todas las páginas servidor y no deja que vuelva a pasar.
 */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

function archivos(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) archivos(p, out)
    else if (/\.(tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const RAIZ = path.resolve(__dirname, "..")
const servidor = archivos(path.join(RAIZ, "app")).filter((f) => !/^\s*(\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(fs.readFileSync(f, "utf8")))

describe("las páginas servidor no pasan funciones a los componentes cliente", () => {
  it("hay páginas servidor que revisar", () => { expect(servidor.length).toBeGreaterThan(3) })
  it("ninguna página servidor usa `alTerminar={…}` (es una función): usan irA o irAConIdDe", () => {
    const malas = servidor.filter((f) => /\balTerminar=\{/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(RAIZ, f))
    expect(malas).toEqual([])
  })
  it("ninguna página servidor pasa una flecha como valor de una propiedad de un componente (`prop={(…) =>`)", () => {
    const malas = servidor.filter((f) => /<[A-Z]\w*[^>]*\s[a-z]\w*=\{\s*(async\s*)?\([^)]*\)\s*=>/.test(fs.readFileSync(f, "utf8")))
    expect(malas.map((f) => path.relative(RAIZ, f))).toEqual([])
  })
})
