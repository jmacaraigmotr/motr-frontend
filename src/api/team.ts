import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { Role } from '@/types/auth'

// Team and role management live in the auth API group — same auth mechanism,
// logically related to users and access control.
const api = createApiClient(API_GROUPS.auth)

export interface TeamMember {
  id: number
  created_at: number
  name: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  job_title: string | null
  status: 'active' | 'inactive' | 'pending'
  role_id: number | null
  shop_id: number | null
  last_login: string | null
  is_archived: boolean | null
}

export interface EditMemberInput {
  user_id: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  job_title?: string
  role_id?: number
  shop_id?: number
  status?: 'active' | 'inactive' | 'pending'
  is_archived?: boolean
}

export interface CreateMemberInput {
  first_name: string
  last_name: string
  email: string
  password: string
  phone?: string
  job_title?: string
  role_id?: number
  shop_id?: number
  status?: 'active' | 'inactive' | 'pending'
}

export interface UpdateMemberRoleInput {
  user_id: number
  role_id: number
}

export interface UpdateRoleInput {
  role_id: number
  name?: string
  description?: string
  default_view?: string
  is_active?: boolean
}

export const teamApi = {
  listMembers: async (params?: { shop_id?: number }): Promise<TeamMember[]> =>
    api.get('/auth/team_members', { params }),

  createMember: async (input: CreateMemberInput): Promise<TeamMember> => {
    const payload: Record<string, unknown> = { ...input }
    if (!payload.phone) delete payload.phone
    if (!payload.job_title) delete payload.job_title
    const rid = Number(payload.role_id)
    if (payload.role_id == null || payload.role_id === '' || !Number.isInteger(rid) || rid <= 0) {
      delete payload.role_id
    } else {
      payload.role_id = rid
    }
    return api.post('/auth/team_members', payload)
  },

  listRoles: async (): Promise<Role[]> =>
    api.get('/auth/roles'),

  updateMemberRole: async (input: UpdateMemberRoleInput): Promise<TeamMember> =>
    api.patch('/auth/team_members/role', input),

  updateRole: async (input: UpdateRoleInput): Promise<Role> =>
    api.patch('/auth/roles/update', input),

  editMember: async (input: EditMemberInput): Promise<TeamMember> =>
    api.patch('/auth/team_members/edit', input),
}
