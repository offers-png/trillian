const axios = require('axios');
const BASE = process.env.N8N_URL;
const KEY  = process.env.N8N_API_KEY;
const headers = () => ({ 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' });

async function getPipelineStatus({ filter = 'errors' } = {}) {
  const { data } = await axios.get(`${BASE}/api/v1/workflows`, { headers: headers() });
  const workflows = data.data || data;
  if (filter === 'errors') {
    // Get recent executions with errors
    const { data: execs } = await axios.get(`${BASE}/api/v1/executions?status=error&limit=10`, { headers: headers() });
    const errored = (execs.data || []).map(e => e.workflowId);
    const broken = workflows.filter(w => errored.includes(w.id));
    if (!broken.length) return { status: 'healthy', message: 'All workflows running clean.' };
    return { broken: broken.map(w => w.name), count: broken.length };
  }
  return { workflows: workflows.map(w => ({ name: w.name, active: w.active })) };
}

async function triggerWorkflow({ workflow_name, payload = {} }) {
  const { data } = await axios.get(`${BASE}/api/v1/workflows`, { headers: headers() });
  const workflows = data.data || data;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const match = workflows.find(w => norm(w.name) === norm(workflow_name))
             || workflows.find(w => norm(w.name).includes(norm(workflow_name)));
  if (!match) throw new Error(`Workflow "${workflow_name}" not found`);
  await axios.post(`${BASE}/api/v1/workflows/${match.id}/execute`, payload, { headers: headers() });
  return { triggered: match.name, id: match.id };
}

module.exports = { getPipelineStatus, triggerWorkflow };
