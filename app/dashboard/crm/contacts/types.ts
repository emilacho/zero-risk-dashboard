export interface ContactTag {
  id: string
  tag: string
  tag_category: string | null
}

export interface Contact {
  id: string
  client_id: string
  champion_name: string
  champion_role: string | null
  champion_email: string | null
  champion_phone: string | null
  relationship_strength: "weak" | "medium" | "strong" | "very_strong"
  influence_level: "low" | "medium" | "high" | "executive"
  last_contact_at: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  tags: ContactTag[]
}

export interface ContactsListResponse {
  ok: true
  rows: Contact[]
  total: number
  limit: number
  offset: number
}

export interface ContactDetailResponse {
  ok: true
  contact: Contact
  tags: ContactTag[]
  relationships: {
    outbound: ContactRelationship[]
    inbound: ContactRelationship[]
  }
}

export interface ContactRelationship {
  id: string
  from_contact_id: string
  from_contact_type: string
  to_contact_id: string
  to_contact_type: string
  relationship_type: string
  strength: "weak" | "medium" | "strong"
  notes: string | null
  established_at: string | null
  created_at: string
}

export type ApiError = { ok: false; error: string }
