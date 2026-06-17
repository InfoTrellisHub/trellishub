const { getSupabase } = require('../../lib/supabase');
const { sendTeamNotification } = require('../../lib/mailer');
const { isRateLimited } = require('../../lib/rateLimit');

// Mirrors TRELLIS_CHATBOT_COPY.escalate in assets/js/chatbot/chatbot-data.js.
const ESCALATE_STANDBY_COPY =
  "Thanks for reaching out — one of our team will personally follow up with you ASAP. In the meantime, feel free to keep browsing or reach us directly at info.trellishub@gmail.com.";

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Intentionally NOT rate-limited the same way as other endpoints — escalation must
  // fire every single time "None of the above" is picked, even repeatedly in one
  // session, per explicit requirement. A generous ceiling still guards against abuse.
  if (isRateLimited(req, { key: 'chat-escalate', max: 50, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  const body = req.body || {};
  const conversationId = body.conversation_id;
  if (!conversationId) {
    res.status(400).json({ success: false, error: 'Missing conversation_id' });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: conversation, error: fetchError } = await supabase
      .from('chat_conversations')
      .select('escalation_count, captured_name, captured_email, captured_phone, captured_project_details, page_url')
      .eq('id', conversationId)
      .single();
    if (fetchError) throw fetchError;

    const newCount = (conversation.escalation_count || 0) + 1;

    await supabase
      .from('chat_conversations')
      .update({ escalated: true, escalation_count: newCount, last_node_id: body.node_id || null })
      .eq('id', conversationId);

    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      sender: 'bot',
      node_id: body.node_id || null,
      message_text: ESCALATE_STANDBY_COPY,
      is_escalation: true
    });

    const { data: transcript } = await supabase
      .from('chat_messages')
      .select('sender, message_text, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const transcriptText = (transcript || [])
      .map((m) => `${m.sender === 'bot' ? 'Bot' : 'Visitor'}: ${m.message_text}`)
      .join('\n');

    const contactLine = conversation.captured_name || conversation.captured_email
      ? `${conversation.captured_name || 'Unknown name'} <${conversation.captured_email || 'no email'}> ${conversation.captured_phone || ''}`.trim()
      : 'Anonymous visitor';

    await sendTeamNotification(
      `New chatbot escalation — ${conversation.captured_name || 'Anonymous visitor'}`,
      `Triggered at node: ${body.node_id || 'unknown'}\nThis is escalation #${newCount} for this conversation.\nContact: ${contactLine}\nProject details: ${conversation.captured_project_details || '—'}\nPage: ${conversation.page_url || '—'}\n\nFull transcript:\n${transcriptText}`
    );

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('chat/escalate.js error:', e);
    res.status(500).json({ success: false, error: 'Could not process escalation' });
  }
};
