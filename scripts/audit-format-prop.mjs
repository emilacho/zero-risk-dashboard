#!/usr/bin/env node
/**
 * audit-format-prop.mjs · Phase 4.2 belt-and-braces guard.
 *
 * Scans `components/` and `app/` for any JSX `format={(...) => ...}`
 * pattern · this is the digest 3406040795 regression. The lint rule
 * (`local/no-function-format-prop`) is the primary defense · this
 * script is a fast, dependency-free secondary check that also runs
 * in pre-commit and CI.
 *
 * Exits 1 (non-zero) when a hit is found · prints the file + line +
 * snippet so the offender can fix it before committing.
 */
import { readdir, readFile, stat } from "node:fs/promises"
import { join, extname } from "node:path"

const ROOT = process.cwd()
const SEARCH_DIRS = ["components", "app", "lib"]
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "__rule-test", // synthetic violation fixture
])
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"])

// Patterns we treat as regressions · scoped to our components only.
// Recharts / Tremor / Radix all expose unrelated `format(ter)` callback
// APIs that live entirely in client trees and are NOT in scope here.
const TARGET_COMPONENTS = ["AnimatedNumber", "OpsKpiCell"]
const CONTEXT_LINES = 8 // lookback window for a target opening tag

const FORBIDDEN = [
  {
    name: "arrow-format",
    re: /\bformat\s*=\s*\{\s*\([^)]*\)\s*=>/,
    hint: "format={(v) => ...} arrow callback · migrate to formatType",
  },
  {
    name: "function-format",
    re: /\bformat\s*=\s*\{\s*function\b/,
    hint: "format={function(v){...}} callback · migrate to formatType",
  },
]

function hasTargetContext(lines, idx) {
  const start = Math.max(0, idx - CONTEXT_LINES)
  for (let j = start; j <= idx; j++) {
    for (const c of TARGET_COMPONENTS) {
      if (lines[j].includes(`<${c}`)) return true
    }
  }
  return false
}

let hits = 0

async function walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      await walk(full)
    } else if (e.isFile()) {
      const ext = extname(e.name).toLowerCase()
      if (!EXTS.has(ext)) continue
      await checkFile(full)
    }
  }
}

async function checkFile(path) {
  const content = await readFile(path, "utf8")
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pat of FORBIDDEN) {
      if (pat.re.test(line) && hasTargetContext(lines, i)) {
        const rel = path.replace(ROOT + "\\", "").replace(ROOT + "/", "")
        console.error(`\x1b[31m✖\x1b[0m ${rel}:${i + 1}  [${pat.name}]`)
        console.error(`    ${line.trim()}`)
        console.error(`    \x1b[33mhint·\x1b[0m ${pat.hint}`)
        hits++
      }
    }
  }
}

for (const d of SEARCH_DIRS) {
  try {
    const s = await stat(join(ROOT, d))
    if (s.isDirectory()) await walk(join(ROOT, d))
  } catch {
    /* ignore missing dirs */
  }
}

if (hits === 0) {
  console.log("\x1b[32m✓\x1b[0m audit:format-prop · 0 callback violations across components/ app/ lib/")
  process.exit(0)
}
console.error(
  `\n\x1b[31m✖\x1b[0m audit:format-prop · ${hits} violation${hits === 1 ? "" : "s"} found · digest 3406040795 regression · fix before committing.`,
)
process.exit(1)
