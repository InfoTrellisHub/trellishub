const { getSupabase } = require('../../lib/supabase');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'chat-start', max: 20, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        page_url: (req.body && req.body.page_url) || null,
        user_agent: req.headers['user-agent'] || null,
        last_node_id: 'root'
      })
      .select('id')
      .single();

    if (error) throw error;
    res.status(200).json({ conversation_id: data.id, root_node_id: 'root' });
  } catch (e) {
    console.error('chat/start.js error:', e);
    res.status(500).json({ error: 'Could not start conversation' });
  }
};
