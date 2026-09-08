/* =====================================================================
 *  BuildCart Production Backend — Node.js / Express
 *  Features: product API, fundi API, M-Pesa Daraja STK Push (sandbox),
 *  order management, quote requests, admin routes
 * ===================================================================== */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const crypto     = require('crypto');
const axios      = require('axios');
const { v4: uuid } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ─────────────────────────────────────────────── */
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── In-memory stores (swap for DB in production) ──────────── */
const orders       = new Map();   // id → order
const quotes       = new Map();   // id → quote request
const fundiLeads   = new Map();   // id → fundi lead

/* ── Simple auth middleware for admin ───────────────────────── */
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== (process.env.ADMIN_KEY || 'buildcart-admin-2024')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/* ════════════════════════════════════════════════════════════════
 *  PRODUCT API
 * ══════════════════════════════════════════════════════════════ */

// Load product data from data.js (shared with frontend)
let BUILDCART_DATA;
try {
  // We parse the JS file's data portion
  const fs = require('fs');
  const raw = fs.readFileSync(path.join(__dirname, 'public', 'js', 'data.js'), 'utf8');
  // Extract the JSON-like object
  const match = raw.match(/window\.BUILDCART_DATA\s*=\s*({[\s\S]*?});?\s*$/m);
  if (match) {
    // Use eval in sandboxed context to parse the JS object
    const vm = require('vm');
    const script = new vm.Script('var obj = ' + match[1]);
    const ctx = vm.createContext({});
    script.runInContext(ctx);
    BUILDCART_DATA = ctx.obj;
  }
} catch (e) {
  console.warn('⚠ Could not load data.js for backend API, using empty data');
  BUILDCART_DATA = { PRODUCTS: [], CATEGORIES: [], BRANDS: [] };
}

app.get('/api/products', (req, res) => {
  let products = [...(BUILDCART_DATA.PRODUCTS || [])];
  const { category, brand, search, minPrice, maxPrice, sort } = req.query;

  if (category) products = products.filter(p => p.category === category);
  if (brand)    products = products.filter(p => p.brand === brand);
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }
  if (minPrice) products = products.filter(p => p.price >= Number(minPrice));
  if (maxPrice) products = products.filter(p => p.price <= Number(maxPrice));

  if (sort === 'price-asc')  products.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  if (sort === 'name')      products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  res.json({ total: products.length, products });
});

