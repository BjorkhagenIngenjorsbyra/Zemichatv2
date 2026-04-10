import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Don't throw at module load — that would crash the entire app before
// React mounts and produce a blank screen on iOS/Android. Instead log
// loudly and create a degraded client; main.tsx will surface the error
// to the user via the bootstrap fallback UI when API calls fail.
if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY at build time. ' +
      'The app will not be able to authenticate. Check Codemagic env vars.'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'invalid'
);
