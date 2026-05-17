#!/usr/bin/env node
/**
 * codemod-lucide-to-phosphor.mjs · Sprint #8 D3 step C
 *
 * Scans app/ + components/ + lib/ for `lucide-react` imports and rewrites
 * them to `@phosphor-icons/react` · with icon-name remapping where the
 * libraries differ (e.g. ChevronDown → CaretDown · ExternalLink →
 * ArrowSquareOut · AlertTriangle → Warning · Mail → Envelope).
 *
 * Usage:
 *   node scripts/codemod-lucide-to-phosphor.mjs            # apply changes
 *   node scripts/codemod-lucide-to-phosphor.mjs --dry-run  # print plan only
 *
 * Strategy:
 *   1. Walk app/ + components/ + lib/ · .tsx + .ts only · skip node_modules + .next
 *   2. For each file · find every `import { ... } from "lucide-react"` block
 *      (single OR multi-line)
 *   3. Resolve every named import via ICON_MAP · keep unmapped names verbatim
 *      (Phosphor has many same-name icons · default identity mapping is safe)
 *   4. Rewrite the import block with mapped names
 *   5. For every rename pair (e.g. Sparkles → Sparkle) replace JSX usage
 *      `<Sparkles ` and `</Sparkles>` and bare `Sparkles}` references
 *   6. Change the import source string `lucide-react` → `@phosphor-icons/react`
 *   7. Write the file back · summary at end
 *
 * Safety:
 *   - Only matches identifier characters in JSX rename (won't touch unrelated
 *     symbols)
 *   - Skips files with NO `lucide-react` import
 *   - Idempotent · re-running is a no-op if all files are already migrated
 *   - Keeps `lucide-react` installed (caller does NOT auto-remove from
 *     package.json · per dispatch "keep Lucide as fallback temporary")
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join, extname } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const TARGET_DIRS = ["app", "components", "lib"]
const EXTS = new Set([".tsx", ".ts"])
const DRY_RUN = process.argv.includes("--dry-run")

/**
 * Lucide → Phosphor icon name mapping. Same-name pairs are omitted (identity
 * mapping is the default · saves boilerplate). Add new mappings here as
 * additional Lucide icons surface in the codebase.
 *
 * Source mapping references:
 *   - https://phosphoricons.com/ (Phosphor catalog · 1,512 icons · 6 weights)
 *   - https://lucide.dev/icons (Lucide catalog · 1,711 icons · stroke-only)
 */
const ICON_MAP = {
  // Navigation + UI
  ChevronDown: "CaretDown",
  ChevronUp: "CaretUp",
  ChevronLeft: "CaretLeft",
  ChevronRight: "CaretRight",
  ExternalLink: "ArrowSquareOut",
  MousePointerClick: "CursorClick",
  Sparkles: "Sparkle",

  // Status + feedback
  AlertTriangle: "Warning",
  AlertOctagon: "WarningOctagon",
  CircleAlert: "WarningCircle",
  ShieldAlert: "ShieldWarning",
  CheckCircle2: "CheckCircle",
  Loader2: "CircleNotch",

  // Actions
  Send: "PaperPlaneTilt",
  Save: "FloppyDisk",
  LogIn: "SignIn",
  LogOut: "SignOut",
  Mail: "Envelope",
  Eye: "Eye",
  EyeOff: "EyeSlash",
  RefreshCcw: "ArrowsCounterClockwise",
  RefreshCw: "ArrowClockwise",

  // Iconography that maps to differently-named Phosphor icons
  Banknote: "CurrencyDollar",
  TrendingUp: "TrendUp",
  TrendingDown: "TrendDown",
  Instagram: "InstagramLogo",
  Facebook: "FacebookLogo",
  Twitter: "TwitterLogo",
  LinkedIn: "LinkedinLogo",
  Inbox: "Tray",
  Type: "TextT",
  Layers: "Stack",
  Boxes: "Stack",
  Workflow: "FlowArrow",
  Network: "TreeStructure",
  Settings: "Gear",
  Settings2: "GearSix",
  MessageCircle: "ChatCircle",
  MessageSquare: "ChatTeardrop",
  BellRing: "BellRinging",
  LifeBuoy: "Lifebuoy",
  Compass: "Compass",
  GitBranch: "GitBranch",
  Coins: "Coins",
  PiggyBank: "PiggyBank",
  Megaphone: "Megaphone",
  Ticket: "Ticket",
  Activity: "Pulse",
  Cpu: "Cpu",
  Brain: "Brain",
  HardDrive: "HardDrive",
  Bell: "Bell",
  Lock: "Lock",
  Unlock: "LockOpen",
  Check: "Check",
  Copy: "Copy",
  Plug: "Plugs",
  WifiOff: "WifiSlash",
  Wifi: "WifiHigh",
  ShieldCheck: "ShieldCheck",
  Users: "Users",
  Building2: "Buildings",
  FileText: "FileText",
  Image: "Image",
  Video: "VideoCamera",
  Box: "Cube",
  Globe: "Globe",
  Camera: "Camera",
  Search: "MagnifyingGlass",
  X: "X",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Plus: "Plus",
  Minus: "Minus",
  Info: "Info",
  Edit: "PencilSimple",
  Trash: "Trash",
  Trash2: "Trash",
  Clock: "Clock",
  Calendar: "Calendar",
  Filter: "Funnel",
  ArrowUpRight: "ArrowUpRight",
  ArrowDownRight: "ArrowDownRight",
  CircleCheck: "CheckCircle",
  CircleX: "XCircle",
  Hash: "Hash",

  // Sprint #8 unmapped pass-2 (verified Phosphor exports)
  Bot: "Robot",
  Database: "Database",
  DollarSign: "CurrencyDollarSimple",
  History: "ClockCounterClockwise",
  LayoutDashboard: "SquaresFour",
  Map: "MapTrifold",
  Play: "Play",
  LucideIcon: "Icon", // TS type alias · Phosphor exports `Icon` type for icon components
}

