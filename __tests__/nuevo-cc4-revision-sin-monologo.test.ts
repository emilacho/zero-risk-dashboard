import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { limpiarParaLeer, sinMonologo } from "@/lib/revisiones-del-manual"

const CRUDO = [
  "Analizando la evidencia y preparando la sección del brand book como «content-creator». Sección emitida. El consolidador ya la tiene. Aquí el resumen de lo que construí y por qué:",
  "- Cambié la promesa principal para el segmento S3 (S1–S5) porque el cliente ideal (ICP) pide rapidez.",
  "**Por qué:** el texto anterior hablaba de precio y no de tiempo.",
].join("\n")

describe("CC4 · revisión del editor · solo qué cambió y por qué", () => {
  const t = limpiarParaLeer(sinMonologo(CRUDO))
  it("no queda monólogo, códigos de segmento ni nombres técnicos", () => {
    expect(t).not.toMatch(/Analizando|Sección emitida|consolidador|Aquí el resumen/i)
    expect(t).not.toMatch(/\bS[1-5]\b|ICP|content-creator|brand book/)
  })
  it("sí queda lo que cambió y por qué, con frases simples", () => {
    expect(t).toContain("Cambié la promesa principal")
    expect(t).toContain("cliente ideal")
    expect(t).not.toContain("cliente ideal (cliente ideal)"); expect(t).not.toContain("el ese segmento"); expect(t).toContain("para el segmento porque")
    expect(t).toContain("**Por qué:** el texto anterior hablaba de precio y no de tiempo.")
  })
  it("el aviso dice «Te llega para que lo veas; nadie marcó un problema.»", () => {
    const s = readFileSync("lib/revisiones-del-manual.ts", "utf8")
    expect(s).toContain("Te llega para que lo veas; nadie marcó un problema.")
    expect(s).not.toContain("los revisores no respondieron")
  })
})
