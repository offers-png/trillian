# TRILLIAN
### Voice-First AI Operating System

> *"Sometimes you gotta run before you can walk." — Tony Stark*

Trillian is a personal AI operating system with a British female voice, persistent memory, and full access to your calendar, email, Stripe, n8n workflows, and local filesystem. Think J.A.R.V.I.S. from Iron Man.

---

## Architecture

```
Hey Trillian... → [Wake Word] → [STT: Deepgram] → [Claude claude-sonnet-4-6]
                                                         ↓ (tool calls)
                                              Calendar / Gmail / Stripe / n8n / Files
                                                         ↓
                               [ElevenLabs TTS] → British voice response
                                                         ↓
                               [Supabase] ← memory stored with pgvector embeddings
                                                         ↓
                               [Electron HUD] ← real-time dashboard updates
```

---

## Repo Structure

```
trillian/
├── core/                    ← Node.js brain: STT → Claude → TTS pipeline
│   ├── index.js             ← Entry point, orchestrator
│   ├── wake-word.js         ← openWakeWord / Porcupine listener
│   ├── stt.js               ← Deepgram / Whisper speech-to-text
│   ├── tts.js               ← ElevenLabs text-to-speech (streaming)
│   ├── memory.js            ← Supabase memory: store, retrieve, forget
│   ├── tools.js             ← Claude tool definitions (MCP + custom)
│   └── briefing.js          ← Morning briefing generator
│
├── electron/                ← Desktop HUD app
│   ├── main.js              ← Electron main process
│   ├── preload.js           ← IPC bridge
│   └── src/
│       ├── App.jsx          ← Main HUD layout
│       ├── StatusRing.jsx   ← Arc reactor animation
│       ├── CalendarStrip.jsx
│       ├── EmailBadge.jsx
│       ├── RevenueTicker.jsx
│       └── PipelineHealth.jsx
│
├── mcp-servers/
│   ├── filesystem/          ← Sandboxed local file operations MCP server
│   │   └── index.js
│   └── stripe/              ← Stripe read-only MCP server
│       └── index.js
│
├── supabase/
│   ├── migrations/          ← All DB schema migrations
│   │   └── 001_trillian.sql
│   └── functions/
│       └── jarvis-chat/     ← Already deployed edge function
│
├── scripts/
│   ├── setup.sh             ← One-command dev setup
│   └── test-voice.js        ← Test ElevenLabs voice output
│
├── .env.example             ← All required env vars documented
├── package.json
└── TRILLIAN_PRD_v1.docx     ← Full product requirements
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/offers-png/trillian
cd trillian

# 2. Install
npm install

# 3. Set up env
cp .env.example .env
# Fill in your API keys (see .env.example for all required vars)

# 4. Run Supabase migrations
npm run db:migrate

# 5. Test your ElevenLabs voice
node scripts/test-voice.js

# 6. Start Trillian
npm run dev
```

---

## Environment Variables

See `.env.example` for the full list. Required to start:
- `ANTHROPIC_API_KEY`
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPGRAM_API_KEY`

---

## Build Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | 🔨 Building | Voice pipeline: wake word → STT → Claude → TTS |
| 2 | ⏳ Planned | Integrations: Calendar, Gmail, Stripe |
| 3 | ⏳ Planned | Memory system: pgvector semantic search |
| 4 | ⏳ Planned | Local OS: filesystem, clipboard, app control |
| 5 | ⏳ Planned | HUD polish + cloud deployment option |

---

## Owner
Saleh — DealDily / Saleh-2 Ecosystem  
Supabase project: `wzcuzyouymauokijaqjk`  
n8n: `saleh852.app.n8n.cloud`
