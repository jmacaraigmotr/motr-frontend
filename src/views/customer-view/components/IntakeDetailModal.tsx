import { useQuery } from '@tanstack/react-query'
import { repairOrdersApi } from '@/api/repairOrders'
import type { StaffMember } from '@/types/repairOrder'
import type { Vehicle } from '@/types/vehicle'
import IntakePanel from './IntakePanel'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import { X, ClipboardList } from 'lucide-react'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/types/repairOrder'

interface Props {
  roId: number | null
  onClose: () => void
}

export default function IntakeDetailModal({ roId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['repair_order_detail', roId],
    queryFn: () => repairOrdersApi.get(roId as number),
    enabled: !!roId,
  })

  const ro         = data?.ro
  const customer   = data?.customer as { first_name?: string; last_name?: string } | null
  const vehicle    = (data?.vehicle ?? null) as Vehicle | null
  const customerName = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : null
  const vehicleLabel = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : null

  return (
    <Dialog
      open={!!roId}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '92vh' } }}
    >
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box sx={{ p: 0.75, bgcolor: 'primary.main', borderRadius: 1.5, display: 'flex', color: '#fff', flexShrink: 0 }}>
              <ClipboardList size={16} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1 }}>
                Intake Details
              </Typography>
              {ro && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4, flexWrap: 'wrap' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em', lineHeight: 1 }}>
                    Job #{ro.job_number ?? '—'}
                  </Typography>
                  <Typography variant="body2" color="text.disabled" sx={{ fontWeight: 500 }}>
                    RO #{ro.ro_number}
                  </Typography>
                  <Chip
                    label={JOB_STATUS_LABELS[ro.job_status ?? 'open']}
                    color={JOB_STATUS_COLORS[ro.job_status ?? 'open']}
                    size="small"
                    sx={{ fontWeight: 700, height: 20, fontSize: '0.7rem' }}
                  />
                </Box>
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0 }}>
            <X size={16} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {isLoading || !ro ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <IntakePanel
            roId={ro.id}
            jobType={ro.job_type}
            dealerClaimType={ro.insurance_claim_type ?? null}
            roSummary={{
              jobNumber: ro.job_number,
              roNumber: ro.ro_number,
              customerName,
              vehicleLabel,
              jobType: ro.job_type,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
