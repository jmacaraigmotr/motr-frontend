import { useState, useEffect, useCallback } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import {
  X, ChevronLeft, ChevronRight, Download,
  ZoomIn, ZoomOut, RotateCw, FileText,
} from 'lucide-react'
import type { CustomerDocument } from '@/types/document'

const CATEGORY_LABELS: Record<string, string> = {
  drivers_license: "Driver's License",
  registration:    'Registration',
  insurance_card:  'Insurance Card',
  other:           'Other',
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  documents: CustomerDocument[]
  initialIndex?: number
  open: boolean
  onClose: () => void
}

export default function DocumentViewer({ documents, initialIndex = 0, open, onClose }: Props) {
  const [index,    setIndex]    = useState(initialIndex)
  const [zoom,     setZoom]     = useState(1)
  const [rotation, setRotation] = useState(0)

  const doc     = documents[index]
  const fileUrl = doc?.file?.url ?? null
  const isImage = doc?.file?.type === 'image'
  const isPdf   = doc?.file?.mime?.includes('pdf') ?? false

  // Sync to initialIndex whenever viewer opens
  useEffect(() => {
    if (open) { setIndex(initialIndex); setZoom(1); setRotation(0) }
  }, [open, initialIndex])

  // Reset zoom/rotation when navigating
  useEffect(() => { setZoom(1); setRotation(0) }, [index])

  const prev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : documents.length - 1)), [documents.length])
  const next = useCallback(() => setIndex(i => (i < documents.length - 1 ? i + 1 : 0)), [documents.length])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')          prev()
      else if (e.key === 'ArrowRight')    next()
      else if (e.key === 'Escape')        onClose()
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 5))
      else if (e.key === '-')             setZoom(z => Math.max(z - 0.25, 0.25))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, prev, next, onClose])

  if (!doc) return null

  const displayName  = doc.label ?? CATEGORY_LABELS[doc.category ?? ''] ?? 'Document'
  const hasMany      = documents.length > 1
  const zoomPct      = `${Math.round(zoom * 100)}%`

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#0d0d0d', display: 'flex', flexDirection: 'column' } }}
    >
      {/* ── Top bar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1.25,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        bgcolor: 'rgba(255,255,255,0.03)',
      }}>
        {/* File info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} fontSize="0.9rem" color="#fff" noWrap>
            {displayName}
          </Typography>
          <Typography fontSize="0.72rem" sx={{ color: 'rgba(255,255,255,0.38)' }} noWrap>
            {doc.file?.name}
            {doc.file?.size ? ` · ${formatSize(doc.file.size)}` : ''}
            {hasMany ? ` · ${index + 1} / ${documents.length}` : ''}
          </Typography>
        </Box>

        {doc.category && (
          <Chip
            label={CATEGORY_LABELS[doc.category] ?? doc.category}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', height: 20 }}
          />
        )}

        {/* Image controls */}
        {isImage && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Tooltip title="Zoom out  (-)">
              <span>
                <IconButton size="small" onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} disabled={zoom <= 0.25} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  <ZoomOut size={17} />
                </IconButton>
              </span>
            </Tooltip>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', minWidth: 38, textAlign: 'center', userSelect: 'none' }}>
              {zoomPct}
            </Typography>
            <Tooltip title="Zoom in  (+)">
              <span>
                <IconButton size="small" onClick={() => setZoom(z => Math.min(z + 0.25, 5))} disabled={zoom >= 5} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  <ZoomIn size={17} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Rotate 90°">
              <IconButton size="small" onClick={() => setRotation(r => (r + 90) % 360)} sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5 }}>
                <RotateCw size={17} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Download */}
        {fileUrl && (
          <Tooltip title="Download">
            <IconButton
              size="small"
              component="a"
              href={fileUrl}
              download={doc.file?.name ?? true}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5 }}
            >
              <Download size={17} />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Close  (Esc)">
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5 }}>
            <X size={19} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Main content ── */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', minHeight: 0 }}>

        {/* Prev */}
        {hasMany && (
          <Tooltip title="Previous  (←)">
            <IconButton
              onClick={prev}
              sx={{
                position: 'absolute', left: 16, zIndex: 2,
                bgcolor: 'rgba(255,255,255,0.07)', color: '#fff',
                width: 44, height: 44,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
              }}
            >
              <ChevronLeft size={26} />
            </IconButton>
          </Tooltip>
        )}

        {/* ── Image ── */}
        {isImage && fileUrl ? (
          <Box sx={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Box
              component="img"
              src={fileUrl}
              alt={displayName}
              draggable={false}
              sx={{
                display: 'block',
                maxWidth:  zoom === 1 ? '100%'  : 'none',
                maxHeight: zoom === 1 ? '100%'  : 'none',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: 'transform 0.18s ease',
                borderRadius: 1.5,
                boxShadow: '0 12px 60px rgba(0,0,0,0.7)',
                userSelect: 'none',
              }}
            />
          </Box>

        /* ── PDF ── */
        ) : isPdf && fileUrl ? (
          <Box
            component="iframe"
            src={fileUrl}
            title={displayName}
            sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />

        /* ── Unsupported / generic ── */
        ) : fileUrl ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)', display: 'inline-flex' }}>
                <FileText size={52} color="rgba(255,255,255,0.3)" />
              </Box>
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.75, fontSize: '0.95rem' }}>
              Preview not available for this file type.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', mb: 3 }}>
              {doc.file?.name}
            </Typography>
            <Button
              variant="outlined"
              component="a"
              href={fileUrl}
              download={doc.file?.name ?? true}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<Download size={16} />}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.06)' } }}
            >
              Download file
            </Button>
          </Box>

        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.25)' }}>No file available.</Typography>
        )}

        {/* Next */}
        {hasMany && (
          <Tooltip title="Next  (→)">
            <IconButton
              onClick={next}
              sx={{
                position: 'absolute', right: 16, zIndex: 2,
                bgcolor: 'rgba(255,255,255,0.07)', color: '#fff',
                width: 44, height: 44,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
              }}
            >
              <ChevronRight size={26} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* ── Thumbnail rail ── */}
      {hasMany && (
        <Box sx={{
          display: 'flex', gap: 1, px: 2.5, py: 1.5, alignItems: 'center',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          overflowX: 'auto', flexShrink: 0,
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          {documents.map((d, i) => {
            const isImg  = d.file?.type === 'image'
            const active = i === index
            return (
              <Box
                key={d.id}
                onClick={() => setIndex(i)}
                title={d.label ?? CATEGORY_LABELS[d.category ?? ''] ?? 'Document'}
                sx={{
                  width: 56, height: 40, borderRadius: 1.25, flexShrink: 0,
                  cursor: 'pointer', overflow: 'hidden',
                  border: '2px solid',
                  borderColor: active ? 'primary.main' : 'transparent',
                  bgcolor: 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.15s, opacity 0.15s',
                  opacity: active ? 1 : 0.55,
                  '&:hover': { borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.3)', opacity: 1 },
                }}
              >
                {isImg && d.file?.url ? (
                  <Box component="img" src={d.file.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <FileText size={18} color="rgba(255,255,255,0.5)" />
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </Dialog>
  )
}
