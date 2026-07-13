/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV_ID: string
  readonly VITE_CLOUDBASE_REGION: string
  readonly VITE_CLOUDBASE_ACCESS_KEY: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_PUBLIC_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
