import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const XANO_BASE = import.meta.env.VITE_XANO_BASE

if (!XANO_BASE) {
  throw new Error('VITE_XANO_BASE is not set. Copy .env.example to .env and fill in your Xano instance URL.')
}

type ApiErrorResponse = { error?: { code?: string; message?: string } }

type AuthHandlers = {
  getToken?: () => string | null
  clearAuth?: () => void
}

const authHandlers: AuthHandlers = {}

export function setAuthHandlers(handlers: AuthHandlers) {
  authHandlers.getToken = handlers.getToken
  authHandlers.clearAuth = handlers.clearAuth
}

export function createApiClient(canonical: string) {
  const instance = axios.create({
    baseURL: `${XANO_BASE}/api:${canonical}`,
    // Content-Type is NOT set here globally.
    // JSON is set per-request via transformRequest below.
    // FormData requests (file uploads) must NOT have Content-Type set — the
    // browser adds it automatically with the correct multipart boundary.
    timeout: 30_000,
  })

  // Automatically set Content-Type: application/json for plain object/string
  // payloads, but leave FormData untouched so the browser sets the boundary.
  instance.defaults.transformRequest = [
    (data, headers) => {
      if (data instanceof FormData) return data
      if (data !== undefined && data !== null) {
        if (headers) headers['Content-Type'] = 'application/json'
        return JSON.stringify(data)
      }
      return data
    },
  ]

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = authHandlers.getToken?.()
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error),
  )

  instance.interceptors.response.use(
    (response) => {
      const d = response.data
      // Xano paginated lists return { items, itemsReceived, curPage, perPage, ... }
      // (itemsTotal is also present when totals:true is set in the query)
      // Normalize to { data, pagination } so all views work consistently

      // Shape: { list: { items, ... }, metadata: { ... } }
      // Normalize list to { data, pagination } and surface metadata at the top level.
      // This keeps all existing views working (they read .data / .pagination) while
      // letting consumers that need metadata access it via .metadata.
      if (d && d.list && Array.isArray(d.list.items) && ('itemsReceived' in d.list || 'itemsTotal' in d.list)) {
        return {
          data: d.list.items,
          pagination: {
            page    : d.list.curPage,
            per_page: d.list.perPage,
            total   : d.list.itemsTotal ?? d.list.itemsReceived,
          },
          metadata: d.metadata ?? null,
        }
      }

      // Shape: { items, itemsReceived, curPage, perPage, ... }
      if (d && Array.isArray(d.items) && ('itemsReceived' in d || 'itemsTotal' in d)) {
        return {
          data: d.items,
          pagination: {
            page    : d.curPage,
            per_page: d.perPage,
            total   : d.itemsTotal ?? d.itemsReceived,
          },
        }
      }
      return d
    },
    (error: AxiosError<ApiErrorResponse>) => {
      if (error.response?.status === 401) {
        // Any 401 means the session is expired or the token is invalid.
        // Clear auth so the user is redirected to the login page rather than
        // remaining stuck in a broken state where no data loads.
        authHandlers.clearAuth?.()
        window.location.href = '/login'
      }

      return Promise.reject({
        code: error.response?.data?.error?.code ?? 'UNKNOWN_ERROR',
        message:
          error.response?.data?.error?.message ??
          error.message ??
          'An unexpected error occurred',
        status: error.response?.status ?? 500,
      })
    },
  )

  return instance
}
