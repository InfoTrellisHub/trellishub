// Exposes non-secret public config to the frontend.
// Checks both plain and NEXT_PUBLIC_ prefixed env var names so either convention works.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({});
    return;
  }
  res.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null,
  });
};
