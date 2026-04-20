const axios = require('axios');

async function handleAction(text) {
  const lower = text.toLowerCase();
  if (lower.includes('time') && !lower.includes('workflow') && !lower.includes('trigger')) {
    return new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  }
  if (lower.includes('list workflows') || lower.includes('show workflows') || lower.includes('what workflows')) {
    return await listWorkflows();
  }
  if (lower.includes('list files')) {
    const fs = require('fs');
    try { return 'Files: ' + fs.readdirSync('.').slice(0, 10).join(', '); } catch(e) { return 'Could not list files.'; }
  }
  return null;
}

async function n8nRequest(path, options = {}) {
  const baseUrl = process.env.N8N_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Missing N8N_URL or N8N_API_KEY');
  const res = await axios({
    url: baseUrl + path,
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': apiKey },
    data: options.body ? JSON.parse(options.body) : undefined,
  });
  return res.data;
}

async function listWorkflows() {
  try {
    const data = await n8nRequest('/api/v1/workflows');
    const workflows = data.data || data;
    const names = workflows.slice(0, 10).map(w => w.name);
    return 'Active workflows: ' + names.join(', ');
  } catch (err) {
    return 'Could not fetch workflows: ' + err.message;
  }
}

module.exports = { handleAction };
