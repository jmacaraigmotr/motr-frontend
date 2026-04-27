import { useState, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { X, ChevronRight, ChevronLeft, Image, Square, Spline, MapPin, Hand } from 'lucide-react'

// ─── Tour step definitions ─────────────────────────────────────────────────────

interface ShortcutRef { key: string; label: string }

interface TourStep {
  target?: string
  icon?: React.ReactNode
  title: string
  description: string
  shortcut?: string
  shortcuts?: ShortcutRef[]
}

const STEPS: TourStep[] = [
  {
    title: 'Lot Builder Tour',
    description: 'Learn how to set up your parking lot in a few quick steps. Click Next to begin.',
  },
  {
    target: 'tool-blueprint',
    icon: <Image size={15} />,
    title: 'Step 1 — Add a Blueprint',
    description: 'Upload an aerial photo of your lot as a background reference. Trace your zones and spots over it for an accurate layout.',
  },
  {
    target: 'tool-draw-zone',
    icon: <Square size={15} />,
    title: 'Step 2 — Draw a Zone',
    description: 'Click and drag on the canvas to draw a rectangular parking zone. Zones group your spots and give them a label and color.',
    shortcut: 'Z',
  },
  {
    target: 'tool-draw-zone-poly',
    icon: <Spline size={15} />,
    title: 'Step 3 — Draw a Polygon Zone',
    description: 'For irregular shapes, click to place points and trace any outline. Press Enter or click "Finish" to close the polygon.',
    shortcut: 'Shift+Z',
  },
  {
    target: 'tool-place-spot',
    icon: <MapPin size={15} />,
    title: 'Step 4 — Place Spots',
    description: 'Click inside a zone to drop individual parking spots. Drag them to reposition, or resize using the handles when selected.',
    shortcut: 'S',
  },
  {
    target: 'tool-draw-spot-poly',
    icon: <Spline size={15} />,
    title: 'Step 5 — Draw a Polygon Spot',
    description: 'For angled or irregular spaces, click to trace the exact spot shape — great for diagonal rows or unusual stalls.',
    shortcut: 'Shift+S',
  },
  {
    target: 'tool-pan',
    icon: <Hand size={15} />,
    title: 'Step 6 — Pan the Canvas',
    description: 'Drag to scroll around your lot. You can also hold Space at any time to temporarily switch to pan mode without changing your tool.',
    shortcut: 'P',
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Here\'s a full reference for everything you can do from your keyboard:',
    shortcuts: [
      { key: 'V',       label: 'Select'        },
      { key: 'Z',       label: 'Zone (rect)'   },
      { key: 'Shift+Z', label: 'Zone (poly)'   },
      { key: 'S',       label: 'Spot'          },
      { key: 'Shift+S', label: 'Spot (poly)'   },
      { key: 'P',       label: 'Pan'           },
      { key: 'Space',   label: 'Temp pan'      },
      { key: 'Ctrl+Z',  label: 'Undo'          },
      { key: 'Ctrl+Y',  label: 'Redo'          },
      { key: 'Del',     label: 'Delete'        },
      { key: 'Enter',   label: 'Finish poly'   },
      { key: 'Esc',     label: 'Cancel'        },
    ],
  },
]

// ─── Spotlight geometry ────────────────────────────────────────────────────────

const PAD = 10
const CARD_W = 300

interface SpotRect { top: number; left: number; width: number; height: number }

function getSpotRect(target: string): SpotRect | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

// ─── Key chip helper ───────────────────────────────────────────────────────────

function KeyChips({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split('+')
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {parts.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && <Typography variant="caption" color="text.disabled">+</Typography>}
          <Chip
            label={k}
            size="small"
            sx={{ height: 20, fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, bgcolor: 'grey.100', border: '1px solid', borderColor: 'grey.300' }}
          />
        </Fragment>
      ))}
    </Box>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props { open: boolean; onClose: () => void }

export default function LotBuilderTour({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState<SpotRect | null>(null)

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  // Reset to first step when opened
  useEffect(() => { if (open) setStep(0) }, [open])

  // Update spotlight position when step changes
  useEffect(() => {
    if (!open) return
    setSpot(current.target ? getSpotRect(current.target) : null)
  }, [step, open, current.target])

  if (!open) return null

  const handleNext = () => isLast ? onClose() : setStep(s => s + 1)
  const handleBack = () => setStep(s => s - 1)

  // Card position: right of spotlight, or centered if no target
  const cardStyle: React.CSSProperties = spot
    ? {
        position: 'fixed',
        left: Math.min(spot.left + spot.width + 16, window.innerWidth - CARD_W - 16),
        top: Math.max(16, Math.min(spot.top + spot.height / 2 - 120, window.innerHeight - 360)),
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }

  return createPortal(
    <>
      {/* Backdrop panels */}
      {spot ? (
        <>
          <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: spot.top, bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1400 }} onClick={onClose} />
          <Box sx={{ position: 'fixed', top: spot.top + spot.height, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1400 }} onClick={onClose} />
          <Box sx={{ position: 'fixed', top: spot.top, left: 0, width: spot.left, height: spot.height, bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1400 }} onClick={onClose} />
          <Box sx={{ position: 'fixed', top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height, bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1400 }} onClick={onClose} />
          {/* Spotlight ring */}
          <Box sx={{
            position: 'fixed',
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            border: '2px solid', borderColor: 'primary.main', borderRadius: 2,
            boxShadow: '0 0 0 4px rgba(25,118,210,0.25)',
            zIndex: 1401, pointerEvents: 'none',
          }} />
        </>
      ) : (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1400 }} onClick={onClose} />
      )}

      {/* Tour card */}
      <Paper
        elevation={12}
        sx={{ ...cardStyle, width: CARD_W, zIndex: 1402, borderRadius: 2, overflow: 'hidden' }}
      >
        {/* Header */}
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.contrastText' }}>
            {current.icon && <Box sx={{ opacity: 0.9 }}>{current.icon}</Box>}
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.78rem' }}>
              {current.title}
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={onClose}
            sx={{ border: 'none', background: 'none', cursor: 'pointer', color: 'primary.contrastText', p: 0, display: 'flex', opacity: 0.75, '&:hover': { opacity: 1 } }}
          >
            <X size={14} />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2, pt: 1.75, pb: 1.25 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', lineHeight: 1.65 }}>
            {current.description}
          </Typography>

          {/* Single shortcut */}
          {current.shortcut && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>Shortcut</Typography>
              <KeyChips shortcut={current.shortcut} />
            </Box>
          )}

          {/* Shortcuts grid */}
          {current.shortcuts && (
            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              {current.shortcuts.map(s => (
                <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <KeyChips shortcut={s.key} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2, pb: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.disabled">
            {step + 1} / {STEPS.length}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isFirst && (
              <Button
                size="small" variant="outlined"
                onClick={handleBack}
                startIcon={<ChevronLeft size={13} />}
                sx={{ py: 0.4, px: 1.5, fontSize: '0.73rem', minWidth: 0 }}
              >
                Back
              </Button>
            )}
            <Button
              size="small" variant="contained"
              onClick={handleNext}
              endIcon={isLast ? undefined : <ChevronRight size={13} />}
              sx={{ py: 0.4, px: 1.5, fontSize: '0.73rem' }}
            >
              {isLast ? 'Done' : 'Next'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </>,
    document.body
  )
}
