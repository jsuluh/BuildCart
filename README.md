# BuildCart Kenya 🏗️

**Kenya's #1 Digital Marketplace for Construction Materials & Vetted Installation Services**

> *From Foundation to Finish, We've Got You.*

---

## 🚀 Quick Start

### Frontend Only (No Server Required)

Simply open `index.html` in a browser — everything works with client-side JavaScript and localStorage.

```bash
# Or serve with any static server:
cd public/
npx serve .
# Visit http://localhost:3000
```

### Full Stack (Node.js Backend + M-Pesa)

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your M-Pesa Daraja credentials

# Start the server
npm start
# Server runs on http://localhost:3000
```

---

## 📁 Project Structure

```
buildcart/
├── server.js              # Express backend (API + M-Pesa integration)
├── package.json           # Node.js dependencies
├── .env.example           # Environment variables template
├── manifest.json           # PWA manifest
├── service-worker.js       # PWA service worker (offline caching)
├── public/                 # Static frontend files
│   ├── index.html          # Homepage / Landing page
│   ├── materials.html      # Product catalog with filters
│   ├── services.html       # Fundi (installer) directory
│   ├── product.html        # Single product detail page
│   ├── cart.html           # Shopping cart
│   ├── checkout.html       # Checkout with M-Pesa integration
│   ├── calculator.html     # Material quantity calculator
│   ├── orders.html         # Order history & tracking
│   ├── admin.html          # Admin dashboard
│   ├── css/
│   │   └── style.css       # Custom styles + Tailwind extensions
│   ├── js/
│   │   ├── data.js         # Product, category, brand, and fundi data
│   │   ├── app.js          # Main app logic (cart, filters, i18n, etc.)
│   │   └── pwa.js          # Service worker registration
│   └── icons/              # PWA icons (72-512px)
└── README.md
```

---

## 🌟 Features

### Customer-Facing
- ✅ **Product Catalog** — 40+ construction materials across 8 categories
- ✅ **Smart Filters** — Category, brand, price range, search, sort
- ✅ **Cascading Brand Dropdown** — Brand options update based on selected category
- ✅ **Shopping Cart** — Add/remove items, quantity controls, localStorage persistence
- ✅ **M-Pesa Checkout** — STK Push integration (sandbox-ready) + Cash on Delivery option
- ✅ **Fundi Directory** — Browse and hire vetted installers (plumbers, electricians, masons, etc.)
- ✅ **Material Calculator** — Cement, blocks, roofing, paint, tiles calculators with waste factors
- ✅ **Order Tracking** — View order history, status timeline, WhatsApp tracking
- ✅ **Swahili Toggle** — 60+ translation pairs, instant language switch
- ✅ **WhatsApp Integration** — Floating button + contextual WhatsApp links
- ✅ **PWA Support** — Installable, offline caching, app-like experience
- ✅ **Responsive Design** — Mobile-first, works on all screen sizes

### Admin & Backend
- ✅ **Node.js/Express API** — RESTful endpoints for products, orders, quotes, fundis
- ✅ **M-Pesa Daraja STK Push** — Sandbox integration ready for production credentials
- ✅ **M-Pesa Callback** — Handles payment confirmation from Safaricom
- ✅ **Order Management** — Create, read, update status (admin-protected)
- ✅ **Quote Request API** — Handle project quote requests
- ✅ **Fundi Lead API** — Track fundi hire requests
- ✅ **Admin Dashboard** — Order list, status updates, stats, product catalog view
- ✅ **Admin Auth** — API key-based admin route protection

### Data & Content
- ✅ **Real Kenyan Brands** — Bamburi Cement, Devki Steel, Mabati Rolling Mills, Crown Paints, etc.
- ✅ **Kenyan Pricing** — All prices in KES (Kenyan Shillings)
- ✅ **Nairobi Delivery** — Nairobi Metro delivery zones with fee structure
- ✅ **Free Delivery** — Orders over KES 50,000 ship free

---

## 📱 PWA Installation

1. Open the site in Chrome (Android) or Safari (iOS)
2. **Android**: Tap "Add to Home Screen" from browser menu
3. **iOS**: Tap Share → "Add to Home Screen"
4. The app installs with BuildCart icon and works offline!

---

## 🔧 M-Pesa Integration Setup

### Sandbox (Testing)

1. Register at [Daraja API Portal](https://developer.safaricom.co.ke)
2. Create a sandbox app
3. Get your Consumer Key and Consumer Secret
4. Update `.env`:
   ```
   MPESA_ENV=sandbox
   MPESA_CONSUMER_KEY=your_key
   MPESA_CONSUMER_SECRET=your_secret
   ```

### Production

1. Apply for production credentials on Daraja
2. Get your Paybill/Till number
3. Update `.env`:
   ```
   MPESA_ENV=production
   MPESA_SHORTCODE=your_paybill
   MPESA_PASSKEY=your_production_passkey
   MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
   ```

---

## 🎨 Brand Identity

| Element | Value |
|---------|-------|
| Primary Color | `#166534` (Forest Green) |
| Accent Color | `#f59e0b` (Amber) |
| Tagline | "From Foundation to Finish, We've Got You" |
| Target Market | Nairobi Metro, Kenya |
| WhatsApp | +254 712 345 678 |
| Currency | KES (Kenyan Shilling) |

