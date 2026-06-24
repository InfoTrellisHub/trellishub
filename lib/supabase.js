const { createClient } = require('@supabase/supabase-js');

// --- Server-side client (service role, bypasses RLS) ---
// Never import this into anything that ships to the browser.
console.log('[supabase] SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'MISSING');
console.log('[supabase] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'MISSING');

let _serverClient = null;

function getSupabase() {
  if (_serverClient) return _serverClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  }
  _serverClient = createClient(url, key, { auth: { persistSession: false } });
  return _serverClient;
}

// --- Public anon client (RLS-gated, safe for auth flows) ---
console.log('[supabase] NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Loaded' : 'MISSING');
console.log('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Loaded' : 'MISSING');

const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

module.exports = { getSupabase, supabaseAnon };
