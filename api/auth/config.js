// Exposes non-secret public config to the frontend.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({});
    return;
  }
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
};
