/**
 * TRILLIAN — Claude Tool Definitions
 * Every capability Trillian has is defined here as a Claude tool
 */
const { forget, memorySummary } = require('./memory');

// ─── TOOL REGISTRY ─────────────────────────────────────────────────────────
// Add new tools here as integrations are built

const TOOLS = [
  // ── CALENDAR ──────────────────────────────────────────────────────────────
  {
    name: 'get_calendar_events',
    description: 'Get calendar events for a date range. Use for "what\'s on my calendar", "do I have anything today", etc.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date ISO 8601 (e.g. 2026-04-19)' },
        end_date:   { type: 'string', description: 'End date ISO 8601' },
      },
      required: ['start_date'],
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Create a calendar event. Always confirm with user before creating.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string' },
        start_time:  { type: 'string', description: 'ISO 8601 datetime' },
        end_time:    { type: 'string', description: 'ISO 8601 datetime' },
        description: { type: 'string' },
      },
      required: ['title', 'start_time', 'end_time'],
    }
  },

  // ── EMAIL ─────────────────────────────────────────────────────────────────
  {
    name: 'get_emails',
    description: 'Get recent emails from Gmail. Use for "check my email", "any important emails", etc.',
    input_schema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: 'Max emails to fetch (default 10)' },
        query:       { type: 'string', description: 'Gmail search query (e.g. "is:unread", "from:saleh")' },
      },
    }
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail. ALWAYS read the draft back to the user and wait for confirmation before calling this.',
    input_schema: {
      type: 'object',
      properties: {
        to:      { type: 'string' },
        subject: { type: 'string' },
        body:    { type: 'string' },
        cc:      { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    }
  },

  // ── STRIPE ────────────────────────────────────────────────────────────────
  {
    name: 'get_stripe_revenue',
    description: 'Get Stripe revenue data. Use for "how much today", "what\'s our MRR", "any failed payments".',
    input_schema: {
      type: 'object',
      properties: {
        period:     { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'last_month'] },
        metric:     { type: 'string', enum: ['gross', 'mrr', 'failed_payments', 'new_subscriptions', 'top_customers'] },
      },
      required: ['period', 'metric'],
    }
  },

  // ── n8n WORKFLOWS ─────────────────────────────────────────────────────────
  {
    name: 'get_pipeline_status',
    description: 'Check n8n workflow health. Use for "what\'s broken", "pipeline status", "are my workflows running".',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['all', 'errors', 'active', 'inactive'] },
      },
    }
  },
  {
    name: 'trigger_workflow',
    description: 'Trigger an n8n workflow by name. Always confirm with user first.',
    input_schema: {
      type: 'object',
      properties: {
        workflow_name: { type: 'string', description: 'Name of the n8n workflow to trigger' },
        payload:       { type: 'object', description: 'Optional payload to send to the workflow' },
      },
      required: ['workflow_name'],
    }
  },

  // ── FILESYSTEM ────────────────────────────────────────────────────────────
  {
    name: 'read_file',
    description: 'Read a file from the local filesystem (within sandbox directory).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to TRILLIAN_ROOT_DIR' },
      },
      required: ['path'],
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory.',
    input_schema: {
      type: 'object',
      properties: {
        path:    { type: 'string', description: 'Directory path relative to TRILLIAN_ROOT_DIR' },
        pattern: { type: 'string', description: 'File pattern to filter (e.g. "*.pdf")' },
      },
    }
  },
  {
    name: 'create_file',
    description: 'Create a new file with content.',
    input_schema: {
      type: 'object',
      properties: {
        path:    { type: 'string', description: 'File path relative to TRILLIAN_ROOT_DIR' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    }
  },

  // ── MEMORY ────────────────────────────────────────────────────────────────
  {
    name: 'forget_memory',
    description: 'Delete a memory when user says "forget that" or "delete what I told you about X".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to forget' },
      },
      required: ['query'],
    }
  },
  {
    name: 'memory_summary',
    description: 'Return a summary of everything Trillian knows about the user.',
    input_schema: {
      type: 'object',
      properties: {},
    }
  },

  // ── WEB SEARCH ────────────────────────────────────────────────────────────
  {
    name: 'web_search',
    description: 'Search the web for current information.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    }
  },
];

function getTools() {
  return TOOLS;
}

/**
 * Execute a tool call from Claude
 * Each tool routes to its implementation module
 */
async function executeTool(toolName, input) {
  switch (toolName) {
    // Calendar
    case 'get_calendar_events':    return require('./integrations/calendar').getEvents(input);
    case 'create_calendar_event':  return require('./integrations/calendar').createEvent(input);

    // Email
    case 'get_emails':             return require('./integrations/gmail').getEmails(input);
    case 'send_email':             return require('./integrations/gmail').sendEmail(input);

    // Stripe
    case 'get_stripe_revenue':     return require('./integrations/stripe').getRevenue(input);

    // n8n
    case 'get_pipeline_status':    return require('./integrations/n8n').getPipelineStatus(input);
    case 'trigger_workflow':       return require('./integrations/n8n').triggerWorkflow(input);

    // Filesystem
    case 'read_file':              return require('./integrations/filesystem').readFile(input);
    case 'list_files':             return require('./integrations/filesystem').listFiles(input);
    case 'create_file':            return require('./integrations/filesystem').createFile(input);

    // Memory
    case 'forget_memory':          return forget(input.query);
    case 'memory_summary':         return memorySummary();

    // Web
    case 'web_search':             return require('./integrations/search').search(input.query);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

module.exports = { getTools, executeTool };
