const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || '';
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN || '';

// ── Claude AI endpoint ──
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system, useWeb } = req.body;

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: system || 'Je bent de AI assistent van Kenza Beauty Lab.',
      messages: messages
    };

    if (useWeb) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.content;
    const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.json({ reply: text });

  } catch (err) {
    console.error('Claude error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ── Shopify orders ──
app.get('/api/shopify/orders', async (req, res) => {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return res.json({ orders: [] });
  try {
    const r = await axios.get(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?limit=10&status=any`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Shopify stats ──
app.get('/api/shopify/stats', async (req, res) => {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return res.json({ stats: null });
  try {
    const [orders, products] = await Promise.all([
      axios.get(`https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?limit=250&status=paid&created_at_min=${new Date(Date.now()-30*24*60*60*1000).toISOString()}`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }),
      axios.get(`https://${SHOPIFY_STORE}/admin/api/2024-01/products/count.json`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } })
    ]);
    const totalRevenue = orders.data.orders.reduce((s, o) => s + parseFloat(o.total_price), 0);
    res.json({
      orders: orders.data.orders.length,
      revenue: totalRevenue.toFixed(2),
      products: products.data.count
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Health check ──
app.get('/health', (req, res) => res.json({ status: 'Kenza OS actief ✓' }));

// ── Serve dashboard ──
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Kenza OS draait op poort ${PORT}`));
