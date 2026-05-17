import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE =
  process.env.DASHBOARD_URL ?? "https://zero-risk-dashboard.vercel.app"
const OUT = path.join(process.cwd(), "scripts", "verify-out")
fs.mkdirSync(OUT, { recursive: true })

const depts = [
  { slug: "ops", marker: "Operations" },
  { slug: "csm", marker: "Client Success" },
  { slug: "fin", marker: "Finanzas" },
  { slug: "mkt", marker: "Marketing" },
  { slug: "qa", marker: "QA" },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })

// 1) Home with dept overview grid
const home = await ctx.newPage()
await home.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30_000 })
await home.waitForTimeout(1200)
await home.screenshot({
  path: path.join(OUT, "home-with-dept-grid.png"),
  fullPage: false,
})
console.log("[OK] home-with-dept-grid.png · viewport")
await home.close()

// 2) Each dept page
let exitCode = 0
for (const { slug, marker } of depts) {
  const p = await ctx.newPage()
  const errs = []
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(BASE + `/dept/${slug}`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  })
  await p.waitForTimeout(1200)
  const visible = await p.evaluate(() => document.body.innerText)
  const ok =
    !visible.includes("Application error") &&
    !visible.includes("server-side exception") &&
    visible.toLowerCase().includes(marker.toLowerCase())
  if (!ok) exitCode = 1
  await p.screenshot({
    path: path.join(OUT, `dept-${slug}.png`),
    fullPage: false,
  })
  console.log(
    `[${ok ? "OK" : "FAIL"}] /dept/${slug}${errs.length ? " · errors: " + errs.join("|") : ""}`,
  )
  await p.close()
}

await browser.close()
process.exit(exitCode)
