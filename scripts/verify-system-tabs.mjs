import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE =
  process.env.DASHBOARD_URL ?? "https://zero-risk-dashboard.vercel.app"
const OUT = path.join(process.cwd(), "scripts", "verify-out")
fs.mkdirSync(OUT, { recursive: true })

const tabs = [
  { slug: "agents", marker: "agents" },
  { slug: "workflows", marker: "workflows" },
  { slug: "brazos", marker: "brazos" },
  { slug: "plataformas", marker: "plataformas" },
  { slug: "storage", marker: "tables" },
  { slug: "memoria", marker: "memory" },
  { slug: "inbox", marker: "inbox" },
  { slug: "roadmap", marker: "roadmap" },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
})

let exitCode = 0
for (const t of tabs) {
  const p = await ctx.newPage()
  const pageErrors = []
  p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/system/${t.slug}`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  })
  await p.waitForTimeout(1400)
  const visible = await p.evaluate(() => document.body.innerText)
  const ok =
    !visible.includes("Application error") &&
    !visible.includes("server-side exception") &&
    visible.toLowerCase().includes(t.marker.toLowerCase())
  if (!ok) exitCode = 1
  await p.screenshot({
    path: path.join(OUT, `system-${t.slug}.png`),
    fullPage: false,
  })
  console.log(
    `[${ok ? "OK" : "FAIL"}] /system/${t.slug}${pageErrors.length ? " · errs: " + pageErrors.join("|") : ""}`,
  )
  await p.close()
}

await browser.close()
process.exit(exitCode)
