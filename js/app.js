// ============================================================
// BuildCart MVP — App Logic (Cart, Search, Filters, Checkout)
// ============================================================

const Cart = {
  KEY: 'buildcart_cart',

  getItems() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch { return []; }
  },

  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.updateBadge();
  },

  addItem(product, qty = 1) {
    const items = this.getItems();
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ id: product.id, name: product.name, price: product.price, unit: product.unit, qty, brand: product.brand, category: product.category, image: product.image });
    }
    this.save(items);
    showToast(`${product.name} added to cart`);
  },

  removeItem(productId) {
    const items = this.getItems().filter(i => i.id !== productId);
    this.save(items);
  },

  updateQty(productId, qty) {
    const items = this.getItems();
    const item = items.find(i => i.id === productId);
    if (item) {
      item.qty = Math.max(1, qty);
      this.save(items);
    }
  },

  getTotal() {
    return this.getItems().reduce((sum, i) => sum + i.price * i.qty, 0);
  },

  getCount() {
    return this.getItems().reduce((sum, i) => sum + i.qty, 0);
  },

  clear() {
    localStorage.removeItem(this.KEY);
    this.updateBadge();
  },

  updateBadge() {
    const badges = document.querySelectorAll('#cart-badge');
    const count = this.getCount();
    badges.forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? 'flex' : 'none';
    });
  }
};

// Toast notification
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2';
    document.body.appendChild(c);
    return c;
  })();
  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all transform translate-x-full ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.remove('translate-x-full'); toast.classList.add('translate-x-0'); });
  setTimeout(() => {
    toast.classList.remove('translate-x-0');
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format currency
function formatKES(amount) {
  return 'KES ' + amount.toLocaleString('en-KE');
}

// Search & Filter helpers — now reads from sidebar controls
function getFilteredProducts() {
  const data = window.BUILDCART_DATA;
  let products = [...data.PRODUCTS];

  // URL params (initial load from category links)
  const urlParams = new URLSearchParams(window.location.search);
  const urlCat = urlParams.get('category');
  const urlBrand = urlParams.get('brand');
  const urlSearch = urlParams.get('search')?.toLowerCase();

  // Sidebar controls (take priority if user interacts)
  const catSelect = document.getElementById('filter-category');
  const brandSelect = document.getElementById('filter-brand');
  const searchInput = document.getElementById('search-input');
  const minInput = document.getElementById('filter-min');
  const maxInput = document.getElementById('filter-max');
  const sortSelect = document.getElementById('filter-sort');

  // Category filter
  const cat = catSelect ? catSelect.value : (urlCat || '');
  if (cat) products = products.filter(p => p.category === cat);

  // Brand filter
  const brand = brandSelect ? brandSelect.value : (urlBrand || '');
  if (brand) products = products.filter(p => p.brand === brand);

  // Search filter
  const search = searchInput ? searchInput.value.toLowerCase() : (urlSearch || '');
  if (search) products = products.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.brand.toLowerCase().includes(search) ||
    (p.description && p.description.toLowerCase().includes(search))
  );

  // Price range
  const minPrice = parseInt(minInput?.value) || parseInt(urlParams.get('minPrice')) || 0;
  const maxPrice = parseInt(maxInput?.value) || parseInt(urlParams.get('maxPrice')) || 0;
  if (minPrice) products = products.filter(p => p.price >= minPrice);
  if (maxPrice) products = products.filter(p => p.price <= maxPrice);

  // Sort
  const sort = sortSelect ? sortSelect.value : (urlParams.get('sort') || '');
  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));

  return products;
}

