require('dotenv').config();
const https = require('https');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2';

async function speakStream(text) {
  if (!text || !API_KEY || !VOICE_ID) {
    console.warn('[TTS] Missing config');
    return;
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }
    });
    const options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/' + VOICE_ID + '/stream',
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
        let err = '';
        res.on('data', d => err += d);
        res.on('end', () => reject(new Error('ElevenLabs ' + res.statusCode + ': ' + err)));
        return;
      }
      const tmp = path.join(os.tmpdir(), 'trillian_' + Date.now() + '.mp3');
      const ws = fs.createWriteStream(tmp);
      res.pipe(ws);
      ws.on('finish', () => {
        playAudio(tmp).then(() => {
          try { fs.unlinkSync(tmp); } catch(e) {}
          resolve();
        }).catch(e => {
          try { fs.unlinkSync(tmp); } catch(e) {}
          reject(e);
        });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function speak(text) {
  return speakStream(text);
}

function playAudio(filePath) {
  return new Promise((resolve, reject) => {
    let cmd, args;
    if (process.platform === 'win32') {
      // Use PowerShell with Windows Media Player COM object - works on all Windows
      cmd = 'powershell';
      args = [
        '-NoProfile', '-NonInteractive', '-Command',
        'Add-Type -AssemblyName presentationCore; ' +
        '$mp = New-Object System.Windows.Media.MediaPlayer; ' +
        '$mp.Open([uri]"' + filePath.replace(/\\/g, '/') + '"); ' +
        'Start-Sleep -Milliseconds 500; ' +
        '$mp.Play(); ' +
        'Start-Sleep -Seconds ([math]::Ceiling($mp.NaturalDuration.TimeSpan.TotalSeconds) + 1); ' +
        '$mp.Close()'
      ];
    } else if (process.platform === 'darwin') {
      cmd = 'afplay';
      args = [filePath];
    } else {
      cmd = 'mpg123';
      args = ['-q', filePath];
    }
    const proc = spawn(cmd, args);
    proc.on('close', code => resolve()); // resolve regardless — audio may play fine even with non-zero exit
    proc.on('error', err => {
      console.warn('[TTS] Audio player error: ' + err.message);
      resolve(); // don't crash Trillian if audio fails
    });
  });
}

async function playChime() {
  try {
    if (process.platform === 'win32') {
      execSync('powershell -NoProfile -Command "[console]::beep(880,200)"', { timeout: 1000 });
    } else if (process.platform === 'darwin') {
      execSync('afplay /System/Library/Sounds/Tink.aiff');
    }
  } catch(e) {}
}

module.exports = { speak, speakStream, playChime };
