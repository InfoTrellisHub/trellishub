const { getSupabase } = require('../../lib/supabase');
const { clean } = require('../../lib/validate');
const { isRateLimited } = require('../../lib/rateLimit');

const CAPTURE_COLUMN_MAP = {
  name: 'captured_name',
  email: 'captured_email',
  phone: 'captured_phone',
  project_details: 'captured_project_details'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'chat-message', max: 120, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  const body = req.body || {};
  const conversationId = body.conversation_id;
  if (!conversationId || !body.sender || !body.message_text) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  try {
    const supabase = getSupabase();

    const { error: msgError } = await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      sender: body.sender,
      node_id: body.node_id || null,
      message_text: clean(body.message_text, 2000),
      selected_option_index: typeof body.selected_option_index === 'number' ? body.selected_option_index : null
    });
    if (msgError) throw msgError;

    const updates = { last_node_id: body.node_id || null };
    if (body.captured && typeof body.captured === 'object') {
      Object.entries(body.captured).forEach(([key, value]) => {
        const column = CAPTURE_COLUMN_MAP[key];
        if (column) updates[column] = clean(String(value), 300);
      });
    }

    const { error: convError } = await supabase.from('chat_conversations').update(updates).eq('id', conversationId);
    if (convError) throw convError;

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('chat/message.js error:', e);
    res.status(500).json({ success: false, error: 'Could not log message' });
  }
};
