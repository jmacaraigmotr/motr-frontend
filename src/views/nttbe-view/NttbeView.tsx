import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import { MoveRight, CheckCircle, Clock, MapPin, AlertCircle } from 'lucide-react'
import { initials } from '@/lib/utils'

// ─── Placeholder task data (will be replaced by tasks API) ────────────────────

interface MockTask {
  id: number
  title: string
  roNumber?: string
  vehicle?: string
  type: 'transport' | 'pickup' | 'dropoff' | 'sublet' | 'intake' | 'other'
  status: 'pending' | 'in_progress' | 'complete'
  priority: 'normal' | 'high' | 'rush'
  location?: string
  notes?: string
  assignedAt: string
}

const TASK_TYPE_COLORS: Record<MockTask['type'], string> = {
  transport: '#42A5F5',
  pickup:    '#66BB6A',
  dropoff:   '#FFA726',
  sublet:    '#CE93D8',
  intake:    '#4FC3F7',
  other:     '#78909C',
}

const TASK_TYPE_LABELS: Record<MockTask['type'], string> = {
  transport: 'Transport',
  pickup:    'Pick Up',
  dropoff:   'Drop Off',
  sublet:    'Sublet',
  intake:    'Intake Photos',
  other:     'Task',
}

// ─── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, active, onClick,
}: {
  task: MockTask
  active?: boolean
  onClick: () => void
}) {
  const typeColor = TASK_TYPE_COLORS[task.type]
  const isRush = task.priority === 'rush'

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3, mb: 1.5, cursor: 'pointer',
        borderColor: active ? 'primary.main' : isRush ? 'error.main' : 'divider',
        borderWidth: active || isRush ? 1.5 : 1,
        bgcolor: active ? 'rgba(251,191,36,0.04)' : 'background.paper',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 0 }}>
        <CardContent sx={{ p: '14px 16px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            {/* Type dot */}
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: typeColor, flexShrink: 0, mt: 0.75,
            }} />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: typeColor, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem' }}>
                  {TASK_TYPE_LABELS[task.type]}
                </Typography>
                {task.roNumber && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.72rem' }}>
                    {task.roNumber}
                  </Typography>
                )}
                {isRush && <Chip label="RUSH" size="small" color="error" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />}
                {active && <Chip label="Active" size="small" color="primary" sx={{ height: 18, fontSize: '0.62rem' }} />}
              </Box>

              <Typography variant="body2" fontWeight={600} noWrap mb={0.25}>{task.title}</Typography>

              {task.vehicle && (
                <Typography variant="caption" color="text.secondary" display="block" noWrap>{task.vehicle}</Typography>
              )}

              {task.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                  <MapPin size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.disabled" noWrap>{task.location}</Typography>
                </Box>
              )}

              {task.notes && (
                <Typography variant="caption" color="text.disabled" display="block" mt={0.5} sx={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic',
                }}>
                  {task.notes}
                </Typography>
              )}
            </Box>

            {/* Status icon */}
            {task.status === 'complete' && <CheckCircle size={16} color="#66BB6A" style={{ flexShrink: 0, marginTop: 2 }} />}
            {task.status === 'in_progress' && <Clock size={16} color="#FBBF24" style={{ flexShrink: 0, marginTop: 2 }} />}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

// ─── NTTBE View ────────────────────────────────────────────────────────────────

