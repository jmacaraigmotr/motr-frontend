import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

// ── Types ──────────────────────────────────────────────────────────────────────

type TooltipPos = 'center' | 'bottom' | 'top' | 'right' | 'left' | 'fixed-br'

type StepConfig = {
  id: string
  view?: string           // navigate to this view before showing
  tourAction?: string     // dispatch to uiStore (triggers dialog opens etc.)
  targetId?: string       // data-tour-id of element to spotlight / ring-highlight
  tooltipPos: TooltipPos
  overlay: boolean        // true = dark overlay + spotlight; false = ring only
  title: string
  body: string
  waitMs?: number         // extra wait after navigate / action before finding element
}

// ── Step Definitions ───────────────────────────────────────────────────────────

const STEPS: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to MOTR',
    body: "Let's take a 60-second tour of the key things you can do. You can skip at any time.",
    tooltipPos: 'center',
    overlay: true,
  },
  {
    id: 'dashboard',
    view: 'dashboard-view',
    targetId: 'dashboard-main',
    title: 'Your Dashboard',
    body: "See today's active repair orders, overdue tasks, and shop activity — all at a glance.",
    tooltipPos: 'center',
    overlay: true,
    waitMs: 400,
  },
  {
    id: 'customers-page',
    view: 'customer-view',
    targetId: 'customers-header',
    title: 'Customers',
    body: 'Every customer, vehicle, repair history, and payment lives here.',
    tooltipPos: 'bottom',
    overlay: true,
    waitMs: 400,
  },
  {
    id: 'add-customer-btn',
    targetId: 'add-customer-btn',
    title: 'Add a Customer',
    body: "Click 'Add Customer' to create a new profile — fill in their name, contact info, and address.",
    tooltipPos: 'bottom',
    overlay: true,
  },
  {
    id: 'add-customer-form',
    tourAction: 'open-add-customer',
    targetId: 'add-customer-dialog',
    title: 'Customer Form',
    body: "Try it out — enter a first name, last name, and phone number, then click Save.",
    tooltipPos: 'fixed-br',
    overlay: false,
    waitMs: 500,
  },
  {
    id: 'customer-detail',
    tourAction: 'open-first-customer',
    targetId: 'customer-detail-dialog',
    title: 'Customer Profile',
    body: "Click any customer to open their full profile — with tabs for vehicles, repair orders, payments, and more.",
    tooltipPos: 'fixed-br',
    overlay: false,
    waitMs: 600,
  },
  {
    id: 'customer-actions',
    targetId: 'customer-detail-actions',
    title: 'Add Vehicles & Repair Orders',
    body: "From here: add vehicles, start a new repair order, or edit the profile. Each tab shows full history.",
    tooltipPos: 'fixed-br',
    overlay: true,
  },
  {
    id: 'team-chat-launcher',
    targetId: 'team-chat-launcher',
    title: 'Team Chat',
    body: "See the red 'New' badge? That means someone on your team just pinged you. Click the chat icon to jump in.",
    tooltipPos: 'left',
    overlay: true,
    waitMs: 200,
    tourAction: 'prep-team-chat',
  },
  {
    id: 'team-chat-window',
    tourAction: 'open-team-chat',
    targetId: 'team-chat-drawer',
    title: 'Real-time Collaboration',
    body: 'Chat in threads, mention teammates, and keep questions out of group texts. Replies show up instantly right here.',
    tooltipPos: 'left',
    overlay: true,
    waitMs: 500,
  },
  {
    id: 'tour-replay',
    targetId: 'tour-relaunch-btn',
    title: 'Need a refresher?',
    body: 'Tap this question mark anytime to replay the walkthrough and revisit every feature.',
    tooltipPos: 'left',
    overlay: true,
    waitMs: 200,
    tourAction: 'close-team-chat',
  },
  {
    id: 'done',
    tourAction: 'close-all',
    title: "You're all set!",
    body: "Add your first customer, then hit the orange 'New Repair Order' button in the sidebar whenever a car comes in.",
    tooltipPos: 'center',
    overlay: true,
    waitMs: 300,
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

type Rect = { top: number; left: number; width: number; height: number }

function getTooltipStyle(
  spotlight: Rect | null,
  pos: TooltipPos,
  cardW = 340,
  cardH = 185,
): React.CSSProperties {
  const PAD = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Fixed bottom-right corner — used for dialog steps so the tooltip is always visible
  if (pos === 'fixed-br') {
    return {
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: cardW,
      zIndex: 9100,
    }
  }

  if (pos === 'center' || !spotlight) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardW,
      zIndex: 9100,
    }
  }

  const { top, left, width, height } = spotlight

  if (pos === 'bottom') {
    let t = top + height + PAD
    let l = left + width / 2 - cardW / 2
    l = Math.max(PAD, Math.min(vw - cardW - PAD, l))
    // If off-screen below, try above; if that's also off-screen, fall back to fixed-br
    if (t + cardH > vh - PAD) {
      t = top - cardH - PAD
      if (t < PAD) return { position: 'fixed', bottom: 24, right: 24, width: cardW, zIndex: 9100 }
    }
    return { position: 'fixed', top: t, left: l, width: cardW, zIndex: 9100 }
  }

  if (pos === 'top') {
    let t = top - cardH - PAD
    let l = left + width / 2 - cardW / 2
    l = Math.max(PAD, Math.min(vw - cardW - PAD, l))
    if (t < PAD) t = top + height + PAD
    return { position: 'fixed', top: t, left: l, width: cardW, zIndex: 9100 }
  }

  if (pos === 'right') {
    let l = left + width + PAD
    let t = top + height / 2 - cardH / 2
    t = Math.max(PAD, Math.min(vh - cardH - PAD, t))
    if (l + cardW > vw - PAD) l = left - cardW - PAD
    return { position: 'fixed', top: t, left: l, width: cardW, zIndex: 9100 }
  }

  if (pos === 'left') {
    let l = left - cardW - PAD
    let t = top + height / 2 - cardH / 2
    t = Math.max(PAD, Math.min(vh - cardH - PAD, t))
    if (l < PAD) l = left + width + PAD
    return { position: 'fixed', top: t, left: l, width: cardW, zIndex: 9100 }
  }

  return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: cardW, zIndex: 9100 }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface WalkthroughTourProps {
  open: boolean
  userName?: string | null
  onDismiss: (completed: boolean) => void
  switchView: (view: string) => void
}

