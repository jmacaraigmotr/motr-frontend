export interface Company {
  id: number
  shop_id: number
  name: string
  phone: string | null
  email: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateCompanyInput {
  name: string
  shop_id?: number
  phone?: string
  email?: string
  address_line1?: string
  city?: string
  state?: string
  zip?: string
  notes?: string
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {}