export default function NttbeView() {
  const { user } = useAuth()
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)

  // Placeholder — replace with real tasks API once built
  const mockTasks: MockTask[] = [
    {
      id: 1, title: 'Transport to Espo\'s (sublet)',
      roNumber: 'RO-3467', vehicle: '2022 Mercedes AMG',
      type: 'sublet', status: 'in_progress', priority: 'rush',
      location: 'North → Espo\'s Body',
      notes: 'Call ahead — they close at 5pm',
      assignedAt: new Date().toISOString(),
    },
    {
      id: 2, title: 'Customer pickup — Jennifer Dragoy',
      roNumber: 'RO-3468', vehicle: '2020 Ford Fusion',
      type: 'pickup', status: 'pending', priority: 'normal',
      location: 'Customer home → South',
      assignedAt: new Date().toISOString(),
    },
    {
      id: 3, title: 'Move to detail bay',
      roNumber: 'RO-3469', vehicle: '2021 Honda Accord',
      type: 'transport', status: 'pending', priority: 'normal',
      location: 'South lot → Inside (Detail Bay 2)',
      assignedAt: new Date().toISOString(),
    },
    {
      id: 4, title: 'Intake photos — new arrival',
      roNumber: 'RO-3471', vehicle: '2019 Honda Civic',
      type: 'intake', status: 'pending', priority: 'high',
      location: 'North — Bay 3',
      assignedAt: new Date().toISOString(),
    },
  ]

  const activeTask = mockTasks.find(t => t.id === activeTaskId) ?? mockTasks.find(t => t.status === 'in_progress') ?? null
  const upcoming = mockTasks.filter(t => t !== activeTask && t.status !== 'complete')
  const completed = mockTasks.filter(t => t.status === 'complete')

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', px: 2.5, py: 3, height: '100%', overflowY: 'auto' }}>
      {/* User header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ width: 44, height: 44, bgcolor: 'rgba(167,243,208,0.15)', color: '#6EE7B7', fontWeight: 800, fontSize: 14 }}>
          {initials(user?.first_name, user?.last_name)}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">Driver / NTTBE</Typography>
        </Box>
        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
          <Typography variant="h5" fontWeight={900} color="primary.main">{upcoming.length}</Typography>
          <Typography variant="caption" color="text.disabled">tasks left</Typography>
        </Box>
      </Box>

      {/* Active task */}
      {activeTask ? (
        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" color="primary.main" display="block" mb={1.5} letterSpacing="0.1em">
            Current Task
          </Typography>
          <Card sx={{
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(251,191,36,0.04) 100%)',
            border: '1.5px solid rgba(251,191,36,0.35)',
          }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TASK_TYPE_COLORS[activeTask.type], flexShrink: 0 }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: TASK_TYPE_COLORS[activeTask.type], textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
                  {TASK_TYPE_LABELS[activeTask.type]}
                </Typography>
                {activeTask.roNumber && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    · {activeTask.roNumber}
                  </Typography>
                )}
                {activeTask.priority === 'rush' && (
                  <Chip label="RUSH" size="small" color="error" sx={{ ml: 'auto', height: 20, fontWeight: 800 }} />
                )}
              </Box>

              <Typography variant="subtitle2" fontWeight={800} mb={0.5}>{activeTask.title}</Typography>

              {activeTask.vehicle && (
                <Typography variant="body2" color="text.secondary" mb={0.5}>{activeTask.vehicle}</Typography>
              )}

              {activeTask.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                  <MapPin size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
                  <Typography variant="body2" color="text.secondary">{activeTask.location}</Typography>
                </Box>
              )}

              {activeTask.notes && (
                <Box sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontStyle="italic">{activeTask.notes}</Typography>
                </Box>
              )}

              <Button
                variant="contained" fullWidth
                sx={{ borderRadius: 3, py: 1.25, fontWeight: 700, fontSize: '0.9rem' }}
                startIcon={<CheckCircle size={18} />}
              >
                Mark Complete
              </Button>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Box sx={{
          textAlign: 'center', py: 4, mb: 3,
          bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4,
          border: '1px dashed rgba(255,255,255,0.1)',
        }}>
          <MoveRight size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
          <Typography variant="body2" color="text.disabled">No active task</Typography>
          <Typography variant="caption" color="text.disabled">Start a task below to get going</Typography>
        </Box>
      )}

      {/* Upcoming tasks */}
      {upcoming.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary" display="block" mb={1.5}>
            Upcoming ({upcoming.length})
          </Typography>
          {upcoming.map((t) => (
            <TaskCard
              key={t.id} task={t}
              active={t.id === activeTask?.id}
              onClick={() => setActiveTaskId(t.id === activeTaskId ? null : t.id)}
            />
          ))}
        </>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <>
          <Typography variant="overline" color="text.disabled" display="block" mt={2} mb={1}>
            Completed Today ({completed.length})
          </Typography>
          {completed.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => {}} />
          ))}
        </>
      )}
    </Box>
  )
}
