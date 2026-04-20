/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_XANO_BASE: string
  readonly VITE_XANO_REALTIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
