export interface TeamChatThread {
  id: number
  title: string
  created_at: string
  updated_at: string
  created_by: number
  is_private?: boolean
  is_pinned?: boolean
  last_message_at?: string | null
  last_message_preview?: string | null
  last_read_at?: string | null
  member_ids?: number[]
}

export interface TeamChatMessage {
  id: number
  thread_id: number
  user_id: number
  body: string
  created_at: string
  edited_at?: string | null
}
