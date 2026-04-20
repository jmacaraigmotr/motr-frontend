import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/auth'
import { setAuthHandlers } from '@/api/client'
import type { User } from '@/types'
import type { Shop } from '@/types/auth'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  currentView: string
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User, token: string) => void
  switchView: (view: string) => void
  setActiveShop: (shop: Shop) => void
  hasPermission: (permission: string) => boolean
}

const DEFAULT_VIEW_FOR_ROLE: Record<string, string> = {
  csr: 'dashboard-view',
  csr_manager: 'dashboard-view',
  logistics: 'logistics-view',
  logistics_manager: 'logistics-view',
  production_scheduler: 'production-view',
  shop_foreman: 'production-view',
  technician: 'technician-view',
  painter: 'technician-view',
  nttbe: 'nttbe-view',
  accounting: 'accounting-view',
  upper_management: 'dashboard-view',
  admin: 'dashboard-view',
}

function getDefaultView(user: User): string {
  const roleCode = user.role?.code ?? ''
  return DEFAULT_VIEW_FOR_ROLE[roleCode] ?? 'customer-view'
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      currentView: '',

      login: async (email, password) => {
        const response = await authApi.login({ email, password })
        const view = getDefaultView(response.user)
        set({
          user: response.user,
          token: response.authToken,
          isAuthenticated: true,
          currentView: view,
        })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, currentView: '' })
      },

      setUser: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          currentView: getDefaultView(user),
        })
      },

      switchView: (view) => set({ currentView: view }),

      setActiveShop: (shop) => {
        const { user } = get()
        if (!user) return
        set({ user: { ...user, shop } })
      },

      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        if (user.role?.code === 'admin') return true
        return false
      },
    }),
    {
      name: 'motr-v2-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        currentView: state.currentView,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

setAuthHandlers({
  getToken: () => useAuthStore.getState().token,
  clearAuth: () => useAuthStore.getState().logout(),
})
