import { useState } from 'react'
import { DollarSign, ClipboardList, Users, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/ui'
import TransactionsByCSRReport from './TransactionsByCSRReport'

type ReportKey = 'transactions_by_csr' | null

const REPORT_CARDS: Array<{
  key: ReportKey
  icon: React.ElementType
  title: string
  description: string
  color: string
  bg: string
  soon: boolean
}> = [
  {
    key: 'transactions_by_csr',
    icon: DollarSign,
    title: 'Transaction Report',
    description: 'Outstanding transactions by CSR — not paid and not approved.',
    color: '#10B981',
    bg: '#ECFDF5',
    soon: false,
  },
  {
    key: null,
    icon: ClipboardList,
    title: 'Repair Orders Report',
    description: 'RO volume, job types, status distribution, and cycle times.',
    color: '#3B82F6',
    bg: '#EFF6FF',
    soon: false,
  },
  {
    key: null,
    icon: Users,
    title: 'Customer Report',
    description: 'New vs. returning customers, referral sources, and retention.',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    soon: true,
  },
  {
    key: null,
    icon: TrendingUp,
    title: 'Performance Report',
    description: 'Staff productivity, CSR assignments, and throughput trends.',
    color: '#F59E0B',
    bg: '#FFFBEB',
    soon: true,
  },
]

export default function ReportsView() {
  const [activeReport, setActiveReport] = useState<ReportKey>(null)

  if (activeReport === 'transactions_by_csr') {
    return <TransactionsByCSRReport onBack={() => setActiveReport(null)} />
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Reports"
        description="Analytics and summaries across your shop operations."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {REPORT_CARDS.map(({ key, icon: Icon, title, description, color, bg, soon }) => (
          <div
            key={title}
            className="relative rounded-xl border border-[var(--line)] bg-[var(--surface-0)] p-5 flex gap-4 items-start transition-shadow hover:shadow-md"
            style={{
              opacity: soon ? 0.55 : 1,
              cursor: soon || key === null ? 'default' : 'pointer',
            }}
            onClick={() => !soon && key !== null && setActiveReport(key)}
          >
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 40, height: 40, background: bg }}
            >
              <Icon size={18} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-[var(--text-strong)]">{title}</p>
                {soon && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                  >
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
