/**
 * TRILLIAN — Wake Word Listener
 * Windows: keyboard trigger (press ENTER)
 * Future: openWakeWord / Porcupine for real wake word
 */
const readline = require('readline');
const { recordAudio } = require('./stt');
const { playChime } = require('./tts');

/**
 * Start listening for wake word / keyboard trigger
 * @param {Function} onActivated - called with audio buffer when triggered
 */
async function startWakeWordListener(onActivated) {
  // Keyboard trigger mode for Windows (and fallback on all platforms)
  console.log('[TRILLIAN] Keyboard trigger mode loaded.');
  console.log('[TRILLIAN] Press ENTER to simulate wake word.');

  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', async () => {
    console.log('[TRILLIAN] Activated.');
    await playChime();

    try {
      console.log('[TRILLIAN] Recording...');
      const audio = await recordAudio(6000);
      console.log(`[TRILLIAN] Got ${audio.length} bytes of audio.`);
      await onActivated(audio);
    } catch (err) {
      // If recording fails, fall back to typed input
      console.log(`[TRILLIAN RECORD ERROR] ${err.message}`);
      console.log('[TRILLIAN] Mic unavailable. Type your command instead:');
      
      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl2.question('> ', async (text) => {
        rl2.close();
        if (text.trim()) {
          await onActivated({ _text: text.trim() }); // pass text directly
        }
      });
    }
  });
}

module.exports = { startWakeWordListener };
