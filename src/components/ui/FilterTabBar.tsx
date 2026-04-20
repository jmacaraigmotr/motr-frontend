import { Fragment } from 'react'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'

export type FilterTabItem<T extends string = string> = {
  label:   string
  value:   T
  danger?: boolean
}

interface Props<T extends string> {
  groups:       FilterTabItem<T>[][]
  value:        T
  onChange:     (val: T) => void
  accentColor:  string
  dangerColor?: string
}

export default function FilterTabBar<T extends string>({
  groups, value, onChange, accentColor, dangerColor = '#EF4444',
}: Props<T>) {
  const flat = groups.flatMap<React.ReactNode>((group, gi) => [
    gi > 0 ? (
      <Divider
        key={`__div_${gi}`}
        orientation="vertical"
        flexItem
        sx={{ mx: 0.5, alignSelf: 'center', height: 22 }}
      />
    ) : null,
    ...group.map(item => {
      const isActive = value === item.value
      const color    = item.danger ? dangerColor : accentColor
      return (
        <Box
          key={item.value}
          component="button"
          onClick={() => onChange(item.value)}
          sx={{
            px: 2.25, py: 0.875,
            borderRadius: '100px',
            border: '1.5px solid',
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
            transition: 'border-color 0.15s, background-color 0.15s, color 0.15s',
            borderColor: isActive ? color : 'divider',
            bgcolor:     isActive ? alpha(color, 0.1) : 'transparent',
            color:       isActive ? color : 'text.secondary',
            '&:hover': {
              borderColor: color,
              color,
              bgcolor: alpha(color, 0.06),
            },
          }}
        >
          {item.label}
        </Box>
      )
    }),
  ]).filter(Boolean)

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      {flat.map((node, i) => <Fragment key={i}>{node}</Fragment>)}
    </Box>
  )
}
