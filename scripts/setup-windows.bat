@echo off
echo Creating .env file for Trillian...
echo NOTE: Fill in the blank values after running this script

(
echo ELEVENLABS_API_KEY=sk_4f8bbe4b01a57b9eb1c2a437d333a01333f4051f9aef66c5
echo ELEVENLABS_VOICE_ID=zNsotODqUhvbJ5wMG7Ei
echo ELEVENLABS_MODEL=eleven_turbo_v2
echo ANTHROPIC_API_KEY=
echo SUPABASE_URL=https://wzcuzyouymauokijaqjk.supabase.co
echo SUPABASE_SERVICE_ROLE_KEY=
echo DEEPGRAM_API_KEY=
echo OPENAI_API_KEY=
echo STRIPE_SECRET_KEY=
echo N8N_API_KEY=
echo N8N_URL=https://saleh852.app.n8n.cloud
echo TWILIO_SID=
echo TWILIO_AUTH_TOKEN=
echo TWILIO_FROM=
echo TRILLIAN_ROOT_DIR=C:\Users\saleh\Documents\Trillian
echo WAKE_WORD=hey trillian
echo MORNING_BRIEFING_TIME=08:00
echo BRIEFING_TIMEZONE=America/New_York
echo PORT=4000
echo NODE_ENV=development
) > .env

echo.
echo .env created! ElevenLabs keys are pre-filled.
echo.
echo Running voice test...
node scripts/test-voice.js
