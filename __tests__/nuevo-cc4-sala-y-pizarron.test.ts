import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { nombreDelFlujoEnPalabras } from "@/lib/escena-avatares"
import { SIN_CUENTA_LARGO, textoDeLaTarjeta } from "@/components/nuevo/escena/PanelesDelPizarron"
import type { CuadroDeMetrica } from "@/lib/escena-metricas"

const leer = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n")

describe("CC4 · sala de reuniones · palabras de oficina", () => {
  it("el trabajo nunca se dice con código: nombre de n8n limpio o «un trabajo en curso»", () => {
    expect(nombreDelFlujoEnPalabras("2128abcd", { "2128abcd": "Zero Risk — Cambios al manual · CC-12" })).toBe("Cambios al manual")
    expect(nombreDelFlujoEnPalabras("2128abcd", {})).toBe("un trabajo en curso")
    expect(nombreDelFlujoEnPalabras(null)).toBe("un trabajo en curso")
    expect(nombreDelFlujoEnPalabras("2128abcd", {})).not.toMatch(/2128|flujo/)
  })
  it("sin reunión no hay botón; con fallo lo dice en rojo; el detalle técnico va detrás de «ver detalle»", () => {
    const s = leer("components/nuevo/escena/SalaDeReuniones.tsx")
    expect(s).toContain('role={r ? "button" : undefined}')
    expect(s).toContain("if (r) onAbrir()")
    expect(s).toContain("#f87171")
    expect(s).toContain("data-detalle-tecnico")
    expect(s).toContain("data-dijo")
    const sala = leer("lib/escena-sala.ts")
    expect(sala).toContain('"falló" : "terminó"')
  })
})

describe("CC4 · pizarrón y vitrina · grandes y tocables", () => {
  const base: CuadroDeMetrica = { clave: "instagram" as never, nombre: "Instagram", sigla: "IG", principal: null, variacion: null, texto: "métricas pronto", tiene: true }
  it("la tarjeta de una red sin cuenta dice «sin cuenta todavía · se conecta cuando exista»", () => {
    expect(textoDeLaTarjeta({ ...base, tiene: false })).toBe(SIN_CUENTA_LARGO)
    expect(SIN_CUENTA_LARGO).toBe("sin cuenta todavía · se conecta cuando exista")
    expect(textoDeLaTarjeta(base)).toBe("métricas pronto")
    expect(textoDeLaTarjeta({ ...base, principal: "1.200 seguidores" })).toBe("1.200 seguidores")
  })
  it("los cuadros y la vitrina son botones que abren su tarjeta, y los botones del panel miden al menos 44 px", () => {
    const e = leer("components/nuevo/escena/EntregasEnLaFoto.tsx")
    expect(e).toContain("onAbrir?.(c.clave)"); expect(e).toContain("data-pizarron-toque"); expect(e).toContain('role="button"')
    expect(e).not.toContain("cursor:default")
    const p = leer("components/nuevo/escena/PanelesDelPizarron.tsx")
    expect(p).toContain("min-h-[72px]"); expect(p).toContain("min-h-[44px]"); expect(p).toContain("data-vitrina-vacia"); expect(p).toContain("Aún sin piezas")
    const a = leer("components/nuevo/escena/Avatares.tsx")
    expect(a).toContain("PanelDelPizarron"); expect(a).toContain("PanelDeLaVitrina")
  })
})
