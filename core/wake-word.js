/**
 * TRILLIAN — Wake Word Listener
 * Uses Porcupine for offline wake word detection ("Hey Trillian")
 * Falls back to ENTER key if Porcupine not configured
 */
require('dotenv').config();
const readline = require('readline');
const { recordAudio } = require('./stt');
const { playChime } = require('./tts');

async function startWakeWordListener(onActivated) {
  const accessKey = process.env.PORCUPINE_ACCESS_KEY;

  if (accessKey) {
    return startPorcupineListener(accessKey, onActivated);
  } else {
    return startKeyboardListener(onActivated);
  }
}

async function startPorcupineListener(accessKey, onActivated) {
  try {
    const { Porcupine, BuiltinKeyword } = require('@picovoice/porcupine-node');
    const { PvRecorder } = require('@picovoice/pvrecorder-node');

    const porcupine = new Porcupine(accessKey, [BuiltinKeyword.JARVIS], [0.7]);
    const recorder = new PvRecorder(porcupine.frameLength, -1);

    console.log('[TRILLIAN] Wake word engine loaded. Say "JARVIS" to activate.');
    console.log('[TRILLIAN] (Or press ENTER for manual activation)');

    // Also keep keyboard fallback running in parallel
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', () => handleActivation(onActivated));

    recorder.start();
    while (true) {
      const frame = await recorder.read();
      const index = porcupine.process(frame);
      if (index >= 0) {
        console.log('[TRILLIAN] Wake word detected!');
        await handleActivation(onActivated);
      }
    }
  } catch(e) {
    console.log('[TRILLIAN] Porcupine load failed (' + e.message.split('\n')[0] + '), using keyboard mode');
    return startKeyboardListener(onActivated);
  }
}

async function startKeyboardListener(onActivated) {
  console.log('[TRILLIAN] Keyboard trigger mode loaded.');
  console.log('[TRILLIAN] Press ENTER to activate.');
  console.log('[TRILLIAN] To enable true voice wake word, add PORCUPINE_ACCESS_KEY to .env');
  console.log('[TRILLIAN] Get free key at: https://console.picovoice.ai/');

  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', () => handleActivation(onActivated));
}

let isHandling = false;
async function handleActivation(onActivated) {
  if (isHandling) return;
  isHandling = true;
  console.log('[TRILLIAN] Activated.');
  await playChime().catch(() => {});
  try {
    console.log('[TRILLIAN] Recording...');
    const audio = await recordAudio(6000);
    console.log('[TRILLIAN] Got ' + audio.length + ' bytes of audio.');
    await onActivated(audio);
  } catch(err) {
    console.log('[TRILLIAN] Mic error: ' + err.message);
    // Typed fallback
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl2.question('[TRILLIAN] Type instead: ', async (text) => {
      rl2.close();
      if (text.trim()) await onActivated({ _text: text.trim() });
    });
  } finally {
    isHandling = false;
  }
}

module.exports = { startWakeWordListener };
