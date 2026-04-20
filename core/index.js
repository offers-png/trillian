/**
 * TRILLIAN - Core Brain
 */
require('dotenv').config();
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

async function handleVoiceInput(audioBuffer) {
  if (isProcessing) return;
  isProcessing = true;
  try {
    if (!audioBuffer) {
      console.log('[TRILLIAN] Recording...');
      audioBuffer = await recordAudio(6000);
    }
    console.log('[TRILLIAN] Transcribing...');
    const userText = await transcribe(audioBuffer);
    if (!userText || userText.trim().length < 2) { isProcessing = false; return; }
    console.log('[USER] ' + userText);

    try {
      const { handleAction } = require('./actions');
      const actionResult = await handleAction(userText);
      if (actionResult) {
        console.log('[TRILLIAN ACTION] ' + actionResult);
        await speakStream(actionResult);
        isProcessing = false;
        return;
      }
    } catch (e) {}

    const memories = await recall(userText, 5).catch(() => []);
    const memCtx = memories.length
      ? '\nContext from memory:\n' + memories.map(m => '- ' + m.content).join('\n')
      : '';

    const systemPrompt = buildSystemPrompt(memCtx);
    conversationHistory.push({ role: 'user', content: userText });
    if (conversationHistory.length > MAX_HISTORY)
      conversationHistory = conversationHistory.slice(-MAX_HISTORY);

    console.log('[TRILLIAN] Thinking...');
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: getTools(),
      messages: conversationHistory,
    });

    let finalText = response.stop_reason === 'tool_use'
      ? await handleToolCalls(response, systemPrompt)
      : response.content.filter(b => b.type === 'text').map(b => b.text).join(' ');

    if (!finalText) { isProcessing = false; return; }
    conversationHistory.push({ role: 'assistant', content: finalText });
    console.log('[TRILLIAN] ' + finalText);
    await speakStream(finalText);
    storeConversation([
      { role: 'user', content: userText },
      { role: 'assistant', content: finalText }
    ]).catch(() => {});
  } catch (err) {
    console.error('[TRILLIAN ERROR] ' + err.message);
    await speak('I hit an error. Please try again.').catch(() => {});
  } finally {
    isProcessing = false;
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
        results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(out) });
      } catch (e) {
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
  return 'You are Trillian, Saleh\'s personal AI operating system. British female voice and personality — precise, warm, intelligent, slight dry wit. Think J.A.R.V.I.S. from Iron Man.\n\nCurrent time: ' + now + '\n\nAbout Saleh:\n- Runs DealDily (dealdily.com) - SaaS automation business\n- 32+ n8n workflows on saleh852.app.n8n.cloud\n- Uncle Sam Market convenience store, Syracuse NY\n- Email: offers@dealdily.com\n- Values speed and directness\n' + memoryContext + '\n\nCommunication style:\n- Natural complete sentences (voice output)\n- Under 3 sentences for simple answers\n- Numbers spoken naturally\n- Never read raw JSON - interpret and summarize\n- Confirm before irreversible actions\n- You have access to tools for: calendar, email, Stripe, n8n workflows, filesystem, web search.';
}

function scheduleMorningBriefing() {
  const time = process.env.MORNING_BRIEFING_TIME || '08:00';
  const [hour, minute] = time.split(':');
  const tz = process.env.BRIEFING_TIMEZONE || 'America/New_York';
  cron.schedule(minute + ' ' + hour + ' * * *', async () => {
    const briefing = await morningBriefing();
    await speakStream(briefing);
    storeConversation([{ role: 'assistant', content: briefing }]).catch(() => {});
  }, { timezone: tz });
  console.log('[TRILLIAN] Morning briefing scheduled for ' + time + ' ' + tz);
}

async function boot() {
  console.log('');
  console.log('  +-+-+-+-+-+-+-+-+');
  console.log('  |T|R|I|L|L|I|A|N|');
  console.log('  +-+-+-+-+-+-+-+-+');
  console.log('  Voice-First AI Operating System -- v0.1.0');
  console.log('');

  const required = ['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('[ERROR] Missing env vars: ' + missing.join(', '));
    process.exit(1);
  }

  await speak('Trillian online. Good to be back, Saleh.');
  console.log('[TRILLIAN] Online. Listening for wake word...');
  console.log('[TRILLIAN] Say "' + (process.env.WAKE_WORD || 'hey trillian') + '" to activate.');
  scheduleMorningBriefing();
  await startWakeWordListener(handleVoiceInput);
}

boot().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
