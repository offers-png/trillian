const https = require('https');

async function search(query) {
  // Use DuckDuckGo Instant Answer API (no key needed)
  return new Promise((resolve) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const answer = json.AbstractText || json.Answer || json.Definition || 'No direct answer found. Try a more specific query.';
          resolve({ query, answer: answer.slice(0, 500), source: json.AbstractURL || '' });
        } catch {
          resolve({ query, answer: 'Search error', source: '' });
        }
      });
    }).on('error', () => resolve({ query, answer: 'Search unavailable', source: '' }));
  });
}

module.exports = { search };
