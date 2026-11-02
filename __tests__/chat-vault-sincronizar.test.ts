/**
 * 02-nov · CHAT de /nuevo · ADENDA 3 · lo que sube el vault a Supabase: lista blanca, filtro de secretos, subir solo lo que cambió, traspaso sin editar a mano. US$ 0, sin red ni llaves.
 */
import { describe, expect, it } from "vitest"
// @ts-expect-error módulo .mjs sin tipos
import { motivoDeSecreto, planDeSubida, rutaPermitida, shaDe, tituloDe, TOPE_BYTES } from "../scripts/chat-vault/nucleo.mjs"
// @ts-expect-error módulo .mjs sin tipos
import { armarParteViva, armarTraspaso } from "../scripts/chat-vault/sincronizar.mjs"

describe("lista blanca de rutas", () => {
  it("sube solo .md de las carpetas permitidas", () => {
    for (const r of ["00-meta/ADR-020.md", "wiki/decisions/x.md", "raw/tasks/a.md", "raw/estado/CC2-marca.md", "runbooks/r.md", "projects/p/q.md", "areas/a.md"]) expect(rutaPermitida(r)).toBe(true)
    for (const r of ["00-meta/credentials/llaves.md", "00-meta/credentials/sub/a.md", "raw/findings/x.md", "raw/tasks/a.txt", "README.md", "../fuera.md", "wiki/../raw/x.md", ".obsidian/p.md", "wiki/.git/x.md", "raw/tasks/img.png"]) expect(rutaPermitida(r)).toBe(false)
  })
  it("las marcas de los CC (sin extensión) suben; otros archivos sin extensión no", () => {
    expect(rutaPermitida("raw/estado/CC2-marca")).toBe(true)
    expect(rutaPermitida("raw/estado/CC2-otra-cosa")).toBe(false)
    expect(rutaPermitida("wiki/CC2-marca")).toBe(false)
  })
  it("las barras invertidas de Windows se normalizan", () => {
    expect(rutaPermitida("wiki\\decisions\\x.md")).toBe(true)
    expect(rutaPermitida("00-meta\\credentials\\x.md")).toBe(false)
  })
})

