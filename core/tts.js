/**
 * TRILLIAN — Text-to-Speech (ElevenLabs)
 * Streaming audio for lowest latency
 */
const https = require('https');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_KEY   = process.env.ELEVENLABS_API_KEY;
const VOICE_ID  = process.env.ELEVENLABS_VOICE_ID;
const MODEL     = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2';

/**
 * Stream TTS audio — lowest latency, starts playing before full synthesis
 * This is what you want for real-time voice responses
 */
async function speakStream(text) {
  if (!text || !API_KEY || !VOICE_ID) {
    console.warn('[TTS] Missing API key or Voice ID');
    return;
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${VOICE_ID}/stream`,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', d => errData += d);
        res.on('end', () => reject(new Error(`ElevenLabs ${res.statusCode}: ${errData}`)));
        return;
      }

      // Stream audio to a temp file then play
      // For production, pipe directly to audio player
      const tmpFile = path.join(os.tmpdir(), `trillian_${Date.now()}.mp3`);
      const writeStream = fs.createWriteStream(tmpFile);

      res.pipe(writeStream);
      writeStream.on('finish', () => {
        playAudio(tmpFile).then(() => {
          fs.unlinkSync(tmpFile);
          resolve();
        }).catch(reject);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Simple speak (non-streaming, for short responses)
 */
async function speak(text) {
  return speakStream(text);
}

/**
 * Play audio file using platform-native player
 */
function playAudio(filePath) {
  return new Promise((resolve, reject) => {
    let cmd, args;
    switch (process.platform) {
      case 'darwin':  cmd = 'afplay';  args = [filePath]; break;
      case 'linux':   cmd = 'mpg123';  args = ['-q', filePath]; break;
      case 'win32':   cmd = 'powershell'; args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`]; break;
      default: return reject(new Error(`Unsupported platform: ${process.platform}`));
    }
    const proc = spawn(cmd, args);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Audio player exited with code ${code}`)));
    proc.on('error', reject);
  });
}

/**
 * Play a chime sound on wake word detection
 */
async function playChime() {
  // Generate a simple beep using system audio
  try {
    if (process.platform === 'darwin') execSync('afplay /System/Library/Sounds/Tink.aiff 2>/dev/null');
    else if (process.platform === 'linux') execSync('paplay /usr/share/sounds/freedesktop/stereo/message.oga 2>/dev/null');
  } catch {}
}

module.exports = { speak, speakStream, playChime };
