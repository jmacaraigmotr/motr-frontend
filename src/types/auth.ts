export interface User {
  id: number
  name: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  job_title: string | null
  profile_image: string | null
  status: 'active' | 'inactive' | 'pending'
  role: Role | null
  shop: Shop | null
  last_login: string | null
}

export interface Role {
  id: number
  code: string
  name: string
  description?: string | null
  default_view: string | null
  is_active?: boolean
}

export interface Shop {
  id: number
  name: string
  address: string | null
  phone: string | null
  brand_color: string | null  // hex e.g. "#1E40AF" — drives sidebar bg per shop
  canvas_cols: number | null  // lot builder macro grid width
  canvas_rows: number | null  // lot builder macro grid height
}

export interface Department {
  id: number
  name: string
  display_name: string | null
  sequence_order: number | null
  color: string | null
  shop_id: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  authToken: string
  user: User
}
