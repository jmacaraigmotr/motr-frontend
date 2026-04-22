import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { initials } from '@/lib/utils'
import NewROWizard from '@/components/NewROWizard'
import RODetailDrawer from '@/views/customer-view/components/RODetailDrawer'
import { useUIStore } from '@/stores/uiStore'
import WalkthroughTour from '@/components/onboarding/WalkthroughTour'
import TeamChatWidget from '@/components/chat/TeamChatWidget'
import ActivityDrawer from '@/components/activity/ActivityDrawer'
import {
  Users,
  DollarSign,
  LayoutDashboard,
  ClipboardList,
  BarChart2,
  LogOut,
  Menu,
  HelpCircle,
  MessageSquare,
  Bell,
  X,
  ChevronDown,
  Settings,
  Plus,
  Building2,
  Check,
} from 'lucide-react'
import { shopsApi } from '@/api/shops'
import { lotApi } from '@/api/lot'
import type { Shop } from '@/types/auth'

// MUI for backward-compat mobile sheet
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'

import { Avatar } from '@/ui'

const SIDEBAR_OPEN_WIDTH = 224
const SIDEBAR_CLOSED_WIDTH = 56
const MOBILE_DRAWER_WIDTH = 280
const TOUR_STORAGE_KEY = 'motr_tour_seen_v1'

type NavItem = { id: string; label: string; icon: React.ElementType }

