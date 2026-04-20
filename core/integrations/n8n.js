const axios = require('axios');
const BASE = process.env.N8N_URL;
const KEY  = process.env.N8N_API_KEY;
const h = () => ({ 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' });

async function getPipelineStatus({ filter = 'errors' } = {}) {
  const { data } = await axios.get(BASE + '/api/v1/workflows', { headers: h() });
  const workflows = data.data || data;
  if (filter === 'errors') {
    try {
      const { data: execs } = await axios.get(BASE + '/api/v1/executions?status=error&limit=20', { headers: h() });
      const errored = new Set((execs.data || []).map(e => e.workflowId));
      const broken = workflows.filter(w => errored.has(w.id));
      if (!broken.length) return { status: 'healthy', message: 'All workflows running clean.' };
      return { broken: broken.map(w => w.name), count: broken.length };
    } catch(e) {
      return { workflows: workflows.filter(w => w.active).map(w => w.name), total: workflows.length };
    }
  }
  return { workflows: workflows.map(w => ({ name: w.name, active: w.active })), total: workflows.length };
}

async function triggerWorkflow({ workflow_name, payload = {} }) {
  const { data } = await axios.get(BASE + '/api/v1/workflows', { headers: h() });
  const workflows = data.data || data;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const match = workflows.find(w => norm(w.name) === norm(workflow_name))
             || workflows.find(w => norm(w.name).includes(norm(workflow_name)))
             || workflows.find(w => norm(workflow_name).includes(norm(w.name)));
  if (!match) {
    const names = workflows.map(w => w.name).slice(0, 8).join(', ');
    throw new Error('Workflow not found. Available: ' + names);
  }
  // n8n Cloud uses webhook execution, not /execute endpoint
  // Activate workflow then use its webhook trigger if available
  // For now return workflow info so Trillian can guide the user
  return { found: match.name, id: match.id, active: match.active,
           note: 'To trigger via webhook, the workflow needs a webhook trigger node configured.' };
}

module.exports = { getPipelineStatus, triggerWorkflow };
