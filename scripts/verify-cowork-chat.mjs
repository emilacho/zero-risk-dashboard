import { chromium } from "playwright"
import path from "node:path"
import fs from "node:fs"

const BASE =
  process.env.DASHBOARD_URL ?? "https://zero-risk-dashboard.vercel.app"
const OUT = path.join(process.cwd(), "scripts", "verify-out")
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await ctx.newPage()

await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30_000 })
await page.waitForTimeout(1200)

// (1) closed state · floating button visible · viewport-only screenshot
await page.screenshot({
  path: path.join(OUT, "cowork-chat-closed.png"),
  fullPage: false,
})
console.log("[OK] cowork-chat-closed.png · viewport")

// (2) open drawer · click the message button
const btn = page.locator('button[aria-label="Mensaje a Cowork"]')
await btn.click()
await page.waitForTimeout(600)

// Fill some text to show real usage
const ta = page.locator('textarea[placeholder*="Escribe acá"]')
await ta.fill(
  "Hola Cowork · este es un mensaje de prueba enviado desde el dashboard Phase 3 verify script. Cmd+Enter para enviar.",
)
await page.waitForTimeout(400)
await page.screenshot({
  path: path.join(OUT, "cowork-chat-open.png"),
  fullPage: false,
})
console.log("[OK] cowork-chat-open.png · viewport · drawer visible")

await browser.close()
