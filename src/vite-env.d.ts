/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
