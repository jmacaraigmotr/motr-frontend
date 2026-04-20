import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/layout/AppShell'
import AdminShell from '@/components/layout/AdminShell'
import LoginPage from '@/views/auth/LoginPage'
import DashboardView from '@/views/dashboard-view/DashboardView'
import CustomersView from '@/views/customers-view/CustomersView'
import LogisticsView from '@/views/logistics-view/LogisticsView'
import ProductionView from '@/views/production-view/ProductionView'
import TechnicianView from '@/views/technician-view/TechnicianView'
import NttbeView from '@/views/nttbe-view/NttbeView'
import AccountingView from '@/views/accounting-view/AccountingView'
import AdminView from '@/views/admin-view/AdminView'
import RepairOrdersView from '@/views/repair-orders-view/RepairOrdersView'
import TeamView from '@/views/team-view/TeamView'
import InsuranceCompaniesView from '@/views/insurance-companies-view/InsuranceCompaniesView'
import LotBuilderView from '@/views/lot-builder/LotBuilderView'
import AdminOverviewView from '@/views/admin-app/AdminOverviewView'
import AdminShopsView from '@/views/admin-app/AdminShopsView'
import AdminLotBuilderPage from '@/views/admin-app/AdminLotBuilderPage'
import AdminLotBuilderPickerPage from '@/views/admin-app/AdminLotBuilderPickerPage'
import AdminUsersView from '@/views/admin-app/AdminUsersView'
import AdminShopLotsView from '@/views/admin-app/AdminShopLotsView'

function ViewRouter() {
  const { currentView } = useAuth()

  const map: Record<string, React.ReactNode> = {
    'dashboard-view': <DashboardView />,
    'customer-view':  <CustomersView />,
    'customers-view': <CustomersView />,
    'logistics-view': <LogisticsView />,
    'production-view': <ProductionView />,
    'technician-view': <TechnicianView />,
    'nttbe-view': <NttbeView />,
    'repair-orders-view': <RepairOrdersView />,
    'accounting-view': <AccountingView />,
    'admin-view': <AdminView />,
    'team-view':          <TeamView />,
    'lot-builder-view':   <LotBuilderView />,
    'insurance-companies-view': <InsuranceCompaniesView />,
  }

  return <>{map[currentView] ?? <CustomersView />}</>
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          </RequireAuth>
        }
      >
        <Route path="overview" element={<AdminOverviewView />} />
        <Route path="users" element={<AdminUsersView />} />
        <Route path="shops" element={<AdminShopsView />} />
        <Route path="shops/:shopId/lots" element={<AdminShopLotsView />} />
        <Route path="shops/:shopId/lots/:layoutId" element={<AdminLotBuilderPage />} />
        <Route path="shops/:shopId/lot-builder" element={<AdminLotBuilderPage />} />
        <Route path="lot-builder" element={<AdminLotBuilderPickerPage />} />
        <Route index element={<Navigate to="overview" replace />} />
      </Route>
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell>
              <ViewRouter />
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
