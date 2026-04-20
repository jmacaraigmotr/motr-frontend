export interface Vehicle {
  id: number
  customer_id: number
  vin: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  color: string | null
  license_plate: string | null
  license_state: string | null
  mileage_in: number | null
  insurance_company: string | null
  insurance_policy_number: string | null
  created_at: string
}

export interface CreateVehicleInput {
  customer_id: number
  vin?: string
  year?: number
  make?: string
  model?: string
  trim?: string
  color?: string
  license_plate?: string
  license_state?: string
  mileage_in?: number
  insurance_company?: string
  insurance_policy_number?: string
}
