import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { TeamChatThread, TeamChatMessage } from '@/types/chat'

const api = createApiClient(API_GROUPS.team_chat ?? '/team_chat')

export interface CreateThreadInput {
  title: string
  member_ids?: number[]
  is_private?: boolean
}

export interface CreateMessageInput {
  thread_id: number
  body: string
}

export interface UpdateThreadInput {
  thread_id: number
  title: string
}

export const teamChatApi = {
  listThreads: async (): Promise<TeamChatThread[]> =>
    api.get('/team_chat/threads/list'),

  createThread: async (data: CreateThreadInput): Promise<TeamChatThread> =>
    api.post('/team_chat/threads/create', data),

  updateThread: async (data: UpdateThreadInput): Promise<TeamChatThread> =>
    api.patch('/team_chat/threads/update', data),

  listMessages: async (thread_id: number): Promise<TeamChatMessage[]> =>
    api.get('/team_chat/messages/list', { params: { thread_id } }),

  createMessage: async (data: CreateMessageInput): Promise<TeamChatMessage> =>
    api.post('/team_chat/messages/create', data),
}
