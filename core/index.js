require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const { startWakeWordListener } = require('./wake-word');
const { transcribe, recordAudio } = require('./stt');
const { speak, speakStream } = require('./tts');
const { recall, storeConversation } = require('./memory');
const { getTools, executeTool } = require('./tools');
const { morningBriefing } = require('./briefing');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
let conversationHistory = [];
const MAX_HISTORY = 16;
let isProcessing = false;

// Boot HUD server
let hud = { updateState: () => {}, addTranscript: () => {} };
try {
  hud = require('../hud/server');
  console.log('[TRILLIAN] HUD server starting...');
} catch(e) {
  console.log('[TRILLIAN] HUD not available: ' + e.message);
}

async function handleVoiceInput(audioBuffer) {
  if (isProcessing) return;
  isProcessing = true;
  hud.updateState({ processing: true, listening: false });

  try {
    if (!audioBuffer) {
      audioBuffer = await recordAudio(6000);
    }
    const userText = await transcribe(audioBuffer);
    if (!userText || userText.trim().length < 2) { isProcessing = false; hud.updateState({ processing: false, listening: true }); return; }

    console.log('[USER] ' + userText);
    hud.addTranscript('user', userText);

    // actions.js shortcut layer
    try {
      const { handleAction } = require('./actions');
      const actionResult = await handleAction(userText);
      if (actionResult) {
        console.log('[TRILLIAN ACTION] ' + actionResult);
        hud.addTranscript('trillian', actionResult);
        await speakStream(actionResult);
        isProcessing = false;
        hud.updateState({ processing: false, listening: true });
        return;
      }
    } catch(e) {}

    const memories = await recall(userText, 5).catch(() => []);
    const memCtx = memories.length
      ? '\nContext:\n' + memories.map(m => '- ' + m.content).join('\n') : '';

    const systemPrompt = buildSystemPrompt(memCtx);
    conversationHistory.push({ role: 'user', content: userText });
    if (conversationHistory.length > MAX_HISTORY)
      conversationHistory = conversationHistory.slice(-MAX_HISTORY);

    console.log('[TRILLIAN] Thinking...');
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      system: systemPrompt, tools: getTools(), messages: conversationHistory,
    });

    let finalText = response.stop_reason === 'tool_use'
      ? await handleToolCalls(response, systemPrompt)
      : response.content.filter(b => b.type === 'text').map(b => b.text).join(' ');

    if (!finalText) { isProcessing = false; hud.updateState({ processing: false, listening: true }); return; }

    conversationHistory.push({ role: 'assistant', content: finalText });
    console.log('[TRILLIAN] ' + finalText);
    hud.addTranscript('trillian', finalText);
    await speakStream(finalText);
    storeConversation([{ role: 'user', content: userText }, { role: 'assistant', content: finalText }]).catch(() => {});

  } catch(err) {
    console.error('[TRILLIAN ERROR] ' + err.message);
    await speak('I hit an error. Please try again.').catch(() => {});
  } finally {
    isProcessing = false;
    hud.updateState({ processing: false, listening: true });
  }
}

async function handleToolCalls(response, systemPrompt) {
  const messages = conversationHistory.slice();
  let cur = response;
  while (cur.stop_reason === 'tool_use') {
    const uses = cur.content.filter(b => b.type === 'tool_use');
    const results = [];
    for (const t of uses) {
      console.log('[TOOL] ' + t.name);
      try {
        const out = await executeTool(t.name, t.input);
        if (t.name === 'get_pipeline_status' || t.name === 'get_pipeline_status') {
          if (out.total) hud.updateState({ workflows: { total: out.total, active: out.active || 0, inactive: out.inactive || 0 } });
        }
        results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(out) });
      } catch(e) {
        results.push({ type: 'tool_result', tool_use_id: t.id, content: 'Error: ' + e.message, is_error: true });
      }
    }
    messages.push({ role: 'assistant', content: cur.content });
    messages.push({ role: 'user', content: results });
    cur = await claude.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      system: systemPrompt, tools: getTools(), messages,
    });
  }
  return cur.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
}

function buildSystemPrompt(memoryContext) {
  const now = new Date().toLocaleString('en-US', {
    timeZone: process.env.BRIEFING_TIMEZONE || 'America/New_York',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  return 'You are Trillian, Saleh\'s personal AI operating system. British female voice — precise, warm, dry wit. J.A.R.V.I.S. from Iron Man.\n\nTime: ' + now + '\n\nAbout Saleh:\n- DealDily (dealdily.com) SaaS automation\n- 90+ n8n workflows on saleh852.app.n8n.cloud\n- Uncle Sam Market, Syracuse NY\n- offers@dealdily.com\n- Values speed above all\n' + memoryContext + '\n\nStyle: Natural voice output. Under 3 sentences. Never read raw JSON. Confirm before irreversible actions. Tools: calendar, email, Stripe, n8n, filesystem, web search.';
}

function scheduleMorningBriefing() {
  const time = process.env.MORNING_BRIEFING_TIME || '08:00';
  const [hour, minute] = time.split(':');
  const tz = process.env.BRIEFING_TIMEZONE || 'America/New_York';
  cron.schedule(minute + ' ' + hour + ' * * *', async () => {
    const briefing = await morningBriefing();
    hud.addTranscript('trillian', briefing);
    await speakStream(briefing);
    storeConversation([{ role: 'assistant', content: briefing }]).catch(() => {});
  }, { timezone: tz });
  console.log('[TRILLIAN] Morning briefing scheduled for ' + time);
}

async function boot() {
  console.log('\n  +-+-+-+-+-+-+-+-+');
  console.log('  |T|R|I|L|L|I|A|N|');
  console.log('  +-+-+-+-+-+-+-+-+');
  console.log('  Voice-First AI OS -- v0.2.0\n');

  const required = ['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) { console.error('[ERROR] Missing: ' + missing.join(', ')); process.exit(1); }

  await speak('Trillian online. Good to be back, Saleh.');
  hud.updateState({ status: 'online', listening: true, startedAt: new Date().toISOString() });
  hud.addTranscript('trillian', 'Trillian online. Good to be back, Saleh.');

  console.log('[TRILLIAN] Online. Open http://localhost:4000 for the HUD.');
  scheduleMorningBriefing();
  await startWakeWordListener(handleVoiceInput);
}

// API ROUTE
app.post('/api/command', async (req, res) => {
  const { command } = req.body;

  console.log('[API COMMAND]:', command);

  try {
    hud.addTranscript('user', command);
    hud.addTranscript('trillian', 'Processing: ' + command);

    res.json({
      status: 'ok',
      reply: 'Received: ' + command
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// START API SERVER
app.listen(4001, () => {
  console.log('[API] Running on http://localhost:4001');
});

boot().catch(err => { console.error('[FATAL]', err); process.exit(1); });
