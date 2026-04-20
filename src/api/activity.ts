import { createApiClient } from './client'
import { API_GROUPS } from './groups'

// NOTE: After pushing the backend to Xano, the 'activity' key will be
// auto-generated in groups.ts. Until then, the canonical falls back to
// the placeholder value set in backend/apis/activity/api_group.xs.
const api = createApiClient((API_GROUPS as Record<string, string>)['activity'] ?? 'actvlg01')

export interface ActivityLogEntry {
  id: number
  created_at: string
  user_id: number | null
  user_email: string | null
  user: { id: number; first_name: string | null; last_name: string | null; email: string | null } | null
  action_type: 'create' | 'update' | 'delete'
  entity_type: string
  entity_id: number | null
  entity_name: string | null
  description: string | null
}

export const activityApi = {
  getRecent: async (limit = 50): Promise<ActivityLogEntry[]> => {
    const res = await api.get('/activity/recent', { params: { limit } }) as any
    // Xano returns paginated shape { items: [...] } when totals:false skips normalization
    if (Array.isArray(res?.items)) return res.items
    if (Array.isArray(res?.data)) return res.data
    if (Array.isArray(res)) return res
    return []
  },
}
