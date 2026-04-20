import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { VoiceRecording } from '@/types/repairOrder'

const api = createApiClient(API_GROUPS.repair_orders)

export const voiceApi = {
  listByRO: async (repair_order_id: number): Promise<VoiceRecording[]> =>
    api.get('/voice/list', { params: { repair_order_id } }),

  upload: async (repair_order_id: number, formData: FormData): Promise<VoiceRecording> =>
    api.post('/voice/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { repair_order_id },
    }),
}