export default function WalkthroughTour({
  open,
  userName,
  onDismiss,
  switchView,
}: WalkthroughTourProps) {
  const { setTourAction } = useUIStore()
  const [step, setStep] = useState(0)
  const [spotlight, setSpotlight] = useState<Rect | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setStep(0)
      setSpotlight(null)
      setTransitioning(false)
    }
  }, [open])

  // Handle step transitions: navigate, dispatch actions, find target element
  useEffect(() => {
    if (!open) return

    let cancelled = false
    setTransitioning(true)
    setSpotlight(null)

    const run = async () => {
      const cfg = STEPS[step]

      // 1. Navigate to view if specified
      if (cfg.view) {
        switchView(cfg.view)
        await sleep(cfg.waitMs ?? 350)
        if (cancelled) return
      }

      // 2. Dispatch tourAction if specified
      if (cfg.tourAction) {
        // Close existing overlays before opening destination views
        if (
          cfg.tourAction === 'open-first-customer' ||
          cfg.tourAction === 'open-team-chat' ||
          cfg.tourAction === 'prep-team-chat'
        ) {
          setTourAction('close-all')
          await sleep(280)
          if (cancelled) return
        }
        setTourAction(cfg.tourAction)
        const wait = cfg.view ? 300 : (cfg.waitMs ?? 450)
        await sleep(wait)
        if (cancelled) return
      } else if (!cfg.view) {
        await sleep(80)
        if (cancelled) return
      }

      // 3. Find the target element (poll for up to ~2s)
      if (cfg.targetId) {
        for (let i = 0; i < 16; i++) {
          if (cancelled) return
          const el = document.querySelector(`[data-tour-id="${cfg.targetId}"]`)
          if (el) {
            const r = el.getBoundingClientRect()
            setSpotlight({ top: r.top, left: r.left, width: r.width, height: r.height })
            break
          }
          await sleep(130)
        }
      }

      if (!cancelled) setTransitioning(false)
    }

    run()
    return () => { cancelled = true }
  }, [step, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    if (transitioning) return
    if (step === STEPS.length - 1) {
      onDismiss(true)
    } else {
      setStep(s => s + 1)
    }
  }

  const handleBack = () => {
    if (transitioning || step === 0) return
    setStep(s => s - 1)
  }

  const handleSkip = () => {
    setTourAction('close-all')
    onDismiss(false)
  }

  const cfg = STEPS[step]
  const celebrate = cfg.id === 'done'
  const confettiPieces = useMemo(() => {
    if (!celebrate) return []
    const colors = ['#F97316', '#10B981', '#3B82F6', '#F43F5E', '#FACC15']
    return Array.from({ length: 18 }, (_, i) => ({
      left: `${(i / 18) * 100}%`,
      delay: `${(i % 6) * 0.18}s`,
      duration: 2.4 + (i % 4) * 0.25,
      color: colors[i % colors.length],
      size: 8 + (i % 3) * 3,
      rotate: (i * 17) % 40,
    }))
  }, [celebrate])
  const isLast = step === STEPS.length - 1
  const firstName = userName?.split(' ')[0] ?? ''
  const SPAD = 8 // spotlight padding

  const tooltipStyle = getTooltipStyle(spotlight, cfg.tooltipPos)
  const showSpotlightOverlay = cfg.overlay && Boolean(spotlight)
  const showBackdropOverlay = cfg.overlay && !spotlight

  if (!open) return null

  return createPortal(
    <>
      {/* ── Dark overlay (spotlight) ── */}
      {showSpotlightOverlay && spotlight && (
        <>
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 8998,
              pointerEvents: 'all',
            }}
            onClick={e => e.stopPropagation()}
          />
          <Box
            sx={{
              position: 'fixed',
              top: spotlight.top - SPAD,
              left: spotlight.left - SPAD,
              width: spotlight.width + SPAD * 2,
              height: spotlight.height + SPAD * 2,
              borderRadius: '10px',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
              border: '2px solid rgba(96,165,250,0.75)',
              zIndex: 8999,
              pointerEvents: 'none',
              transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
              '@keyframes spotlight-pulse': {
                '0%':   { borderColor: 'rgba(96,165,250,0.5)' },
                '50%':  { borderColor: 'rgba(96,165,250,1)'   },
                '100%': { borderColor: 'rgba(96,165,250,0.5)' },
              },
              animation: 'spotlight-pulse 2.4s ease infinite',
            }}
          />
        </>
      )}

      {/* ── Full-screen overlay for steps without a target (e.g., welcome) ── */}
      {showBackdropOverlay && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 8998,
            bgcolor: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(1px)',
            pointerEvents: 'all',
          }}
          onClick={e => e.stopPropagation()}
        />
      )}

      {/* ── Ring highlight (for non-overlay steps with a target, e.g. open dialogs) ── */}
      {!cfg.overlay && spotlight && (
        <Box
          sx={{
            position: 'fixed',
            top: spotlight.top - SPAD,
            left: spotlight.left - SPAD,
            width: spotlight.width + SPAD * 2,
            height: spotlight.height + SPAD * 2,
            borderRadius: '10px',
            border: '2px solid',
            borderColor: 'primary.main',
            zIndex: 9000,
            pointerEvents: 'none',
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
            '@keyframes ring-pulse': {
              '0%':   { opacity: 0.6, transform: 'scale(1)'    },
              '50%':  { opacity: 1,   transform: 'scale(1.01)' },
              '100%': { opacity: 0.6, transform: 'scale(1)'    },
            },
            animation: 'ring-pulse 2s ease infinite',
          }}
        />
      )}

      {celebrate && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9001,
            overflow: 'hidden',
            '@keyframes confetti-fall': {
              '0%':   { transform: 'translateY(-10vh) rotate(0deg)', opacity: 1 },
              '80%':  { opacity: 1 },
              '100%': { transform: 'translateY(120vh) rotate(90deg)', opacity: 0 },
            },
          }}
        >
          {confettiPieces.map((piece, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: -20,
                left: piece.left,
                width: 6,
                height: piece.size,
                borderRadius: '2px',
                bgcolor: piece.color,
                opacity: 0.95,
                transform: `rotate(${piece.rotate}deg)`,
                animation: `confetti-fall ${piece.duration}s linear infinite`,
                animationDelay: piece.delay,
              }}
            />
          ))}
        </Box>
      )}

      {/* ── Tooltip card ── */}
      <Paper
        elevation={12}
        style={tooltipStyle as React.CSSProperties}
        sx={{
          borderRadius: '14px',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          pointerEvents: 'all',
        }}
      >
        {/* Progress bar */}
        <Box sx={{ height: 3, bgcolor: 'action.selected', position: 'relative', overflow: 'hidden' }}>
          <Box
            sx={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${((step + 1) / STEPS.length) * 100}%`,
              bgcolor: 'primary.main',
              transition: 'width 0.35s ease',
            }}
          />
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              sx={{
                fontSize: '0.68rem', fontWeight: 700,
                color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.09em',
              }}
            >
              {step + 1} / {STEPS.length}
            </Typography>
            <IconButton size="small" onClick={handleSkip} sx={{ m: -0.5, color: 'text.disabled' }}>
              <X size={13} />
            </IconButton>
          </Box>

          <Typography fontWeight={800} fontSize="0.975rem" sx={{ mb: 0.75, lineHeight: 1.3 }}>
            {step === 0 && firstName ? `Welcome, ${firstName}!` : cfg.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, fontSize: '0.84rem' }}>
            {cfg.body}
          </Typography>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            px: 2.5, pb: 2, pt: 0.5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <Button
            size="small"
            onClick={handleSkip}
            sx={{ fontSize: '0.73rem', color: 'text.disabled', minWidth: 0, p: 0 }}
          >
            Skip tour
          </Button>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {step > 0 && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleBack}
                disabled={transitioning}
                startIcon={<ChevronLeft size={13} />}
                sx={{ minWidth: 0, fontSize: '0.78rem', borderRadius: 2 }}
              >
                Back
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={handleNext}
              disabled={transitioning}
              endIcon={isLast ? undefined : <ChevronRight size={13} />}
              sx={{ minWidth: 80, fontSize: '0.78rem', borderRadius: 2 }}
            >
              {isLast ? 'Finish' : transitioning ? '···' : 'Next'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </>,
    document.body,
  )
}
