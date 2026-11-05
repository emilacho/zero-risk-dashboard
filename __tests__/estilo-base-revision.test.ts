/**
 * ESTILO BASE (aprobado por Emilio 2026-11-05 · guía zr-vault `00-meta/ESTILO-DASHBOARD.md`): los tokens viven en un solo archivo y una revisión
 * automática en CI rechaza colores, tamaños, pesos, radios y sombras fuera de ellos en lo nuevo o tocado de /nuevo (y entero en lo ya migrado).
 */
import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const tokens = readFileSync("app/estilo-base.css", "utf8")
const ci = readFileSync(".github/workflows/ci.yml", "utf8")

describe("estilo base · los tokens", () => {
  it("los colores son exactamente los de la guía", () => {
    for (const [k, v] of Object.entries({ carbon: "#0d0e10", grafito: "#141519", "grafito-2": "#18191e", hueso: "#e9e7e2", gris: "#a3a2a8", apagado: "#6c6c74", oro: "#d6aa64", ambar: "#e8731a", alarma: "#d9534a" })) expect(tokens, k).toContain(`--color-${k}: ${v};`)
    expect(tokens.match(/--color-[\w-]+:/g)).toHaveLength(14) // 9 de la guía + letra sobre el ámbar + 3 líneas + el velo: ningún otro
  })
  it("4 tamaños + los 2 de número, 2 pesos y los radios de la guía", () => {
    for (const [k, v] of Object.entries({ titulo: 20, cuerpo: 15, dato: 13, rotulo: 11, cifra: 24, numero: 36 })) expect(tokens, k).toContain(`--text-${k}: ${v}px;`)
    expect(tokens.match(/--text-[\w]+:/g)).toHaveLength(6)
    expect(tokens).toContain("--font-weight-medio: 500;")
    for (const [k, v] of Object.entries({ panel: 20, tarjeta: 14, control: 12 })) expect(tokens, k).toContain(`--radius-${k}: ${v}px;`)
  })
  it("se cargan en toda la aplicación", () => {
    expect(readFileSync("app/globals.css", "utf8").split("\n").slice(0, 3).join("\n")).toContain('@import "./estilo-base.css";')
  })
})

describe("estilo base · la revisión automática", () => {
  it("cada regla frena su caso, deja pasar los tokens y no acepta permisos sin razón", () => {
    expect(execFileSync(process.execPath, ["scripts/revisar-estilo.mjs", "probar"], { encoding: "utf8" })).toMatch(/^ok · \d+ frenan, \d+ pasan, 2 permisos sin razón no valen/)
  })
  it("las pantallas migradas están limpias enteras", () => {
    const s = readFileSync("scripts/revisar-estilo.mjs", "utf8")
    for (const f of ["components/nuevo/EstiloBase.tsx", "components/nuevo/PanelRiesgos.tsx", "components/nuevo/PanelDecisiones.tsx", "components/nuevo/EditorDeCifra.tsx"]) expect(s, f).toContain(`"${f}"`)
  })
  it("corre en CI con la historia completa (sin base no revisa a ciegas)", () => {
    expect(ci).toMatch(/actions\/checkout@v4\s+with:\s+fetch-depth: 0/)
    expect(ci).toContain("node scripts/revisar-estilo.mjs diff origin/main")
  })
})

describe("estilo base · la campana roja con su número abre Riesgos", () => {
  it("el número: abiertos; «+» si la lista puede estar incompleta; nada sin lectura o sin riesgos (nunca un «0» falso)", async () => {
    const { numeroDeLaCampana, cuentaDeLaCampana } = await import("@/lib/direccion-riesgos")
    expect(numeroDeLaCampana(null)).toBeNull()
    expect(numeroDeLaCampana({ abiertos: 0, graves: 0, completo: true })).toBeNull()
    expect(numeroDeLaCampana({ abiertos: 0, graves: 0, completo: false })).toBe("?")
    expect(numeroDeLaCampana({ abiertos: 3, graves: 1, completo: true })).toBe("3")
    expect(numeroDeLaCampana({ abiertos: 140, graves: 0, completo: true })).toBe("99")
    expect(cuentaDeLaCampana({ total: 4, por_gravedad: { 1: 1, 2: 2, 3: 1 }, completo: true })).toEqual({ abiertos: 4, graves: 1, completo: true })
  })
  it("rojo solo si hay algo grave; oro si no; y la escena le pasa su lectura", async () => {
    const { createElement } = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { CampanaDeRiesgos } = await import("@/components/nuevo/BotonesDelMarco")
    const pinta = (graves: number) => renderToStaticMarkup(createElement(CampanaDeRiesgos, { className: "x", cuentaInicial: { abiertos: 3, graves, completo: true }, children: "🔔" }))
    expect(pinta(1)).toMatch(/data-numero-campana[^>]*bg-alarma[^>]*>3</); expect(pinta(0)).toMatch(/data-numero-campana[^>]*bg-oro[^>]*>3</)
    expect(renderToStaticMarkup(createElement(CampanaDeRiesgos, { className: "x", children: "🔔" }))).not.toContain("data-numero-campana")
    expect(readFileSync("components/nuevo/MarcoNuevo.tsx", "utf8")).toContain("<CampanaDeRiesgos className={ICONO_SUPERIOR}><Bell size={17} /></CampanaDeRiesgos>")
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain("window.dispatchEvent(new CustomEvent(EVENTO_RIESGOS_LEIDOS, { detail: cuentaDeLaCampana(j) }))")
  })
})
