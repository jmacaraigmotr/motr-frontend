import { useState, useMemo } from 'react'
import { isToday, isYesterday, isSameDay, subDays } from 'date-fns'
import type { RepairOrderListItem } from '@/types/repairOrder'

export type FilterKey =
  | 'open' | 'closed' | 'all' | 'deleted'
  | 'available' | 'taken' | 'arrived' | 'delivered'

export type DateOffset = 'today' | 'yesterday' | 'two_days_ago'

export const DATE_OFFSET_LABELS: Record<DateOffset, string> = {
  today:        'Today',
  yesterday:    'Yesterday',
  two_days_ago: '2 Days Ago',
}

export const FILTER_GROUPS: { label: string; value: FilterKey }[][] = [
  [
    { label: 'Open ROs',   value: 'open'    },
    { label: 'Closed ROs', value: 'closed'  },
    { label: 'All ROs',    value: 'all'     },
    { label: 'Deleted',    value: 'deleted' },
  ],
  [
    { label: 'Available', value: 'available' },
    { label: 'Taken',     value: 'taken'     },
    { label: 'Arrived',   value: 'arrived'   },
    { label: 'Delivered', value: 'delivered' },
  ],
]

const PER_PAGE = 25

function matchesDateOffset(dateStr: string | null | undefined, offset: DateOffset): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (offset === 'today')        return isToday(date)
  if (offset === 'yesterday')    return isYesterday(date)
  return isSameDay(date, subDays(new Date(), 2))
}

export function useROFilters(
  ros:        RepairOrderListItem[],
  deletedRos: RepairOrderListItem[],
  filterState: [FilterKey, (v: FilterKey) => void],
) {
  const [filter, setFilterRaw] = filterState
  const [dateOffset, setDateOffset] = useState<DateOffset>('today')
  const [search,     setSearchRaw]  = useState('')
  const [page,       setPage]       = useState(1)

  const showDatePicker = filter === 'arrived' || filter === 'delivered'

  const filtered = useMemo(() => {
    const source = filter === 'deleted' ? deletedRos : ros

    let list = source.filter(r => {
      switch (filter) {
        case 'open':      return r.job_status !== 'closed'
        case 'closed':    return r.job_status === 'closed'
        case 'all':       return r.job_status != null
        case 'deleted':   return true
        case 'available': return r.scheduled_out_date == null && r.job_status !== 'closed' && !r.is_total_loss
        case 'taken':     return r.scheduled_out_date != null && r.job_status !== 'closed'
        case 'arrived':   return matchesDateOffset(r.arrived_at, dateOffset)
        case 'delivered':  return matchesDateOffset(r.delivered_at, dateOffset)
        default:          return true
      }
    })

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r => {
        // Support both 'customer' (singular) and 'customers' (plural) depending on API shape
        const cust = r.customer ?? r.customers
        const veh  = r.vehicle  ?? r.vehicles
        return (
          (r.job_number != null && `${r.job_number}`.includes(q)) ||
          r.ro_number?.toLowerCase().includes(q) ||
          `${cust?.first_name ?? ''} ${cust?.last_name ?? ''}`.trim().toLowerCase().includes(q) ||
          veh?.make?.toLowerCase().includes(q) ||
          veh?.model?.toLowerCase().includes(q)
        )
      })
    }

    // Taken: soonest scheduled out first. Everything else: newest first.
    if (filter === 'taken') {
      return [...list].sort((a, b) => {
        if (!a.scheduled_out_date) return 1
        if (!b.scheduled_out_date) return -1
        return new Date(a.scheduled_out_date).getTime() - new Date(b.scheduled_out_date).getTime()
      })
    }

    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [ros, deletedRos, filter, dateOffset, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage  = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  function setFilter(val: FilterKey) {
    setFilterRaw(val)
    setPage(1)
  }

  function setSearch(val: string) {
    setSearchRaw(val)
    setPage(1)
  }

  return {
    filter,      setFilter,
    dateOffset,  setDateOffset,
    search,      setSearch,
    page,        setPage,
    pageCount,   safePage,    pageItems,
    totalCount:  filtered.length,
    showDatePicker,
  }
}
