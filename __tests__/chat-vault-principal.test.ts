/**
 * 02-nov · CHAT de /nuevo · #149 · condiciones de la certificación de CC3: (1) el traspaso pasa por el filtro de secretos; (2) pruebas de `principal()` (el modo --seco no escribe, el retiro, los lotes) y del tope de 5 resultados.
 * US$ 0: la base va simulada (una función que registra las llamadas); no hay red ni llaves.
 */
import { describe, expect, it } from "vitest"
// @ts-expect-error módulo .mjs sin tipos
import { armarTraspaso, principal } from "../scripts/chat-vault/sincronizar.mjs"
// @ts-expect-error módulo .mjs sin tipos
import { shaDe } from "../scripts/chat-vault/nucleo.mjs"
import { buscarEnElVault } from "@/lib/chat-herramientas"

const LLAVE_FALSA = "sk-ant-api03-FALSAFALSAFALSAFALSAFALSA"
const BEARER_FALSO = "Bearer FALSOFALSOFALSOFALSOFALSOFALSO12"
const ahora = new Date("2026-11-02T08:30:00Z")
const arch = (ruta: string, cuerpo: string, modificado_en = "2026-11-02T07:00:00Z") => ({ ruta, cuerpo, modificado_en })
const NUCLEO = arch("00-meta/HANDOFF-chat-de-nuevo.md", "# Traspaso\nNúcleo fijo limpio.")

