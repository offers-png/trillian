/**
 * TRILLIAN HUD — Local web server + WebSocket for real-time updates
 * Open http://localhost:4000 in your browser
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.HUD_PORT || 4000;

// Store latest state
const state = {
  status: 'online',
  listening: true,
  processing: false,
  lastUser: '',
  lastTrillian: '',
  transcript: [],
  workflows: { total: 0, active: 0 },
  startedAt: new Date().toISOString(),
};

// HTTP server serves the HUD HTML
const server = http.createServer((req, res) => {
  if (req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(state));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
});

// WebSocket for real-time push updates
const wss = new WebSocketServer({ server });
function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

// Update functions called from index.js
function updateState(patch) {
  Object.assign(state, patch);
  broadcast('state', state);
}

function addTranscript(role, text) {
  state.transcript.unshift({ role, text, ts: new Date().toLocaleTimeString() });
  if (state.transcript.length > 50) state.transcript.pop();
  if (role === 'user') state.lastUser = text;
  if (role === 'trillian') state.lastTrillian = text;
  broadcast('transcript', { role, text });
}

server.listen(PORT, () => {
  console.log('[HUD] Dashboard running at http://localhost:' + PORT);
});

module.exports = { updateState, addTranscript, broadcast };
