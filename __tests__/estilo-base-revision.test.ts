/**
 * ESTILO BASE (aprobado por Emilio 2026-11-05 · guía zr-vault `00-meta/ESTILO-DASHBOARD.md`): los tokens viven en un solo archivo y una revisión
 * automática en CI rechaza colores, tamaños, pesos, radios y sombras fuera de ellos en lo nuevo o tocado de /nuevo (y entero en lo ya migrado).
 */
import { afterAll, describe, expect, it } from "vitest"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const tokens = readFileSync("app/estilo-base.css", "utf8")
const ci = readFileSync(".github/workflows/ci.yml", "utf8")

describe("estilo base · los tokens", () => {
  it("los colores son exactamente los de la guía", () => {
    for (const [k, v] of Object.entries({ carbon: "#0d0e10", grafito: "#141519", "grafito-2": "#18191e", hueso: "#e9e7e2", gris: "#a3a2a8", apagado: "#818189", oro: "#d6aa64", ambar: "#e8731a", alarma: "#d9534a" })) expect(tokens, k).toContain(`--color-${k}: ${v};`)
    expect(tokens.match(/--color-[\w-]+:/g)).toHaveLength(15) // 9 de la guía + letra sobre el ámbar + 3 líneas + el velo + la tarjeta sobre la escena (09-nov): ningún otro
    expect(tokens).toContain("--color-tarjeta-escena: #151515;")
  })
  it("4 tamaños + los 2 de número + el de los botones (18, 09-nov), 2 pesos y los radios de la guía", () => {
    for (const [k, v] of Object.entries({ titulo: 20, cuerpo: 15, dato: 13, rotulo: 11, cifra: 24, numero: 36, boton: 18 })) expect(tokens, k).toContain(`--text-${k}: ${v}px;`)
    expect(tokens.match(/--text-[\w]+:/g)).toHaveLength(7)
    expect(tokens).toContain("--font-weight-medio: 500;")
    for (const [k, v] of Object.entries({ panel: 20, tarjeta: 14, control: 12 })) expect(tokens, k).toContain(`--radius-${k}: ${v}px;`)
  })
  it("se cargan en toda la aplicación", () => {
    expect(readFileSync("app/globals.css", "utf8").split("\n").slice(0, 3).join("\n")).toContain('@import "./estilo-base.css";')
  })
})

describe("estilo base · la revisión automática", () => {
  it("cada regla frena su caso, deja pasar los tokens y no acepta permisos sin razón", () => {
    expect(execFileSync(process.execPath, ["scripts/revisar-estilo.mjs", "probar"], { encoding: "utf8" })).toMatch(/^ok · \d+ frenan, \d+ pasan, 2 permisos sin razón no valen · botones: 5 frenan, 7 pasan, 3 constantes/)
  })
  it("la lista de migrados es exactamente la de esta entrega (campana incluida)", () => {
    const lista = readFileSync("scripts/revisar-estilo.mjs", "utf8").match(/export const MIGRADOS = \[([^\]]*)\]/)?.[1] ?? ""
    expect([...lista.matchAll(/"([^"]+)"/g)].map((m) => m[1])).toEqual(["components/nuevo/EstiloBase.tsx", "components/nuevo/PanelRiesgos.tsx", "components/nuevo/PanelDecisiones.tsx", "components/nuevo/EditorDeCifra.tsx", "components/nuevo/BotonesDelMarco.tsx", "components/nuevo/PanelAplicaciones.tsx"]) // 06-nov · el Centro de campaña pasa al estilo base
  })
})

