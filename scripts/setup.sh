#!/bin/bash
# TRILLIAN — Setup Script
# Run: bash scripts/setup.sh

set -e

echo ""
echo "  ████████ ██████  ██ ██      ██      ██  █████  ███    ██ "
echo "     ██    ██   ██ ██ ██      ██      ██ ██   ██ ████   ██ "
echo "     ██    ██████  ██ ██      ██      ██ ███████ ██ ██  ██ "
echo "     ██    ██   ██ ██ ██      ██      ██ ██   ██ ██  ██ ██ "
echo "     ██    ██   ██ ██ ███████ ███████ ██ ██   ██ ██   ████ "
echo ""
echo "  Setup Script v0.1.0"
echo "  ─────────────────────────────────────────"
echo ""

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Current: $(node --version)"
  echo "   Install from: https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Set up .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
  echo ""
  echo "⚠️  Fill in your API keys in .env before running Trillian"
  echo ""
  echo "Required keys:"
  echo "  ANTHROPIC_API_KEY      → console.anthropic.com"
  echo "  ELEVENLABS_API_KEY     → elevenlabs.io/profile"
  echo "  ELEVENLABS_VOICE_ID    → elevenlabs.io/voices (search British)"
  echo "  SUPABASE_URL           → your Supabase project URL"
  echo "  SUPABASE_SERVICE_ROLE_KEY → Supabase Settings → API"
  echo "  DEEPGRAM_API_KEY       → deepgram.com/console"
else
  echo "✓ .env already exists"
fi

# Check audio dependencies
echo ""
echo "Checking audio system..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "✓ macOS: using afplay for audio output"
  # Check for mic access (will prompt)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if command -v mpg123 &> /dev/null; then
    echo "✓ Linux: mpg123 found"
  else
    echo "⚠️  Linux: mpg123 not found. Installing..."
    sudo apt-get install -y mpg123 2>/dev/null || echo "  Run: sudo apt-get install mpg123"
  fi
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Setup complete! Next steps:"
echo ""
echo "  1. Fill in .env with your API keys"
echo "  2. Run Supabase migration:"
echo "     → Paste supabase/migrations/001_trillian.sql into Supabase SQL Editor"
echo "  3. Test your voice:"
echo "     → node scripts/test-voice.js"
echo "  4. Start Trillian:"
echo "     → npm run dev"
echo "═══════════════════════════════════════════"
echo ""
