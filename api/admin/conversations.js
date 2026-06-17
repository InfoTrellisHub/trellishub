const { getSupabase } = require('../../lib/supabase');
const { getAdminSession } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!getAdminSession(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const supabase = getSupabase();

    if (req.query.conversation_id) {
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', req.query.conversation_id)
        .single();
      if (convError) throw convError;

      const { data: messages, error: msgError } = await supabase
        .from('chat_messages')
        .select('id, sender, node_id, message_text, selected_option_index, is_escalation, created_at')
        .eq('conversation_id', req.query.conversation_id)
        .order('created_at', { ascending: true });
      if (msgError) throw msgError;

      res.status(200).json({ conversation, messages: messages || [] });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    let query = supabase
      .from('chat_conversations')
      .select('id, started_at, captured_name, captured_email, captured_phone, escalated, escalation_count, last_node_id', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.escalated === 'true') query = query.eq('escalated', true);

    const { data, error, count } = await query;
    if (error) throw error;
    res.status(200).json({ conversations: data || [], total: count || 0 });
  } catch (e) {
    console.error('admin/conversations.js error:', e);
    res.status(500).json({ error: 'Could not load conversations' });
  }
};