---

## 🛡️ Security Notes

- Admin API is protected by `x-admin-key` header
- M-Pesa credentials should never be committed to version control
- In production, use HTTPS for the callback URL
- The service worker caches static assets but not sensitive data
- All pricing calculations happen server-side in production

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (filters: category, brand, search, minPrice, maxPrice, sort) |
| GET | `/api/products/:id` | Single product details |
| GET | `/api/categories` | All categories |
| GET | `/api/brands` | Brands (filter: category) |
| GET | `/api/fundis` | List fundis (filters: specialty, location, minRating) |
| GET | `/api/fundis/:id` | Single fundi profile |
| POST | `/api/fundis/hire` | Submit fundi hire request |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/:id` | Get order details |
| PATCH | `/api/orders/:id/status` | Update order status (admin) |
| POST | `/api/quotes` | Submit quote request |
| POST | `/api/mpesa/stkpush` | Initiate M-Pesa STK Push |
| POST | `/api/mpesa/callback` | M-Pesa payment callback (from Safaricom) |
| GET | `/api/mpesa/status/:checkoutId` | Query STK Push status |
| POST | `/api/calculator` | Material calculation API |
| GET | `/api/admin/stats` | Dashboard stats (admin) |
| GET | `/api/admin/orders` | All orders (admin) |
| GET | `/api/admin/quotes` | All quote requests (admin) |
| GET | `/api/admin/fundi-leads` | All fundi leads (admin) |

---

## 🇰🇪 Swahili Toggle

Click the 🇰🇪 SW button in the navbar to switch between English and Swahili. Translations cover:
- Navigation labels
- Page headings
- Product categories
- Call-to-action buttons
- Common phrases

---

## 📐 Material Calculators

| Calculator | Input | Output | Waste Factor |
|------------|-------|--------|-------------|
| Cement (Concrete) | Volume (m³) | Bags (50kg) | +10% |
| Cement (Plaster) | Area (m²) | Bags (50kg) | — |
| Blocks | Wall area (m²) | Block count | +5% |
| Roofing | Roof area (m²), sheet length | Sheet count | +15% overlap |
| Paint | Wall area (m²), coats | Litres / 20L buckets | — |
| Tiles | Floor area (m²) | Tile count | +10% |

---

## 🚀 Deployment Checklist

- [ ] Replace M-Pesa sandbox credentials with production
- [ ] Set up HTTPS (required for M-Pesa callbacks + PWA)
- [ ] Connect to a real database (PostgreSQL/MongoDB)
- [ ] Add user authentication (JWT)
- [ ] Set up WhatsApp Business API for automated updates
- [ ] Configure SMS gateway for order notifications
- [ ] Add product image CDN
- [ ] Set up CI/CD pipeline
- [ ] Load testing with k6/artillery
- [ ] Add rate limiting to API endpoints
- [ ] Enable CORS for production domain only

---

## 📄 License

MVP — All rights reserved. Built for BuildCart Kenya.
