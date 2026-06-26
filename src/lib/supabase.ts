import { supabase } from '@/integrations/supabase/client'

export { supabase }

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
    if (error) {
      console.error('Supabase connection error:', error);
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err: any) {
    console.error('Network error checking Supabase:', err);
    let message = 'No route to host';
    if (!navigator.onLine) message = 'You are currently offline';
    return { connected: false, error: err.message || message };
  }
};