app.get('/api/products/:id', (req, res) => {
  const p = (BUILDCART_DATA.PRODUCTS || []).find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

app.get('/api/categories', (req, res) => {
  res.json(BUILDCART_DATA.CATEGORIES || []);
});

app.get('/api/brands', (req, res) => {
  const { category } = req.query;
  let brands = BUILDCART_DATA.BRANDS || [];
  if (category) brands = brands.filter(b => b.category === category);
  res.json(brands);
});

/* ════════════════════════════════════════════════════════════════
 *  FUNDI (INSTALLER) API
 * ══════════════════════════════════════════════════════════════ */

app.get('/api/fundis', (req, res) => {
  let fundis = [...(BUILDCART_DATA.FUNDIS || [])];
  const { specialty, location, minRating } = req.query;
  if (specialty) fundis = fundis.filter(f => f.specialties && f.specialties.includes(specialty));
  if (location)  fundis = fundis.filter(f => f.location && f.location.toLowerCase().includes(location.toLowerCase()));
  if (minRating)  fundis = fundis.filter(f => f.rating >= Number(minRating));
  res.json({ total: fundis.length, fundis });
});

app.get('/api/fundis/:id', (req, res) => {
  const f = (BUILDCART_DATA.FUNDIS || []).find(f => f.id === req.params.id);
  if (!f) return res.status(404).json({ error: 'Fundi not found' });
  res.json(f);
});

// Submit a fundi hire request
app.post('/api/fundis/hire', (req, res) => {
  const { fundiId, clientName, clientPhone, projectType, projectDesc, preferredDate } = req.body;
  if (!fundiId || !clientName || !clientPhone) {
    return res.status(400).json({ error: 'Missing required fields: fundiId, clientName, clientPhone' });
  }
  const lead = {
    id: uuid(),
    fundiId,
    clientName,
    clientPhone,
    projectType: projectType || '',
    projectDesc: projectDesc || '',
    preferredDate: preferredDate || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  fundiLeads.set(lead.id, lead);
  res.status(201).json({ success: true, leadId: lead.id, message: 'Fundi hire request submitted. We will contact you shortly.' });
});

/* ════════════════════════════════════════════════════════════════
 *  ORDER API
 * ══════════════════════════════════════════════════════════════ */

app.post('/api/orders', (req, res) => {
  const { customerName, customerPhone, customerEmail, items, paymentMethod, deliveryAddress, notes } = req.body;
  if (!customerName || !customerPhone || !items || !items.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const total = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const deliveryFee = total >= 50000 ? 0 : 2500;

  const order = {
    id: 'BC-' + Date.now().toString(36).toUpperCase(),
    customerName,
    customerPhone,
    customerEmail: customerEmail || '',
    items,
    total: total + deliveryFee,
    subtotal: total,
    deliveryFee,
    paymentMethod: paymentMethod || 'cod',
    deliveryAddress: deliveryAddress || '',
    notes: notes || '',
    status: 'placed',
    statusHistory: [{ status: 'placed', timestamp: new Date().toISOString() }],
    createdAt: new Date().toISOString()
  };

  orders.set(order.id, order);
  res.status(201).json({ success: true, order });
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.patch('/api/orders/:id/status', adminAuth, (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { status } = req.body;
  const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  order.status = status;
  order.statusHistory.push({ status, timestamp: new Date().toISOString() });
  orders.set(order.id, order);
  res.json({ success: true, order });
});

/* ════════════════════════════════════════════════════════════════
 *  QUOTE REQUEST API
 * ══════════════════════════════════════════════════════════════ */

app.post('/api/quotes', (req, res) => {
  const { name, phone, email, projectType, projectDesc, estimatedBudget, location } = req.body;
  if (!name || !phone || !projectType) {
    return res.status(400).json({ error: 'Missing required fields: name, phone, projectType' });
  }
  const quote = {
    id: 'QT-' + Date.now().toString(36).toUpperCase(),
    name,
    phone,
    email: email || '',
    projectType,
    projectDesc: projectDesc || '',
    estimatedBudget: estimatedBudget || '',
    location: location || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  quotes.set(quote.id, quote);
  res.status(201).json({ success: true, quoteId: quote.id, message: 'Quote request received. Our team will contact you within 24 hours.' });
});

/* ════════════════════════════════════════════════════════════════
 *  M-PESA DARAJA STK PUSH (Sandbox)
 * ══════════════════════════════════════════════════════════════ */

const MPESA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// M-Pesa access token cache
let mpesaToken = { token: null, expires: 0 };

async function getMpesaToken() {
  if (mpesaToken.token && Date.now() < mpesaToken.expires) return mpesaToken.token;
  const consumerKey    = process.env.MPESA_CONSUMER_KEY    || 'YOUR_CONSUMER_KEY';
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET';
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const { data } = await axios.get(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    mpesaToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    return data.access_token;
  } catch (e) {
    console.error('❌ M-Pesa token error:', e.response?.data || e.message);
    throw new Error('Failed to get M-Pesa access token');
  }
}

// STK Push (Lipa Na M-Pesa Online)
app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phone, amount, orderId, accountRef } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount are required' });

    const token = await getMpesaToken();
    const shortcode   = process.env.MPESA_SHORTCODE   || '174379';  // Sandbox paybill
    const passkey     = process.env.MPESA_PASSKEY     || 'bfb279f9aa68bdb4012d7d9f9e7c3c1e3d9c4e7';  // Sandbox passkey
    const timestamp   = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password    = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone.startsWith('0') ? '254' + phone.slice(1) : phone,  // Format to 254...
      PartyB: shortcode,
      PhoneNumber: phone.startsWith('0') ? '254' + phone.slice(1) : phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL || `http://localhost:${PORT}/api/mpesa/callback`,
      AccountReference: accountRef || orderId || 'BuildCart',
      TransactionDesc: `BuildCart Order ${orderId || ''}`
    };

    const { data } = await axios.post(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Save the CheckoutRequestID with the order for callback matching
    if (orderId && orders.has(orderId)) {
      const order = orders.get(orderId);
      order.mpesaCheckoutId = data.CheckoutRequestID;
      order.mpesaMerchantId = data.MerchantRequestID;
      orders.set(order.id, order);
    }

    res.json({ success: true, MerchantRequestID: data.MerchantRequestID, CheckoutRequestID: data.CheckoutRequestID });
  } catch (e) {
    console.error('❌ STK Push error:', e.response?.data || e.message);
    res.status(502).json({ error: 'M-Pesa request failed', details: e.response?.data || e.message });
  }
});

// M-Pesa callback (called by Safaricom after STK Push)
app.post('/api/mpesa/callback', (req, res) => {
  const { Body } = req.body;
  if (!Body || !Body.stkCallback) return res.sendStatus(200);

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;

  // Find the order by CheckoutRequestID
  for (const [id, order] of orders) {
    if (order.mpesaCheckoutId === CheckoutRequestID) {
      if (ResultCode === 0) {
        // Payment succeeded
        const meta = CallbackMetadata?.Item || [];
        const mpesaReceipt = meta.find(m => m.Name === 'MpesaReceiptNumber')?.Value;
        const paidAmount   = meta.find(m => m.Name === 'Amount')?.Value;
        order.mpesaReceipt = mpesaReceipt;
        order.paidAmount   = paidAmount;
        order.status = 'confirmed';
        order.statusHistory.push({ status: 'confirmed', timestamp: new Date().toISOString(), note: `M-Pesa payment confirmed. Receipt: ${mpesaReceipt}` });
      } else {
        order.mpesaResultCode = ResultCode;
        order.mpesaResultDesc = ResultDesc;
        order.statusHistory.push({ status: 'payment_failed', timestamp: new Date().toISOString(), note: ResultDesc });
      }
      orders.set(id, order);
      break;
    }
  }
  res.sendStatus(200);  // Must return 200 to Safaricom
});

// Query STK Push status
app.get('/api/mpesa/status/:checkoutId', async (req, res) => {
  try {
    const token = await getMpesaToken();
    const shortcode   = process.env.MPESA_SHORTCODE || '174379';
    const passkey     = process.env.MPESA_PASSKEY || 'bfb279f9aa68bdb4012d7d9f9e7c3c1e3d9c4e7';
    const timestamp   = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password    = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const { data } = await axios.post(`${MPESA_BASE}/mpesa/stkpushquery/v1/query`, {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: req.params.checkoutId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Failed to query M-Pesa status', details: e.response?.data || e.message });
  }
});

/* ════════════════════════════════════════════════════════════════
 *  MATERIAL CALCULATOR API
 * ══════════════════════════════════════════════════════════════ */

app.post('/api/calculator', (req, res) => {
  const { type, ...params } = req.body;
  const calculators = {
    cement:  (p) => {
      const input = Number(p.input);
      if (p.subtype === 'bags_per_m3') return { bags: Math.ceil(input * 6), description: `${input} m³ of concrete (C20 mix, 1:2:4) ≈ ${Math.ceil(input * 6)} bags` };
      if (p.subtype === 'plaster')     return { bags: Math.ceil(input / 30), description: `${input} m² of plaster (15mm) ≈ ${Math.ceil(input / 30)} bags` };
      return { error: 'Unknown cement subtype' };
    },
    blocks:  (p) => {
      const input = Number(p.input);
      const perSqm = { '6-inch': 10, '8-inch': 10, 'issb': 12 };
      const count = Math.ceil(input * (perSqm[p.subtype] || 10) * 1.05);
      return { blocks: count, description: `${input} m² wall with ${p.subtype} blocks ≈ ${count} blocks (+5% waste)` };
    },
    roofing: (p) => {
      const area = Number(p.area);
      const sheetLen = Number(p.sheetLength) || 3;
      const sheetWidth = 0.76;  // Standard mabati width
      const sheetsPerSq = 1 / (sheetLen * sheetWidth * 0.85);  // 15% overlap
      const count = Math.ceil(area * sheetsPerSq);
      return { sheets: count, description: `${area} m² roof with ${sheetLen}m sheets ≈ ${count} sheets (includes 15% overlap)` };
    },
    paint:   (p) => {
      const area = Number(p.area);
      const coats = Number(p.coats) || 2;
      const litres = Math.ceil((area * coats) / 8);
      const buckets = Math.ceil(litres / 20);
      return { litres, buckets, description: `${area} m² with ${coats} coats ≈ ${litres}L (${buckets} × 20L buckets)` };
    },
    tiles:   (p) => {
      const area = Number(p.area);
      const tileSize = p.tileSize || '30x30';  // cm
      const [tw, th] = tileSize.split('x').map(Number);
      const tilesPerSqm = 10000 / (tw * th);
      const count = Math.ceil(area * tilesPerSqm * 1.1);  // 10% waste
      return { tiles: count, description: `${area} m² floor with ${tileSize}cm tiles ≈ ${count} tiles (+10% waste)` };
    }
  };
  const calc = calculators[type];
  if (!calc) return res.status(400).json({ error: `Unknown calculator type: ${type}` });
  const result = calc(params);
  res.json(result);
});

/* ════════════════════════════════════════════════════════════════
 *  ADMIN API
 * ══════════════════════════════════════════════════════════════ */

app.get('/api/admin/orders', adminAuth, (req, res) => {
  const { status, limit, offset } = req.query;
  let all = [...orders.values()];
  if (status) all = all.filter(o => o.status === status);
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = Number(offset) || 0;
  const end   = start + (Number(limit) || 50);
  res.json({ total: all.length, orders: all.slice(start, end) });
});

app.get('/api/admin/quotes', adminAuth, (req, res) => {
  const all = [...quotes.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ total: all.length, quotes: all });
});

app.get('/api/admin/fundi-leads', adminAuth, (req, res) => {
  const all = [...fundiLeads.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ total: all.length, leads: all });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const allOrders = [...orders.values()];
  const totalRevenue = allOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const ordersByStatus = {};
  allOrders.forEach(o => { ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1; });
  res.json({
    totalOrders: allOrders.length,
    totalRevenue,
    ordersByStatus,
    totalQuotes: quotes.size,
    totalFundiLeads: fundiLeads.size
  });
});

/* ════════════════════════════════════════════════════════════════
 *  SPA FALLBACK — serve index.html for all non-API / non-file routes
 * ══════════════════════════════════════════════════════════════ */

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ── Start Server ──────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🏗️  BuildCart Server running on http://localhost:${PORT}`);
  console.log(`   M-Pesa Environment: ${process.env.MPESA_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(`   Admin Key: ${process.env.ADMIN_KEY || 'buildcart-admin-2024'}\n`);
});