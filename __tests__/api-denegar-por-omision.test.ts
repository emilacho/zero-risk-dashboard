/**
 * Fase 0 (29-oct) · NINGUNA ruta de /api del tablero queda abierta: la prueba recorre TODAS las rutas que existen en app/api y exige 401 sin sesión ni llave.
 * Si mañana nace una ruta nueva, entra en el recorrido sola. US$ 0, sin red.
 */
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sesion = vi.hoisted(() => ({ user: null as null | { id: string }, rol: null as null | string }))
vi.mock('@/lib/supabase-session', () => ({
  getMiddlewareClient: () => ({
    auth: { getUser: async () => ({ data: { user: sesion.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: sesion.rol ? { role: sesion.rol } : null }) }) }) }),
  }),
}))

import { middleware } from '../middleware'

function rutas(dir: string, base = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return rutas(p, `${base}/${d.name}`)
    return d.name === 'route.ts' ? [`/api${base}`] : []
  })
}
const RUTAS = rutas(path.resolve(__dirname, '../app/api')).map((r) => r.replace(/\[[^\]]+\]/g, 'x'))
const pedir = (ruta: string, h: Record<string, string> = {}) => middleware(new NextRequest(`https://t.test${ruta}`, { method: 'POST', headers: h }))

beforeEach(() => { sesion.user = null; sesion.rol = null; process.env.INTERNAL_API_KEY = 'k-interna-de-prueba' })

describe('/api denegado por omisión', () => {
  it('la lista de rutas no está vacía (la prueba mira algo) y trae las cinco que estaban abiertas', () => {
    expect(RUTAS.length).toBeGreaterThan(20)
    for (const r of ['/api/cowork/messages', '/api/cowork/message', '/api/notifications/feed', '/api/dashboard/ops-extras', '/api/hitl/resolve']) expect(RUTAS).toContain(r)
  })
  it.each(RUTAS)('%s · sin sesión ni llave → 401', async (r) => { expect((await pedir(r)).status).toBe(401) })
  it.each(RUTAS)('%s · llave equivocada → 401', async (r) => { expect((await pedir(r, { 'x-api-key': 'otra' })).status).toBe(401) })
  it('sesión de alguien SIN rol o client_viewer → 403 (no entra a las rutas del tablero)', async () => {
    sesion.user = { id: 'u1' }
    expect((await pedir('/api/hitl/resolve')).status).toBe(403)
    sesion.rol = 'client_viewer'
    expect((await pedir('/api/cowork/messages')).status).toBe(403)
  })
  it('admin con sesión pasa; llave interna correcta pasa (x-api-key y x-internal-key)', async () => {
    sesion.user = { id: 'u1' }; sesion.rol = 'admin'
    expect((await pedir('/api/hitl/resolve')).status).toBe(200)
    sesion.user = null; sesion.rol = null
    expect((await pedir('/api/hitl/resolve', { 'x-api-key': 'k-interna-de-prueba' })).status).toBe(200)
    expect((await pedir('/api/cowork/messages', { 'x-internal-key': 'k-interna-de-prueba' })).status).toBe(200)
  })
  it('sin INTERNAL_API_KEY configurada NO hay camino por llave (ni con cabecera vacía)', async () => {
    delete process.env.INTERNAL_API_KEY
    expect((await pedir('/api/hitl/resolve', { 'x-api-key': '' })).status).toBe(401)
    expect((await pedir('/api/hitl/resolve', { 'x-api-key': 'undefined' })).status).toBe(401)
  })
})
