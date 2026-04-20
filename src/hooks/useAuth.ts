import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const store = useAuthStore()

  return {
    user: store.user,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    currentView: store.currentView,
    role: store.user?.role ?? null,
    shop: store.user?.shop ?? null,
    login: store.login,
    logout: store.logout,
    switchView: store.switchView,
    hasPermission: store.hasPermission,
    setActiveShop: store.setActiveShop,
    isAdmin: store.user?.role?.code === 'admin',
  }
}
