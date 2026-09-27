/**
 * PriceLister - Customer Portal Client Controller
 * Standalone catalog, real-time search, category filtering, and shopping cart engine.
 */

import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from './firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

let currentWorkspaceId = null;
let storeSettings = {};
let allProducts = [];
let filteredProducts = [];
let categoriesList = [];
let activeCategory = 'ALL';
let currentSearchQuery = '';
let cart = {}; // { productId: { product, quantity } }

// Helper for formatting currency
const formatPrice = (amount) => {
    const sym = (storeSettings.currencySymbol || '$').trim();
    const num = Number(amount) || 0;
    const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const separator = /^[A-Za-z]+$/.test(sym) ? ' ' : '';
    return `${sym}${separator}${formatted}`;
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Initialize Customer Portal
 */
export const initCustomerPortal = async () => {
    // 1. Resolve Workspace ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentWorkspaceId = urlParams.get('ws') || urlParams.get('workspace') || urlParams.get('id');

    if (!currentWorkspaceId) {
        renderNoWorkspaceState();
        return;
    }

    // Save for convenient return
    try {
        localStorage.setItem('pricelister_last_public_ws', currentWorkspaceId);
    } catch (e) {}

    // Load Cart from LocalStorage
    loadCartFromStorage();

    // 2. Fetch Store Settings & Verification
    try {
        await loadStoreSettings();
    } catch (err) {
        console.error("Error loading store settings:", err);
        renderErrorState("Could not connect to this store. Please check the URL or try again later.");
        return;
    }

    // 3. If Store is Suspended / Stopped -> Render Temporary Closed
    if (!storeSettings.enabled) {
        renderTemporaryClosedState();
        return;
    }

    // 4. Fetch Products & Categories
    try {
        await loadProductsAndCategories();
    } catch (err) {
        console.error("Error loading catalog:", err);
        renderErrorState("Failed to load catalog products.");
        return;
    }

    // 5. Render Main Customer Catalog
    renderCustomerCatalogUI();
};

/**
 * Load Store & Customer Panel Settings from Firestore
 */
const loadStoreSettings = async () => {
    const subColRef = collection(db, 'Workspaces', currentWorkspaceId, 'CustomerPanel');
    const panelRef = doc(db, 'CustomerPanelSettings', currentWorkspaceId);
    const wsRef = doc(db, 'Workspaces', currentWorkspaceId);
    const receiptRef = doc(db, 'ReceiptData', currentWorkspaceId);

    const [subColSnap, panelSnap, wsSnap, receiptSnap] = await Promise.all([
        getDocs(subColRef).catch(() => null),
        getDoc(panelRef).catch(() => null),
        getDoc(wsRef).catch(() => null),
        getDoc(receiptRef).catch(() => null)
    ]);

    let subfieldData = null;
    if (subColSnap && !subColSnap.empty) {
        subfieldData = subColSnap.docs[0].data();
    }

    const panelData = panelSnap && panelSnap.exists() ? panelSnap.data() : {};
    const wsData = wsSnap && wsSnap.exists() ? wsSnap.data() : {};
    const receiptData = receiptSnap && receiptSnap.exists() ? receiptSnap.data() : {};
    const embeddedData = wsData.customerPanel || receiptData.customerPanel || {};

    // Local storage cache fallback
    let localData = {};
    try {
        const raw = localStorage.getItem(`pricelister_customer_panel_${currentWorkspaceId}`);
        if (raw) localData = JSON.parse(raw) || {};
    } catch (e) {}

    const merged = { ...localData, ...embeddedData, ...panelData, ...(subfieldData || {}) };

    const isPublished = merged.isPublished !== undefined 
        ? Boolean(merged.isPublished) 
        : (merged.enabled !== undefined ? Boolean(merged.enabled) : (receiptData.customerPanelPublished !== undefined ? Boolean(receiptData.customerPanelPublished) : false));

    storeSettings = {
        enabled: isPublished,
        isPublished: isPublished,
        storeName: merged.storeName || wsData.name || receiptData["Shop Name"] || 'PriceLister Store',
        announcement: merged.announcement || 'Welcome! Browse our catalog and add items to your cart.',
        termsAndConditions: merged.termsAndConditions || '• Prices are subject to change without prior notice.\n• All orders are confirmed before dispatch.',
        categorySelectionMode: merged.categorySelectionMode || 'ALL',
        allowedCategories: Array.isArray(merged.allowedCategories) ? merged.allowedCategories : [],
        showMrp: merged.showMrp !== undefined ? Boolean(merged.showMrp) : true,
        showStockBadge: merged.showStockBadge !== undefined ? Boolean(merged.showStockBadge) : true,
        whatsappNumber: merged.whatsappNumber || wsData.phone || receiptData["Phone Number"] || '',
        phone: merged.phone || wsData.phone || receiptData["Phone Number"] || '',
        email: merged.email || wsData.email || '',
        address: merged.address || wsData.address || receiptData["Address / Subtitle"] || '',
        closedMessage: merged.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.',
        currencySymbol: merged.currencySymbol || wsData.currency || wsData.currencySymbol || receiptData["Currency"] || '$'
    };

    // Update Browser Document Title
    document.title = `${storeSettings.storeName} — Online Product Catalog`;
};

/**
 * Fetch Catalog Products & Extract Categories
 */
const loadProductsAndCategories = async () => {
    const productsRef = collection(db, `Workspaces/${currentWorkspaceId}/Products`);
    const querySnapshot = await getDocs(productsRef);

    const items = [];
    const catMap = new Map();

    querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isArchive) {
            const prd = { id: docSnap.id, ...data };
            items.push(prd);

            const catName = (prd.category || 'General').trim();
            catMap.set(catName, (catMap.get(catName) || 0) + 1);
        }
    });

    // Apply allowed category filter if admin specified specific categories
    if (storeSettings.categorySelectionMode === 'SPECIFIC' && storeSettings.allowedCategories.length > 0) {
        allProducts = items.filter(p => storeSettings.allowedCategories.includes(p.category));
    } else {
        allProducts = items;
    }

    // Build category list
    categoriesList = Array.from(catMap.keys()).map(name => ({
        name: name,
        count: catMap.get(name)
    }));

    filteredProducts = [...allProducts];
};

