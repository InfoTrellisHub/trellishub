// Exposes non-secret public config to the frontend.
// Checks both NEXT_PUBLIC_ prefixed and unprefixed env var names so either convention works.

function validUrl(val) {
  return typeof val === 'string' && (val.startsWith('https://') || val.startsWith('http://'));
}

const candidates = [
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
];
const supabaseUrl = candidates.find(validUrl) || null;

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;

console.log('[auth/config] SUPABASE_URL candidates:', candidates.map(v => v ? v.slice(0, 30) : 'MISSING'));
console.log('[auth/config] resolved supabaseUrl:', supabaseUrl ? supabaseUrl.slice(0, 40) : 'NONE');
console.log('[auth/config] SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Loaded' : 'MISSING');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({});
    return;
  }
  res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
