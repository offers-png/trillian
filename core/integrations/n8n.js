const axios = require('axios');

function headers() {
  return { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' };
}

// Fetch ALL workflows by paginating through all pages
async function getAllWorkflows() {
  const BASE = process.env.N8N_URL;
  let all = [];
  let cursor = null;
  do {
    const url = BASE + '/api/v1/workflows?limit=100' + (cursor ? '&cursor=' + cursor : '');
    const { data } = await axios.get(url, { headers: headers() });
    const items = data.data || data;
    if (Array.isArray(items)) all = all.concat(items);
    cursor = data.nextCursor || null;
  } while (cursor);
  return all;
}

async function getPipelineStatus({ filter = 'all' } = {}) {
  const workflows = await getAllWorkflows();
  if (filter === 'errors') {
    try {
      const { data } = await axios.get(
        process.env.N8N_URL + '/api/v1/executions?status=error&limit=50',
        { headers: headers() }
      );
      const erroredIds = new Set((data.data || []).map(e => e.workflowId));
      const broken = workflows.filter(w => erroredIds.has(w.id));
      if (!broken.length) return { status: 'healthy', message: 'All ' + workflows.length + ' workflows running clean.' };
      return { broken: broken.map(w => w.name), count: broken.length, total: workflows.length };
    } catch(e) {
      // fallback if executions API fails
    }
  }
  const active = workflows.filter(w => w.active);
  const inactive = workflows.filter(w => !w.active);
  return {
    total: workflows.length,
    active: active.length,
    inactive: inactive.length,
    active_names: active.map(w => w.name),
  };
}

async function triggerWorkflow({ workflow_name, payload = {} }) {
  const workflows = await getAllWorkflows();
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = norm(workflow_name);
  const match = workflows.find(w => norm(w.name) === target)
             || workflows.find(w => norm(w.name).includes(target))
             || workflows.find(w => target.includes(norm(w.name)));
  if (!match) {
    const names = workflows.slice(0, 15).map(w => w.name).join(', ');
    throw new Error('Workflow "' + workflow_name + '" not found. First 15 available: ' + names);
  }
  return {
    found: match.name,
    id: match.id,
    active: match.active,
    message: match.active
      ? 'Workflow "' + match.name + '" is active. To trigger it, it needs a webhook or manual trigger node.'
      : 'Workflow "' + match.name + '" is currently inactive. Activate it in n8n first.'
  };
}

async function listWorkflows({ filter = 'active' } = {}) {
  const workflows = await getAllWorkflows();
  const filtered = filter === 'active'
    ? workflows.filter(w => w.active)
    : filter === 'inactive'
    ? workflows.filter(w => !w.active)
    : workflows;
  return {
    total: workflows.length,
    showing: filtered.length,
    filter,
    names: filtered.map(w => w.name)
  };
}

module.exports = { getPipelineStatus, triggerWorkflow, listWorkflows, getAllWorkflows };
