/** La llave interna de /api: la única comparación que deja pasar sin sesión. US$ 0, sin red. */
import { describe, expect, it } from "vitest"
import { llaveInternaValida } from "@/lib/api-gate"

const pedido = (h: Record<string, string>) => ({ headers: new Headers(h) })

describe("llaveInternaValida", () => {
  it("la llave correcta pasa por x-api-key y por x-internal-key", () => {
    expect(llaveInternaValida(pedido({ "x-api-key": "secreta-123" }), "secreta-123")).toBe(true)
    expect(llaveInternaValida(pedido({ "x-internal-key": "secreta-123" }), "secreta-123")).toBe(true)
  })
  it("una llave incorrecta del MISMO largo no pasa", () => {
    expect(llaveInternaValida(pedido({ "x-api-key": "secreta-124" }), "secreta-123")).toBe(false)
  })
  it("una llave de distinto largo (más corta o más larga) no pasa", () => {
    expect(llaveInternaValida(pedido({ "x-api-key": "secreta-12" }), "secreta-123")).toBe(false)
    expect(llaveInternaValida(pedido({ "x-api-key": "secreta-1234" }), "secreta-123")).toBe(false)
  })
  it("sin llave en el pedido, o vacía, no pasa", () => {
    expect(llaveInternaValida(pedido({}), "secreta-123")).toBe(false)
    expect(llaveInternaValida(pedido({ "x-api-key": "" }), "secreta-123")).toBe(false)
  })
  it("sin llave esperada configurada NO hay camino por llave, ni siquiera con llave vacía", () => {
    expect(llaveInternaValida(pedido({ "x-api-key": "cualquiera" }), undefined)).toBe(false)
    expect(llaveInternaValida(pedido({ "x-api-key": "" }), "")).toBe(false)
  })
})
