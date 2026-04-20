require('dotenv').config();
const https = require('https');
const { spawn, execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2';

async function speakStream(text) {
  if (!text || !API_KEY || !VOICE_ID) { console.warn('[TTS] Missing config'); return; }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text, model_id: MODEL,
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
        res.on('end', () => { console.warn('[TTS] ElevenLabs error ' + res.statusCode); resolve(); });
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
          console.warn('[TTS] Playback warning: ' + e.message);
          try { fs.unlinkSync(tmp); } catch(e) {}
          resolve(); // never crash
        });
      });
    });
    req.on('error', e => { console.warn('[TTS] Request error: ' + e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

async function speak(text) { return speakStream(text); }

function playAudio(filePath) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      const cmd = process.platform === 'darwin' ? 'afplay' : 'mpg123';
      const args = process.platform === 'darwin' ? [filePath] : ['-q', filePath];
      const proc = spawn(cmd, args);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
      return;
    }

    // Windows: try VLC first (fastest), then Windows Media Player, then SoundPlayer
    // Check if VLC exists
    const vlcPaths = [
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
    ];
    const vlc = vlcPaths.find(p => fs.existsSync(p));

    if (vlc) {
      const proc = spawn(vlc, ['--intf', 'dummy', '--play-and-exit', filePath]);
      proc.on('close', () => resolve());
      proc.on('error', () => playWithPowerShell(filePath, resolve));
      return;
    }

    // PowerShell with SoundPlayer (fast, but only plays WAV)
    // So we use Windows Media Player via command line
    const wmplayer = 'C:\\Program Files\\Windows Media Player\\wmplayer.exe';
    if (fs.existsSync(wmplayer)) {
      const proc = spawn(wmplayer, ['/play', '/close', filePath]);
      // WMP doesn't block, so estimate duration from file size
      const fileSizeKb = fs.statSync(filePath).size / 1024;
      const estimatedSecs = Math.max(2, Math.ceil(fileSizeKb / 16)); // ~16KB/sec for mp3
      setTimeout(() => {
        try { proc.kill(); } catch(e) {}
        resolve();
      }, estimatedSecs * 1000 + 500);
      return;
    }

    // Final fallback: PowerShell MediaPlayer (slower but reliable)
    playWithPowerShell(filePath, resolve);
  });
}

function playWithPowerShell(filePath, resolve) {
  const psCmd = [
    'Add-Type -AssemblyName presentationCore;',
    '$mp = New-Object System.Windows.Media.MediaPlayer;',
    '$mp.Open([uri]"file:///' + filePath.replace(/\\/g, '/') + '");',
    'Start-Sleep -Milliseconds 800;',
    '$mp.Play();',
    '$dur = 0;',
    'while($mp.NaturalDuration.HasTimeSpan -eq $false -and $dur -lt 30){ Start-Sleep -Milliseconds 100; $dur++ };',
    '$secs = [math]::Ceiling($mp.NaturalDuration.TimeSpan.TotalSeconds) + 1;',
    'Start-Sleep -Seconds $secs;',
    '$mp.Close()'
  ].join(' ');
  const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCmd]);
  proc.on('close', () => resolve());
  proc.on('error', () => { console.warn('[TTS] PowerShell audio failed'); resolve(); });
}

async function playChime() {
  try {
    if (process.platform === 'win32') {
      spawnSync('powershell', ['-NoProfile', '-Command', '[console]::beep(880,150)'], { timeout: 500 });
    } else if (process.platform === 'darwin') {
      execSync('afplay /System/Library/Sounds/Tink.aiff');
    }
  } catch(e) {}
}

module.exports = { speak, speakStream, playChime };
