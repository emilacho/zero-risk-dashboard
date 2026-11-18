/** 18-nov · la vista limpia del brief (GO Lenovo 13:08Z · CC5): con el brief REAL de Náufrago `36e66179` v1 (cadena_brief_creativo id 11, 14 942 caracteres) */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { describe, expect, it } from "vitest"
import { briefLimpio, SECCIONES_INTERNAS_DEL_BRIEF } from "@/lib/brief-limpio"
import { seccionesDelBrief } from "@/lib/brief"

const LEE = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n")
const REAL = LEE("__tests__/fixtures/brief-real-36e66179-v1.md")
const titulos = (md: string) => md.split("\n").filter((l) => /^## /.test(l)).map((l) => l.slice(3))

describe("vista limpia del brief · el brief real de Náufrago", () => {
  const limpio = briefLimpio(REAL)
  it("🔴 no se escapa ninguna marca del sistema", () => {
    expect(limpio).not.toMatch(/brf-[0-9a-f]+-v\d+/)
    expect(limpio).not.toMatch(/\*\((?:fuente|fundado en)/i)
    expect(limpio).not.toMatch(/no cita literal/i)
    expect(limpio).not.toMatch(/\((?:aporte\s+)?A\d+\)/)
    expect(limpio).not.toMatch(/\bA\d+\b/)
  })
  it("🔴 se van «Citas» y «De qué parte del plan sale»; las demás secciones quedan, en su orden", () => {
    // los nombres escritos aquí, no tomados del código: si alguien saca una de la lista, esto lo ve
    expect(SECCIONES_INTERNAS_DEL_BRIEF).toEqual(["Citas", "De qué parte del plan sale"])
    for (const s of ["Citas", "De qué parte del plan sale"]) { expect(titulos(REAL)).toContain(s); expect(titulos(limpio)).not.toContain(s) }
    expect(titulos(limpio)).toEqual(titulos(REAL).map((t) => t.replace(/ · brf-.*$/, "")).filter((t) => !(SECCIONES_INTERNAS_DEL_BRIEF as readonly string[]).includes(t)))
    expect(titulos(limpio)).toContain("Faltantes")
    expect(titulos(limpio)).toContain("Contradicciones plan vs manual")
    expect(seccionesDelBrief(limpio).length).toBeGreaterThan(10)
  })
  it("🔴 no se come texto humano: cada línea que queda es una línea del brief, solo sin sus marcas", () => {
    const original = new Set(REAL.split("\n").map((l) => l.trim()))
    const sinMarcas = (l: string) => l.replace(/\s*\*\((?:fuente|fundado en|resumen, no cita literal)\b[^\n]*?\)\*/gi, "").replace(/\s*\((?:aporte\s+)?A\d+\)/g, "").replace(/\s*·\s*brf-[0-9a-f]+-v\d+\s*$/i, "").trim()
    const posibles = new Set([...original].map(sinMarcas))
    for (const l of limpio.split("\n").map((x) => x.trim()).filter(Boolean)) expect(posibles.has(l), l.slice(0, 80)).toBe(true)
    expect(limpio).toContain("El mejor encebollado que he comido")
  })
  it("🔴 la versión interna no cambia (la cadena y los chequeos la leen entera)", () => {
    const antes = crypto.createHash("sha256").update(REAL).digest("hex")
    briefLimpio(REAL)
    expect(crypto.createHash("sha256").update(REAL).digest("hex")).toBe(antes)
  })
})

describe("vista limpia del brief · reglas", () => {
  it("🔴 una fuente nombrada en la prosa se queda; solo se quita el paréntesis-marca", () => {
    const md = "## Insight\n\nSegún el plan v3 la gente pide por WhatsApp. *(fuente: 4996c6c2)*\n"
    expect(briefLimpio(md)).toBe("## Insight\n\nSegún el plan v3 la gente pide por WhatsApp.")
  })
  it("🔴 dos marcas en la misma línea: se van las dos y la prosa del medio queda", () => {
    expect(briefLimpio("## Público\n\nVecinos de Olón *(fuente: sede:efe5a9d5)* y turistas de fin de semana *(fuente: 4996c6c2)*.")).toBe("## Público\n\nVecinos de Olón y turistas de fin de semana.")
  })
  it("🔴 la marca de resumen se va y la prosa queda", () => {
    expect(briefLimpio("## Tono\n\nCercano y directo. *(resumen, no cita literal del manual)*")).toBe("## Tono\n\nCercano y directo.")
  })
  it("🔴 un «A» que no es código de aporte se queda", () => {
    expect(briefLimpio("## Objetivo\n\nPlan A y plan B para la zona A.")).toBe("## Objetivo\n\nPlan A y plan B para la zona A.")
  })
  it("🔴 un ### dentro de «Citas» no la corta; el siguiente ## sí (🟡 CC7 22:40Z)", () => {
    expect(briefLimpio("## Insight\n\nUno.\n\n## Citas\n\n### Aporte A1\n\ntexto interno\n\n## Tono\n\nCercano.")).toBe("## Insight\n\nUno.\n\n## Tono\n\nCercano.")
    expect(briefLimpio("## Tono\n\n### Matiz\n\nCercano.")).toBe("## Tono\n\n### Matiz\n\nCercano.")
  })
  it("🔴 el nombre de la sección interna vale en mayúsculas o sin tilde (🟡 d12 CC7)", () => {
    expect(briefLimpio("## Tono\n\nCercano.\n\n## CITAS\n\ninterno\n\n## De que parte del plan sale\n\ninterno 2\n\n## Objetivo\n\nVender.")).toBe("## Tono\n\nCercano.\n\n## Objetivo\n\nVender.")
  })
  it("🔴 vacío o nulo no rompe", () => {
    expect(briefLimpio(null)).toBe("")
    expect(briefLimpio("")).toBe("")
  })
})

describe("vista limpia del brief · dónde lo ve Emilio", () => {
  it("🔴 el panel «Brief de campaña» pinta el brief limpio, no `texto_md` crudo", () => {
    const t = LEE("components/nuevo/PanelBrief.tsx")
    expect(t).toMatch(/prosa=\{briefLimpio\(brief\.texto_md\)\}/)
    expect(t).not.toMatch(/prosa=\{brief\.texto_md\}/)
  })
  it("🔴 el visor del concepto (bandeja de Piezas) también", () => {
    const t = LEE("app/piezas/VisorDeConcepto.tsx")
    expect(t).toMatch(/\{briefLimpio\(concepto\.brief\.texto_md\)\}/)
    expect(t).not.toMatch(/\{concepto\.brief\.texto_md\}/)
  })
})
