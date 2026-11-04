/** LAS LETRAS VIVEN EN EL PROYECTO (CC6 · 03-nov · encargo de Lenovo): `next/font/google` falló 3 veces hoy al compilar (GitHub y Vercel). US$ 0. */
import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const archivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === "node_modules" || n.startsWith(".") ? [] : archivos(p)) : /\.(tsx?|css)$/.test(n) ? [p] : [] })

describe("ninguna letra se baja de Google al compilar", () => {
  it("nadie importa `next/font/google` (app, components, lib)", () => {
    const con = ["app", "components", "lib"].flatMap(archivos).filter((p) => /from ["']next\/font\/google["']/.test(readFileSync(p, "utf8")))
    expect(con).toEqual([])
  })
  it("el diseño raíz carga las 4 familias desde app/letras, con las mismas variables y pesos de antes", () => {
    const l = readFileSync("app/layout.tsx", "utf8")
    expect(l).toContain('import localFont from "next/font/local"')
    for (const [archivo, peso, variable] of [["inter-latin-var", "100 900", "--font-inter"], ["jetbrains-mono-latin-var", "100 800", "--font-mono"], ["space-grotesk-latin-var", "400 700", "--font-display"], ["permanent-marker-latin-400", "400", "--font-marker"]]) {
      expect(l).toMatch(new RegExp(`path: "\\./letras/${archivo}\\.woff2", weight: "${peso}"[^}]*\\}\\],\\s*variable: "${variable}"`))
      const b = readFileSync(`app/letras/${archivo}.woff2`)
      expect(b.subarray(0, 4).toString("latin1"), archivo).toBe("wOF2"); expect(b.length, archivo).toBeGreaterThan(10_000)
    }
  })
})
