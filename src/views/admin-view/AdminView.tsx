import { useState } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import AdminOverviewView from '@/views/admin-app/AdminOverviewView'
import AdminShopsView from '@/views/admin-app/AdminShopsView'

export default function AdminView() {
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <Box sx={{ px: 4, pt: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 44 }}>
          <Tab label="Dashboard" sx={{ fontWeight: 700, minHeight: 44 }} />
          <Tab label="Shops" sx={{ fontWeight: 700, minHeight: 44 }} />
        </Tabs>
      </Box>

      <Box sx={{ px: 4, py: 3, flex: 1 }}>
        {tab === 0 && <AdminOverviewView />}
        {tab === 1 && <AdminShopsView />}
      </Box>
    </Box>
  )
}
