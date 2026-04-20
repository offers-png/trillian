async function morningBriefing() {
  const now = new Date().toLocaleString('en-US', {
    timeZone: process.env.BRIEFING_TIMEZONE || 'America/New_York',
    weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  return `Good morning Saleh. It's ${now}. I'm online and all systems are operational. How can I help you start your day?`;
}

module.exports = { morningBriefing };
