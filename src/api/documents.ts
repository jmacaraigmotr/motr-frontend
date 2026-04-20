import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { CustomerDocument, DocumentEntityType, DocumentCategory } from '@/types/document'

// Documents live in the customers API group (same Xano group as vehicles)
const api = createApiClient(API_GROUPS.customers)

export const documentsApi = {
  list: async (entityType: DocumentEntityType, entityId: number): Promise<CustomerDocument[]> =>
    api.get('/documents/list', { params: { entity_type: entityType, entity_id: entityId } }),

  upload: async (params: {
    entityType: DocumentEntityType
    entityId: number
    file: File
    category?: DocumentCategory
    label?: string
    shopId?: number
  }): Promise<CustomerDocument> => {
    const form = new FormData()
    form.append('entity_type', params.entityType)
    form.append('entity_id', String(params.entityId))
    form.append('file', params.file)
    if (params.category) form.append('category', params.category)
    if (params.label)    form.append('label', params.label)
    if (params.shopId)   form.append('shop_id', String(params.shopId))
    return api.post('/documents/upload', form)
  },

  delete: async (id: number): Promise<{ success: boolean }> =>
    api.delete('/documents/delete', { params: { id } }),
}
