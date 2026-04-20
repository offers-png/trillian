const Stripe = require('stripe');

function getClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function getRevenue({ period = 'today', metric = 'gross' }) {
  const stripe = getClient();
  const now = Math.floor(Date.now() / 1000);
  const ranges = {
    today:      { gte: now - 86400 },
    yesterday:  { gte: now - 172800, lte: now - 86400 },
    this_week:  { gte: now - 604800 },
    this_month: { gte: now - 2592000 },
    last_month: { gte: now - 5184000, lte: now - 2592000 },
  };
  const created = ranges[period] || ranges.today;

  if (metric === 'gross') {
    const charges = await stripe.charges.list({ created, limit: 100 });
    const total = charges.data.filter(c => c.paid).reduce((s, c) => s + c.amount, 0);
    return { period, gross: `$${(total / 100).toFixed(2)}`, count: charges.data.length };
  }
  if (metric === 'failed_payments') {
    const charges = await stripe.charges.list({ created, limit: 100 });
    const failed = charges.data.filter(c => !c.paid);
    return { failed: failed.map(c => ({ amount: `$${(c.amount/100).toFixed(2)}`, customer: c.billing_details?.name || c.customer })) };
  }
  if (metric === 'new_subscriptions') {
    const subs = await stripe.subscriptions.list({ created, limit: 50 });
    return { new_subscriptions: subs.data.length, plans: subs.data.map(s => s.items.data[0]?.price?.nickname || s.id) };
  }
  return { message: `${metric} for ${period} — Stripe connected` };
}

module.exports = { getRevenue };
