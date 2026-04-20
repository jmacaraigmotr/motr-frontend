import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import { Search } from 'lucide-react'
import FilterTabBar, { type FilterTabItem } from '@/components/ui/FilterTabBar'
import { DATE_OFFSET_LABELS, type FilterKey, type DateOffset } from '../hooks/useROFilters'

const FILTER_GROUPS: FilterTabItem<FilterKey>[][] = [
  [
    { label: 'Open ROs',   value: 'open'              },
    { label: 'Closed ROs', value: 'closed'            },
    { label: 'All ROs',    value: 'all'               },
    { label: 'Deleted',    value: 'deleted', danger: true },
  ],
  [
    { label: 'Available', value: 'available' },
    { label: 'Taken',     value: 'taken'     },
    { label: 'Arrived',   value: 'arrived'   },
    { label: 'Delivered', value: 'delivered' },
  ],
]

const DATE_OFFSET_ITEMS: FilterTabItem<DateOffset>[] = (
  Object.entries(DATE_OFFSET_LABELS) as [DateOffset, string][]
).map(([value, label]) => ({ label, value }))

interface Props {
  filter:         FilterKey
  onFilterChange: (f: FilterKey) => void
  dateOffset:     DateOffset
  onDateOffset:   (d: DateOffset) => void
  search:         string
  onSearch:       (s: string) => void
  totalCount:     number
  showDatePicker: boolean
}

export default function ROFilterBar({
  filter, onFilterChange,
  dateOffset, onDateOffset,
  search, onSearch,
  totalCount, showDatePicker,
}: Props) {
  const theme = useTheme()

  return (
    <Box sx={{ px: { xs: 3, md: 4 }, pt: 2, pb: 0, borderBottom: '1px solid', borderColor: 'divider' }}>

      {/* Search + count */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by job #, customer, or vehicle"
          value={search}
          onChange={e => onSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 300 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} style={{ opacity: 0.5 }} />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
          {totalCount} {totalCount === 1 ? 'order' : 'orders'}
        </Typography>
      </Box>

      {/* Main filter tabs */}
      <Box sx={{ pb: showDatePicker ? 1.5 : 2 }}>
        <FilterTabBar
          groups={FILTER_GROUPS}
          value={filter}
          onChange={onFilterChange}
          accentColor={theme.palette.primary.main}
          dangerColor={theme.palette.error.main}
        />
      </Box>

      {/* Date offset row — only visible for Arrived / Delivered */}
      {showDatePicker && (
        <Box sx={{ pb: 2 }}>
          <FilterTabBar
            groups={[DATE_OFFSET_ITEMS]}
            value={dateOffset}
            onChange={onDateOffset}
            accentColor={theme.palette.primary.main}
          />
        </Box>
      )}
    </Box>
  )
}
