/**
 * Browser-verify all 6 dashboard routes against Vercel prod.
 *
 * For each route:
 *   - launch chromium · navigate · wait for networkidle
 *   - capture: HTTP status, page title, presence of "Application error"
 *     / "Something went wrong" Next.js client error boundary, presence
 *     of expected content markers, console error log, PNG screenshot
 *
 * Exits non-zero if any route ships an error boundary or fails to
 * render the expected markers.
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE =
  process.env.DASHBOARD_URL ?? "https://zero-risk-dashboard.vercel.app"

const NAUFRAGO_ID = "d69100b5-8ad7-4bb0-908c-68b5544065dc"

const routes = [
  {
    path: "/",
    label: "home",
    expect: ["Operations overview", "Spend", "Brand"],
  },
  {
    path: "/agents",
    label: "agents-list",
    expect: ["brand_strategist", "claude", "cost"],
  },
  {
    path: "/agents/brand-strategist",
    label: "agent-detail",
    expect: ["Brand Guardian", "sesiones", "claude"],
  },
  {
    path: "/clients",
    label: "clients-list",
    expect: ["Náufrago", "food-delivery"],
  },
  {
    path: `/clients/${NAUFRAGO_ID}`,
    label: "client-detail",
    expect: ["Náufrago", "food-delivery", "Memory"],
  },
  { path: "/graph", label: "graph", expect: ["Náufrago", "Memory"] },
]

const OUT = path.join(process.cwd(), "scripts", "verify-out")
fs.mkdirSync(OUT, { recursive: true })

const ERROR_BOUNDARY_MARKERS = [
  "Application error",
  "server-side exception",
  "Something went wrong",
  "This page could not be found",
]

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const results = []
  let exitCode = 0

  for (const r of routes) {
    const page = await ctx.newPage()
    const consoleErrors = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200))
    })
    const pageErrors = []
    page.on("pageerror", (err) => {
      pageErrors.push(String(err).slice(0, 200))
    })
    const url = BASE + r.path
    let status = 0
    try {
      const resp = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      })
      status = resp ? resp.status() : 0
      // give RSC chunks a beat to flush
      await page.waitForTimeout(1500)
    } catch (e) {
      pageErrors.push("nav-error: " + String(e).slice(0, 200))
    }
    const html = await page.content()
    const visible = await page.evaluate(() => document.body.innerText)
    const errorBoundary = ERROR_BOUNDARY_MARKERS.find((m) => visible.includes(m))
    const presentMarkers = r.expect.filter((m) =>
      visible.toLowerCase().includes(m.toLowerCase()),
    )
    const missing = r.expect.filter((m) => !presentMarkers.includes(m))
    const screenshotPath = path.join(OUT, `${r.label}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const verdict =
      errorBoundary || missing.length > 0 || status >= 400 ? "FAIL" : "OK"
    if (verdict !== "OK") exitCode = 1
    results.push({
      route: r.path,
      label: r.label,
      status,
      verdict,
      errorBoundary: errorBoundary ?? null,
      foundMarkers: presentMarkers,
      missingMarkers: missing,
      consoleErrors: consoleErrors.slice(0, 3),
      pageErrors: pageErrors.slice(0, 3),
      htmlBytes: html.length,
      screenshot: path.relative(process.cwd(), screenshotPath),
    })
    console.log(
      `[${verdict}] ${r.path.padEnd(48)} HTTP ${status} · ${html.length} B · markers ${presentMarkers.length}/${r.expect.length}` +
        (errorBoundary ? ` · ⚠ ${errorBoundary}` : ""),
    )
    await page.close()
  }

  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ base: BASE, ts: new Date().toISOString(), results }, null, 2),
  )

  await browser.close()
  console.log(`\nReport: ${path.join(OUT, "report.json")}`)
  console.log(`Screenshots: ${OUT}`)
  process.exit(exitCode)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
