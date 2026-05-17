import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE =
  process.env.DASHBOARD_URL ?? "https://zero-risk-dashboard.vercel.app"
const OUT = path.join(process.cwd(), "scripts", "verify-out")
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})

// 1) Visit /dept/ops · expect redirect to /login
const p1 = await ctx.newPage()
await p1.goto(BASE + "/dept/ops", { waitUntil: "networkidle", timeout: 30_000 })
await p1.waitForTimeout(800)
const finalUrl = p1.url()
const ok1 = finalUrl.includes("/login")
await p1.screenshot({
  path: path.join(OUT, "auth-login-page.png"),
  fullPage: false,
})
console.log(`[${ok1 ? "OK" : "FAIL"}] /dept/ops redirected to ${finalUrl}`)

// 2) Try to access /api/admin/campaigns/list without session · expect 401
const p2 = await ctx.newPage()
await p2.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 30_000 })
const apiRes = await p2.evaluate(async (base) => {
  const r = await fetch(`${base}/api/admin/campaigns/list?limit=5`, {
    cache: "no-store",
  })
  return { status: r.status, text: (await r.text()).slice(0, 200) }
}, BASE)
const ok2 = apiRes.status === 401 || apiRes.status === 403
console.log(
  `[${ok2 ? "OK" : "FAIL"}] /api/admin/campaigns/list unauth · HTTP ${apiRes.status} · ${apiRes.text}`,
)

// 3) Smoke /api/dashboard/ops-extras (open per middleware exception) · expect 200
const p3 = await ctx.newPage()
await p3.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 30_000 })
const openRes = await p3.evaluate(async (base) => {
  const r = await fetch(`${base}/api/dashboard/ops-extras`)
  return r.status
}, BASE)
console.log(
  `[${openRes === 200 ? "OK" : "FAIL"}] /api/dashboard/ops-extras open · HTTP ${openRes}`,
)

await browser.close()
process.exit(ok1 && ok2 && openRes === 200 ? 0 : 1)
