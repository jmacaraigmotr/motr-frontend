import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { initials } from '@/lib/utils'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import {
  LogOut,
  LayoutDashboard,
  Building2,
  Map,
  Users,
  ChevronLeft,
} from 'lucide-react'

// ─── Color tokens ─────────────────────────────────────────────────────────────
const BG = '#0F1629'          // deep navy-indigo
const BG_HOVER = '#1A2340'    // slightly lighter on hover
const BG_ACTIVE = '#312E81'   // indigo-900 for active item
const ACCENT = '#818CF8'      // indigo-400 for active icon/text
const TEXT_DIM = '#94A3B8'    // slate-400
const TEXT_BRIGHT = '#E2E8F0' // slate-200
const DIVIDER = '#1E2D45'

// ─── Nav structure ────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Manage',
    items: [
      { label: 'Overview', path: '/admin/overview', icon: LayoutDashboard },
      { label: 'Users',    path: '/admin/users',    icon: Users            },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Shops',       path: '/admin/shops',       icon: Building2 },
      { label: 'Lot Builder', path: '/admin/lot-builder', icon: Map       },
    ],
  },
] as const

export default function AdminShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'grey.50' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Box
        component="nav"
        sx={{
          width: 240,
          flexShrink: 0,
          bgcolor: BG,
          display: 'flex',
          flexDirection: 'column',
          py: 0,
        }}
      >
        {/* Logo bar */}
        <Box
          sx={{
            px: 3,
            py: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: `1px solid ${DIVIDER}`,
            minHeight: 64,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              bgcolor: ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: '#1E1B4B', lineHeight: 1 }}>
              M
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: TEXT_BRIGHT, lineHeight: 1.2 }}>
              MOTR Admin
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: TEXT_DIM, lineHeight: 1.4 }}>
              System Console
            </Typography>
          </Box>
        </Box>

        {/* Nav sections */}
        <Box sx={{ flex: 1, overflowY: 'auto', py: 2, px: 1.5 }}>
          {NAV_SECTIONS.map((section, si) => (
            <Box key={section.label} sx={{ mb: si < NAV_SECTIONS.length - 1 ? 3 : 0 }}>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: TEXT_DIM,
                  px: 1.5,
                  mb: 0.75,
                }}
              >
                {section.label}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
                      {({ isActive }) => (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            cursor: 'pointer',
                            bgcolor: isActive ? BG_ACTIVE : 'transparent',
                            color: isActive ? TEXT_BRIGHT : TEXT_DIM,
                            transition: 'background-color 0.15s ease, color 0.15s ease',
                            '&:hover': {
                              bgcolor: isActive ? BG_ACTIVE : BG_HOVER,
                              color: TEXT_BRIGHT,
                            },
                          }}
                        >
                          <Icon
                            size={17}
                            style={{ color: isActive ? ACCENT : 'inherit', flexShrink: 0 }}
                          />
                          <Typography
                            sx={{
                              fontSize: '0.875rem',
                              fontWeight: isActive ? 700 : 500,
                              lineHeight: 1,
                              color: 'inherit',
                            }}
                          >
                            {item.label}
                          </Typography>
                        </Box>
                      )}
                    </NavLink>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Footer */}
        <Box>
          <Divider sx={{ borderColor: DIVIDER }} />
          {/* Back to app */}
          <Box sx={{ px: 1.5, pt: 1.5 }}>
            <Box
              onClick={() => navigate('/')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                cursor: 'pointer',
                color: TEXT_DIM,
                transition: 'background-color 0.15s, color 0.15s',
                '&:hover': { bgcolor: BG_HOVER, color: TEXT_BRIGHT },
              }}
            >
              <ChevronLeft size={17} style={{ flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'inherit' }}>
                Back to app
              </Typography>
            </Box>
          </Box>

          {/* User row */}
          <Box sx={{ px: 1.5, pt: 1, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: ACCENT,
                color: '#1E1B4B',
                width: 34,
                height: 34,
                fontSize: '0.75rem',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {initials(user?.first_name, user?.last_name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: TEXT_BRIGHT, lineHeight: 1.3 }} noWrap>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: TEXT_DIM, lineHeight: 1.3 }} noWrap>
                {user?.role?.name ?? 'Admin'}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton
                size="small"
                onClick={logout}
                sx={{ color: TEXT_DIM, '&:hover': { color: '#F87171', bgcolor: 'rgba(248,113,113,0.1)' } }}
              >
                <LogOut size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          bgcolor: 'grey.50',
          p: 4,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
