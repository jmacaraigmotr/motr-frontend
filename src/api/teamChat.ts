import { createApiClient } from './client'
import { API_GROUPS } from './groups'
import type { TeamChatThread, TeamChatMessage } from '@/types/chat'

const api = createApiClient(API_GROUPS.team_chat ?? '/team_chat')

export interface MessagesPage {
  items: TeamChatMessage[]
  has_more: boolean
  next_cursor: number | null
}

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

export interface AddMembersInput {
  thread_id: number
  user_ids: number[]
}

export interface PinThreadInput {
  thread_id: number
  is_pinned: boolean
}

export const teamChatApi = {
  listThreads: async (): Promise<TeamChatThread[]> =>
    api.get('/team_chat/threads/list'),

  createThread: async (data: CreateThreadInput): Promise<TeamChatThread> =>
    api.post('/team_chat/threads/create', data),

  updateThread: async (data: UpdateThreadInput): Promise<TeamChatThread> =>
    api.patch('/team_chat/threads/update', data),

  addMembers: async (data: AddMembersInput): Promise<{ success: boolean }> =>
    api.post('/team_chat/threads/add_members', data),

  pinThread: async (data: PinThreadInput): Promise<TeamChatThread> =>
    api.patch('/team_chat/threads/pin', data),

  markRead: async (thread_id: number): Promise<{ success: boolean }> =>
    api.patch('/team_chat/threads/mark_read', { thread_id }),

  listMessages: async (thread_id: number, before_id?: number): Promise<MessagesPage> =>
    api.get('/team_chat/messages/list', {
      params: { thread_id, ...(before_id != null ? { before_id } : {}) },
    }),

  createMessage: async (data: CreateMessageInput): Promise<TeamChatMessage> =>
    api.post('/team_chat/messages/create', data),
}
