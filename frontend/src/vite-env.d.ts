/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_OA_ID: string;
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