const BASE_NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard-view',     label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'customer-view',      label: 'Customers',      icon: Users           },
  { id: 'repair-orders-view', label: 'Repair Orders',  icon: ClipboardList   },
  { id: 'accounting-view',    label: 'Transactions',   icon: DollarSign      },
  { id: 'reports-view',       label: 'Reports',        icon: BarChart2       },
] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, currentView, switchView, logout, isAdmin, setActiveShop } = useAuth()
  const navigate = useNavigate()
  const { tourAction, setTourAction } = useUIStore()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [newROId, setNewROId] = useState<number | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [shopPickerOpen, setShopPickerOpen] = useState(false)
  const [allShops, setAllShops] = useState<Shop[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const qc = useQueryClient()

  const shopPickerRef = useRef<HTMLDivElement>(null)

  // Preload active lot layouts so the LotPickerDialog opens instantly
  useEffect(() => {
    const shopId = user?.shop?.id
    if (!shopId) return
    qc.prefetchQuery({
      queryKey: ['lot_layouts_active', shopId],
      queryFn: async () => {
        const all = await lotApi.listLayouts(shopId)
        return all.filter(l => l.is_active)
      },
      staleTime: 30_000,
    })
  }, [user?.shop?.id, qc])

  useEffect(() => {
    const shouldLoad = (shopPickerOpen || mobileDrawerOpen) && isAdmin && allShops.length === 0
    if (!shouldLoad) return
    setLoadingShops(true)
    shopsApi.list()
      .then(setAllShops)
      .finally(() => setLoadingShops(false))
  }, [shopPickerOpen, mobileDrawerOpen, isAdmin, allShops.length])

  useEffect(() => {
    if (!shopPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (shopPickerRef.current && !shopPickerRef.current.contains(e.target as Node)) {
        setShopPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [shopPickerOpen])

  const navItems = BASE_NAV_ITEMS
  // Historical alias: some persisted sessions still store `customers-view`.
  // Normalize so the active highlight stays correct until the user switches views.
  const canonicalView = currentView === 'customers-view' ? 'customer-view' : currentView
  const activeNavIndex = navItems.findIndex(item => item.id === canonicalView)

  useEffect(() => {
    if (user) {
      const seen = window.localStorage.getItem(TOUR_STORAGE_KEY)
      if (!seen) setTourOpen(true)
    }
  }, [user])

  useEffect(() => {
    if (!tourAction) return
    if (tourAction === 'prep-team-chat') {
      setChatOpen(false)
      setTourAction(null)
    } else if (tourAction === 'open-team-chat') {
      setChatOpen(true)
      setTourAction(null)
    } else if (tourAction === 'close-team-chat') {
      setChatOpen(false)
      setTourAction(null)
    } else if (tourAction === 'close-all') {
      setChatOpen(false)
    }
  }, [tourAction, setTourAction])

  const handleTourDismiss = (completed: boolean) => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, completed ? 'completed' : 'dismissed')
    setTourOpen(false)
  }

  const sharedModals = (
    <>
      <NewROWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(_roNumber, roId) => {
          setWizardOpen(false)
          qc.invalidateQueries({ queryKey: ['dashboard_repair_orders'] })
          qc.invalidateQueries({ queryKey: ['repair_orders'] })
          setNewROId(roId)
        }}
      />
      <RODetailDrawer roId={newROId} onClose={() => setNewROId(null)} />
      <WalkthroughTour
        open={tourOpen}
        userName={user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : undefined}
        onDismiss={handleTourDismiss}
        switchView={switchView}
      />
      <TeamChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />
    </>
  )

  // ── Mobile ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: 'var(--surface-0)',
            borderBottom: '1px solid var(--line)',
            color: 'var(--text-default)',
          }}
        >
          <Toolbar sx={{ gap: 1, minHeight: '56px !important' }}>
            <IconButton edge="start" size="small" onClick={() => setMobileDrawerOpen(true)}>
              <Menu size={22} />
            </IconButton>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <img
                src="https://8232-application-data-2273.s3.amazonaws.com/3GN69K3xrz/1760734200-MOTR-Rectangular.png"
                alt="MOTR"
                style={{ height: 22, objectFit: 'contain', filter: 'brightness(0)' }}
              />
            </Box>
            <IconButton size="small" onClick={() => setActivityOpen(p => !p)}>
              <Bell size={20} />
            </IconButton>
            <IconButton size="small" data-tour-id="team-chat-launcher" onClick={() => setChatOpen(p => !p)}>
              <Badge color="error" variant="dot" overlap="circular">
                <MessageSquare size={20} />
              </Badge>
            </IconButton>
          </Toolbar>
        </AppBar>

        <SwipeableDrawer
          anchor="left"
          open={mobileDrawerOpen}
          onOpen={() => setMobileDrawerOpen(true)}
          onClose={() => setMobileDrawerOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: MOBILE_DRAWER_WIDTH, display: 'flex', flexDirection: 'column', bgcolor: 'var(--surface-0)' } }}
        >
          {/* Mobile drawer header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--line)]" style={{ minHeight: 64 }}>
            <img
              src="https://8232-application-data-2273.s3.amazonaws.com/3GN69K3xrz/1760734200-MOTR-Rectangular.png"
              alt="MOTR"
              style={{ height: 50, objectFit: 'contain', filter: 'brightness(0)' }}
            />
            <button onClick={() => setMobileDrawerOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-default)]">
              <X size={18} />
            </button>
          </div>

          {/* Mobile shop context */}
          <div className="px-3 py-2.5 border-b border-[var(--line)]">
            <div className="flex items-center gap-2.5">
              <Building2 size={15} className="text-[var(--text-muted)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate text-[var(--text-strong)]">{user?.shop?.name ?? 'No Shop'}</p>
                {isAdmin && <p className="text-[10px] uppercase tracking-wide font-medium text-[var(--text-muted)]">Admin</p>}
              </div>
            </div>
            {isAdmin && (
              <div className="mt-2 space-y-0.5 max-h-36 overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wide px-1 mb-1" style={{ color: 'var(--text-muted)' }}>Switch Shop</p>
                {loadingShops ? (
                  <p className="text-[12px] px-1 text-[var(--text-muted)]">Loading…</p>
                ) : allShops.map(shop => {
                  const isCurrent = shop.id === user?.shop?.id
                  return (
                    <button
                      key={shop.id}
                      onClick={() => { setActiveShop(shop); setMobileDrawerOpen(false) }}
                      className={[
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors',
                        isCurrent ? 'bg-[var(--surface-2)] text-[var(--text-strong)]' : 'text-[var(--text-default)] hover:bg-[var(--surface-1)]',
                      ].join(' ')}
                    >
                      <Building2 size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
                      <span className="flex-1 truncate">{shop.name}</span>
                      {isCurrent && <Check size={12} style={{ opacity: 0.7, flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <nav className="flex-1 py-2 px-2 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon
              const active = canonicalView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { switchView(item.id); setMobileDrawerOpen(false) }}
                  className={[
                    'relative flex items-center gap-3 w-full h-10 px-3 rounded-[var(--radius-md)] mb-0.5',
                    'text-[14px] font-medium transition-colors duration-[var(--motion-duration)]',
                    active
                      ? 'bg-[var(--surface-2)] text-[var(--text-strong)]'
                      : 'text-[var(--text-default)] hover:bg-[var(--surface-1)]',
                  ].join(' ')}
                >
                  <Icon size={18} className={active ? 'text-[var(--text-strong)]' : 'text-[var(--text-muted)]'} />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <div className="border-t border-[var(--line)] p-3 flex flex-col gap-2">
            <button
              onClick={() => { setActivityOpen(p => !p); setMobileDrawerOpen(false) }}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-[var(--radius-md)] text-[14px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-1)]"
            >
              <Bell size={16} className="text-[var(--text-muted)]" /> Recent Activity
            </button>
            <button
              data-tour-id="team-chat-launcher"
              onClick={() => { setChatOpen(p => !p); setMobileDrawerOpen(false) }}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-[var(--radius-md)] text-[14px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-1)]"
            >
              <MessageSquare size={16} className="text-[var(--text-muted)]" /> Team Chat
            </button>
            {isAdmin && (
              <button
                onClick={() => { navigate('/admin/overview'); setMobileDrawerOpen(false) }}
                className="flex items-center gap-2 w-full h-9 px-3 rounded-[var(--radius-md)] text-[14px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-1)]"
              >
                <Settings size={16} className="text-[var(--text-muted)]" /> Admin Console
              </button>
            )}
            <button
              onClick={() => { setWizardOpen(true); setMobileDrawerOpen(false) }}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-[var(--radius-md)] text-[14px] font-semibold text-white"
              aria-label="New Repair Order"
              style={{ background: '#C05621' }}
            >
              <Plus size={16} /> New Repair Order
            </button>
          </div>
          <div className="border-t border-[var(--line)] p-3 flex items-center gap-3">
            <Avatar initials={initials(user?.first_name, user?.last_name)} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[var(--text-strong)] truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-[12px] text-[var(--text-muted)] truncate">{user?.role?.name ?? 'Staff'}</p>
            </div>
            <button onClick={logout} aria-label="Sign out" className="text-[var(--text-muted)] hover:text-[var(--danger-fg)]">
              <LogOut size={16} />
            </button>
          </div>
        </SwipeableDrawer>

        <Box component="main" sx={{ pt: '56px', pb: '56px', minHeight: '100vh', overflow: 'auto', bgcolor: 'var(--surface-0)' }}>
          {children}
        </Box>

        <Fab
          aria-label="New Repair Order"
          onClick={() => setWizardOpen(true)}
          sx={{
            position: 'fixed', bottom: 64, right: 16, zIndex: theme.zIndex.speedDial,
            bgcolor: 'var(--text-strong)', color: '#fff',
            '&:hover': { bgcolor: 'var(--text-default)' },
          }}
        >
          <Plus size={22} />
        </Fab>

        <Paper
          elevation={0}
          sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: theme.zIndex.appBar,
            borderTop: '1px solid var(--line)',
            bgcolor: 'var(--surface-0)',
          }}
        >
          <BottomNavigation
            value={activeNavIndex >= 0 ? activeNavIndex : 0}
            onChange={(_, v) => switchView(navItems[v].id)}
            showLabels
            sx={{ bgcolor: 'transparent' }}
          >
            {navItems.map(item => {
              const Icon = item.icon
              return (
                  <BottomNavigationAction
                    key={item.id}
                    label={item.label}
                    icon={<Icon size={20} />}
                  sx={{
                    color: 'var(--text-muted)',
                    '&.Mui-selected': { color: 'var(--text-strong)' },
                    '& .MuiBottomNavigationAction-label': { fontSize: '0.68rem', fontWeight: 600 },
                  }}
                />
              )
            })}
          </BottomNavigation>
        </Paper>

        {sharedModals}
      </>
    )
  }

  // ── Desktop ─────────────────────────────────────────────────────────────────
  const w = sidebarOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-0)]">
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-[var(--motion-duration)]"
        style={{ width: w, background: 'var(--sidebar-bg)' }}
      >
        {/* Zone 1 — App bar (logo + collapse) */}
        <div
          className="flex items-center px-3"
          style={{ height: 56, borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {sidebarOpen ? (
            <div className="flex flex-1 items-center justify-center">
              <img
                src="https://8232-application-data-2273.s3.amazonaws.com/3GN69K3xrz/1760734200-MOTR-Rectangular.png"
                alt="MOTR"
                style={{ height: 50, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.92 }}
              />
            </div>
          ) : null}
          <Tooltip title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className="p-1.5 rounded-[var(--radius-sm)] transition-colors shrink-0"
              style={{ color: 'var(--sidebar-text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-active)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)' }}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <Menu size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Zone 2 — Shop context */}
        <div ref={shopPickerRef} className="relative px-2 py-2" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <Tooltip title={user?.shop?.name ?? 'Shop'} placement="right">
            <button
              onClick={() => isAdmin && setShopPickerOpen(p => !p)}
              className={[
                'flex items-center w-full rounded-[var(--radius-md)] transition-colors',
                sidebarOpen ? 'gap-2.5 px-2.5 py-2' : 'justify-center p-2',
                isAdmin ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
              style={{ color: 'var(--sidebar-text-active)' }}
              onMouseEnter={e => { if (isAdmin) { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' } }}
              onMouseLeave={e => { if (isAdmin) { (e.currentTarget as HTMLElement).style.background = '' } }}
            >
              <Building2 size={16} className="shrink-0" style={{ opacity: 0.8 }} />
              {sidebarOpen && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--sidebar-text-active)' }}>
                      {user?.shop?.name ?? 'No Shop'}
                    </p>
                  </div>
                  {isAdmin && <ChevronDown size={14} className="shrink-0" style={{ opacity: 0.5, transform: shopPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />}
                </>
              )}
            </button>
          </Tooltip>

          {/* Shop picker dropdown */}
          {shopPickerOpen && isAdmin && sidebarOpen && (
            <div
              className="absolute left-2 right-2 z-50 rounded-[var(--radius-md)] overflow-hidden"
              style={{ top: '100%', marginTop: 4, background: 'var(--surface-0)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
            >
              <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>Switch Shop</p>
              </div>
              <div className="py-1 max-h-48 overflow-y-auto">
                {loadingShops ? (
                  <p className="px-3 py-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</p>
                ) : allShops.map(shop => {
                  const isCurrent = shop.id === user?.shop?.id
                  return (
                    <button
                      key={shop.id}
                      onClick={() => { setActiveShop(shop); setShopPickerOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-[13px] transition-colors"
                      style={{ color: isCurrent ? 'var(--text-strong)' : 'var(--text-default)', background: isCurrent ? 'var(--surface-2)' : 'transparent' }}
                      onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)' }}
                      onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Building2 size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                      <span className="flex-1 truncate font-medium">{shop.name}</span>
                      {isCurrent && <Check size={13} style={{ opacity: 0.7, flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Zone 3 — Primary nav (items are scoped to current shop) */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const active = canonicalView === item.id
            return (
              <Tooltip key={item.id} title={!sidebarOpen ? item.label : ''} placement="right">
                <button
                  onClick={() => switchView(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'relative flex items-center h-10 mb-0.5 rounded-[var(--radius-md)] w-full',
                    'text-[14px] font-medium transition-all duration-[var(--motion-duration)]',
                    sidebarOpen ? 'gap-3 px-3' : 'justify-center px-0',
                  ].join(' ')}
                  style={{
                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                    color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-active)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
                    }
                  }}
                >
                  <Icon
                    size={18}
                    className="shrink-0"
                    style={{ color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)', opacity: active ? 1 : 0.7 }}
                  />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </button>
              </Tooltip>
            )
          })}
        </nav>

        {/* Zone 4 — Secondary drawers */}
        <div className="px-2 pb-2 flex flex-col gap-0.5" style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: 8 }}>
          {(
            [
              { icon: Bell,          label: 'Activity',     tourId: undefined,             onClick: () => setActivityOpen(p => !p), active: activityOpen },
              { icon: MessageSquare, label: 'Team Chat',    tourId: 'team-chat-launcher',  onClick: () => setChatOpen(p => !p),     active: chatOpen     },
            ] as const
          ).map(({ icon: Icon, label, tourId, onClick, active }) => (
            <Tooltip key={label} title={!sidebarOpen ? label : ''} placement="right">
              <button
                data-tour-id={tourId}
                onClick={onClick}
                className={[
                  'flex items-center h-9 rounded-[var(--radius-md)] w-full transition-all duration-[var(--motion-duration)]',
                  'text-[13px] font-medium',
                  sidebarOpen ? 'gap-2.5 px-3' : 'justify-center px-0',
                ].join(' ')}
                style={{
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-active)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
                  }
                }}
              >
                <Icon size={16} className="shrink-0" style={{ opacity: 0.7 }} />
                {sidebarOpen && label}
              </button>
            </Tooltip>
          ))}
          {isAdmin && (
            <Tooltip title={!sidebarOpen ? 'Admin Console' : ''} placement="right">
              <button
                onClick={() => navigate('/admin/overview')}
                className={[
                  'flex items-center h-9 rounded-[var(--radius-md)] w-full transition-all duration-[var(--motion-duration)]',
                  'text-[13px] font-medium',
                  sidebarOpen ? 'gap-2.5 px-3' : 'justify-center px-0',
                ].join(' ')}
                style={{ color: 'var(--sidebar-text)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-active)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = ''
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
                }}
              >
                <Settings size={16} className="shrink-0" style={{ opacity: 0.7 }} />
                {sidebarOpen && 'Admin Console'}
              </button>
            </Tooltip>
          )}
          <Tooltip title={!sidebarOpen ? 'New RO' : ''} placement="right">
            <button
              onClick={() => setWizardOpen(true)}
              aria-label="New Repair Order"
              className={[
                'flex items-center h-9 rounded-[var(--radius-md)] w-full transition-all duration-[var(--motion-duration)]',
                'text-[13px] font-semibold text-white',
                sidebarOpen ? 'gap-2.5 px-3' : 'justify-center px-0',
              ].join(' ')}
              style={{ background: '#C05621' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#9C4419'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = '#C05621'
              }}
            >
              <Plus size={16} className="shrink-0" />
              {sidebarOpen && 'New Repair Order'}
            </button>
          </Tooltip>
        </div>

        {/* User card */}
        <div className="p-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div
            className={[
              'flex items-center gap-2 p-1.5 rounded-[var(--radius-md)]',
              sidebarOpen ? '' : 'justify-center',
            ].join(' ')}
          >
            <Tooltip title={!sidebarOpen ? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() : ''} placement="right">
              <span>
                <Avatar
                  initials={initials(user?.first_name, user?.last_name)}
                  size="md"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                />
              </span>
            </Tooltip>
            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate leading-tight" style={{ color: 'var(--sidebar-text-active)' }}>
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-[11px] truncate leading-tight" style={{ color: 'var(--sidebar-text)' }}>
                    {user?.role?.name ?? 'Staff'}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip title="Show walkthrough">
                    <button
                      onClick={() => setTourOpen(true)}
                      data-tour-id="tour-relaunch-btn"
                      aria-label="Show walkthrough"
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--sidebar-text)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-active)'; (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'; (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      <HelpCircle size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip title="Sign out">
                    <button
                      onClick={logout}
                      aria-label="Sign out"
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--sidebar-text)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'; (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      <LogOut size={15} />
                    </button>
                  </Tooltip>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto bg-[var(--surface-0)]">
        {children}
      </main>

      {sharedModals}
    </div>
  )
}
