import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { leerRevisionesDelEditor, limpiarParaLeer, sinMonologo } from "@/lib/revisiones-del-manual"

const CRUDO = [
  "Analizando la evidencia y preparando la sección del brand book como «content-creator». Sección emitida. El consolidador ya la tiene. Aquí el resumen de lo que construí y por qué:",
  "- Cambié la promesa principal para el segmento S3 (S1–S5) porque el cliente ideal (ICP) pide rapidez.",
  "**Por qué:** el texto anterior hablaba de precio y no de tiempo.",
].join("\n")
const L = limpiarParaLeer

describe("CC4 · revisión del editor · solo qué cambió y por qué", () => {
  const t = L(sinMonologo(CRUDO))
  it("no queda monólogo, códigos de segmento ni nombres técnicos", () => {
    expect(t).not.toMatch(/Analizando|Sección emitida|consolidador|Aquí el resumen/i)
    expect(t).not.toMatch(/\bS[1-5]\b|ICP|content-creator|brand book/)
  })
  it("sí queda lo que cambió y por qué, con frases simples", () => {
    expect(t).toContain("Cambié la promesa principal para el segmento porque el cliente ideal pide rapidez.")
    expect(t).not.toContain("cliente ideal (cliente ideal)"); expect(t).not.toContain("el ese segmento")
    expect(t).toContain("**Por qué:** el texto anterior hablaba de precio y no de tiempo.")
  })
  it("el aviso dice «Te llega para que lo veas; nadie marcó un problema.»", () => {
    const s = readFileSync("lib/revisiones-del-manual.ts", "utf8")
    expect(s).toContain("Te llega para que lo veas; nadie marcó un problema.")
    expect(s).not.toContain("los revisores no respondieron")
  })
})

describe("CC4 · limpiarParaLeer · una prueba por regla", () => {
  it("monólogo: «Analizando», «Sección emitida», «Aquí está/va/el resumen» (con tilde incluida)", () => {
    expect(L("Analizando todo. Cambié el título.")).toBe("Cambié el título.")
    expect(L("Sección emitida. Cambié el título.")).toBe("Cambié el título.")
    expect(L("Aquí está el resumen. Cambié el título.")).toBe("Cambié el título.")
    expect(L("Aquí el resumen de lo que construí: Cambié el título.")).toBe("Cambié el título.")
  })
  it("códigos S1–S9 sueltos, en rango, entre paréntesis y tras «segmento»", () => {
    expect(L("Aplica a S4 y S2.")).toBe("Aplica a ese segmento y ese segmento.")
    expect(L("Aplica a S1–S5 por igual.")).toBe("Aplica a los segmentos por igual.")
    expect(L("Aplica al cliente (S1, S2) por igual.")).toBe("Aplica al cliente por igual.")
    expect(L("Para el segmento S3 sube.")).toBe("Para el segmento sube.")
  })
  it("sin artículos duplicados: «el S3» → «ese segmento»; «Amazon S3» no es un segmento", () => {
    expect(L("Cambió el S3 mucho.")).toBe("Cambió ese segmento mucho.")
    expect(L("Se guarda en Amazon S3.")).toBe("Se guarda en Amazon S3.")
  })
  it("ICP: suelto → «cliente ideal»; repetido entre paréntesis se quita", () => {
    expect(L("Pensando en el ICP.")).toBe("Pensando en el cliente ideal.")
    expect(L("El cliente ideal (ICP) pide rapidez.")).toBe("El cliente ideal pide rapidez.")
  })
  it("nombres técnicos: empleados → «el equipo» (y «del el equipo» queda «del equipo»), consolidador, brand book", () => {
    expect(L("Lo hizo content-creator.")).toBe("Lo hizo el equipo.")
    expect(L("Es la voz del content-creator.")).toBe("Es la voz del equipo.")
    expect(L("Lo vio el consolidador.")).toBe("Lo vio el equipo.")
    expect(L("Va al brand book.")).toBe("Va al manual de la marca.")
  })
  it("las viñetas y negritas se conservan", () => {
    expect(L("- uno\n- dos\n**Por qué:** x")).toBe("- uno\n- dos\n**Por qué:** x")
  })
})

describe("CC4 · la limpieza se usa en el armado real de la revisión", () => {
  const base = (tablas: Record<string, Array<Record<string, unknown>>>) => ({ from: (t: string) => {
    let d = [...(tablas[t] ?? [])]
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit", "gte"]) q[m] = () => q
    q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
    q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
    return q
  } }) as never
  it("leerRevisionesDelEditor entrega el texto ya limpio y el aviso simple", async () => {
    const r = await leerRevisionesDelEditor(base({
      hitl_queue: [{ id: "a", client_id: "c1", type: "editor_escalation", documento: "manual", status: "pending", created_at: "2026-11-03T13:00:00Z", agent_name: "content-creator",
        metadata: { editor: { full_content: CRUDO, original_task: "", editor_verdict: { issues: ["editor-en-jefe unavailable"] } } } }],
      agent_invocations: [],
    }), "c1", (k: string) => ({ clave: k, etiqueta: k }))
    expect(r[0].texto).not.toMatch(/Analizando|consolidador|S3|ICP|brand book/)
    expect(r[0].texto).toContain("para el segmento porque el cliente ideal pide rapidez")
    expect(r[0].pista).toBe("Te llega para que lo veas; nadie marcó un problema.")
  })
})
