import { AwsClient } from 'aws4fetch';

// Canonical shape of the wayfinder backup payload. Mirrors what
// `buildBackupPayload()` in WayfinderInterface.tsx produces.
export interface WayfinderBackup {
  version: number;
  exportedAt: string;
  nodes: Record<string, unknown>;
  customRoutes: Record<string, Array<{ x: number; y: number }>>;
  edges: Array<{ from: string; to: string }>;
}

// Read configuration from Vite env. Values are injected at build time.
// Missing values simply disable cloud sync — the app still works offline.
const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL as string | undefined;
const ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID as string | undefined;
const ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID as string | undefined;
const SECRET_KEY = import.meta.env.VITE_R2_SECRET_KEY as string | undefined;
const BUCKET = import.meta.env.VITE_R2_BUCKET as string | undefined;
const OBJECT_KEY = 'wayfinder.json';

export const isCloudSyncConfigured = (): boolean =>
  Boolean(PUBLIC_URL && ACCOUNT_ID && ACCESS_KEY_ID && SECRET_KEY && BUCKET);

// Fetch the cloud-hosted wayfinder JSON. Returns null on any failure so
// callers can fall back to localStorage without special error handling.
export const fetchCloudData = async (): Promise<WayfinderBackup | null> => {
  if (!PUBLIC_URL) return null;
  try {
    // `cache: 'no-store'` ensures we always pull the freshest JSON rather than
    // letting the browser cache a stale copy between reloads.
    const res = await fetch(PUBLIC_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('Cloud fetch returned non-OK status:', res.status);
      return null;
    }
    const parsed = (await res.json()) as WayfinderBackup;
    return parsed;
  } catch (err) {
    console.warn('Cloud fetch failed (offline or bucket unreachable):', err);
    return null;
  }
};

// Upload the backup payload to R2, overwriting the existing object. Uses
// SigV4 via aws4fetch since R2 is S3-API compatible.
export const uploadCloudData = async (payload: WayfinderBackup): Promise<boolean> => {
  if (!isCloudSyncConfigured()) {
    console.warn('Cloud sync not configured; set VITE_R2_* env vars.');
    return false;
  }
  try {
    const client = new AwsClient({
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_KEY!,
      service: 's3',
      region: 'auto',
    });
    const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${OBJECT_KEY}`;
    const body = JSON.stringify(payload);
    const res = await client.fetch(endpoint, {
      method: 'PUT',
      body,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Cloud upload failed:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Cloud upload error:', err);
    return false;
  }
};
