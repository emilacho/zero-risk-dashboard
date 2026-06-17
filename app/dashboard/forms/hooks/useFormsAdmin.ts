"use client"
import { useQuery } from "@tanstack/react-query"

export interface FormRow {
  id: string
  name: string
  vertical: string | null
  tally_form_id: string | null
  description: string | null
  schema_fields: unknown[]
  is_active: boolean
  created_at: string
  updated_at: string
  submissions_count: number
}

export interface FormSubmissionRow {
  id: string
  form_id: string | null
  contact_id: string | null
  payload: Record<string, unknown>
  source: string
  source_event_id: string | null
  signature_verified: boolean
  processed_at: string | null
  processing_error: string | null
  created_at: string
}

export function useForms() {
  return useQuery<{ rows: FormRow[]; total: number }>({
    queryKey: ["sprint4", "forms"],
    queryFn: async () => {
      const res = await fetch("/api/forms", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { ok: boolean; rows: FormRow[]; total: number; error?: string }
      if (!json.ok) throw new Error(json.error ?? "forms fetch failed")
      return { rows: json.rows, total: json.total }
    },
  })
}

export function useFormSubmissions(formId: string | null) {
  return useQuery<{ rows: FormSubmissionRow[]; total: number }>({
    queryKey: ["sprint4", "form_submissions", formId],
    queryFn: async () => {
      const url = new URL("/api/form-submissions", window.location.origin)
      if (formId) url.searchParams.set("form_id", formId)
      const res = await fetch(url.toString().replace(window.location.origin, ""), { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as {
        ok: boolean
        rows: FormSubmissionRow[]
        total: number
        error?: string
      }
      if (!json.ok) throw new Error(json.error ?? "submissions fetch failed")
      return { rows: json.rows, total: json.total }
    },
  })
}
