import { create } from 'zustand'
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark'

interface UIState {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  tourAction: string | null
  setTourAction: (action: string | null) => void
}

const THEME_STORAGE_KEY = 'motr-ui'

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark'

const readStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const stored = parsed?.state?.themeMode
    return isThemeMode(stored) ? stored : null
  } catch {
    return null
  }
}

const getSystemThemeMode = (): ThemeMode => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const initialThemeMode: ThemeMode = readStoredThemeMode() ?? 'light'

type ThemeOnlyState = Pick<UIState, 'themeMode'>

const persistOptions: PersistOptions<UIState, ThemeOnlyState> = {
  name: THEME_STORAGE_KEY,
  partialize: (state: UIState) => ({ themeMode: state.themeMode }),
  ...(typeof window !== 'undefined'
    ? { storage: createJSONStorage<ThemeOnlyState>(() => window.localStorage) }
    : {}),
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      themeMode: initialThemeMode,
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleTheme: () => {
        const next = get().themeMode === 'light' ? 'dark' : 'light'
        set({ themeMode: next })
      },
      tourAction: null,
      setTourAction: (action) => set({ tourAction: action }),
    }),
    persistOptions,
  ),
)