/**
 * LocalStorage Cart Management
 */
const loadCartFromStorage = () => {
    try {
        const raw = localStorage.getItem(`pricelister_customer_cart_${currentWorkspaceId}`);
        if (raw) {
            cart = JSON.parse(raw) || {};
        }
    } catch (e) {
        cart = {};
    }
};

const saveCartToStorage = () => {
    try {
        localStorage.setItem(`pricelister_customer_cart_${currentWorkspaceId}`, JSON.stringify(cart));
    } catch (e) {}
    updateCartHeaderBadge();
};

const getCartTotals = () => {
    let count = 0;
    let total = 0;

    Object.keys(cart).forEach(id => {
        const item = cart[id];
        const qty = item.quantity || 0;
        const price = Number(item.product.sellingPrice || item.product.price || 0);
        count += qty;
        total += (qty * price);
    });

    return { count, total };
};

/**
 * Render Main Catalog View
 */
const renderCustomerCatalogUI = () => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <!-- HEADER -->
        <header class="cp-header">
            <div class="cp-header-inner">
                <a href="javascript:void(0)" class="cp-brand" id="cp-brand-link">
                    <img src="pricelister_org.png" alt="Logo" class="cp-logo">
                    <div>
                        <div class="cp-store-name">${escapeHtml(storeSettings.storeName)}</div>
                        <div class="cp-store-tagline">Live Product Catalog</div>
                    </div>
                </a>

                <!-- Search Input -->
                <div class="cp-search-wrapper">
                    <span class="cp-search-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input type="text" id="cp-search-input" class="cp-search-input" placeholder="Search products, size, description, barcode..." autocomplete="off">
                    <button type="button" id="cp-clear-search-btn" class="cp-clear-search" title="Clear">✕</button>
                </div>

                <!-- Shopping Cart Trigger Button -->
                <button type="button" id="cp-open-cart-btn" class="cp-cart-btn" title="View your shopping cart">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    <span>Cart</span>
                    <span id="cp-header-cart-count" class="cp-cart-count-badge">0</span>
                    <span id="cp-header-cart-total" class="cp-cart-total-text">$0.00</span>
                </button>
            </div>
        </header>

        <!-- ANNOUNCEMENT BANNER -->
        ${storeSettings.announcement ? `
            <div class="cp-announcement-bar">
                <div class="cp-announcement-inner">
                    <div class="cp-announcement-text">
                        <span>📢</span>
                        <span>${escapeHtml(storeSettings.announcement)}</span>
                    </div>
                    ${storeSettings.termsAndConditions ? `
                        <button type="button" id="cp-open-terms-btn" class="cp-terms-btn">Terms & Conditions</button>
                    ` : ''}
                </div>
            </div>
        ` : ''}

        <!-- CATEGORY HORIZONTAL FILTER -->
        <div class="cp-filter-bar-container">
            <div class="cp-filter-bar" id="cp-filter-bar">
                <button type="button" class="cp-cat-chip active" data-category="ALL">
                    All Items (${allProducts.length})
                </button>
                ${categoriesList.map(cat => `
                    <button type="button" class="cp-cat-chip" data-category="${escapeHtml(cat.name)}">
                        ${escapeHtml(cat.name)} (${cat.count})
                    </button>
                `).join('')}
            </div>
        </div>

        <!-- MAIN CATALOG CONTENT -->
        <main class="cp-main-container">
            <div class="cp-catalog-header">
                <div>
                    <h1 class="cp-catalog-title" id="cp-section-title">All Products</h1>
                </div>
                <div class="cp-product-count-label" id="cp-count-label">
                    Showing ${filteredProducts.length} items
                </div>
            </div>

            <!-- Product Cards Grid -->
            <div class="cp-products-grid" id="cp-products-grid">
                <!-- Injected dynamically -->
            </div>
        </main>

        <!-- SLIDE-OUT CART DRAWER -->
        <div class="cp-cart-overlay" id="cp-cart-overlay">
            <div class="cp-cart-drawer">
                <div class="cp-cart-header">
                    <div class="cp-cart-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        <span>Your Shopping Cart</span>
                    </div>
                    <button type="button" id="cp-close-cart-btn" class="cp-cart-close-btn" title="Close cart">✕</button>
                </div>

                <div class="cp-cart-body" id="cp-cart-items-list">
                    <!-- Items rendered dynamically -->
                </div>

                <div class="cp-cart-footer">
                    <div class="cp-cart-summary-row">
                        <span>Total Items</span>
                        <strong id="cp-drawer-items-count">0 items</strong>
                    </div>
                    <div class="cp-cart-total-row">
                        <span>Total Amount</span>
                        <span id="cp-drawer-grand-total" style="color:var(--primary);">$0.00</span>
                    </div>

                    <!-- Customer Order Details (Optional for direct inquiry) -->
                    <div style="margin-bottom:0.85rem; display:flex; flex-direction:column; gap:0.4rem;">
                        <input type="text" id="cp-order-customer-name" placeholder="Your Name (Optional)" class="cp-search-input" style="height:34px; font-size:0.82rem; padding:0 0.75rem;">
                        <input type="text" id="cp-order-customer-address" placeholder="Delivery Address / Notes (Optional)" class="cp-search-input" style="height:34px; font-size:0.82rem; padding:0 0.75rem;">
                    </div>

                    <div class="cp-cart-actions">
                        ${storeSettings.whatsappNumber ? `
                            <button type="button" id="cp-btn-order-whatsapp" class="cp-btn-whatsapp-order" title="Send order via WhatsApp">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>
                                Send Order via WhatsApp
                            </button>
                        ` : ''}
                        
                        <button type="button" id="cp-btn-print-slip" class="cp-btn-print-order" title="Download or print order slip">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print / Download Order Slip
                        </button>
                    </div>

                    <button type="button" id="cp-btn-clear-cart" class="cp-btn-clear-cart">Clear Shopping Cart</button>
                </div>
            </div>
        </div>

        <!-- PRODUCT QUICK VIEW MODAL CONTAINER -->
        <div id="cp-quickview-modal-container"></div>

        <!-- TERMS & CONDITIONS MODAL CONTAINER -->
        <div id="cp-terms-modal-container"></div>
    `;

    // Attach Event Listeners
    setupCatalogEventListeners();

    // Render Initial Product Cards & Cart state
    renderProductCardsGrid();
    updateCartHeaderBadge();
};

/**
 * Render Product Cards in Grid
 */
const renderProductCardsGrid = () => {
    const grid = document.getElementById('cp-products-grid');
    const countLabel = document.getElementById('cp-count-label');
    if (!grid) return;

    if (countLabel) {
        countLabel.textContent = `Showing ${filteredProducts.length} items`;
    }

    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background:#ffffff; border-radius:12px; border:1px solid var(--border-color);">
                <div style="font-size:2.5rem; margin-bottom:0.75rem;">📦</div>
                <h3 style="color:var(--text-primary); margin-bottom:0.35rem;">No Products Found</h3>
                <p style="color:var(--text-secondary); font-size:0.9rem;">Try adjusting your search or category filter.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredProducts.map(p => {
        const inCartQty = cart[p.id] ? cart[p.id].quantity : 0;
        const sellingPrice = Number(p.sellingPrice || p.price || 0);
        const mrp = Number(p.mrp || p.wholesalePrice || 0);
        const hasDiscount = storeSettings.showMrp && mrp > sellingPrice;
        const discountPct = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

        const isOutOfStock = typeof p.stock === 'number' && p.stock <= 0;
        const stockHtml = storeSettings.showStockBadge 
            ? `<div class="cp-card-stock-badge ${isOutOfStock ? 'cp-stock-out' : 'cp-stock-in'}">${isOutOfStock ? 'Out of Stock' : (typeof p.stock === 'number' ? `${p.stock} in stock` : 'In Stock')}</div>`
            : '';

        return `
            <div class="cp-product-card" data-id="${p.id}">
                ${hasDiscount ? `<div class="cp-card-badge-top cp-badge-discount">${discountPct}% OFF</div>` : ''}
                
                <div class="cp-card-image-wrap" onclick="window.cpOpenQuickView('${p.id}')">
                    ${p.imageUrl ? `
                        <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="cp-card-img" loading="lazy" onerror="this.src='pricelister_org.png';">
                    ` : `
                        <div class="cp-card-img-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>
                        </div>
                    `}
                </div>

                <div class="cp-card-body">
                    <div class="cp-card-meta-row">
                        <span class="cp-card-category">${escapeHtml(p.category || 'General')}</span>
                        ${p.size ? `<span class="cp-card-size">${escapeHtml(p.size)}</span>` : ''}
                    </div>

                    <h3 class="cp-card-title" onclick="window.cpOpenQuickView('${p.id}')" title="${escapeHtml(p.name)}">
                        ${escapeHtml(p.name)}
                    </h3>

                    ${p.description ? `
                        <p class="cp-card-description">${escapeHtml(p.description)}</p>
                    ` : ''}

                    <div class="cp-card-price-row">
                        <span class="cp-card-selling-price">${formatPrice(sellingPrice)}</span>
                        ${hasDiscount ? `<span class="cp-card-mrp">${formatPrice(mrp)}</span>` : ''}
                    </div>

                    ${stockHtml}

                    <!-- Action Button / Stepper -->
                    <div class="cp-card-action-container" id="card-action-${p.id}">
                        ${inCartQty > 0 ? `
                            <div class="cp-stepper-wrap">
                                <button type="button" class="cp-stepper-btn" onclick="window.cpUpdateQty('${p.id}', -1)">−</button>
                                <span class="cp-stepper-qty">${inCartQty}</span>
                                <button type="button" class="cp-stepper-btn" onclick="window.cpUpdateQty('${p.id}', 1)">+</button>
                            </div>
                        ` : `
                            <button type="button" class="cp-btn-add-cart" onclick="window.cpAddToCart('${p.id}')" ${isOutOfStock ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                Add to Cart
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Filter & Search Products
 */
const applyFilters = () => {
    const q = currentSearchQuery.trim().toLowerCase();

    filteredProducts = allProducts.filter(p => {
        // Category check
        if (activeCategory !== 'ALL' && p.category !== activeCategory) {
            return false;
        }

        // Search text check
        if (q) {
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const sizeMatch = (p.size || '').toLowerCase().includes(q);
            const descMatch = (p.description || '').toLowerCase().includes(q);
            const barcodeMatch = (p.barcode || p.sku || '').toLowerCase().includes(q);
            const catMatch = (p.category || '').toLowerCase().includes(q);
            return nameMatch || sizeMatch || descMatch || barcodeMatch || catMatch;
        }

        return true;
    });

    renderProductCardsGrid();
};

/**
 * Cart Operations (Attached to window for inline onclicks)
 */
window.cpAddToCart = (productId) => {
    const prd = allProducts.find(p => p.id === productId);
    if (!prd) return;

    if (!cart[productId]) {
        cart[productId] = {
            product: prd,
            quantity: 1
        };
    } else {
        cart[productId].quantity += 1;
    }

    saveCartToStorage();
    renderProductCardsGrid();
    renderCartDrawerList();
};

window.cpUpdateQty = (productId, delta) => {
    if (!cart[productId]) return;

    cart[productId].quantity += delta;
    if (cart[productId].quantity <= 0) {
        delete cart[productId];
    }

    saveCartToStorage();
    renderProductCardsGrid();
    renderCartDrawerList();
};

window.cpRemoveFromCart = (productId) => {
    if (cart[productId]) {
        delete cart[productId];
        saveCartToStorage();
        renderProductCardsGrid();
        renderCartDrawerList();
    }
};

/**
 * Update Header Cart Count & Price Badge
 */
const updateCartHeaderBadge = () => {
    const badge = document.getElementById('cp-header-cart-count');
    const totalEl = document.getElementById('cp-header-cart-total');
    const { count, total } = getCartTotals();

    if (badge) badge.textContent = count;
    if (totalEl) totalEl.textContent = formatPrice(total);
};

/**
 * Render Cart Items inside Drawer
 */
const renderCartDrawerList = () => {
    const list = document.getElementById('cp-cart-items-list');
    const itemsCountEl = document.getElementById('cp-drawer-items-count');
    const grandTotalEl = document.getElementById('cp-drawer-grand-total');
    if (!list) return;

    const items = Object.values(cart);
    const { count, total } = getCartTotals();

    if (itemsCountEl) itemsCountEl.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(total);

    if (items.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color:var(--text-muted);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛒</div>
                <div style="font-weight:600; font-size:1rem; color:var(--text-primary); margin-bottom:0.25rem;">Your Cart is Empty</div>
                <p style="font-size:0.85rem;">Browse the catalog and add products to calculate your total.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = items.map(item => {
        const p = item.product;
        const qty = item.quantity;
        const price = Number(p.sellingPrice || p.price || 0);
        const subtotal = qty * price;

        return `
            <div class="cp-cart-item">
                <img src="${p.imageUrl ? escapeHtml(p.imageUrl) : 'pricelister_org.png'}" alt="${escapeHtml(p.name)}" class="cp-cart-item-img" onerror="this.src='pricelister_org.png';">
                
                <div class="cp-cart-item-info">
                    <div class="cp-cart-item-title">${escapeHtml(p.name)}</div>
                    <div class="cp-cart-item-price">${formatPrice(price)} each ${p.size ? `• ${escapeHtml(p.size)}` : ''}</div>
                    <div class="cp-cart-item-subtotal">${formatPrice(subtotal)}</div>
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <div class="cp-stepper-wrap" style="width:84px; height:30px;">
                        <button type="button" class="cp-stepper-btn" style="width:24px; height:24px;" onclick="window.cpUpdateQty('${p.id}', -1)">−</button>
                        <span class="cp-stepper-qty" style="font-size:0.8rem;">${qty}</span>
                        <button type="button" class="cp-stepper-btn" style="width:24px; height:24px;" onclick="window.cpUpdateQty('${p.id}', 1)">+</button>
                    </div>

                    <button type="button" class="cp-cart-item-delete" onclick="window.cpRemoveFromCart('${p.id}')" title="Remove item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Event Listeners Setup
 */
const setupCatalogEventListeners = () => {
    // Search input
    const searchInput = document.getElementById('cp-search-input');
    const clearSearchBtn = document.getElementById('cp-clear-search-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            if (clearSearchBtn) clearSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
            applyFilters();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                currentSearchQuery = '';
                clearSearchBtn.style.display = 'none';
                applyFilters();
                searchInput.focus();
            }
        });
    }

    // Category chips
    document.querySelectorAll('.cp-cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cp-cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            activeCategory = chip.getAttribute('data-category') || 'ALL';
            const titleEl = document.getElementById('cp-section-title');
            if (titleEl) {
                titleEl.textContent = activeCategory === 'ALL' ? 'All Products' : activeCategory;
            }

            applyFilters();
        });
    });

    // Cart Drawer Open/Close
    const cartOverlay = document.getElementById('cp-cart-overlay');
    const openCartBtn = document.getElementById('cp-open-cart-btn');
    const closeCartBtn = document.getElementById('cp-close-cart-btn');

    if (openCartBtn && cartOverlay) {
        openCartBtn.addEventListener('click', () => {
            renderCartDrawerList();
            cartOverlay.classList.add('open');
        });
    }

    if (closeCartBtn && cartOverlay) {
        closeCartBtn.addEventListener('click', () => {
            cartOverlay.classList.remove('open');
        });
    }

    if (cartOverlay) {
        cartOverlay.addEventListener('click', (e) => {
            if (e.target === cartOverlay) {
                cartOverlay.classList.remove('open');
            }
        });
    }

    // Clear Cart
    const clearCartBtn = document.getElementById('cp-btn-clear-cart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (Object.keys(cart).length === 0) return;
            if (confirm("Are you sure you want to clear your shopping cart?")) {
                cart = {};
                saveCartToStorage();
                renderProductCardsGrid();
                renderCartDrawerList();
            }
        });
    }

    // WhatsApp Order Dispatcher
    const btnWhatsapp = document.getElementById('cp-btn-order-whatsapp');
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
            const items = Object.values(cart);
            if (items.length === 0) {
                alert("Your cart is empty! Please add some items before sending an order.");
                return;
            }

            const custName = document.getElementById('cp-order-customer-name')?.value?.trim() || 'Customer';
            const custAddress = document.getElementById('cp-order-customer-address')?.value?.trim() || '';
            const { total } = getCartTotals();

            let msg = `🛒 *New Order from ${custName}*\n`;
            msg += `Store: *${storeSettings.storeName}*\n`;
            msg += `----------------------------------------\n`;

            items.forEach((item, index) => {
                const p = item.product;
                const price = formatPrice(p.sellingPrice || p.price || 0);
                const lineTotal = formatPrice(item.quantity * (p.sellingPrice || p.price || 0));
                msg += `${index + 1}. *${p.name}* ${p.size ? `(${p.size})` : ''}\n`;
                msg += `   Qty: ${item.quantity} × ${price} = *${lineTotal}*\n`;
            });

            msg += `----------------------------------------\n`;
            msg += `💰 *Grand Total: ${formatPrice(total)}*\n`;
            if (custAddress) {
                msg += `📍 *Delivery / Notes:* ${custAddress}\n`;
            }
            msg += `\n_Generated via PriceLister Customer Portal_`;

            // Clean phone number for WhatsApp
            let cleanPhone = storeSettings.whatsappNumber.replace(/[^0-9]/g, '');
            if (!cleanPhone.startsWith('880') && cleanPhone.startsWith('01')) {
                cleanPhone = '88' + cleanPhone;
            }

            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        });
    }

    // Print Order Slip
    const btnPrint = document.getElementById('cp-btn-print-slip');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            const items = Object.values(cart);
            if (items.length === 0) {
                alert("Your cart is empty! Add products to print an order slip.");
                return;
            }
            printOrderSlip();
        });
    }

    // Terms & Conditions Modal
    const btnTerms = document.getElementById('cp-open-terms-btn');
    if (btnTerms) {
        btnTerms.addEventListener('click', () => {
            openTermsModal();
        });
    }
};

