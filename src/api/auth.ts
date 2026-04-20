import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { LoginRequest, LoginResponse, User } from '@/types'

const api = createApiClient(API_GROUPS.authentication)

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> =>
    api.post('/auth/login', data),

  me: async (): Promise<User> =>
    api.get('/auth/me'),

  logout: async (): Promise<void> =>
    api.post('/auth/logout'),
}
