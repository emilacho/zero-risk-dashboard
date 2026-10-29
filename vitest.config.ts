import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  // los componentes de `app/` no importan React (Next lo pone solo): las pruebas que los dibujan usan el mismo JSX automático
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
