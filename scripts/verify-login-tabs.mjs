import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE =
  process.env.DASHBOARD_URL ?? "https://zero-risk-dashboard.vercel.app"
const OUT = path.join(process.cwd(), "scripts", "verify-out")
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Default tab · Contraseña
await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30_000 })
await page.waitForTimeout(800)
await page.screenshot({
  path: path.join(OUT, "login-password-tab.png"),
  fullPage: false,
})
console.log("[OK] login-password-tab.png")

// Click Magic link tab
await page.locator('button[role="tab"]', { hasText: "Magic link" }).click()
await page.waitForTimeout(400)
await page.screenshot({
  path: path.join(OUT, "login-magic-tab.png"),
  fullPage: false,
})
console.log("[OK] login-magic-tab.png")

await browser.close()
