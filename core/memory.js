/**
 * TRILLIAN — Memory System
 * Stores and retrieves memories using Supabase + pgvector semantic search
 */
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate text embedding for semantic search
 */
async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

/**
 * Store a memory
 */
async function remember(content, category = 'general', importance = 5) {
  const embedding = await embed(content);
  const { error } = await sb.from('trillian_memory').insert({
    content,
    embedding,
    category,
    importance,
  });
  if (error) console.error('[MEMORY] Store error:', error.message);
}

/**
 * Retrieve relevant memories using semantic similarity
 * @param {string} query - The current context to search against
 * @param {number} limit - Max memories to return
 */
async function recall(query, limit = 5) {
  try {
    const queryEmbedding = await embed(query);
    const { data, error } = await sb.rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
    });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[MEMORY] Recall error:', err.message);
    return [];
  }
}

/**
 * Store a conversation turn
 */
async function storeConversation(messages, sessionId = null) {
  const sid = sessionId || `session_${Date.now()}`;
  const rows = messages.map(m => ({
    session_id: sid,
    role: m.role,
    content: m.content,
    tokens: Math.ceil(m.content.length / 4), // rough estimate
  }));
  const { error } = await sb.from('trillian_conversations').insert(rows);
  if (error) console.error('[MEMORY] Conversation store error:', error.message);

  // Auto-extract facts from assistant messages and store as memories
  for (const msg of messages) {
    if (msg.role === 'user' && msg.content.toLowerCase().startsWith('remember')) {
      await remember(msg.content.replace(/^remember\s*/i, ''), 'explicit', 9);
    }
  }
}

/**
 * Get recent conversation history
 */
async function getRecentConversations(limit = 10) {
  const { data, error } = await sb
    .from('trillian_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).reverse();
}

/**
 * Forget a specific memory by ID or content match
 */
async function forget(query) {
  // Try exact content match first
  const { data } = await sb
    .from('trillian_memory')
    .select('id, content')
    .ilike('content', `%${query}%`)
    .limit(5);

  if (data && data.length > 0) {
    const ids = data.map(d => d.id);
    await sb.from('trillian_memory').delete().in('id', ids);
    return `Forgotten ${data.length} memory entry${data.length > 1 ? 's' : ''}.`;
  }
  return 'No matching memories found.';
}

/**
 * Get a summary of all stored memories for "what do you know about me"
 */
async function memorySummary() {
  const { data } = await sb
    .from('trillian_memory')
    .select('content, category, importance, created_at')
    .order('importance', { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return 'I have no stored memories yet.';

  const byCategory = {};
  data.forEach(m => {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m.content);
  });

  return Object.entries(byCategory)
    .map(([cat, items]) => `${cat}: ${items.slice(0, 3).join('; ')}`)
    .join('\n');
}

module.exports = { remember, recall, storeConversation, getRecentConversations, forget, memorySummary };
