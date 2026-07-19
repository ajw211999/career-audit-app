import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Next 14 patches global fetch with a persistent data cache that survives
  // deployments — a cached Supabase read means stale rows in every route that
  // selects (dashboard list, approve, sweep CAS reads). Database reads must
  // never be cached.
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}
