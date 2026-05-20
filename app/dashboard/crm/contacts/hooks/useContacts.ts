"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Contact, ContactDetailResponse, ContactsListResponse } from "../types"

interface UseContactsParams {
  search?: string
  clientId?: string
  tag?: string
  limit?: number
  offset?: number
}

async function fetchContacts(params: UseContactsParams): Promise<ContactsListResponse> {
  const url = new URL("/api/contacts", window.location.origin)
  if (params.search) url.searchParams.set("search", params.search)
  if (params.clientId) url.searchParams.set("client_id", params.clientId)
  if (params.tag) url.searchParams.set("tag", params.tag)
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit))
  if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset))
  const res = await fetch(url.toString().replace(window.location.origin, ""), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Contacts fetch failed · HTTP ${res.status}`)
  return (await res.json()) as ContactsListResponse
}

export function useContacts(params: UseContactsParams = {}) {
  return useQuery<ContactsListResponse>({
    queryKey: ["crm", "contacts", params],
    queryFn: () => fetchContacts(params),
  })
}

export function useContact(id: string | null) {
  return useQuery<ContactDetailResponse>({
    queryKey: ["crm", "contact", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${id}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Contact ${id} fetch failed · HTTP ${res.status}`)
      return (await res.json()) as ContactDetailResponse
    },
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Contact> & { client_id: string; champion_name: string }) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok: boolean; contact?: Contact; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "create failed")
      }
      return data.contact!
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] })
    },
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as { ok: boolean; contact?: Contact; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "update failed")
      return data.contact!
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] })
      qc.invalidateQueries({ queryKey: ["crm", "contact", id] })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "delete failed")
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] })
    },
  })
}

export function useAssignTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { contact_id: string; tag: string; tag_category?: string | null }) => {
      const res = await fetch("/api/contact-tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "assign tag failed")
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] })
      qc.invalidateQueries({ queryKey: ["crm", "contact", vars.contact_id] })
    },
  })
}

export function useUnassignTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/contact-tags?id=${encodeURIComponent(tagId)}`, {
        method: "DELETE",
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "unassign tag failed")
      return tagId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] })
    },
  })
}
