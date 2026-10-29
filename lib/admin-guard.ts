/**
 * La puerta de las rutas de `/api` que muestran o deciden piezas: SOLO una sesión de administrador (Emilio). Sin sesión 401; con sesión pero sin rol de admin 403.
 * Las rutas nuevas llaman a esto en su primera línea (el middleware deja pasar toda `/api/*`, así que cada ruta se cierra sola).
 */
import { getCurrentRole } from "@/lib/supabase-session"

export type Puerta = { ok: true; email: string | null } | { ok: false; status: 401 | 403 }

export async function exigirAdmin(): Promise<Puerta> {
  try {
    const r = await getCurrentRole()
    if (!r.userId) return { ok: false, status: 401 }
    if (r.role !== "admin") return { ok: false, status: 403 }
    return { ok: true, email: r.email }
  } catch {
    return { ok: false, status: 401 }
  }
}
