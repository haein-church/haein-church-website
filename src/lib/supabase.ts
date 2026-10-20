import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Shared church computers retain the login only in the current browser tab.
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: typeof window !== 'undefined',
  },
});
