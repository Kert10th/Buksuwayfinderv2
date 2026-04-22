/// <reference types="vite/client" />

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

// Cloud sync (Cloudflare R2). Set in .env.local; unset values disable cloud.
interface ImportMetaEnv {
  readonly VITE_R2_PUBLIC_URL?: string;   // e.g. https://pub-xxxx.r2.dev/wayfinder.json
  readonly VITE_R2_ACCOUNT_ID?: string;   // Cloudflare account ID
  readonly VITE_R2_ACCESS_KEY_ID?: string;
  readonly VITE_R2_SECRET_KEY?: string;
  readonly VITE_R2_BUCKET?: string;       // e.g. buksu-wayfinder
  readonly VITE_ADMIN_PASSWORD?: string;  // Admin login password; set via hosting env
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}