// CC6 (certificación de #290): que la revisión FRENE la entrega se prueba de verdad, en un repositorio de juguete con su propia historia
describe("estilo base · la revisión frena la entrega", () => {
  const SCRIPT = path.resolve("scripts/revisar-estilo.mjs")
  const MIGRADOS = ["EstiloBase", "PanelRiesgos", "PanelDecisiones", "EditorDeCifra", "BotonesDelMarco", "PanelAplicaciones"].map((x) => `components/nuevo/${x}.tsx`)
  const git = (dir: string, ...a: string[]) => execFileSync("git", ["-c", "user.name=prueba", "-c", "user.email=prueba@x", "-c", "core.hooksPath=/dev/null", ...a], { cwd: dir, stdio: "pipe" })
  const escribir = (dir: string, f: string, t: string) => { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), t) }
  /** repositorio con la rama principal (los migrados, limpios o no) y una rama de trabajo encima */
  const repo = (migradoSucio = false) => {
    const dir = mkdtempSync(path.join(tmpdir(), "estilo-"))
    git(dir, "init", "-q", "-b", "main")
    for (const f of MIGRADOS) escribir(dir, f, `export const x = "text-hueso bg-grafito"\n${migradoSucio && f.endsWith("PanelRiesgos.tsx") ? 'export const y = "text-amber-200"\n' : ""}`)
    git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "base"); git(dir, "checkout", "-q", "-b", "trabajo")
    return dir
  }
  const correr = (dir: string, base: string) => spawnSync(process.execPath, [SCRIPT, "diff", base], { cwd: dir, encoding: "utf8" })
  const dirs: string[] = []
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })

  it("una línea nueva fuera de estilo hace FALLAR la entrega y dice dónde; una limpia pasa", () => {
    const dir = repo(); dirs.push(dir)
    escribir(dir, "components/nuevo/Nueva.tsx", 'export const a = "text-cuerpo"\nexport const b = "border: 1px solid #222"\n')
    git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "mala")
    const mal = correr(dir, "main")
    expect(mal.status).toBe(1); expect(mal.stderr).toContain("components/nuevo/Nueva.tsx:2")
    escribir(dir, "components/nuevo/Nueva.tsx", 'export const a = "text-cuerpo"\nexport const b = "border-linea"\n')
    git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "arreglada")
    expect(correr(dir, "main").status).toBe(0)
  }, 60_000)
  it("lo migrado se revisa ENTERO: algo fuera de estilo que ya estaba, aunque la entrega no lo toque, frena", () => {
    const dir = repo(true); dirs.push(dir)
    escribir(dir, "components/nuevo/Otra.tsx", 'export const a = "text-cuerpo"\n'); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "limpia")
    const r = correr(dir, "main")
    expect(r.status).toBe(1); expect(r.stderr).toContain("components/nuevo/PanelRiesgos.tsx:2")
  }, 60_000)
  // 09-nov · GO de Lenovo (botones a 18): CC6 certifica con un sabotaje; estas son las mismas formas de romperlo
  it("un botón ámbar o de borde oro con letra 15 hace FALLAR la entrega, aunque la etiqueta ocupe varias líneas", () => {
    const dir = repo(); dirs.push(dir)
    const decisiones = (t: string) => `export const x = "text-hueso bg-grafito"\nconst B = () => <button type="button" className="rounded-control bg-ambar px-3 ${t} font-medio text-sobre-ambar">Firmar</button>\n`
    const suelta = (t: string) => `const C = () => (\n  <button type="button"\n    className="rounded-control px-4 py-3 ${t}font-medio"\n    style={{ background: ok ? AMBAR : APAGADO }}>\n    Crear\n  </button>\n)\n`
    escribir(dir, "components/nuevo/PanelDecisiones.tsx", decisiones("text-cuerpo")); escribir(dir, "components/nuevo/Suelta.tsx", suelta(""))
    git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "botones a 15")
    const r = correr(dir, "main")
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("components/nuevo/PanelDecisiones.tsx:2 · botón con letra distinta de 18")
    expect(r.stderr).toContain("components/nuevo/Suelta.tsx:2 · botón con letra distinta de 18")
    escribir(dir, "components/nuevo/PanelDecisiones.tsx", decisiones("text-boton")); escribir(dir, "components/nuevo/Suelta.tsx", suelta("text-boton "))
    git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "botones a 18")
    expect(correr(dir, "main").status).toBe(0)
  }, 60_000)
  it("si la entrega toca solo una línea de en medio de un botón ya existente, se revisa el botón entero", () => {
    const dir = repo(); dirs.push(dir)
    const suelta = (t: string) => `const C = () => (\n  <button type="button"\n    className="rounded-control px-4 py-3 ${t}font-medio"\n    style={{ background: ok ? AMBAR : APAGADO }}>\n    Crear\n  </button>\n)\n`
    git(dir, "checkout", "-q", "main"); escribir(dir, "components/nuevo/Suelta.tsx", suelta("text-boton ")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "botón a 18 en la base")
    git(dir, "checkout", "-q", "-b", "trabajo-2"); escribir(dir, "components/nuevo/Suelta.tsx", suelta("")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "le saca el 18")
    const r = correr(dir, "main")
    expect(r.status).toBe(1); expect(r.stderr).toContain("components/nuevo/Suelta.tsx:2 · botón con letra distinta de 18")
  }, 60_000)
  it("la constante del botón también: BOTON_PRINCIPAL de vuelta a 15 frena", () => {
    const dir = repo(); dirs.push(dir)
    escribir(dir, "components/nuevo/EstiloBase.tsx", 'export const x = "text-hueso bg-grafito"\nexport const BOTON_PRINCIPAL = `zr-apagable rounded-control border border-ambar bg-ambar px-3 text-cuerpo font-medio text-sobre-ambar`\n')
    git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "constante a 15")
    const r = correr(dir, "main")
    expect(r.status).toBe(1); expect(r.stderr).toContain("components/nuevo/EstiloBase.tsx:2 · botón con letra distinta de 18")
  }, 60_000)
  it("sin la base para comparar FALLA con el motivo (nunca pasa a ciegas)", () => {
    const dir = repo(); dirs.push(dir)
    const r = correr(dir, "no-existe")
    expect(r.status).toBe(2); expect(r.stderr).toContain("No encuentro la base no-existe")
  }, 60_000)
  it("corre en CI con la historia completa (sin base no revisa a ciegas)", () => {
    expect(ci).toMatch(/actions\/checkout@v4\s+with:\s+fetch-depth: 0/)
    expect(ci).toContain("node scripts/revisar-estilo.mjs diff origin/main")
  })
})