/**
 * Print Order Slip
 */
const printOrderSlip = () => {
    const items = Object.values(cart);
    const { count, total } = getCartTotals();
    const custName = document.getElementById('cp-order-customer-name')?.value?.trim() || 'General Customer';
    const custAddress = document.getElementById('cp-order-customer-address')?.value?.trim() || 'Direct Inquiry';
    const orderDate = new Date().toLocaleString();

    const printWin = window.open('', '_blank', 'width=700,height=800');
    if (!printWin) return;

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Slip — ${escapeHtml(storeSettings.storeName)}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 2rem; color: #1e293b; max-width: 650px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
                .store-title { font-size: 1.6rem; font-weight: bold; margin: 0; color: #0f172a; }
                .meta { font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; }
                .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1.5rem; font-size: 0.9rem; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
                th { text-align: left; padding: 0.65rem; border-bottom: 2px solid #cbd5e1; font-size: 0.85rem; text-transform: uppercase; color: #475569; }
                td { padding: 0.65rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
                .text-right { text-align: right; }
                .total-row { font-size: 1.15rem; font-weight: bold; border-top: 2px solid #0f172a; }
                .footer { text-align: center; font-size: 0.8rem; color: #94a3b8; margin-top: 2rem; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="store-title">${escapeHtml(storeSettings.storeName)}</h1>
                <div class="meta">Customer Order Slip & Estimate</div>
                <div class="meta">${escapeHtml(orderDate)}</div>
            </div>

            <div class="info-box">
                <div><strong>Customer:</strong> ${escapeHtml(custName)}</div>
                ${custAddress ? `<div><strong>Delivery Address / Notes:</strong> ${escapeHtml(custAddress)}</div>` : ''}
                ${storeSettings.phone ? `<div><strong>Store Contact:</strong> ${escapeHtml(storeSettings.phone)}</div>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-right">Price</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const p = item.product;
                        const price = Number(p.sellingPrice || p.price || 0);
                        return `
                            <tr>
                                <td><strong>${escapeHtml(p.name)}</strong> ${p.size ? `(${escapeHtml(p.size)})` : ''}</td>
                                <td class="text-right">${formatPrice(price)}</td>
                                <td class="text-right">${item.quantity}</td>
                                <td class="text-right">${formatPrice(item.quantity * price)}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="total-row">
                        <td colspan="3" class="text-right">Grand Total:</td>
                        <td class="text-right">${formatPrice(total)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                Thank you for your business! • Powered by PriceLister
            </div>
            <script>
                window.onload = function() { window.print(); };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
};

/**
 * Open Product Quick View Modal
 */
window.cpOpenQuickView = (productId) => {
    const p = allProducts.find(item => item.id === productId);
    if (!p) return;

    const modalContainer = document.getElementById('cp-quickview-modal-container');
    if (!modalContainer) return;

    const sellingPrice = Number(p.sellingPrice || p.price || 0);
    const mrp = Number(p.mrp || p.wholesalePrice || 0);
    const hasDiscount = storeSettings.showMrp && mrp > sellingPrice;
    const discountPct = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
    const inCartQty = cart[p.id] ? cart[p.id].quantity : 0;

    modalContainer.innerHTML = `
        <div class="cp-modal-overlay" id="cp-qv-overlay">
            <div class="cp-modal-card">
                <div class="cp-modal-header">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:700;">${escapeHtml(p.name)}</h3>
                    <button type="button" class="cp-cart-close-btn" onclick="document.getElementById('cp-qv-overlay').remove()">✕</button>
                </div>
                <div class="cp-modal-body">
                    <div class="cp-qv-grid">
                        <div>
                            <img src="${p.imageUrl ? escapeHtml(p.imageUrl) : 'pricelister_org.png'}" alt="${escapeHtml(p.name)}" class="cp-qv-img" onerror="this.src='pricelister_org.png';">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.6rem;">
                            <div style="display:flex; gap:0.4rem; align-items:center;">
                                <span class="cp-card-category">${escapeHtml(p.category || 'General')}</span>
                                ${p.size ? `<span class="cp-card-size">${escapeHtml(p.size)}</span>` : ''}
                            </div>

                            <div style="display:flex; align-items:baseline; gap:0.6rem;">
                                <span style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${formatPrice(sellingPrice)}</span>
                                ${hasDiscount ? `<span class="cp-card-mrp" style="font-size:0.95rem;">${formatPrice(mrp)}</span>` : ''}
                                ${hasDiscount ? `<span class="cp-badge-discount" style="font-size:0.75rem; padding:0.15rem 0.45rem; border-radius:4px;">${discountPct}% OFF</span>` : ''}
                            </div>

                            ${p.barcode || p.sku ? `
                                <div style="font-size:0.8rem; color:var(--text-muted); font-family:monospace;">
                                    SKU / Barcode: ${escapeHtml(p.barcode || p.sku)}
                                </div>
                            ` : ''}

                            ${p.description ? `
                                <div style="margin-top:0.5rem; font-size:0.88rem; color:var(--text-secondary); line-height:1.5;">
                                    <strong>Description:</strong><br>
                                    ${escapeHtml(p.description)}
                                </div>
                            ` : ''}

                            <div style="margin-top:auto; padding-top:1rem;">
                                <button type="button" class="cp-btn-add-cart" style="height:42px; font-size:0.95rem;" onclick="window.cpAddToCart('${p.id}'); document.getElementById('cp-qv-overlay').remove();">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                    ${inCartQty > 0 ? `Add Another (${inCartQty} in cart)` : 'Add to Shopping Cart'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('cp-qv-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'cp-qv-overlay') {
            e.target.remove();
        }
    });
};

/**
 * Open Terms Modal
 */
const openTermsModal = () => {
    const modalContainer = document.getElementById('cp-terms-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="cp-modal-overlay" id="cp-terms-overlay">
            <div class="cp-modal-card" style="max-width:500px;">
                <div class="cp-modal-header">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:700;">Terms & Ordering Policies</h3>
                    <button type="button" class="cp-cart-close-btn" onclick="document.getElementById('cp-terms-overlay').remove()">✕</button>
                </div>
                <div class="cp-modal-body">
                    <div style="font-size:0.92rem; color:var(--text-secondary); line-height:1.6; white-space:pre-line;">
                        ${escapeHtml(storeSettings.termsAndConditions)}
                    </div>
                    ${storeSettings.phone || storeSettings.email ? `
                        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-color); font-size:0.85rem; color:var(--text-muted);">
                            ${storeSettings.phone ? `<div>📞 Phone: ${escapeHtml(storeSettings.phone)}</div>` : ''}
                            ${storeSettings.email ? `<div>✉️ Email: ${escapeHtml(storeSettings.email)}</div>` : ''}
                            ${storeSettings.address ? `<div>📍 Address: ${escapeHtml(storeSettings.address)}</div>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.getElementById('cp-terms-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'cp-terms-overlay') {
            e.target.remove();
        }
    });
};

/**
 * Temporary Closed State
 */
const renderTemporaryClosedState = () => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <div class="cp-closed-container">
            <div class="cp-closed-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </div>
            
            <div style="font-size:0.85rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; margin-bottom:0.25rem;">
                ${escapeHtml(storeSettings.storeName)}
            </div>

            <h1 class="cp-closed-title">Temporary Closed</h1>
            
            <div class="cp-closed-message">
                ${escapeHtml(storeSettings.closedMessage || 'Shop Temporary appended / suspended. May start early.')}
            </div>

            ${storeSettings.phone || storeSettings.email || storeSettings.address ? `
                <div class="cp-closed-contact-box">
                    <strong style="color:var(--text-primary); display:block; margin-bottom:0.35rem;">Store Contact Info:</strong>
                    ${storeSettings.phone ? `<div>📞 <strong>Phone:</strong> ${escapeHtml(storeSettings.phone)}</div>` : ''}
                    ${storeSettings.whatsappNumber ? `<div>💬 <strong>WhatsApp:</strong> ${escapeHtml(storeSettings.whatsappNumber)}</div>` : ''}
                    ${storeSettings.email ? `<div>✉️ <strong>Email:</strong> ${escapeHtml(storeSettings.email)}</div>` : ''}
                    ${storeSettings.address ? `<div>📍 <strong>Address:</strong> ${escapeHtml(storeSettings.address)}</div>` : ''}
                </div>
            ` : ''}

            <div style="margin-top:1.5rem; font-size:0.75rem; color:var(--text-muted);">
                Powered by PriceLister
            </div>
        </div>
    `;
};

/**
 * Missing / Invalid Workspace
 */
const renderNoWorkspaceState = () => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <div class="cp-closed-container" style="margin-top:12vh;">
            <div style="font-size:3rem; margin-bottom:1rem;">🏪</div>
            <h1 class="cp-closed-title">Store Link Required</h1>
            <p class="cp-closed-message">
                Please open the Customer Panel using a valid shareable link provided by the store admin (e.g. <code>customer.html?ws=YOUR_STORE_ID</code>).
            </p>
        </div>
    `;
};

/**
 * Error State
 */
const renderErrorState = (msg) => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <div class="cp-closed-container" style="margin-top:12vh;">
            <div style="font-size:3rem; margin-bottom:1rem;">⚠️</div>
            <h1 class="cp-closed-title">Notice</h1>
            <p class="cp-closed-message">${escapeHtml(msg)}</p>
        </div>
    `;
};
