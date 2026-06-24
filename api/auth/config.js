// Exposes non-secret public config to the frontend.
// Checks both NEXT_PUBLIC_ prefixed and unprefixed env var names so either convention works.

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;

console.log('[auth/config] SUPABASE_URL:', supabaseUrl ? 'Loaded' : 'MISSING');
console.log('[auth/config] SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Loaded' : 'MISSING');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({});
    return;
  }
  res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
