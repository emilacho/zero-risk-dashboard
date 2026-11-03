import { describe, it, expect } from "vitest"
import { cantidadEnPalabras, tokensEnPalabras, dinero, HORA_24 } from "@/lib/formato"
import { costoComoDato } from "@/lib/direccion-corridas"
import { usd } from "@/lib/direccion-dinero"

describe("formato único del dashboard", () => {
  it("dinero con coma decimal en todos los formateadores", () => {
    expect(dinero(2.12)).toBe("US$ 2,12")
    expect(usd(2.12)).toBe("US$ 2,12")
    expect(costoComoDato(2.12)).toBe("US$ 2,12")
  })
  it("horas en 24 h", () => {
    const h = new Date("2026-11-03T19:29:00Z").toLocaleTimeString("es-EC", { ...HORA_24, timeZone: "America/Guayaquil" })
    expect(h).toBe("14:29")
    expect(h).not.toMatch(/[ap]\. ?m\./i)
  })
  it("cantidades grandes en palabras", () => {
    expect(tokensEnPalabras(3_007_000)).toBe("3 millones de tokens")
    expect(tokensEnPalabras(953_000)).toBe("953 mil tokens")
    expect(tokensEnPalabras(950)).toBe("950 tokens")
    expect(cantidadEnPalabras(3_500_000)).toBe("3,5 millones")
    expect(cantidadEnPalabras(1_000_000)).toBe("1 millón")
    expect(cantidadEnPalabras(820_000)).toBe("820 mil")
    expect(cantidadEnPalabras(950)).toBe("950")
    expect(cantidadEnPalabras(12_000)).toBe("12 mil")
    expect(cantidadEnPalabras(9_999)).toBe("9.999")
    expect(cantidadEnPalabras(999_600)).toBe("1 millón")
  })
})
