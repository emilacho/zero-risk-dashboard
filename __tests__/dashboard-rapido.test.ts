import { describe, expect, it } from "vitest"
import { conCache, vaciarCache } from "@/lib/cache-corta"
import { rolDe, olvidarRoles } from "@/lib/rol-cache"
import { debeRefrescar, PAUSA_TRAS_NAVEGAR_MS } from "@/lib/tiempo-real"
import { estadoDelTrabajo, nombreLegible, queHace } from "@/lib/trabajo-en-vivo"

describe("caché corta", () => {
  it("lee una vez dentro del plazo, comparte la lectura en curso y vuelve a leer al vencer", async () => {
    vaciarCache(); let t = 1000; let n = 0
    // en pruebas la caché real se salta; se prueba con NODE_ENV distinto
    const viejo = process.env.NODE_ENV; (process.env as Record<string, string>).NODE_ENV = "production"
    try {
      const leer = async () => ++n
      const [a, b] = await Promise.all([conCache("k", 100, leer, () => t), conCache("k", 100, leer, () => t)])
      expect([a, b, n]).toEqual([1, 1, 1])
      t = 1050; expect(await conCache("k", 100, leer, () => t)).toBe(1)
      t = 1200; expect(await conCache("k", 100, leer, () => t)).toBe(2)
      vaciarCache(); expect(await conCache("k", 100, leer, () => t)).toBe(3)
      await expect(conCache("m", 100, async () => { throw new Error("x") }, () => t)).rejects.toThrow()
      expect(await conCache("m", 100, async () => 7, () => t)).toBe(7)
    } finally { (process.env as Record<string, string>).NODE_ENV = viejo! }
  })
})
describe("rol recordado", () => {
  it("pregunta una vez por persona en 60 s", async () => {
    olvidarRoles(); let n = 0; let t = 0; const viejo = process.env.NODE_ENV; (process.env as Record<string, string>).NODE_ENV = "production"
    try {
      const leer = async () => { n++; return "admin" as const }
      await rolDe("u1", leer, () => t); await rolDe("u1", leer, () => t + 30_000)
      expect(n).toBe(1)
      await rolDe("u1", leer, () => t + 61_000); expect(n).toBe(2)
    } finally { (process.env as Record<string, string>).NODE_ENV = viejo! }
  })
})
describe("el refresco automático", () => {
  const base = { ruta: "/", oculta: false, escribiendo: false, sinRed: false }
  it("no corre justo después de un clic o cambio de pantalla", () => {
    expect(debeRefrescar({ ...base, desdeNavegar: 500 })).toBe(false)
    expect(debeRefrescar({ ...base, desdeNavegar: PAUSA_TRAS_NAVEGAR_MS + 1 })).toBe(true)
    expect(debeRefrescar(base)).toBe(true)
  })
})
describe("trabajo en vivo · nombres del sistema", () => {
  it("estados y frases sin códigos", () => {
    expect(estadoDelTrabajo("completed")).toBe("listo"); expect(estadoDelTrabajo("running")).toBe("trabajando"); expect(estadoDelTrabajo("error")).toBe("fallo")
    expect(nombreLegible("sales_account_strategist")).toBe("Sales account strategist")
    expect(queHace("trabajando", "Náufrago")).toBe("trabaja para Náufrago")
    expect(queHace("fallo", null)).toBe("tuvo un problema")
  })
})