describe("filtro de secretos", () => {
  const casos: Array<[string, string]> = [
    ["llave de api (sk-)", "usa sk-ant-api03-abcdefghijklmnopqrstuvwx para entrar"],
    ["token JWT (eyJ)", "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk"],
    ["encabezado Bearer", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"],
    ["llave privada", "-----BEGIN RSA PRIVATE KEY-----\nMIIE"],
    ["token de GitHub", "ghp_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["token de Slack", "xoxb-1234567890-abcdefghij"],
    ["llave de AWS", "AKIAABCDEFGHIJKLMNOP"],
    ["llave de servicio asignada", "service_role: eyabcdefghijklmnopqrstuvwxyz"],
    ["contraseña asignada", "password = Zx9fQ2mLp7Rt"],
    ["contraseña asignada", 'api_key: "AbCdEf1234567890"'],
  ]
  for (const [motivo, texto] of casos) it(`detecta: ${motivo}`, () => expect(motivoDeSecreto(texto)).toBe(motivo))
  it("el motivo nunca trae el valor", () => {
    expect(motivoDeSecreto("sk-ant-api03-abcdefghijklmnopqrstuvwx")).not.toContain("abcdefgh")
  })
  it("texto normal y marcadores de posición no se toman por secreto", () => {
    for (const t of ["La llave se guarda en Doppler, nunca en el vault.", "password: <tu_clave>", "token: ${TOKEN}", "api_key: xxxxxxxxxxxxxxxx", "Decisión: usar zero-risk-platform y mission-control.", "password: ******", "El token expira cada 12 horas.", ""]) expect(motivoDeSecreto(t)).toBeNull()
  })
})

describe("plan de subida", () => {
  const A = { ruta: "wiki/a.md", cuerpo: "# Título A\nhola", modificado_en: "2026-11-02T00:00:00Z" }
  const B = { ruta: "raw/tasks/b.md", cuerpo: "# B\ncuerpo", modificado_en: "2026-11-02T00:00:00Z" }
  it("sube lo nuevo y lo cambiado; no sube lo que ya tiene el mismo sha", () => {
    const p = planDeSubida([A, B], [{ ruta: A.ruta, sha: shaDe(A.cuerpo) }])
    expect(p.subir.map((x: { ruta: string }) => x.ruta)).toEqual([B.ruta])
    const q = planDeSubida([{ ...A, cuerpo: A.cuerpo + " más" }, B], [{ ruta: A.ruta, sha: shaDe(A.cuerpo) }, { ruta: B.ruta, sha: shaDe(B.cuerpo) }])
    expect(q.subir.map((x: { ruta: string }) => x.ruta)).toEqual([A.ruta])
  })
  it("el título sale del primer encabezado o del nombre del archivo", () => {
    expect(tituloDe("wiki/a.md", "texto\n# Mi título\n")).toBe("Mi título")
    expect(tituloDe("wiki/sin-titulo.md", "solo texto")).toBe("sin-titulo")
  })
  it("retira de la tabla lo que ya no está en el vault, salvo el traspaso", () => {
    const p = planDeSubida([A], [{ ruta: A.ruta, sha: shaDe(A.cuerpo) }, { ruta: "wiki/borrado.md", sha: "x" }, { ruta: "traspaso", sha: "y" }])
    expect(p.retirar).toEqual(["wiki/borrado.md"])
  })
  it("un archivo con secreto NO sube, se anota sin el valor, y si ya estaba subido se retira", () => {
    const S = { ruta: "raw/tasks/s.md", cuerpo: "clave sk-ant-api03-abcdefghijklmnopqrstuvwx", modificado_en: null }
    const p = planDeSubida([S, A], [{ ruta: S.ruta, sha: "viejo" }])
    expect(p.subir.map((x: { ruta: string }) => x.ruta)).toEqual([A.ruta])
    expect(p.retirar).toEqual([S.ruta])
    const nota = p.saltados.find((x: { ruta: string }) => x.ruta === S.ruta)
    expect(nota.motivo).toMatch(/^parece traer/)
    expect(JSON.stringify(p.saltados)).not.toContain("abcdefghijklmnopqrstuvwx")
  })
  it("fuera de la lista blanca y por tamaño se saltan", () => {
    const grande = { ruta: "wiki/grande.md", cuerpo: "a".repeat(TOPE_BYTES + 1), modificado_en: null }
    const fuera = { ruta: "00-meta/credentials/x.md", cuerpo: "hola", modificado_en: null }
    const p = planDeSubida([grande, fuera, A], [])
    expect(p.subir.map((x: { ruta: string }) => x.ruta)).toEqual([A.ruta])
    expect(p.saltados.map((x: { motivo: string }) => x.motivo).sort()).toEqual(["fuera de la lista blanca", "pasa el tope de tamaño"])
  })
})

describe("traspaso vivo", () => {
  const ahora = new Date("2026-11-02T08:30:00Z")
  const A = [
    { ruta: "00-meta/HANDOFF-chat-de-nuevo.md", cuerpo: "# Traspaso\nNúcleo fijo.", modificado_en: "2026-11-01T00:00:00Z" },
    { ruta: "raw/estado/CC2-marca", cuerpo: "l1\nl2 última línea de CC2", modificado_en: "2026-11-02T08:00:00Z" },
    { ruta: "wiki/decisions/d1.md", cuerpo: "# Decisión uno", modificado_en: "2026-11-02T07:00:00Z" },
    { ruta: "raw/tasks/2026-11-02-LISTO-CC2-x.md", cuerpo: "[FROM-CC2] LISTO algo", modificado_en: "2026-11-02T07:30:00Z" },
    { ruta: "raw/tasks/2026-10-01-LISTO-CC2-viejo.md", cuerpo: "viejo", modificado_en: "2026-10-01T00:00:00Z" },
  ]
  it("une el núcleo fijo con una parte viva armada por el script", () => {
    const t = armarTraspaso(A, ahora)
    expect(t).toContain("Núcleo fijo.")
    expect(t).toContain("Parte viva")
    expect(t).toContain("l2 última línea de CC2")
    expect(t).toContain("Decisión uno")
    expect(t).toContain("2026-11-02-LISTO-CC2-x")
    expect(t).not.toContain("viejo")
  })
  it("la parte viva no cambia por minuto (solo por hora): no reescribe la fila cada 3 minutos", () => {
    const a = armarParteViva(A, new Date("2026-11-02T08:30:00Z")), b = armarParteViva(A, new Date("2026-11-02T08:33:00Z"))
    expect(a).toBe(b)
  })
  it("sin el núcleo fijo lo dice en vez de inventarlo", () => {
    expect(armarTraspaso([], ahora)).toContain("Falta el núcleo fijo")
  })
})
