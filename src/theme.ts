import { createTheme, alpha } from '@mui/material/styles'
import type { PaletteMode, PaletteOptions } from '@mui/material'

// ─────────────────────────────────────────────────────────────────────────────
// MOTR v2 Theme  —  V&J Autobody Inc
// ─────────────────────────────────────────────────────────────────────────────
//
// TYPOGRAPHY SCALE (Inter font)
//   h1  32px 800  — page titles (e.g. "Customers", "Repair Orders")
//   h2  24px 700  — section headers inside pages
//   h3  22px 700  — card/panel titles
//   h4  20px 600  — sub-section labels
//   h5  18px 600  — list group labels
//   h6  17px 600  — small headings
//   body1 17px    — default body text
//   body2 15px    — secondary body / table cells
//   button 15px   — button labels (textTransform: none)
//   caption 14px  — helper text, timestamps, badges
//   overline 13px — uppercase labels (e.g. column headers)
//
// BUTTON SIZES  (use size prop — never override minHeight inline)
//   size="small"  → 30px tall  · 13px font  · use in: table rows, dense toolbars
//   size="medium" → 38px tall  · 15px font  · use in: forms, toolbars, dialogs
//   size="large"  → 46px tall  · 16px font  · use in: primary CTAs, hero actions
//
// SPACING & SHAPE
//   borderRadius base: 12px (MUI shape.borderRadius)
//   Cards: 16px  |  Dialogs: 20px  |  Buttons medium: 10px  |  Buttons small: 8px
//
// COLOURS  (light mode)
//   Primary    #1E40AF  — blue, main actions & focus rings
//   Background #F7F7F5  — off-white page background
//   Paper      #FFFFFF  — card / dialog surfaces
//   Divider    #D1D5DB  — borders & separators
//   Text       #111827 / #374151  — primary / secondary
// ─────────────────────────────────────────────────────────────────────────────
const typography = {
  fontFamily: '"Inter", "Roboto", sans-serif',
  h1: { fontSize: '2rem',      lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.025em' },
  h2: { fontSize: '1.5rem',    lineHeight: 1.2,  fontWeight: 700, letterSpacing: '-0.015em' },
  h3: { fontSize: '1.375rem',  lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em'  },
  h4: { fontSize: '1.25rem',   lineHeight: 1.3,  fontWeight: 600, letterSpacing: '-0.01em'  },
  h5: { fontSize: '1.125rem',  lineHeight: 1.35, fontWeight: 600 },
  h6: { fontSize: '1.0625rem', lineHeight: 1.4,  fontWeight: 600 },
  subtitle1: { fontSize: '1.0625rem', lineHeight: 1.5,  fontWeight: 600 },
  subtitle2: { fontSize: '0.9375rem', lineHeight: 1.5,  fontWeight: 600 },
  body1:     { fontSize: '1.0625rem', lineHeight: 1.65, fontWeight: 400 },
  body2:     { fontSize: '0.9375rem', lineHeight: 1.6,  fontWeight: 400 },
  button:    { fontSize: '0.9375rem', lineHeight: 1.4,  fontWeight: 600, textTransform: 'none' as const },
  caption:   { fontSize: '0.875rem',  lineHeight: 1.5,  fontWeight: 500 },
  overline:  { fontSize: '0.8125rem', lineHeight: 1.6,  letterSpacing: '0.09em', fontWeight: 700, textTransform: 'uppercase' as const },
}

// ─────────────────────────────────────────────────────────────────────────────
// Palettes
// ─────────────────────────────────────────────────────────────────────────────
const paletteByMode: Record<PaletteMode, PaletteOptions> = {
  light: {
    mode: 'light',
    primary:    { main: '#1E40AF', light: '#2563EB', dark: '#1E3A8A', contrastText: '#FFFFFF' },
    secondary:  { main: '#374151', light: '#6B7280', dark: '#111827', contrastText: '#FFFFFF' },
    background: { default: '#F7F7F5', paper: '#FFFFFF' },
    text:       { primary: '#111827', secondary: '#374151' },
    divider:    '#D1D5DB',
    success:    { main: '#166534', light: '#DCFCE7', dark: '#14532D', contrastText: '#FFFFFF' },
    warning:    { main: '#B45309', light: '#FEF3C7', dark: '#92400E', contrastText: '#FFFFFF' },
    error:      { main: '#B91C1C', light: '#FEE2E2', dark: '#7F1D1D', contrastText: '#FFFFFF' },
    info:       { main: '#2563EB', light: '#DBEAFE', dark: '#1E40AF', contrastText: '#FFFFFF' },
  },
  dark: {
    mode: 'dark',
    primary:    { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB', contrastText: '#FFFFFF' },
    secondary:  { main: '#9CA3AF', light: '#D1D5DB', dark: '#6B7280', contrastText: '#111827' },
    background: { default: '#0F172A', paper: '#1E293B' },
    text:       { primary: '#F1F5F9', secondary: '#94A3B8' },
    divider:    'rgba(255,255,255,0.1)',
    success:    { main: '#4ADE80', light: '#166534', dark: '#14532D', contrastText: '#111827' },
    warning:    { main: '#FBBF24', light: '#78350F', dark: '#92400E', contrastText: '#111827' },
    error:      { main: '#F87171', light: '#7F1D1D', dark: '#991B1B', contrastText: '#FFFFFF' },
    info:       { main: '#60A5FA', light: '#1E3A8A', dark: '#1D4ED8', contrastText: '#FFFFFF' },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme factory
// ─────────────────────────────────────────────────────────────────────────────
export function getTheme(mode: PaletteMode = 'light') {
  const isDark = mode === 'dark'
  const border = isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB'

  const theme = createTheme({
    palette: paletteByMode[mode],
    shape: { borderRadius: 12 },
    typography,
  })

  theme.components = {
    // ── Global baseline ──────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          colorScheme: isDark ? 'dark' : 'light',
          color: paletteByMode[mode].text?.primary,
          backgroundColor:
            paletteByMode[mode].background?.default ?? (isDark ? '#0F172A' : '#F7F7F5'),
        },
      },
    },

    // ── Buttons ───────────────────────────────────────────────────────────────
    // size="small"  → table rows, dense toolbars          30px / 13px font
    // size="medium" → forms, dialog actions, toolbar CTAs 38px / 15px font
    // size="large"  → primary hero actions                46px / 16px font
    // ⚠️  Always use size prop — never override minHeight inline on individual buttons.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.9375rem',
          minHeight: 38,      // medium (default)
          paddingInline: 18,
          paddingBlock: 7,
          boxShadow: 'none',
          transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          '&:hover': { boxShadow: 'none' },
          '&:focus-visible': {
            outline: `3px solid ${isDark ? '#60A5FA' : '#1E40AF'}`,
            outlineOffset: 3,
          },
        },
        sizeSmall: {
          minHeight: 30,      // table rows / dense toolbars
          fontSize: '0.8125rem',
          paddingInline: 12,
          paddingBlock: 4,
          borderRadius: 8,
        },
        sizeLarge: {
          minHeight: 46,      // hero CTAs only
          fontSize: '1rem',
          paddingInline: 24,
          paddingBlock: 11,
          borderRadius: 12,
        },
        containedPrimary: {
          backgroundColor: '#1E40AF',
          '&:hover': { backgroundColor: '#1E3A8A' },
        },
        outlinedPrimary: {
          borderColor: '#1E40AF',
          color: '#1E40AF',
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
            backgroundColor: '#EFF6FF',
          },
        },
      },
    },

    // ── Icon buttons ─────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          minWidth: 34,
          minHeight: 34,
          padding: 7,
          '&:focus-visible': {
            outline: `3px solid ${isDark ? '#60A5FA' : '#1E40AF'}`,
            outlineOffset: 2,
          },
        },
      },
    },

    // ── Text fields ───────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'medium' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: '0.9375rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
          '& fieldset': { borderColor: border, borderWidth: '1.5px' },
          '&:hover fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF' },
          '&.Mui-focused fieldset': {
            borderColor: isDark ? '#60A5FA' : '#1E40AF',
            borderWidth: '2px',
          },
          '& .MuiInputBase-input': { paddingBlock: 10 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.9375rem',
          top: '50%',
          transform: 'translate(16px, -50%) scale(1)',
          transformOrigin: 'left top',
          '&.Mui-focused': { color: isDark ? '#60A5FA' : '#1E40AF' },
          '&.MuiInputLabel-shrink': {
            top: 0,
            transform: 'translate(14px, -8px) scale(0.75)',
          },
        },
      },
    },

    // ── Cards — clean white with clear border ────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
          border: `1.5px solid ${border}`,
          boxShadow: 'none',
          transition: 'box-shadow 0.15s ease',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px !important',
          '&:last-child': { paddingBottom: '24px !important' },
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          '&:focus-visible': {
            outline: `3px solid ${isDark ? '#60A5FA' : '#1E40AF'}`,
            outlineOffset: 2,
          },
        },
      },
    },

    // ── Paper ────────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: border, borderWidth: '1.5px' },
      },
    },

    // ── Chips ─────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          fontSize: '0.8125rem',
          height: 26,
          paddingInline: 2,
        },
        label: { paddingInline: 8 },
      },
    },

    // ── Tables ───────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1.5px solid ${border}`,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: { borderCollapse: 'separate', borderSpacing: 0 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          paddingBlock: 12,
          paddingInline: 16,
          fontSize: '0.9375rem',
          borderBottom: `1px solid ${border}`,
          color: isDark ? '#F1F5F9' : '#111827',
        },
        head: {
          fontWeight: 700,
          fontSize: '0.75rem',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: isDark ? '#94A3B8' : '#374151',
          backgroundColor: isDark ? '#1E293B' : '#F9FAFB',
          borderBottom: `2px solid ${border}`,
          paddingBlock: 10,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          minHeight: 48,
          '&:last-child td': { borderBottom: 'none' },
          '&:hover td': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
          },
          '&.Mui-selected td': {
            backgroundColor: isDark
              ? alpha('#3B82F6', 0.12)
              : alpha('#1E40AF', 0.06),
          },
        },
      },
    },

    // ── Dialogs ──────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundImage: 'none',
          border: `1.5px solid ${border}`,
          // On mobile: near-fullscreen bottom sheet
          '@media (max-width: 600px)': {
            margin: 0,
            marginTop: 'auto',
            width: '100%',
            maxWidth: '100% !important',
            maxHeight: '92dvh',
            borderRadius: '20px 20px 0 0',
            border: 'none',
          },
        },
        container: {
          '@media (max-width: 600px)': {
            alignItems: 'flex-end',
          },
        },
      },
    },

    // ── Drawer (sidebar) ─────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          borderRight: `1.5px solid ${border}`,
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
        },
      },
    },

    // ── List items ───────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          minHeight: 44,
          paddingInline: 16,
          fontSize: '0.9375rem',
          '&.Mui-selected': {
            backgroundColor: alpha(isDark ? '#3B82F6' : '#1E40AF', 0.1),
            color: isDark ? '#60A5FA' : '#1E40AF',
            '&:hover': {
              backgroundColor: alpha(isDark ? '#3B82F6' : '#1E40AF', 0.15),
            },
          },
          '&:focus-visible': {
            outline: `3px solid ${isDark ? '#60A5FA' : '#1E40AF'}`,
            outlineOffset: 2,
          },
        },
      },
    },

    // ── Divider ──────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: border },
      },
    },

    // ── Skeleton ─────────────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },

    // ── Linear progress ──────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 3,
          backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
        },
        bar: {
          borderRadius: 8,
          backgroundColor: isDark ? '#60A5FA' : '#1E40AF',
        },
      },
    },

    // ── Toggle buttons ───────────────────────────────────────────────────────
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: '100px !important',
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          minHeight: 36,
          paddingInline: 16,
          border: `1.5px solid ${border} !important`,
          '&.Mui-selected': {
            backgroundColor: alpha(isDark ? '#3B82F6' : '#1E40AF', 0.1),
            color: isDark ? '#60A5FA' : '#1E40AF',
            borderColor: `${isDark ? '#3B82F6' : '#1E40AF'} !important`,
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { gap: 8 },
      },
    },

    // ── Tooltip ──────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.875rem',
          borderRadius: 8,
          paddingBlock: 8,
          paddingInline: 12,
          backgroundColor: isDark ? '#374151' : '#111827',
        },
      },
    },
  }

  return theme
}
