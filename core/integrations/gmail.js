// Gmail integration — requires OAuth2 setup
async function getEmails({ max_results = 10, query = 'is:unread' } = {}) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return { message: 'Gmail not yet connected. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then run the OAuth flow.' };
  }
  return { message: 'Gmail OAuth flow required — run: node scripts/auth-google.js' };
}

async function sendEmail({ to, subject, body, cc }) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return { message: 'Gmail not connected yet.' };
  }
  return { message: 'Gmail OAuth flow required' };
}

module.exports = { getEmails, sendEmail };
