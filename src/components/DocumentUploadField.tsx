import { useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import ButtonBase from '@mui/material/ButtonBase'
import { FileText, X, Upload } from 'lucide-react'

interface Props {
  value: File[]
  label: string          // e.g. "Vehicle Registration" or "Insurance Card"
  onChange: (files: File[]) => void
}

export default function DocumentUploadField({ value, label, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    inputRef.current?.click()
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) onChange([...value, ...picked])
    e.target.value = ''
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
      />

      {/* Selected files */}
      {value.map((file, i) => {
        const isPdf = file.type === 'application/pdf'
        const previewUrl = !isPdf ? URL.createObjectURL(file) : null

        return (
          <Box
            key={i}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            {previewUrl ? (
              <Box
                component="img"
                src={previewUrl}
                alt={file.name}
                sx={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 1, flexShrink: 0, border: '1px solid', borderColor: 'divider' }}
              />
            ) : (
              <Box sx={{ width: 72, height: 48, borderRadius: 1, flexShrink: 0, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <FileText size={22} />
              </Box>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{file.name}</Typography>
              <Typography variant="caption" color="text.secondary">{formatSize(file.size)}</Typography>
            </Box>

            <IconButton size="small" onClick={() => remove(i)} title="Remove" sx={{ color: 'error.main', flexShrink: 0 }}>
              <X size={15} />
            </IconButton>
          </Box>
        )
      })}

      {/* Add more / empty state */}
      <ButtonBase
        onClick={handleClick}
        sx={{
          width: '100%',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          py: value.length > 0 ? 1.5 : 2,
          px: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          transition: 'border-color 0.15s, background 0.15s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
        }}
      >
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
          <Upload size={16} />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            {value.length > 0 ? `Add more files` : `Upload ${label}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            JPG, PNG, or PDF
          </Typography>
        </Box>
      </ButtonBase>
    </Box>
  )
}
