import { useEffect, type RefObject } from 'react'
import type { TeamChatMessage } from '@/types'
import { formatTime, formatDateTime } from '@/lib/utils'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import { alpha, useTheme } from '@mui/material/styles'
import { avatarColor, initials } from './helpers'

interface Props {
  messages: TeamChatMessage[]
  loadingMessages: boolean
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  currentUserId?: number
  memberName: (id: number) => string
  scrollRef: RefObject<HTMLDivElement>
  topSentinelRef: RefObject<HTMLDivElement>
  onScroll: () => void
  onLoadMore: () => void
}

function dateSeparatorLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export default function MessageList({
  messages, loadingMessages, hasNextPage, isFetchingNextPage,
  currentUserId, memberName, scrollRef, topSentinelRef, onScroll, onLoadMore,
}: Props) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  useEffect(() => {
    const sentinel  = topSentinelRef.current
    const container = scrollRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore()
        }
      },
      { root: container, threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore, scrollRef, topSentinelRef])

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }} ref={scrollRef} onScroll={onScroll}>
      <div ref={topSentinelRef} style={{ height: 1 }} />

      {isFetchingNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
          <CircularProgress size={16} />
        </Box>
      )}

      {!hasNextPage && !loadingMessages && messages.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
            Beginning of conversation
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
      )}

      {loadingMessages ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={20} />
        </Box>
      ) : messages.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" color="text.disabled">No messages yet — say hello!</Typography>
        </Box>
      ) : (
        messages.map((msg, idx) => {
          const mine        = msg.user_id === currentUserId
          const prev        = messages[idx - 1]
          const isFirst     = !prev || prev.user_id !== msg.user_id
          const newDay      = !prev || !isSameDay(prev.created_at, msg.created_at)
          const name        = memberName(msg.user_id)
          const isOptimistic = msg.id < 0

          // Treat new-day boundary as a new sender group too
          const showHeader = isFirst || newDay

          return (
            <Box key={msg.id}>
              {/* Date separator */}
              {newDay && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.75 }}>
                  <Divider sx={{ flex: 1 }} />
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{
                      whiteSpace: 'nowrap', fontSize: '0.68rem', fontWeight: 600,
                      px: 1, py: 0.25,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {dateSeparatorLabel(msg.created_at)}
                  </Typography>
                  <Divider sx={{ flex: 1 }} />
                </Box>
              )}

              <Box sx={{
                display: 'flex', flexDirection: mine ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 1,
                mb: showHeader ? 1.5 : 0.35,
                mt: showHeader && idx > 0 && !newDay ? 1.5 : 0,
              }}>
                {!mine && (
                  <Box sx={{ width: 30, flexShrink: 0, mb: 0.25 }}>
                    {showHeader && (
                      <Avatar sx={{ width: 30, height: 30, bgcolor: avatarColor(msg.user_id), fontSize: '0.65rem', fontWeight: 700 }}>
                        {initials(name)}
                      </Avatar>
                    )}
                  </Box>
                )}

                <Box sx={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {showHeader && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.35, px: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: mine ? 'primary.main' : 'text.primary' }}>
                        {mine ? 'You' : name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                        {formatTime(msg.created_at)}
                      </Typography>
                    </Box>
                  )}
                  <Tooltip title={msg.created_at ? formatDateTime(msg.created_at) : '—'} placement={mine ? 'left' : 'right'} arrow>
                    <Box sx={{
                      px: 1.5, py: 0.875,
                      borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      bgcolor: mine ? 'primary.main' : isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.06),
                      color: mine ? 'primary.contrastText' : 'text.primary',
                      opacity: isOptimistic ? 0.65 : 1, transition: 'opacity 0.2s',
                    }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.body}
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          )
        })
      )}
    </Box>
  )
}