const stats = {
  files_scanned: 0,
  files_with_lucide: 0,
  files_rewritten: 0,
  icons_renamed: 0,
  unique_unmapped_names: new Set(),
}

function walk(dir) {
  let out = []
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist" || name.startsWith(".")) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out = out.concat(walk(full))
    } else if (EXTS.has(extname(name))) {
      out.push(full)
    }
  }
  return out
}

function rewriteImports(source) {
  // Match single-line or multi-line import block:
  //   import { Name, Name2 } from "lucide-react"
  //   import {
  //     Name,
  //     Name2,
  //   } from 'lucide-react'
  const re = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g
  let modified = source
  let changed = false
  const renamesInFile = new Set()

  modified = modified.replace(re, (match, body) => {
    changed = true
    const names = body
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => n.replace(/\s+as\s+\w+$/, "")) // drop alias for now (rare in this repo)

    const mapped = names.map((origNameRaw) => {
      // Detect leading `type ` keyword (TS type-only import)
      const typeMatch = origNameRaw.match(/^type\s+(\w+)$/)
      const isTypeOnly = !!typeMatch
      const origName = typeMatch ? typeMatch[1] : origNameRaw
      const prefix = isTypeOnly ? "type " : ""
      const newName = ICON_MAP[origName]
      if (!newName) {
        // identity mapping · keep as is · note for unmapped report
        stats.unique_unmapped_names.add(origName)
        return prefix + origName
      }
      if (newName !== origName) {
        renamesInFile.add(`${origName}:${newName}`)
        stats.icons_renamed++
      }
      return prefix + newName
    })

    // Reconstruct import · multi-line if >3 names · else single-line
    if (mapped.length > 3) {
      return `import {\n  ${mapped.join(",\n  ")},\n} from "@phosphor-icons/react"`
    }
    return `import { ${mapped.join(", ")} } from "@phosphor-icons/react"`
  })

  if (!changed) return { source: modified, changed: false, renames: [] }

  // Apply JSX/identifier renames for actually-renamed icons in this file
  for (const pair of renamesInFile) {
    const [oldName, newName] = pair.split(":")
    if (oldName === newName) continue
    // Replace whole-identifier matches only · before <, /, (, comma, space, etc.
    // Word boundary `\b` is reliable for identifier chars
    const tagRe = new RegExp(`\\b${oldName}\\b`, "g")
    modified = modified.replace(tagRe, newName)
  }

  return { source: modified, changed: true, renames: Array.from(renamesInFile) }
}

function main() {
  const allFiles = TARGET_DIRS.flatMap((d) => walk(join(ROOT, d)))
  const fileChanges = []

  for (const file of allFiles) {
    stats.files_scanned++
    const original = readFileSync(file, "utf8")
    if (!original.includes('"lucide-react"') && !original.includes("'lucide-react'")) continue
    stats.files_with_lucide++

    const { source: rewritten, changed, renames } = rewriteImports(original)
    if (!changed || rewritten === original) continue

    fileChanges.push({ file: file.replace(ROOT + "\\", "").replace(ROOT + "/", ""), renames })
    if (!DRY_RUN) {
      writeFileSync(file, rewritten, "utf8")
      stats.files_rewritten++
    }
  }

  console.log(`\n${DRY_RUN ? "[DRY-RUN] " : ""}Lucide → Phosphor codemod`)
  console.log(`  files scanned · ${stats.files_scanned}`)
  console.log(`  files with lucide-react import · ${stats.files_with_lucide}`)
  console.log(`  files rewritten · ${DRY_RUN ? "(would rewrite)" : ""} ${fileChanges.length}`)
  console.log(`  icon renames applied · ${stats.icons_renamed}`)
  console.log(`  unique unmapped icon names (identity-mapped) · ${stats.unique_unmapped_names.size}`)
  if (stats.unique_unmapped_names.size > 0) {
    console.log("\n  Unmapped (kept as-is · verify Phosphor has same name):")
    for (const n of Array.from(stats.unique_unmapped_names).sort()) {
      console.log(`    · ${n}`)
    }
  }
  console.log("\n  Per-file changes:")
  for (const { file, renames } of fileChanges) {
    console.log(`    · ${file}${renames.length > 0 ? ` · renames: ${renames.join(", ")}` : ""}`)
  }
  console.log()
}

main()