describe("la cuenta de riesgos (la usará el número de la antena; la campana no lleva número)", () => {
  it("el número: abiertos; «+» si la lista puede estar incompleta; nada sin lectura o sin riesgos (nunca un «0» falso)", async () => {
    const { numeroDeLaCampana, cuentaDeLaCampana } = await import("@/lib/direccion-riesgos")
    expect(numeroDeLaCampana(null)).toBeNull()
    expect(numeroDeLaCampana({ abiertos: 0, graves: 0, completo: true })).toBeNull()
    expect(numeroDeLaCampana({ abiertos: 0, graves: 0, completo: false })).toBe("?")
    expect(numeroDeLaCampana({ abiertos: 3, graves: 1, completo: true })).toBe("3")
    expect(numeroDeLaCampana({ abiertos: 140, graves: 0, completo: true })).toBe("99")
    expect(numeroDeLaCampana({ abiertos: 3, graves: 0, completo: false })).toBe("3+")
    expect(numeroDeLaCampana({ abiertos: 140, graves: 2, completo: false })).toBe("99+")
    expect(cuentaDeLaCampana({ total: 4, por_gravedad: { 1: 1, 2: 2, 3: 1 }, completo: true })).toEqual({ abiertos: 4, graves: 1, completo: true })
  })
  it("🔴 la campana y el $ de arriba no se tocan (Emilio 01:37 · Lenovo 01:47): la campana es la de producción, sin número", () => {
    const marco = readFileSync("components/nuevo/MarcoNuevo.tsx", "utf8")
    expect(marco).toContain("<BotonDePanel panel=\"riesgos\" etiqueta=\"Riesgos y alarmas\" className={ICONO_SUPERIOR}><Bell size={17} /></BotonDePanel>")
    expect(marco).not.toContain("CampanaDeRiesgos"); expect(readFileSync("components/nuevo/BotonesDelMarco.tsx", "utf8")).not.toMatch(/CampanaDeRiesgos|data-numero-campana/)
  })
  it("la cuenta sale de la lectura; si la lectura falla, no hay cuenta: nunca queda un número viejo", async () => {
    const { cuentaDeLaLectura, cuentaDelAviso } = await import("@/lib/direccion-riesgos")
    const lectura = { ok: true, total: 5, por_gravedad: { 1: 1, 2: 2, 3: 2 }, completo: false }
    expect(cuentaDeLaLectura(true, lectura)).toEqual({ abiertos: 5, graves: 2, completo: false })
    expect(cuentaDeLaLectura(false, lectura)).toBeNull() // la ruta respondió con error
    expect(cuentaDeLaLectura(true, { ok: false, error: "x" })).toBeNull()
    expect(cuentaDeLaLectura(true, null)).toBeNull() // no era JSON
    const aviso = (detail: unknown) => cuentaDelAviso(new CustomEvent("nv:riesgos-leidos", { detail }))
    expect(aviso({ abiertos: 2, graves: 1, completo: true })).toEqual({ abiertos: 2, graves: 1, completo: true })
    expect(aviso(null)).toBeNull(); expect(aviso({ abiertos: "2" })).toBeNull()
    const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(escena).toContain("window.dispatchEvent(new CustomEvent(EVENTO_RIESGOS_LEIDOS, { detail: cuentaDeLaLectura(r.ok, j) }))")
    expect(escena).toContain("setRiesgosCrudos(null); window.dispatchEvent(new CustomEvent(EVENTO_RIESGOS_LEIDOS, { detail: null })) }")
  })
})

// 06-nov · los recuadros de Riesgos pasaron a Abiertas · Tomadas · Cerradas (Lenovo): sus pruebas viven en `riesgos-abiertas-tomadas-cerradas.test.tsx`
