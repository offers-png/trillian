require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.HUD_PORT || 4000;

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

const server = http.createServer((req, res) => {
  if (req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(state));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
});

const wss = new WebSocketServer({ server });

// Load vision module once at startup
let visionModule = null;
try {
  visionModule = require('../core/vision');
  console.log('[HUD] Vision module loaded successfully');
} catch(e) {
  console.error('[HUD] Failed to load vision module:', e.message);
}

wss.on('connection', (ws) => {
  console.log('[HUD] WebSocket client connected');
  
  ws.on('message', (raw) => {
    try {
      const { event, data } = JSON.parse(raw);
      if (event === 'vision_frame') {
        if (visionModule) {
          visionModule.setVisionFrame(data);
          console.log('[HUD] Vision frame received and forwarded to backend');
        } else {
          console.warn('[HUD] Vision frame received but vision module not loaded');
        }
      }
    } catch(e) {
      console.error('[HUD] Error processing message:', e.message);
    }
  });
  
  ws.on('close', () => {
    console.log('[HUD] WebSocket client disconnected');
  });
});

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

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
  console.log('[HUD] Vision system enabled - frames will be forwarded to core/vision.js');
});

module.exports = { updateState, addTranscript, broadcast };
