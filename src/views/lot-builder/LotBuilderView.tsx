import { useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { lotApi } from '@/api/lot'
import type { LotLayout, Zone } from '@/api/lot'
import { useBuilderStore } from '@/stores/builderStore'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import { useState } from 'react'
import { Eye, EyeOff, Save, AlertTriangle, Plus, LayoutDashboard, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import BuilderCanvas, { type SpotLiveData } from './canvas/BuilderCanvas'
import type { LotSpot } from '@/api/lot'
import BuilderToolbar, { MODE_HINTS } from './toolbar/BuilderToolbar'
import ZonePalette from './ZonePalette'
import SpotConfigPanel from './SpotConfigPanel'
import SpotPropertiesPanel from './SpotPropertiesPanel'
import LotBuilderTour from './LotBuilderTour'

// ─── Create Layout Dialog ──────────────────────────────────────────────────────

function CreateLayoutDialog({
  open,
  onClose,
  onCreate,
  creating,
}: {
  open: boolean
  onClose: () => void
  onCreate: (label: string) => void
  creating: boolean
}) {
  const [label, setLabel] = useState('Default')
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Create Lot Layout</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <TextField
          label="Layout Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          fullWidth
          size="small"
          placeholder="e.g. Default, Summer 2025"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={creating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onCreate(label)}
          disabled={creating || !label.trim()}
        >
          {creating ? 'Creating…' : 'Create Layout'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Lot Builder View ──────────────────────────────────────────────────────────

interface LotBuilderViewProps {
  shopIdOverride?: number
  layoutIdOverride?: number
}

export default function LotBuilderView({ shopIdOverride, layoutIdOverride }: LotBuilderViewProps = {}) {
  const { shop } = useAuth()
  const qc = useQueryClient()
  const shopId = shopIdOverride ?? shop?.id

  const [previewMode, setPreviewMode] = useState(false)
  const [rawSpots, setRawSpots] = useState<LotSpot[]>([])
  const [createLayoutOpen, setCreateLayoutOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [tourOpen, setTourOpen] = useState(false)

  const {
    layoutId,
    zones,
    canvasSpots,
    isDirty,
    selectedTempId,
    selectedSpotTempId,
    setSelected,
    setSelectedSpot,
    updateZone,
    updateCanvasSpot,
    deleteZone,
    loadLayout,
    loadCanvasSpots,
    reset,
    markClean,
    undo,
    redo,
    canUndo,
    canRedo,
    removeLastZonePolyPoint,
    removeLastSpotPolyPoint,
    backgroundImage,
    backgroundOpacity,
    toolMode,
  } = useBuilderStore()

  const selectedZone = zones.find((z) => z.tempId === selectedTempId) ?? null
  const selectedSpot = canvasSpots.find((s) => s.tempId === selectedSpotTempId) ?? null
  const selectedSpotZone = selectedSpot
    ? zones.find((z) => z.tempId === selectedSpot.zoneTempId)
    : undefined

  const spotLiveData = useMemo<Record<number, SpotLiveData>>(() => {
    const map: Record<number, SpotLiveData> = {}
    for (const spot of rawSpots) {
      map[spot.id] = {
        isOccupied: spot.is_occupied,
        jobLabel: spot.current_ro?.job_number != null
          ? `#${spot.current_ro.job_number}`
          : spot.current_ro?.ro_number ?? null,
      }
    }
    return map
  }, [rawSpots])

  // ── Data ──────────────────────────────────────────────────────────────────────

  const { data: layouts = [], isLoading: layoutsLoading } = useQuery<LotLayout[]>({
    queryKey: ['lot-layouts', shopId],
    queryFn: () => lotApi.listLayouts(shopId!),
    enabled: !!shopId,
    staleTime: 30_000,
  })

  const activeLayout = layoutIdOverride
    ? (layouts.find((l) => l.id === layoutIdOverride) ?? null)
    : (layouts.find((l) => l.is_active) ?? layouts[0] ?? null)

  const { data: dbZones = [], isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey: ['lot-zones', activeLayout?.id],
    queryFn: () => lotApi.listZones(activeLayout!.id),
    enabled: !!activeLayout,
    staleTime: 30_000,
  })

  // Load into store when layout/zones data arrives, then batch-load canvas spots
  useEffect(() => {
    if (!activeLayout || zonesLoading) return
    loadLayout(activeLayout, dbZones)

    // Load canvas spots for all zones in parallel
    if (dbZones.length > 0) {
      const zoneIdToTempId: Record<number, string> = {}
      dbZones.forEach((z) => { zoneIdToTempId[z.id] = String(z.id) })

      Promise.all(dbZones.map((z) => lotApi.listSpots(z.id)))
        .then((allSpotsPerZone) => {
          const flat = allSpotsPerZone.flat()
          loadCanvasSpots(flat, zoneIdToTempId)
          setRawSpots(flat)
        })
        .catch(() => {/* silently ignore — spots will just be empty */})
    }
  }, [activeLayout?.id, zonesLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset store on unmount
  useEffect(() => () => reset(), [reset])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (mod && e.key === 'z') {
        e.preventDefault()
        const { toolMode: tm, zonePolyInProgress: zpip, spotPolyInProgress: spip } = useBuilderStore.getState()
        if (tm === 'draw-zone-poly' && zpip.length > 0) {
          removeLastZonePolyPoint()
        } else if (tm === 'draw-spot-poly' && spip.length > 0) {
          removeLastSpotPolyPoint()
        } else {
          undo()
        }
      }
      if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
      if (!mod) {
        const { setToolMode } = useBuilderStore.getState()
        if (e.key === 'v' || e.key === 'V') setToolMode('select')
        if (e.key === 'z') setToolMode('draw-zone')
        if (e.key === 'Z') setToolMode('draw-zone-poly')
        if (e.key === 's') setToolMode('place-spot')
        if (e.key === 'S') setToolMode('draw-spot-poly')
        if (e.key === 'p' || e.key === 'P') setToolMode('pan')
        if (e.key === 'Escape') { setSelected(null); setSelectedSpot(null) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setSelected, setSelectedSpot, removeLastZonePolyPoint, removeLastSpotPolyPoint])

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createLayoutMutation = useMutation({
    mutationFn: (label: string) => lotApi.createLayout({ shop_id: shopId!, label }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lot-layouts', shopId] })
      setCreateLayoutOpen(false)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => lotApi.publishLayout(activeLayout!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lot-layouts', shopId] }),
  })

  // ── Save handler ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!layoutId || !shopId) return
    setSaving(true)
    try {
      const state = useBuilderStore.getState()
      const { zones: storeZones, boundary: storeBoundary, canvasSpots: storeSpots } = state

      // 1. Create new zones (id === 0) first to get real IDs
      for (const zone of storeZones.filter((z) => z.id === 0)) {
        const created = await lotApi.createZone({
          layout_id: layoutId,
          shop_id: shopId,
          name: zone.label,
          canvas_x: zone.canvas_x,
          canvas_y: zone.canvas_y,
          canvas_w: zone.canvas_w,
          canvas_h: zone.canvas_h,
          canvas_points: zone.canvas_points ? JSON.stringify(zone.canvas_points) : undefined,
          color_hex: zone.color_hex,
          spots_per_row: zone.spots_per_row,
          icon_type: zone.icon_type,
        })
        updateZone(zone.tempId, { id: created.id })
      }

      // 2. Reorder zones + update layout in parallel (both independent of each other)
      const latest = useBuilderStore.getState().zones
      await Promise.all([
        latest.length > 0
          ? lotApi.reorderZones({
              zones: latest.map((z) => ({
                id: z.id,
                canvas_x: z.canvas_x,
                canvas_y: z.canvas_y,
                canvas_w: z.canvas_w,
                canvas_h: z.canvas_h,
                canvas_points: z.canvas_points ? JSON.stringify(z.canvas_points) : null,
              })),
            })
          : Promise.resolve(),
        lotApi.updateLayout({
          id: layoutId,
          ...(storeBoundary && {
            boundary_x: storeBoundary.x,
            boundary_y: storeBoundary.y,
            boundary_w: storeBoundary.w,
            boundary_h: storeBoundary.h,
          }),
          canvas_shapes: JSON.stringify(useBuilderStore.getState().structures),
          background_image: backgroundImage ?? undefined,
          background_opacity: backgroundOpacity,
        }),
      ])

      // 3. Save spots — group new spots by zone (one bulk call per zone) + all updates in parallel
      const latestZones = useBuilderStore.getState().zones
      const latestSpots = useBuilderStore.getState().canvasSpots
      const { dirtySpotTempIds, deletedSpotIds } = useBuilderStore.getState()
      const zoneByTempId = Object.fromEntries(latestZones.map((z) => [z.tempId, z]))

      // Group unsaved spots by zone
      const newSpotsByZone = new Map<string, typeof latestSpots>()
      for (const spot of latestSpots.filter((s) => s.id === 0)) {
        const zone = zoneByTempId[spot.zoneTempId]
        if (!zone || zone.id === 0) continue
        if (!newSpotsByZone.has(spot.zoneTempId)) newSpotsByZone.set(spot.zoneTempId, [])
        newSpotsByZone.get(spot.zoneTempId)!.push(spot)
      }

      await Promise.all([
        // One bulk call per zone for all new spots in that zone
        ...Array.from(newSpotsByZone.entries()).map(async ([zoneTempId, spots]) => {
          const zone = zoneByTempId[zoneTempId]
          const created = await lotApi.bulkCreateSpots({
            zone_id: zone.id,
            layout_id: layoutId,
            shop_id: shopId,
            replace: false,
            spots: spots.map((spot) => ({
              label: spot.label,
              spot_type: spot.spot_type,
              spot_row: 0,
              spot_col: 0,
              canvas_x: spot.canvas_x,
              canvas_y: spot.canvas_y,
              canvas_w: spot.canvas_w,
              canvas_h: spot.canvas_h,
              canvas_points: spot.canvas_points ? JSON.stringify(spot.canvas_points) : undefined,
            })),
          })
          created.forEach((c, i) => { if (c && spots[i]) updateCanvasSpot(spots[i].tempId, { id: c.id }) })
        }),
        // Only update spots that were actually modified since last save
        ...latestSpots.filter((s) => s.id > 0 && dirtySpotTempIds.includes(s.tempId)).map((spot) =>
          lotApi.updateSpot({
            id: spot.id,
            name: spot.label,
            spot_type: spot.spot_type,
            canvas_x: spot.canvas_x,
            canvas_y: spot.canvas_y,
            canvas_w: spot.canvas_w,
            canvas_h: spot.canvas_h,
            canvas_points: spot.canvas_points ? JSON.stringify(spot.canvas_points) : null,
          })
        ),
        // Delete spots that were removed since last save
        ...deletedSpotIds.map((id) => lotApi.deleteSpot(id)),
      ])

      markClean()
      qc.invalidateQueries({ queryKey: ['lot-zones', layoutId] })
      qc.invalidateQueries({ queryKey: ['lot-layouts', shopId] })
    } finally {
      setSaving(false)
    }
  }, [layoutId, shopId, backgroundImage, backgroundOpacity, updateZone, updateCanvasSpot, markClean, qc])

  // ── Loading / Empty states ────────────────────────────────────────────────────

  if (!shopId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">
          {shopIdOverride
            ? 'Select a valid shop from the admin console to configure its lot.'
            : 'No shop associated with your account.'}
        </Alert>
      </Box>
    )
  }

  if (layoutsLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 4 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">Loading lot layout…</Typography>
      </Box>
    )
  }

  if (!activeLayout) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2, p: 4 }}>
        <LayoutDashboard size={48} style={{ opacity: 0.3 }} />
        <Typography variant="h6" fontWeight={700}>No lot layout yet</Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first layout to start mapping your lot.
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setCreateLayoutOpen(true)}
          disabled={createLayoutMutation.isPending}
        >
          Create Layout
        </Button>
        <CreateLayoutDialog
          open={createLayoutOpen}
          onClose={() => setCreateLayoutOpen(false)}
          onCreate={(label) => createLayoutMutation.mutate(label)}
          creating={createLayoutMutation.isPending}
        />
      </Box>
    )
  }

  // ── Main builder ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header — compact single row */}
      <Box sx={{
        px: 2, py: 0.75,
        display: 'flex', alignItems: 'center', gap: 1.5,
        borderBottom: '1px solid', borderColor: 'divider',
        flexShrink: 0, minHeight: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>{activeLayout.label}</Typography>
          {activeLayout.is_active && (
            <Chip label="Active" size="small" color="success" sx={{ height: 18, fontSize: '0.6rem' }} />
          )}
        </Box>

        {!previewMode && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', whiteSpace: 'nowrap', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {MODE_HINTS[toolMode]}
          </Typography>
        )}

        {isDirty && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <AlertTriangle size={13} color="#F59E0B" />
            <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
              Unsaved
            </Typography>
          </Box>
        )}

        <Tooltip title="Tour — learn how to use the lot builder">
          <IconButton size="small" onClick={() => setTourOpen(true)} sx={{ flexShrink: 0, color: 'text.secondary' }}>
            <HelpCircle size={16} />
          </IconButton>
        </Tooltip>

        <Tooltip title={previewMode ? 'Back to builder' : 'Preview mode'}>
          <Button
            variant="outlined"
            size="small"
            startIcon={previewMode ? <EyeOff size={13} /> : <Eye size={13} />}
            onClick={() => setPreviewMode((p) => !p)}
            sx={{ borderRadius: 2, flexShrink: 0, py: 0.35 }}
          >
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
        </Tooltip>

        {isDirty && !previewMode && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Save size={13} />}
            onClick={handleSave}
            disabled={saving}
            sx={{ borderRadius: 2, flexShrink: 0, py: 0.35 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}

        {!activeLayout.is_active && (
          <Button
            variant="contained"
            size="small"
            onClick={async () => { await handleSave(); publishMutation.mutate() }}
            disabled={publishMutation.isPending || saving}
            sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0, py: 0.35 }}
          >
            {publishMutation.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* Vertical toolbar — collapsible */}
        {!previewMode && (
          <BuilderToolbar open={toolbarOpen} onToggle={() => setToolbarOpen(p => !p)} />
        )}

        {/* Canvas */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
            {zonesLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Loading zones…</Typography>
              </Box>
            ) : (
              <BuilderCanvas
                readonly={previewMode}
                spotLiveData={previewMode ? spotLiveData : undefined}
              />
            )}
          </Box>
        </Box>

        {/* Right panel — Zones + properties (collapsible) */}
        {!previewMode && (
          <Box sx={{
            width: rightOpen ? 240 : 28,
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.18s ease',
            bgcolor: 'background.paper',
          }}>
            {/* Panel header with toggle */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              px: rightOpen ? 1.5 : 0,
              py: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
              justifyContent: rightOpen ? 'space-between' : 'center',
              minHeight: 32,
            }}>
              {rightOpen && (
                <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1 }}>
                  Layers
                </Typography>
              )}
              <Tooltip title={rightOpen ? 'Collapse panel' : 'Expand panel'} placement="left">
                <IconButton size="small" onClick={() => setRightOpen(p => !p)} sx={{ width: 24, height: 24, borderRadius: 1 }}>
                  {rightOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </IconButton>
              </Tooltip>
            </Box>

            {rightOpen && (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Zones list */}
                <Box sx={{ p: 1.5, overflowY: 'auto', flexShrink: 0, maxHeight: 240 }}>
                  <ZonePalette
                    zones={zones}
                    selectedTempId={selectedTempId}
                    onSelectZone={setSelected}
                    onDeleteZone={deleteZone}
                    onRenameZone={(tempId, label) => updateZone(tempId, { label })}
                  />
                </Box>

                {/* Properties section */}
                {(selectedSpot || (selectedZone && !selectedSpot)) && (
                  <>
                    <Divider />
                    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                      {selectedSpot ? (
                        <SpotPropertiesPanel
                          spot={selectedSpot}
                          zone={selectedSpotZone}
                          onUpdate={(updates) => updateCanvasSpot(selectedSpot.tempId, updates)}
                          onClose={() => setSelectedSpot(null)}
                        />
                      ) : selectedZone ? (
                        <SpotConfigPanel
                          zone={selectedZone}
                          onUpdate={(updates) => updateZone(selectedZone.tempId, updates)}
                          onClose={() => setSelected(null)}
                        />
                      ) : null}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>

      <CreateLayoutDialog
        open={createLayoutOpen}
        onClose={() => setCreateLayoutOpen(false)}
        onCreate={(label) => createLayoutMutation.mutate(label)}
        creating={createLayoutMutation.isPending}
      />

      <LotBuilderTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </Box>
  )
}
