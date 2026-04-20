import { useQuery } from '@tanstack/react-query'
import { activityApi } from '@/api/activity'
import type { ActivityLogEntry } from '@/api/activity'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Activity,
} from 'lucide-react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import { alpha, useTheme } from '@mui/material/styles'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatEntityType(entityType: string): string {
  return entityType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const ACTION_CONFIG = {
  create: {
    Icon: Plus,
    label: 'Created',
    color: '#10B981', // green
  },
  update: {
    Icon: Pencil,
    label: 'Updated',
    color: '#3B82F6', // blue
  },
  delete: {
    Icon: Trash2,
    label: 'Deleted',
    color: '#EF4444', // red
  },
} as const

// ── Sub-components ─────────────────────────────────────────────────────────────

function actorLabel(entry: ActivityLogEntry): string {
  const u = entry.user
  if (u) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
    if (name.trim()) return name.trim()
    if (u.email) return u.email
  }
  if (entry.user_email) {
    const prefix = entry.user_email.split('@')[0]
    return prefix.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return 'System'
}

function entityLabel(entry: ActivityLogEntry): string {
  const name = entry.entity_name
  if (!name) return ''
  // If name is just a number (e.g. payment ID "2"), prefix with entity type
  if (/^\d+$/.test(name)) {
    return `#${name}`
  }
  return name
}

function ActivityItem({ entry }: { entry: ActivityLogEntry }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const config = ACTION_CONFIG[entry.action_type]
  const Icon = config.Icon

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2,
        py: 1.5,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Icon chip */}
      <Box
        sx={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(config.color, isDark ? 0.2 : 0.12),
          mt: 0.25,
        }}
      >
        <Icon size={14} color={config.color} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.4 }}>
          {actorLabel(entry)}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: 1.4, mt: 0.25 }}
        >
          <Box component="span" sx={{ color: config.color, fontWeight: 600 }}>
            {config.label}
          </Box>{' '}
          {formatEntityType(entry.entity_type)}
          {entityLabel(entry) && (
            <>
              {' — '}
              <Box
                component="span"
                sx={{
                  color: 'text.primary',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'inline',
                }}
              >
                {entityLabel(entry)}
              </Box>
            </>
          )}
        </Typography>
        {entry.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mt: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.description}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
          {formatRelativeTime(entry.created_at)}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ActivityDrawerProps {
  open: boolean
  onClose: () => void
}

export default function ActivityDrawer({ open, onClose }: ActivityDrawerProps) {
  const theme = useTheme()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['activity_recent'],
    queryFn: () => activityApi.getRecent(50),
    enabled: open,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 380,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 64,
          flexShrink: 0,
        }}
      >
        <Activity size={18} color={theme.palette.primary.main} />
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
          Recent Activity
        </Typography>
        <Tooltip title="Refresh">
          <span>
            <IconButton
              size="small"
              onClick={() => refetch()}
              disabled={isFetching}
              sx={{ color: 'text.secondary' }}
            >
              <RefreshCw size={15} className={isFetching ? 'spin' : ''} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <X size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {isError && (
          <Box sx={{ px: 3, pt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="error" gutterBottom>
              Failed to load activity.
            </Typography>
            <Typography
              variant="caption"
              color="primary"
              sx={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => refetch()}
            >
              Try again
            </Typography>
          </Box>
        )}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <Box sx={{ px: 3, pt: 6, textAlign: 'center' }}>
            <Activity size={32} color={theme.palette.text.disabled} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              No recent activity yet.
            </Typography>
          </Box>
        )}

        {!isLoading && data && data.length > 0 && (
          <Box>
            {data.map((entry, idx) => (
              <Box key={entry.id}>
                <ActivityItem entry={entry} />
                {idx < data.length - 1 && (
                  <Divider sx={{ mx: 2, opacity: 0.5 }} />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