// Populate filter dropdowns from data
function populateFilterDropdowns() {
  const data = window.BUILDCART_DATA;
  const urlParams = new URLSearchParams(window.location.search);

  // Category dropdown
  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    catSelect.innerHTML = '<option value="">All Categories</option>';
    data.CATEGORIES.forEach(cat => {
      catSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
    // Set from URL param
    const urlCat = urlParams.get('category');
    if (urlCat) catSelect.value = urlCat;
  }

  // Brand dropdown — populate with unique brands across all categories
  const brandSelect = document.getElementById('filter-brand');
  if (brandSelect) {
    const allBrands = new Set();
    data.PRODUCTS.forEach(p => allBrands.add(p.brand));
    const sortedBrands = [...allBrands].sort();
    brandSelect.innerHTML = '<option value="">All Brands</option>';
    sortedBrands.forEach(b => {
      brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });
    // Set from URL param
    const urlBrand = urlParams.get('brand');
    if (urlBrand) brandSelect.value = urlBrand;
  }

  // Sync search from URL
  const searchInput = document.getElementById('search-input');
  if (searchInput && urlParams.get('search')) {
    searchInput.value = urlParams.get('search');
  }
}

// Update brand dropdown based on selected category
function updateBrandOptions() {
  const data = window.BUILDCART_DATA;
  const catSelect = document.getElementById('filter-category');
  const brandSelect = document.getElementById('filter-brand');
  if (!catSelect || !brandSelect) return;

  const selectedCat = catSelect.value;
  const currentBrand = brandSelect.value;

  if (selectedCat) {
    // Show only brands for this category
    const catBrands = data.BRANDS[selectedCat] || [];
    brandSelect.innerHTML = '<option value="">All Brands</option>';
    catBrands.forEach(b => {
      brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });
  } else {
    // Show all brands
    const allBrands = new Set();
    data.PRODUCTS.forEach(p => allBrands.add(p.brand));
    const sortedBrands = [...allBrands].sort();
    brandSelect.innerHTML = '<option value="">All Brands</option>';
    sortedBrands.forEach(b => {
      brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });
  }

  // Restore brand selection if still valid
  const options = [...brandSelect.options].map(o => o.value);
  if (options.includes(currentBrand)) {
    brandSelect.value = currentBrand;
  }
}

// Render product cards on materials page
function renderProducts() {
  const products = getFilteredProducts();
  const grid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  const resultCount = document.getElementById('result-count');

  if (!grid) return;

  resultCount.textContent = `Showing ${products.length} product${products.length !== 1 ? 's' : ''}`;

  if (products.length === 0) {
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');
  emptyState.classList.add('hidden');

  grid.innerHTML = products.map(p => `
    <div class="product-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <a href="product.html?id=${p.id}" class="block">
        <div class="relative h-48 bg-gray-100 overflow-hidden">
          <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover hover:scale-105 transition duration-300" loading="lazy">
          <span class="absolute top-3 left-3 bg-bc-800 text-white text-xs font-semibold px-2.5 py-1 rounded-md">${p.category}</span>
        </div>
      </a>
      <div class="p-4">
        <p class="text-xs text-gray-500 mb-1">${p.brand}</p>
        <a href="product.html?id=${p.id}" class="font-semibold text-gray-900 text-sm mb-2 hover:text-bc-700 transition line-clamp-2">${p.name}</a>
        <div class="flex items-end justify-between mt-3">
          <div>
            <p class="text-xl font-bold text-bc-800 price-tag">${formatKES(p.price)}</p>
            <p class="text-xs text-gray-500">${p.unit}</p>
          </div>
          <button onclick='Cart.addItem(BUILDCART_DATA.PRODUCTS.find(x=>x.id==="${p.id}"))' class="btn-press bg-bc-800 hover:bg-bc-700 text-white w-10 h-10 rounded-lg flex items-center justify-center transition">
            <i class="fas fa-cart-plus"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Apply filters (called by controls)
function applyFilters() {
  updateBrandOptions();
  renderProducts();
  // Update page title
  const catSelect = document.getElementById('filter-category');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  if (catSelect && catSelect.value && pageTitle) {
    const cat = BUILDCART_DATA.CATEGORIES.find(c => c.id === catSelect.value);
    if (cat) {
      pageTitle.textContent = cat.name;
      pageSubtitle.textContent = cat.description;
    }
  } else if (pageTitle) {
    pageTitle.textContent = 'Building Materials';
    pageSubtitle.textContent = 'Browse our full catalog of quality construction materials';
  }
}

// Clear all filters
function clearFilters() {
  const catSelect = document.getElementById('filter-category');
  const brandSelect = document.getElementById('filter-brand');
  const searchInput = document.getElementById('search-input');
  const minInput = document.getElementById('filter-min');
  const maxInput = document.getElementById('filter-max');
  const sortSelect = document.getElementById('filter-sort');

  if (catSelect) catSelect.value = '';
  if (brandSelect) brandSelect.value = '';
  if (searchInput) searchInput.value = '';
  if (minInput) minInput.value = '';
  if (maxInput) maxInput.value = '';
  if (sortSelect) sortSelect.value = '';

  // Reset URL params
  window.history.replaceState({}, '', 'materials.html');

  applyFilters();
}

function getFilteredFundis() {
  const data = window.BUILDCART_DATA;
  const params = new URLSearchParams(window.location.search);
  let fundis = [...data.FUNDIS];

  const trade = params.get('trade');
  if (trade) fundis = fundis.filter(f => f.trade === trade);

  return fundis;
}

// Generate star rating HTML
function starsHTML(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  let html = '';
  for (let i = 0; i < full; i++) html += '<i class="fas fa-star text-yellow-400"></i>';
  if (half) html += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
  for (let i = 0; i < empty; i++) html += '<i class="far fa-star text-yellow-400"></i>';
  return html;
}

// Mobile menu toggle
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('hidden');
}

// ============================================================
// Material Quantity Calculator
// ============================================================
const MaterialCalculator = {
  // Cement calculator: bags per m³ of concrete
  // Mix ratio 1:2:4 (C:Sand:Ballast) ≈ 6 bags per m³ for C20
  cementPerCubicMeter: 6,

  // Blocks per m² of wall (6-inch block ≈ 10 blocks/m²)
  blocksPerSqm: { '6-inch': 10, '8-inch': 10, 'issb': 12 },

  // Roofing sheets per m² (0.6m wide, account overlap ~15%)
  roofingSheetCoverage: 1.5, // m² per 3m sheet (with overlap)

  // Paint coverage (m² per litre)
  paintCoveragePerLitre: 8,

  // Tile coverage per m²
  tilesPerSqm: 11, // for 30x60cm tiles (11 tiles per m² with grout gap)

  calculateCement(qty, type = 'bags_per_m3') {
    if (type === 'bags_per_m3') {
      const volume = parseFloat(qty);
      return { bags: Math.ceil(volume * this.cementPerCubicMeter), description: `${volume}m³ of concrete needs ~${Math.ceil(volume * this.cementPerCubicMeter)} bags (1:2:4 mix)` };
    }
    if (type === 'plaster') {
      const area = parseFloat(qty);
      const bags = Math.ceil(area / 30); // ~30m² per 50kg bag at 15mm
      return { bags, description: `${area}m² of plaster (15mm) needs ~${bags} bags` };
    }
    return { bags: 0, description: 'Invalid type' };
  },

  calculateBlocks(areaSqm, blockType = '6-inch') {
    const perSqm = this.blocksPerSqm[blockType] || 10;
    const blocks = Math.ceil(areaSqm * perSqm);
    const wastage = Math.ceil(blocks * 0.05); // 5% wastage
    return { blocks: blocks + wastage, description: `${areaSqm}m² of ${blockType} wall needs ~${blocks + wastage} blocks (incl. 5% wastage)` };
  },

  calculateRoofing(areaSqm, sheetLength = 3) {
    const coveragePerSheet = (sheetLength * 0.6) * 0.85; // 0.6m width with overlap
    const sheets = Math.ceil(areaSqm / coveragePerSheet);
    return { sheets, description: `${areaSqm}m² roof needs ~${sheets} sheets (${sheetLength}m length, incl. overlap)` };
  },

  calculatePaint(areaSqm, coats = 2) {
    const litres = Math.ceil((areaSqm * coats) / this.paintCoveragePerLitre);
    const buckets20L = Math.ceil(litres / 20);
    return { litres, buckets: buckets20L, description: `${areaSqm}m² with ${coats} coats needs ~${litres}L (${buckets20L} × 20L bucket${buckets20L > 1 ? 's' : ''})` };
  },

  calculateTiles(areaSqm) {
    const tiles = Math.ceil(areaSqm * this.tilesPerSqm * 1.1); // 10% wastage
    return { tiles, description: `${areaSqm}m² floor needs ~${tiles} tiles (30×60cm, incl. 10% cut wastage)` };
  }
};

// ============================================================
// Order Tracker (localStorage-based for MVP)
// ============================================================
const OrderTracker = {
  KEY: 'buildcart_orders',

  getOrders() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch { return []; }
  },

  saveOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    localStorage.setItem(this.KEY, JSON.stringify(orders));
  },

  getOrder(orderId) {
    return this.getOrders().find(o => o.id === orderId);
  },

  updateStatus(orderId, status) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({ status, timestamp: new Date().toISOString() });
      localStorage.setItem(this.KEY, JSON.stringify(orders));
    }
  }
};

// ============================================================
// Swahili Language Toggle
// ============================================================
const SwahiliToggle = {
  KEY: 'buildcart_lang',
  currentLang: 'en',

  translations: {
    sw: {
      'Shop Materials': 'Nunua Vifaa',
      'Hire a Fundi': 'Pata Fundi',
      'Building Materials': 'Vifaa vya Ujenzi',
      'Browse our full catalog of quality construction materials': 'Angalia orodha yetu ya vifaa vya ujenzi vya ubora',
      'All Categories': 'Aina Zote',
      'All Brands': 'Chapa Zote',
      'Search': 'Tafuta',
      'Search products...': 'Tafuta bidhaa...',
      'Price Range (KES)': 'Kiwango cha Bei (KES)',
      'Apply': 'Tumia',
      'Sort By': 'Panga kwa',
      'Default': 'Chaguo-msingi',
      'Price: Low → High': 'Bei: Chini → Juu',
      'Price: High → Low': 'Bei: Juu → Chini',
      'Name A–Z': 'Jina A–Z',
      'Clear All Filters': 'Futa Vichujio Vyote',
      'Add to Cart': 'Ongeza kwenye Rukuli',
      'Proceed to Checkout': 'Endelea na Malipo',
      'Your Cart': 'Rukuli Yako',
      'Continue Shopping': 'Endelea Kununua',
      'Clear Cart': 'Futa Rukuli',
      'Subtotal': 'Jumla',
      'Delivery': 'Utoaji',
      'Total': 'Jumla Yote',
      'Place Order': 'Weka Order',
      'Full Name': 'Jina Kamili',
      'Phone Number': 'Nambari ya Simu',
      'Delivery Address': 'Anwani ya Utoaji',
      'Order Notes': 'Maelezo ya Order',
      'M-Pesa': 'M-Pesa',
      'Cash / M-Pesa on Delivery': 'Pesa / M-Pesa Unapopokea',
      'From Foundation to Finish, We\'ve Got You': 'Kutoka Msingi hadi Mwisho, Tuko nawe',
      'Nairobi Metro — Delivering in 1–3 Days': 'Nairobi Metro — Tunalieza ndani ya Siku 1–3',
      'Verified Suppliers': 'Wasambazaji Waliothibitishwa',
      'eTIMS Compliant': 'Ya kufuatilia eTIMS',
      'Vetted Fundis': 'Wafundi Walioangaziwa',
      'M-Pesa Payments': 'Malipo ya M-Pesa',
      'Nairobi Delivery': 'Utoaji Nairobi',
      'What Do You Need?': 'Unahitaji Nini?',
      'Everything for your build — from foundation to finish': 'Kila kitu kwa ujenzi wako — kutoka msingi hadi mwisho',
      'Popular Materials': 'Vifaa Maarufu',
      'Best sellers for Nairobi builders': 'Vinunuziwa zaidi kwa wajenzi wa Nairobi',
      'View All': 'Angalia Yote',
      'How BuildCart Works': 'BuildCart Inavyofanya Kazi',
      'Simple, trusted, convenient': 'Rahisi, ya kuaminika, rahisi',
      '1. Browse & Select': '1. Tafuta na Chagua',
      '2. Pay with M-Pesa': '2. Lipa kwa M-Pesa',
      '3. Build with Confidence': '3. Jenga kwa Uhakika',
      'Ready to Start Building?': 'Uko Tayari Kuanza Kujenga?',
      'Chat on WhatsApp': 'Ongea kwenye WhatsApp',
      'Order Summary': 'Muhtasari wa Order',
      'Shopping Cart': 'Rukuli',
      'Your cart is empty': 'Rukuli yako ni tupu',
      'Start adding building materials to get started': 'Anza kuongeza vifaa vya ujenzi',
      'Browse Materials': 'Angalia Vifaa',
      'Need Installation?': 'Unahitaji Usakinishaji?',
      'Find a Fundi': 'Pata Fundi',
      'Hire a Vetted Fundi': 'Ajiri Fundi Mwenye Uhakika',
      'Request a Quote': 'Omba Nukta ya Bei',
      'Submit Quote Request': 'Wasilisha Omba la Bei',
      'Chat Instead': 'Ongea Badala Yake',
      'Order Placed Successfully!': 'Order Imewekwa Kwa Mafanikio!',
      'Secure Checkout': 'Malipo Salama',
      'Delivery Details': 'Maelezo ya Utoaji',
      'Payment Method': 'Njia ya Malipo',
      'Secure checkout with M-Pesa': 'Malipo salama kwa M-Pesa',
      'Calculator': 'Kalkuleta',
      'Material Calculator': 'Kalkuleta ya Vifaa',
      'Calculate how much you need': 'Hesabu unachohitaji',
    },
  },

  init() {
    const saved = localStorage.getItem(this.KEY);
    if (saved) this.currentLang = saved;
    this.apply();
  },

  toggle() {
    this.currentLang = this.currentLang === 'en' ? 'sw' : 'en';
    localStorage.setItem(this.KEY, this.currentLang);
    this.apply();
  },

  apply() {
    if (this.currentLang === 'en') return;
    const t = this.translations.sw;
    document.querySelectorAll('h1, h2, h3, label, p, span, a, button, option, input[placeholder]').forEach(el => {
      const text = el.textContent?.trim();
      if (t[text]) el.textContent = t[text];
      if (el.placeholder && t[el.placeholder]) el.placeholder = t[el.placeholder];
    });
  },

  getLangButton() {
    const label = this.currentLang === 'en' ? '🇰🇪 SW' : '🇬🇧 EN';
    return `<button onclick="SwahiliToggle.toggle(); location.reload();" class="text-sm text-gray-200 hover:text-white font-medium px-3 py-1 rounded-lg border border-green-700 hover:border-green-500 transition">${label}</button>`;
  }
};

// Init on page load
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();
  SwahiliToggle.init();

  // If on materials page, populate dropdowns and render products
  if (document.getElementById('product-grid')) {
    populateFilterDropdowns();
    applyFilters();
  }
});