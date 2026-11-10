/** DECISIONES EN ESCRITORIO (pedido de Lenovo 06-nov sobre #290): «Decisivo» en rojo y las cifras como en la imagen aprobada. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { cifraEnRecuadro, partirLoDecisivo } from "@/lib/direccion-decisiones"

describe("Decisiones como en la imagen aprobada", () => {
  it("🔴 la cifra: el número solo; el dólar delante del rótulo; otra unidad detrás; nunca se pierde la unidad", () => {
    expect(cifraEnRecuadro({ nombre: "al mes", valor: 1341, unidad: "US$" })).toEqual({ numero: "1.341", rotulo: "US$ al mes" })
    expect(cifraEnRecuadro({ nombre: "al mes", valor: 1341.27, unidad: "US$" })).toEqual({ numero: "1.341,27", rotulo: "US$ al mes" })
    expect(cifraEnRecuadro({ nombre: "US$ al mes", valor: 10, unidad: "US$" }).rotulo).toBe("US$ al mes") // sin «US$ US$»
    expect(cifraEnRecuadro({ nombre: "Meta semanal", valor: 5, unidad: "ventas" })).toEqual({ numero: "5", rotulo: "Meta semanal · ventas" })
    expect(cifraEnRecuadro({ nombre: "Ventas por semana", valor: 5, unidad: "ventas" }).rotulo).toBe("Ventas por semana") // el nombre ya la dice
    expect(cifraEnRecuadro({ nombre: "Pedidos", valor: 3, unidad: null as never }).rotulo).toBe("Pedidos")
  })
  it("🔴 lo decisivo en dos líneas: la frase y su porqué; sin «:» queda entero", () => {
    expect(partirLoDecisivo("Con esta meta el plan no se paga: hacen falta 8 ventas por semana (supuesto)")).toEqual({ frase: "Con esta meta el plan no se paga", porque: "Hacen falta 8 ventas por semana (supuesto)" })
    expect(partirLoDecisivo("Dos hallazgos sin cerrar")).toEqual({ frase: "Dos hallazgos sin cerrar", porque: null })
    expect(partirLoDecisivo("Raro: ")).toEqual({ frase: "Raro: ", porque: null })
    // caso real (06-nov): el «:» dentro de un paréntesis no parte; el primero fuera, sí
    const real = "Instagram @zeroriskgye lleva 6 años inactivo (últimos posts: Junio 2020) y el Business Manager no está confirmado"
    expect(partirLoDecisivo(real)).toEqual({ frase: real, porque: null })
    expect(partirLoDecisivo("Precios reales sin dato: D4 y D6 son nulos")).toEqual({ frase: "Precios reales sin dato", porque: "D4 y D6 son nulos" })
    expect(partirLoDecisivo(`${"x".repeat(95)}: resto`).porque).toBeNull() // la frase larga no es un título
  })
  it("🔴 el rótulo rojo dice «Decisivo», no «Sigue abierto»; las cifras con el número grande", () => {
    // 10-nov · T2: toda decisión se dibuja con la ficha única; el rótulo y las cifras viven en su dibujante
    const c = readFileSync("components/nuevo/FichaDeDecision.tsx", "utf8")
    expect(c).toContain('<Rotulo tono="alarma">Decisivo</Rotulo>'); expect(c).not.toContain("Sigue abierto")
    expect(c).toContain("data-numero-de-cifra className=\"block whitespace-nowrap text-numero font-normal")
  })
})
