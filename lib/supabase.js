// Server-only Supabase client using the service-role key. Never import this from
// anything that ships to the browser — RLS is enabled with no anon policies, so this
// key is the only way to read/write, and it must stay server-side.
const { createClient } = require('@supabase/supabase-js');

let client = null;

function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Public anon client — safe for auth flows (supabase.auth.*) and RLS-gated reads.
// Uses NEXT_PUBLIC_ env vars so the same names work if this project ever moves to Next.js.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[supabase] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'MISSING');
console.log('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Loaded' : 'MISSING');

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

module.exports = { getSupabase, supabase };
