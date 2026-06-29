import { supabase } from '@/integrations/supabase/client'

export { supabase }

export const checkSupabaseConnection = async (): Promise<{ connected: boolean; error?: string }> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { connected: false, error: 'You are currently offline' };
  }

  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url) return { connected: true }; // can't verify, assume OK to avoid false negatives

  // Lightweight reachability probe — hits the auth health endpoint which is always
  // public, doesn't require RLS or a session, and works the same on iOS WKWebView,
  // Android, and the browser. Wrapped in a short timeout so a slow network never
  // surfaces a permanent "unreachable" banner.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: key },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (res.ok || res.status === 401 || res.status === 404) {
      // Any HTTP response means the server is reachable.
      return { connected: true };
    }
    return { connected: false, error: `Server responded ${res.status}` };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { connected: false, error: 'Connection timed out' };
    }
    return { connected: false, error: err?.message || 'Network unreachable' };
  }
};
