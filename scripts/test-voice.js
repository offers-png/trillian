/**
 * TRILLIAN — Voice Test Script
 * Run: node scripts/test-voice.js
 * Tests your ElevenLabs API key and Voice ID are working
 */
require('dotenv').config();
const { speak } = require('../core/tts');

async function testVoice() {
  console.log('\n🎙  TRILLIAN VOICE TEST');
  console.log('─────────────────────');
  console.log(`API Key: ${process.env.ELEVENLABS_API_KEY ? '✓ Set (' + process.env.ELEVENLABS_API_KEY.slice(-4) + ')' : '✗ MISSING'}`);
  console.log(`Voice ID: ${process.env.ELEVENLABS_VOICE_ID ? '✓ Set (' + process.env.ELEVENLABS_VOICE_ID + ')' : '✗ MISSING'}`);
  console.log(`Model: ${process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2 (default)'}`);
  console.log('');

  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    console.error('❌ Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in your .env file');
    console.error('');
    console.error('To get them:');
    console.error('  1. Go to elevenlabs.io → create account');
    console.error('  2. Voices → search "British" → pick a voice');
    console.error('  3. Copy the Voice ID from the voice card');
    console.error('  4. Profile → API Keys → create a key');
    process.exit(1);
  }

  console.log('Playing test audio...');
  console.log('');

  try {
    await speak("Trillian online. All systems operational. Ready when you are, Saleh.");
    console.log('✓ Voice test passed. Trillian is ready.');
  } catch (err) {
    console.error('❌ Voice test failed:', err.message);
    if (err.message.includes('401')) {
      console.error('   → Invalid API key. Check ELEVENLABS_API_KEY');
    } else if (err.message.includes('404')) {
      console.error('   → Voice ID not found. Check ELEVENLABS_VOICE_ID');
      console.error('   → Make sure you copied the ID from the Voices page, not the voice name');
    }
    process.exit(1);
  }
}

testVoice();
