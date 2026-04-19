/**
 * TRILLIAN — Speech-to-Text
 * Deepgram Nova-2 (cloud) or Whisper.cpp (local)
 */
const { createClient } = require('@deepgram/sdk');

const provider = process.env.STT_PROVIDER || 'deepgram';

/**
 * Transcribe audio buffer to text
 * @param {Buffer} audioBuffer - Raw PCM or MP3 audio
 * @returns {string} Transcribed text
 */
async function transcribe(audioBuffer) {
  if (provider === 'deepgram') {
    return transcribeDeepgram(audioBuffer);
  } else {
    return transcribeWhisper(audioBuffer);
  }
}

/**
 * Deepgram Nova-2 — best accuracy for accents, fastest cloud STT
 */
async function transcribeDeepgram(audioBuffer) {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-2',
      smart_format: true,
      punctuate: true,
      language: 'en-US',
    }
  );

  if (error) throw new Error(`Deepgram error: ${error.message}`);

  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return transcript || '';
}

/**
 * Whisper.cpp local — private, no API cost, requires whisper.cpp installed
 */
async function transcribeWhisper(audioBuffer) {
  const { execFile } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  // Write buffer to temp wav file
  const tmpWav = path.join(os.tmpdir(), `trillian_stt_${Date.now()}.wav`);
  fs.writeFileSync(tmpWav, audioBuffer);

  return new Promise((resolve, reject) => {
    // Assumes whisper.cpp main binary is in PATH or WHISPER_BIN env var
    const whisperBin = process.env.WHISPER_BIN || 'whisper-cli';
    const modelPath = process.env.WHISPER_MODEL || './models/ggml-base.en.bin';

    execFile(whisperBin, ['-m', modelPath, '-f', tmpWav, '-otxt', '-of', tmpWav], (err) => {
      fs.unlinkSync(tmpWav);
      if (err) return reject(err);

      const txtFile = tmpWav + '.txt';
      if (fs.existsSync(txtFile)) {
        const text = fs.readFileSync(txtFile, 'utf8').trim();
        fs.unlinkSync(txtFile);
        resolve(text);
      } else {
        resolve('');
      }
    });
  });
}

/**
 * Record audio from microphone for a specified duration
 * Returns raw audio buffer
 */
async function recordAudio(durationMs = 8000) {
  const record = require('node-record-lpcm16');

  return new Promise((resolve) => {
    const chunks = [];
    const recording = record.record({
      sampleRate: 16000,
      channels: 1,
      audioType: 'wav',
    });

    recording.stream().on('data', chunk => chunks.push(chunk));

    setTimeout(() => {
      recording.stop();
      resolve(Buffer.concat(chunks));
    }, durationMs);
  });
}

module.exports = { transcribe, recordAudio };