describe("el traspaso pasa por el filtro de secretos", () => {
  it("una marca con llave falsa en su última línea no entra al traspaso", () => {
    const om: string[] = []
    const t = armarTraspaso([NUCLEO, arch("raw/estado/CC2-marca", `ok\nusé ${LLAVE_FALSA} para probar`)], ahora, om)
    expect(t).not.toContain("FALSAFALSA")
    expect(t).toContain("(omitido: parece traer llave de api (sk-))")
    expect(om.join()).toMatch(/raw\/estado\/CC2-marca: parece traer/)
  })
  it("un título de decisión y la primera línea de un papel reciente con secreto tampoco", () => {
    const t = armarTraspaso([NUCLEO, arch("wiki/decisions/d.md", `# Decisión con ${BEARER_FALSO}`), arch("raw/tasks/2026-11-02-LISTO-CC2-x.md", `Texto con ${LLAVE_FALSA}`)], ahora)
    expect(t).not.toContain("FALSO")
    expect(t.match(/\(omitido: parece traer/g)?.length).toBe(2)
  })
  it("un núcleo fijo con secreto se reemplaza por un aviso", () => {
    const om: string[] = []
    const t = armarTraspaso([arch("00-meta/HANDOFF-chat-de-nuevo.md", `# T\n${BEARER_FALSO}`)], ahora, om)
    expect(t).not.toContain("FALSO")
    expect(t).toContain("El núcleo fijo no se incluyó")
    expect(om[0]).toMatch(/^núcleo fijo: parece traer/)
  })
  it("el texto limpio pasa tal cual", () => {
    const t = armarTraspaso([NUCLEO, arch("raw/estado/CC2-marca", "ok\nsin novedades")], ahora)
    expect(t).toContain("Núcleo fijo limpio.")
    expect(t).toContain("sin novedades")
    expect(t).not.toContain("omitido")
  })
})

type Llamada = { metodo: string; ruta: string; cuerpo?: Array<Record<string, unknown>> }
function base(existentes: Array<{ ruta: string; sha: string }> = [], fallaLeer = false) {
  const llamadas: Llamada[] = []
  const llamar = async (metodo: string, ruta: string, o?: { cuerpo?: Array<Record<string, unknown>> }) => {
    llamadas.push({ metodo, ruta, cuerpo: o?.cuerpo })
    if (metodo === "GET") { if (fallaLeer) throw new Error("GET chat_vault_docs → 404"); return existentes }
    return null
  }
  return { llamadas, llamar }
}
const A = arch("wiki/a.md", "# A\ncuerpo a")
const B = arch("wiki/b.md", "# B\ncuerpo b")

describe("principal() · modo --seco", () => {
  it("lee pero NO escribe nada: ni subidas ni retiros", async () => {
    const { llamadas, llamar } = base([{ ruta: "wiki/viejo.md", sha: "x" }])
    const log: string[] = []
    const r = await principal({ leer: () => [NUCLEO, A, B], llamar, seco: true, log: (m: string) => log.push(m) })
    expect(llamadas.map((l) => l.metodo)).toEqual(["GET"])
    expect(r.subir.length).toBeGreaterThan(0)
    expect(r.retirar).toEqual(["wiki/viejo.md"])
    expect(log.join("\n")).toMatch(/--seco: no se escribió nada/)
  })
  it("si la tabla aún no existe, el seco la simula vacía y sigue", async () => {
    const { llamadas, llamar } = base([], true)
    const r = await principal({ leer: () => [A], llamar, seco: true, log: () => {} })
    expect(llamadas.every((l) => l.metodo === "GET")).toBe(true)
    expect(r.subir.some((d: { ruta: string }) => d.ruta === "wiki/a.md")).toBe(true)
  })
})

describe("principal() · modo real", () => {
  it("sube en lotes de 25 con on_conflict=ruta, y el traspaso va entre lo que sube", async () => {
    const muchos = Array.from({ length: 60 }, (_, i) => arch(`wiki/d${i}.md`, `# D${i}\ncuerpo ${i}`))
    const { llamadas, llamar } = base()
    await principal({ leer: () => [NUCLEO, ...muchos], llamar, seco: false, log: () => {} })
    const posts = llamadas.filter((l) => l.metodo === "POST")
    expect(posts.map((p) => p.cuerpo?.length)).toEqual([25, 25, 12]) // 61 documentos de vault + el traspaso = 62
    expect(posts.every((p) => p.ruta.includes("on_conflict=ruta"))).toBe(true)
    expect(posts.flatMap((p) => p.cuerpo ?? []).some((d) => d.ruta === "traspaso")).toBe(true)
    expect(llamadas.some((l) => l.metodo === "DELETE")).toBe(false)
  })
  it("retira de la tabla lo que ya no está en el vault (con las rutas entre comillas) y nunca el traspaso", async () => {
    const { llamadas, llamar } = base([{ ruta: "wiki/a.md", sha: shaDe(A.cuerpo) }, { ruta: "wiki/borrado.md", sha: "x" }, { ruta: "traspaso", sha: "y" }])
    await principal({ leer: () => [A], llamar, seco: false, log: () => {} })
    const del = llamadas.filter((l) => l.metodo === "DELETE")
    expect(del.length).toBe(1)
    expect(decodeURIComponent(del[0].ruta)).toContain('"wiki/borrado.md"')
    expect(decodeURIComponent(del[0].ruta)).not.toContain("traspaso")
  })
  it("no resube lo que no cambió, ni el traspaso si su sha es el mismo", async () => {
    const t = armarTraspaso([A], new Date())
    const { llamadas, llamar } = base([{ ruta: "wiki/a.md", sha: shaDe(A.cuerpo) }, { ruta: "traspaso", sha: shaDe(t) }])
    await principal({ leer: () => [A], llamar, seco: false, log: () => {} })
    expect(llamadas.filter((l) => l.metodo === "POST")).toEqual([])
  })
  it("un archivo con secreto no sube, y si ya estaba subido se retira", async () => {
    const S = arch("raw/tasks/s.md", `clave ${LLAVE_FALSA}`)
    const { llamadas, llamar } = base([{ ruta: S.ruta, sha: "viejo" }])
    const log: string[] = []
    await principal({ leer: () => [A, S], llamar, seco: false, log: (m: string) => log.push(m) })
    expect(JSON.stringify(llamadas)).not.toContain("FALSAFALSA")
    expect(llamadas.filter((l) => l.metodo === "DELETE").map((l) => decodeURIComponent(l.ruta)).join()).toContain("raw/tasks/s.md")
    expect(log.join("\n")).not.toContain("FALSAFALSA")
  })
  it("un fallo al leer la tabla (sin --seco) se dice y se para: no escribe nada", async () => {
    const { llamadas, llamar } = base([], true)
    await expect(principal({ leer: () => [A], llamar, seco: false, log: () => {} })).rejects.toThrow(/404/)
    expect(llamadas.some((l) => l.metodo !== "GET")).toBe(false)
  })
})

describe("la búsqueda devuelve como máximo 5 resultados", () => {
  it("con 8 coincidencias pide y entrega 5", async () => {
    const filas = Array.from({ length: 8 }, (_, i) => ({ ruta: `wiki/p${i}.md`, titulo: `Plan ${i}`, cuerpo: "el plan", modificado_en: null, actualizado_en: null }))
    let pedido: number | undefined
    const q: Record<string, unknown> = {}
    for (const k of ["select", "neq", "order", "textSearch"]) q[k] = () => q
    q.limit = (n: number) => { pedido = n; return q }
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: filas.slice(0, pedido ?? 99), error: null }).then(ok)
    const r = JSON.parse(await buscarEnElVault("plan", { svc: { from: () => q } as never, plataforma: { leer: async () => null } }))
    expect(pedido).toBe(5)
    expect(r.resultados.length).toBe(5)
  })
})
