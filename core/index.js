/**
 * TRILLIAN — Core Brain
 * Entry point: wake word → STT → Claude → TTS → memory
 */
require('dotenv').config();
const { startWakeWordListener } = require('./wake-word');
const { transcribe } = require('./stt');
const { speak, speakStream } = require('./tts');
const { remember, recall, storeConversation } = require('./memory');
const { getTools, executeTool } = require('./tools');
const { morningBriefing } = require('./briefing');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Conversation history (rolling window)
let conversationHistory = [];
const MAX_HISTORY = 16;

// Session state
let isListening = false;
let isProcessing = false;

/**
 * Main conversation loop
 * Called every time Trillian hears the wake word
 */
async function handleVoiceInput(audioBuffer) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Speech → Text
    console.log('[TRILLIAN] Transcribing...');
    const userText = await transcribe(audioBuffer);
    if (!userText || userText.trim().length < 2) {
      isProcessing = false;
      return;
    }
    console.log(`[USER] ${userText}`);

    // 2. Retrieve relevant memories
    const memories = await recall(userText, 5);
    const memoryContext = memories.length > 0
      ? `\nRelevant context from memory:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(memoryContext);

    // 4. Add to conversation history
    conversationHistory.push({ role: 'user', content: userText });
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY);
    }

    // 5. Call Claude with tools
    console.log('[TRILLIAN] Thinking...');
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: getTools(),
      messages: conversationHistory,
    });

    // 6. Handle tool calls
    let finalText = '';
    if (response.stop_reason === 'tool_use') {
      finalText = await handleToolCalls(response, systemPrompt);
    } else {
      finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join(' ');
    }

    if (!finalText) {
      isProcessing = false;
      return;
    }

    // 7. Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: finalText });

    // 8. Speak the response
    console.log(`[TRILLIAN] ${finalText}`);
    await speakStream(finalText);

    // 9. Store conversation in memory
    await storeConversation([
      { role: 'user', content: userText },
      { role: 'assistant', content: finalText }
    ]);

  } catch (err) {
    console.error('[TRILLIAN ERROR]', err.message);
    await speak("I encountered an error. Please try again.");
  } finally {
    isProcessing = false;
  }
}

/**
 * Handle multi-turn tool use
 */
async function handleToolCalls(response, systemPrompt) {
  const messages = [...conversationHistory];
  let currentResponse = response;

  while (currentResponse.stop_reason === 'tool_use') {
    const toolUseBlocks = currentResponse.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`[TOOL] Calling ${toolUse.name}...`);
      try {
        const result = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: ${err.message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'assistant', content: currentResponse.content });
    messages.push({ role: 'user', content: toolResults });

    currentResponse = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: getTools(),
      messages,
    });
  }

  return currentResponse.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join(' ');
}

/**
 * System prompt with memory context injected
 */
function buildSystemPrompt(memoryContext = '') {
  const now = new Date().toLocaleString('en-US', {
    timeZone: process.env.BRIEFING_TIMEZONE || 'America/New_York',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return `You are Trillian, Saleh's personal AI operating system. You have a British female voice and personality — precise, warm, intelligent, with a slight dry wit. Think J.A.R.V.I.S. from Iron Man.

Current date and time: ${now}

About Saleh:
- Runs DealDily (dealdily.com) — a SaaS automation business
- Has 32+ n8n workflows on saleh852.app.n8n.cloud
- Runs Uncle Sam Market, a convenience store in Syracuse, NY
- Email: offers@dealdily.com
- Always busy — values speed and directness above all
${memoryContext}

Your communication style:
- Speak in complete sentences, naturally — this is voice output
- Be concise. Under 3 sentences for simple answers
- Numbers spoken naturally ("twelve hundred" not "1200")
- Never read raw JSON or data — always interpret and summarize
- Confirm before irreversible actions (send email, delete files)
- Use light British expressions naturally but don't overdo it
- If you don't know something, say so directly

You have access to tools for: calendar, email, Stripe revenue, n8n workflows, filesystem, and web search. Use them proactively when relevant.`;
}

/**
 * Scheduled morning briefing
 */
function scheduleMorningBriefing() {
  const time = process.env.MORNING_BRIEFING_TIME || '08:00';
  const [hour, minute] = time.split(':');
  const tz = process.env.BRIEFING_TIMEZONE || 'America/New_York';

  cron.schedule(`${minute} ${hour} * * *`, async () => {
    console.log('[TRILLIAN] Delivering morning briefing...');
    const briefing = await morningBriefing();
    await speakStream(briefing);
    await storeConversation([{ role: 'assistant', content: briefing }]);
  }, { timezone: tz });

  console.log(`[TRILLIAN] Morning briefing scheduled for ${time} ${tz}`);
}

/**
 * Boot sequence
 */
async function boot() {
  console.log('');
  console.log('  ████████ ██████  ██ ██      ██      ██  █████  ███    ██ ');
  console.log('     ██    ██   ██ ██ ██      ██      ██ ██   ██ ████   ██ ');
  console.log('     ██    ██████  ██ ██      ██      ██ ███████ ██ ██  ██ ');
  console.log('     ██    ██   ██ ██ ██      ██      ██ ██   ██ ██  ██ ██ ');
  console.log('     ██    ██   ██ ██ ███████ ███████ ██ ██   ██ ██   ████ ');
  console.log('');
  console.log('  Voice-First AI Operating System — v0.1.0');
  console.log('  ─────────────────────────────────────────');
  console.log('');

  // Validate required env vars
  const required = ['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('[ERROR] Missing required environment variables:');
    missing.forEach(k => console.error(`  - ${k}`));
    console.error('\nCopy .env.example to .env and fill in your keys.');
    process.exit(1);
  }

  // Boot greeting
  await speak("Trillian online. Good to be back, Saleh.");
  console.log('[TRILLIAN] Online. Listening for wake word...');
  console.log(`[TRILLIAN] Say "${process.env.WAKE_WORD || 'hey trillian'}" to activate.`);

  // Schedule morning briefing
  scheduleMorningBriefing();

  // Start wake word listener
  await startWakeWordListener(handleVoiceInput);
}

boot().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
