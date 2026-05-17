/**
 * Password validation schema · shared client + server.
 *
 * Used by · /auth/update-password (recovery flow) and /settings/security
 * (logged-in change). Min 8 chars · at least 1 letter and 1 number ·
 * confirm match enforced at the form layer (zod refine).
 */
import { z } from "zod"

export const PasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres · Supabase Auth limit")
  .refine((v) => /[A-Za-z]/.test(v), "Debe incluir al menos 1 letra")
  .refine((v) => /[0-9]/.test(v), "Debe incluir al menos 1 número")

export const UpdatePasswordFormSchema = z
  .object({
    password: PasswordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  })

export type UpdatePasswordForm = z.infer<typeof UpdatePasswordFormSchema>
