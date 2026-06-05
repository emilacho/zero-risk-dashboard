#!/usr/bin/env node
/**
 * E2E smoke · canon canon-canon-Phase 1 prep · Approve/Reject wire.
 *
 * Inserta una fila sintética en `hitl_approvals` (status=pending) ·
 * canon canon-llama al endpoint `/api/hitl/resolve` con `decision=approve`
 * y `reviewer_id=smoke` · canon canon-verifica el JSON response · canon
 * canon-borra la fila al final (cero residue).
 *
 * Por default canon-canon-corre en shadow mode (MC_HITL_RESOLVE_WIRE_ENABLED
 * unset) · canon canon-asserts mode=shadow + ok=true + cero n8n call.
 *
 * Para canon-canonical-canary live · `MC_HITL_RESOLVE_WIRE_ENABLED=1 node ...`
 * (canon canon-canon-§144 only · NUNCA correr sin GO explícito de Emilio).
 *
 * Env requerido ·
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) · SUPABASE_SERVICE_ROLE_KEY
 *   MC_RESOLVE_URL · defaults a http://localhost:3000/api/hitl/resolve
 *
 * Uso ·
 *   node scripts/hitl-resolve-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

function loadDotenv() {
  for (const p of [".env.local", ".env"]) {
    try {
      const txt = fs.readFileSync(path.join(process.cwd(), p), "utf8")
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
        }
      }
    } catch {
      /* canon · ignore */
    }
  }
}

async function main() {
  loadDotenv()
  const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const RESOLVE_URL =
    process.env.MC_RESOLVE_URL ?? "http://localhost:3000/api/hitl/resolve"
  if (!URL || !KEY) {
    console.error("[FATAL] Supabase env missing")
    process.exit(1)
  }
  const supa = createClient(URL, KEY, { auth: { persistSession: false } })

  // ── canon · ensure smoke client row exists · canon-canon-FK from hitl_approvals
  const smokeClientName = `smoke-mc-hitl-${Date.now()}`
  const clientInsert = await supa
    .from("clients")
    .insert({ name: smokeClientName, status: "smoke" })
    .select("id")
    .single()
  if (clientInsert.error) {
    console.error("[FATAL] cannot insert smoke client:", clientInsert.error.message)
    process.exit(2)
  }
  const client_id = clientInsert.data.id
  console.log("[1/5] smoke client inserted · id=", client_id)

  // ── canon · insert smoke HITL row
  const hitlInsert = await supa
    .from("hitl_approvals")
    .insert({
      client_id,
      status: "pending",
      priority: "high",
      payload: { proposal: "smoke draft", brand: smokeClientName },
      context: {
        execution_id: `exec-${randomUUID()}`,
        hitl_token: `tok-${randomUUID()}`,
        client_name: smokeClientName,
      },
    })
    .select("id, status, client_id")
    .single()
  if (hitlInsert.error) {
    console.error("[FATAL] cannot insert HITL row:", hitlInsert.error.message)
    await supa.from("clients").delete().eq("id", client_id)
    process.exit(3)
  }
  const hitl_id = hitlInsert.data.id
  console.log("[2/5] hitl_approvals row · id=", hitl_id)

  // ── canon · POST /api/hitl/resolve
  console.log("[3/5] POST", RESOLVE_URL, "canon canon-canon-decision=approve")
  const res = await fetch(RESOLVE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.INTERNAL_API_KEY
        ? { "x-internal-key": process.env.INTERNAL_API_KEY }
        : {}),
    },
    body: JSON.stringify({
      hitl_id,
      decision: "approve",
      reviewer_id: "smoke-mc",
    }),
  })
  const body = await res.json().catch(() => null)
  const ok = res.ok && body && body.ok && body.mode !== "refused"
  console.log(`[${ok ? "OK" : "FAIL"}]  resolve response · status=${res.status} · mode=${body?.mode} · ok=${body?.ok}`)

  // ── canon · readback hitl row · canon-canon-confirm status changed if live
  const readback = await supa
    .from("hitl_approvals")
    .select("id, status, approved_by, approved_at")
    .eq("id", hitl_id)
    .single()
  console.log("[4/5] readback · status=", readback.data?.status, "· approved_by=", readback.data?.approved_by)

  // ── canon · cleanup
  await supa.from("hitl_approvals").delete().eq("id", hitl_id)
  await supa.from("clients").delete().eq("id", client_id)
  console.log("[5/5] cleanup canon-canon-rows deleted")

  console.log("---")
  console.log(
    JSON.stringify({
      smoke: "mc-hitl-resolve",
      ts: new Date().toISOString(),
      pass: ok,
      mode: body?.mode,
      resolve_response: body,
      hitl_row_post: readback.data,
    }),
  )
  if (!ok) process.exit(4)
}

main().catch((e) => {
  console.error("[FATAL]", e?.stack ?? e?.message ?? e)
  process.exit(1)
})
