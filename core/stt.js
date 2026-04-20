require('dotenv').config();
const { createClient } = require('@deepgram/sdk');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function transcribe(audioBuffer) {
  if (audioBuffer && audioBuffer._text) return audioBuffer._text;
  if (!audioBuffer || audioBuffer.length < 500) return '';

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  let wavBuffer = audioBuffer;
  if (audioBuffer.toString('ascii', 0, 4) !== 'RIFF') {
    wavBuffer = pcmToWav(audioBuffer, 16000, 1, 16);
  }

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    wavBuffer,
    { model: 'nova-2', smart_format: true, punctuate: true, language: 'en-US' }
  );
  if (error) throw new Error(JSON.stringify(error));
  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}

async function recordAudio(durationMs = 6000) {
  const tmp = path.join(os.tmpdir(), `trillian_${Date.now()}.wav`);
  const sec = (durationMs / 1000).toFixed(1);

  const args = process.platform === 'win32'
    ? ['-t', 'waveaudio', '-d', '-r', '16000', '-c', '1', '-b', '16', '-e', 'signed-integer', tmp, 'trim', '0', sec]
    : process.platform === 'darwin'
    ? ['-t', 'coreaudio', '-d', '-r', '16000', '-c', '1', '-b', '16', '-e', 'signed-integer', tmp, 'trim', '0', sec]
    : ['-t', 'alsa', '-d', '-r', '16000', '-c', '1', '-b', '16', '-e', 'signed-integer', tmp, 'trim', '0', sec];

  return new Promise((resolve, reject) => {
    execFile('sox', args, (err) => {
      if (err || !fs.existsSync(tmp)) {
        try { fs.unlinkSync(tmp); } catch {}
        return reject(new Error(err?.message || 'SoX recording failed'));
      }
      const buf = fs.readFileSync(tmp);
      try { fs.unlinkSync(tmp); } catch {}
      resolve(buf);
    });
  });
}

function pcmToWav(pcm, sampleRate, channels, bitDepth) {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(channels * bitDepth / 8, 32);
  h.writeUInt16LE(bitDepth, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

module.exports = { transcribe, recordAudio };
