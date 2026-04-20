// Google Calendar integration — requires OAuth2 setup
// Until OAuth is configured, returns a helpful stub
async function getEvents({ start_date, end_date }) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return { message: 'Google Calendar not yet connected. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then run the OAuth flow.' };
  }
  return { message: 'Calendar OAuth flow required — run: node scripts/auth-google.js' };
}

async function createEvent({ title, start_time, end_time, description }) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return { message: 'Google Calendar not connected yet.' };
  }
  return { message: 'Calendar OAuth flow required' };
}

module.exports = { getEvents, createEvent };
