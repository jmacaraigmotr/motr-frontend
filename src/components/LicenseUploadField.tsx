import { useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import ButtonBase from '@mui/material/ButtonBase'
import { Camera, X } from 'lucide-react'

interface Props {
  value: File[]
  existingUrls?: string[]   // for edit mode — already-uploaded images
  onChange: (files: File[]) => void
}

export default function LicenseUploadField({ value, existingUrls = [], onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    inputRef.current?.click()
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) onChange([...value, ...picked])
    e.target.value = ''
  }

  function removeNew(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const hasAny = value.length > 0 || existingUrls.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
      />

      {/* Existing uploaded images (edit mode) */}
      {existingUrls.map((url, i) => (
        <Box
          key={`existing-${i}`}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
        >
          <Box
            component="img"
            src={url}
            alt={`License ${i + 1}`}
            sx={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 1, flexShrink: 0, border: '1px solid', borderColor: 'divider' }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap color="text.secondary">Uploaded</Typography>
          </Box>
        </Box>
      ))}

      {/* Newly selected files */}
      {value.map((file, i) => (
        <Box
          key={`new-${i}`}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
        >
          <Box
            component="img"
            src={URL.createObjectURL(file)}
            alt={file.name}
            sx={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 1, flexShrink: 0, border: '1px solid', borderColor: 'divider' }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{file.name}</Typography>
            <Typography variant="caption" color="text.secondary">{formatSize(file.size)}</Typography>
          </Box>
          <IconButton size="small" onClick={() => removeNew(i)} title="Remove" sx={{ color: 'error.main', flexShrink: 0 }}>
            <X size={15} />
          </IconButton>
        </Box>
      ))}

      {/* Add more / empty state */}
      <ButtonBase
        onClick={handleClick}
        sx={{
          width: '100%',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          py: hasAny ? 1.5 : 2.5,
          px: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.75,
          transition: 'border-color 0.15s, background 0.15s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
        }}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
          <Camera size={18} />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            {hasAny ? 'Add more photos' : 'Click to upload license photo'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            JPG, PNG, HEIC — front &amp; back recommended
          </Typography>
        </Box>
      </ButtonBase>
    </Box>
  )
}
