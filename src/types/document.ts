export type DocumentEntityType = 'customer' | 'vehicle' | 'repair_order'

export type DocumentCategory = 'drivers_license' | 'registration' | 'insurance_card' | 'other'

export interface DocumentFile {
  access: string
  path: string
  name: string
  type: string        // 'image' | 'document' | etc.
  size: number
  mime: string
  url: string
  meta?: { width?: number; height?: number } | null
}

export interface CustomerDocument {
  id: number
  shop_id: number
  uploaded_by: number | null
  entity_type: DocumentEntityType
  entity_id: number
  category: DocumentCategory | null
  label: string | null
  file: DocumentFile | null
  created_at: string
  updated_at: string
}
