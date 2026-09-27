/**
 * PriceLister - Customer Portal Client Controller
 * Standalone catalog, real-time search, category filtering, and shopping cart engine.
 */

import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../firebase/firebase-config.js';
import { getProductService } from './services/productService.js';
import { getCategoryService } from './services/categoryService.js';
import { getOrderService } from './services/orderService.js';

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
    try {
        // 1. Resolve Workspace ID or Custom Slug from URL or Storage
        const urlParams = new URLSearchParams(window.location.search);
        currentWorkspaceId = urlParams.get('ws') || urlParams.get('workspace') || urlParams.get('id');
        const customSlugParam = urlParams.get('shop') || urlParams.get('slug');

        if (!currentWorkspaceId && customSlugParam) {
            // Check known local workspace mapping
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('pricelister_customer_panel_')) {
                        const raw = localStorage.getItem(key);
                        if (raw && raw.includes(`"customSlug":"${customSlugParam.toLowerCase()}"`)) {
                            currentWorkspaceId = key.replace('pricelister_customer_panel_', '');
                            break;
                        }
                    }
                }
            } catch (e) {}
        }

        if (!currentWorkspaceId) {
            try {
                currentWorkspaceId = localStorage.getItem('pricelister_last_public_ws') || 
                                     localStorage.getItem('pricelister_active_workspace_id') ||
                                     localStorage.getItem('pricelister_last_workspace_id');
            } catch (e) {}
        }

        // Seamless fallback to demo/mock sandbox if accessed standalone
        if (!currentWorkspaceId) {
            currentWorkspaceId = 'ws_dev_mock';
        }

        // Save for convenient return
        try {
            localStorage.setItem('pricelister_last_public_ws', currentWorkspaceId);
        } catch (e) {}

        // Load Cart from LocalStorage
        loadCartFromStorage();

        // 2. Fetch Store Settings with Timeout Protection
        try {
            await loadStoreSettings();
        } catch (err) {
            console.warn("Could not load remote store settings, using fallback:", err);
        }

        // 3. If Store is explicitly Suspended / Stopped -> Render Temporary Closed
        if (storeSettings.enabled === false && storeSettings.isPublished === false) {
            renderTemporaryClosedState();
            return;
        }

        // 4. Fetch Products & Categories
        try {
            await loadProductsAndCategories();
        } catch (err) {
            console.warn("Could not load products:", err);
            allProducts = [];
            filteredProducts = [];
            categoriesList = [];
        }

        // 5. Render Main Customer Catalog
        renderCustomerCatalogUI();
    } catch (fatalErr) {
        console.error("Customer Portal Init Error:", fatalErr);
        renderErrorState("Could not load storefront. Please refresh the page or verify the store link.");
    }
};

/**
 * Load Store & Customer Panel Settings from Firestore with Timeout Protection
 */
const loadStoreSettings = async () => {
    // 3.5s timeout promise so page never hangs indefinitely
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 3500));

    const fetchPromise = (async () => {
        try {
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

            return { subfieldData, panelData, wsData, receiptData, embeddedData };
        } catch (e) {
            console.warn("Remote settings fetch warning:", e);
            return {};
        }
    })();

    const remoteResult = await Promise.race([fetchPromise, timeoutPromise]);
    const { subfieldData = null, panelData = {}, wsData = {}, receiptData = {}, embeddedData = {} } = (remoteResult && typeof remoteResult === 'object') ? remoteResult : {};

    // Local storage cache fallback
    let localData = {};
    try {
        const raw = localStorage.getItem(`pricelister_customer_panel_${currentWorkspaceId}`);
        if (raw) localData = JSON.parse(raw) || {};
    } catch (e) {}

    const merged = { ...localData, ...embeddedData, ...panelData, ...(subfieldData || {}) };

    // Default to true if not explicitly set to false, or check published fields
    let isPublished = true;
    if (merged.isPublished !== undefined) {
        isPublished = Boolean(merged.isPublished);
    } else if (merged.enabled !== undefined) {
        isPublished = Boolean(merged.enabled);
    } else if (receiptData.customerPanelPublished !== undefined) {
        isPublished = Boolean(receiptData.customerPanelPublished);
    }

    const defaultAnnouncements = [
        'Welcome! Browse our catalog and add items to your cart.',
        'Welcome to our online demo catalog! Browse items and calculate total or place orders.',
        'Welcome to our online catalog! Browse items and add to cart to calculate total or order directly.',
        'Welcome to our online catalog!'
    ];
    const cleanAnnouncement = (merged.announcement && merged.announcement.trim() !== '' && !defaultAnnouncements.includes(merged.announcement.trim())) 
        ? merged.announcement.trim() 
        : '';

    storeSettings = {
        enabled: isPublished,
        isPublished: isPublished,
        brandingMode: merged.brandingMode || 'PRICELISTER',
        storeName: merged.storeName || wsData.name || receiptData["Shop Name"] || 'PriceLister Store',
        storeLogo: merged.storeLogo || '',
        workspaceLogo: merged.workspaceLogo || wsData.logoUrl || wsData.imageUri || receiptData["Logo Url"] || '',
        customSlug: merged.customSlug || '',
        deployCountry: merged.deployCountry || 'Global',
        announcement: cleanAnnouncement,
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
    try {
        const prodService = getProductService(currentWorkspaceId);
        const catService = getCategoryService(currentWorkspaceId);

        let [itemsRaw, categoriesRaw] = await Promise.all([
            prodService.getAllActiveProducts().catch(() => []),
            catService.getAllCategories().catch(() => [])
        ]);

        // Fallback to direct collection query if service returned empty and workspace is remote
        if ((!itemsRaw || itemsRaw.length === 0) && currentWorkspaceId !== 'ws_dev_mock') {
            try {
                const productsRef = collection(db, `Workspaces/${currentWorkspaceId}/Products`);
                const querySnapshot = await getDocs(productsRef);
                itemsRaw = [];
                querySnapshot.forEach(docSnap => {
                    const d = docSnap.data();
                    if (!d.isArchive) itemsRaw.push({ id: docSnap.id, ...d });
                });
            } catch (e) {
                console.warn("Direct Firestore fallback error:", e);
            }
        }

        const items = [];
        const catMap = new Map();

        (itemsRaw || []).forEach(data => {
            if (!data.isArchive) {
                const resolvedSellingPrice = Number(
                    data.salePrice !== undefined ? data.salePrice : 
                    (data.sellingPrice !== undefined ? data.sellingPrice : (data.price || 0))
                );

                const resolvedStock = Number(
                    data.quantity !== undefined ? data.quantity : (data.stock !== undefined ? data.stock : 0)
                );

                let catName = data.category || 'General';
                if (categoriesRaw && Array.isArray(categoriesRaw)) {
                    const match = categoriesRaw.find(c => c.uniqueId === catName || c.id === catName || c.name === catName);
                    if (match) catName = match.name;
                }

                const prd = {
                    id: data.id || data.uniqueId,
                    uniqueId: data.uniqueId || data.id,
                    ...data,
                    name: data.name || 'Unnamed Product',
                    category: String(catName || 'General').trim(),
                    size: data.size || data.sizeWeight || '',
                    sizeWeight: data.sizeWeight || data.size || '',
                    sellingPrice: resolvedSellingPrice,
                    salePrice: resolvedSellingPrice,
                    price: resolvedSellingPrice,
                    mrp: Number(data.mrp || 0),
                    stock: resolvedStock,
                    quantity: resolvedStock,
                    imageUrl: data.imageUri || data.imageUrl || '',
                    imageUri: data.imageUri || data.imageUrl || '',
                    description: data.note || data.description || '',
                    note: data.note || data.description || '',
                    barcode: data.upcCode || data.barcode || data.sku || '',
                    upcCode: data.upcCode || data.barcode || data.sku || '',
                    variations: Array.isArray(data.variations) ? data.variations : []
                };
                items.push(prd);

                catMap.set(prd.category, (catMap.get(prd.category) || 0) + 1);
            }
        });

        // Apply allowed category filter if admin specified specific categories
        if (storeSettings.categorySelectionMode === 'SPECIFIC' && Array.isArray(storeSettings.allowedCategories) && storeSettings.allowedCategories.length > 0) {
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
    } catch (err) {
        console.warn("Could not load products:", err);
        allProducts = [];
        filteredProducts = [];
        categoriesList = [];
    }
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
        const price = Number(item.product.sellingPrice || item.product.salePrice || item.product.price || 0);
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

    const brandLogoSrc = (storeSettings.brandingMode === 'CUSTOM' && storeSettings.storeLogo)
        ? storeSettings.storeLogo
        : ((storeSettings.brandingMode === 'WORKSPACE' && storeSettings.workspaceLogo) ? storeSettings.workspaceLogo : 'pricelister_org.png');

    const brandTagline = storeSettings.brandingMode === 'PRICELISTER' 
        ? 'Verified PriceLister Catalog'
        : (storeSettings.brandingMode === 'WORKSPACE' ? 'Enterprise Storefront' : 'Online Storefront');

    app.innerHTML = `
        <!-- HEADER -->
        <header class="cp-header">
            <div class="cp-header-inner">
                <a href="javascript:void(0)" class="cp-brand" id="cp-brand-link">
                    <div style="width:40px; height:40px; border-radius:10px; overflow:hidden; background:var(--surface-100); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--border-color); box-shadow:0 2px 6px rgba(0,0,0,0.06);">
                        <img src="${escapeHtml(brandLogoSrc)}" alt="Logo" class="cp-logo" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='pricelister_org.png';">
                    </div>
                    <div>
                        <div class="cp-store-name">${escapeHtml(storeSettings.storeName)}</div>
                        <div class="cp-store-tagline">${escapeHtml(brandTagline)}</div>
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary); flex-shrink:0;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
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

                    <!-- CUSTOMER CHECKOUT ORDER FORM -->
                    <div style="margin:0.85rem 0; background:var(--surface-50); border:1px solid var(--border-color); border-radius:10px; padding:0.85rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Customer Delivery Information</span>
                        
                        <div>
                            <input type="text" id="cp-checkout-name" placeholder="Full Name *" required class="form-control" style="height:36px; font-size:0.85rem; padding:0 0.75rem;">
                        </div>
                        <div>
                            <input type="tel" id="cp-checkout-phone" placeholder="Phone Number (e.g. 01700000000) *" required class="form-control" style="height:36px; font-size:0.85rem; padding:0 0.75rem;">
                        </div>
                        <div>
                            <input type="text" id="cp-checkout-address" placeholder="Delivery Address / City *" required class="form-control" style="height:36px; font-size:0.85rem; padding:0 0.75rem;">
                        </div>
                        <div>
                            <input type="text" id="cp-checkout-note" placeholder="Order Note / Landmark (Optional)" class="form-control" style="height:34px; font-size:0.82rem; padding:0 0.75rem;">
                        </div>
                    </div>

                    <div class="cp-cart-actions" style="display:flex; flex-direction:column; gap:0.5rem;">
                        <button type="button" id="cp-btn-place-order" class="btn btn-primary" style="width:100%; padding:0.75rem; font-size:0.95rem; font-weight:800; display:flex; align-items:center; justify-content:center; gap:0.5rem; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Place Order (Send to Workspace)
                        </button>

                        ${storeSettings.whatsappNumber ? `
                            <button type="button" id="cp-btn-order-whatsapp" class="cp-btn-whatsapp-order" style="padding:0.6rem; font-size:0.85rem;" title="Send order via WhatsApp">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>
                                Send Order via WhatsApp
                            </button>
                        ` : ''}
                        
                        <button type="button" id="cp-btn-print-slip" class="cp-btn-print-order" style="padding:0.55rem; font-size:0.82rem;" title="Download or print order slip">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print / Download Estimate Slip
                        </button>
                    </div>

                    <button type="button" id="cp-btn-clear-cart" class="cp-btn-clear-cart" style="margin-top:0.4rem;">Clear Shopping Cart</button>
                </div>
            </div>
        </div>

        <!-- ORDER CONFIRMATION SLIP MODAL CONTAINER -->
        <div id="cp-order-slip-modal-container"></div>

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
                <div style="margin-bottom:0.75rem; color:var(--text-muted);">
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </div>
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

    // Place Order Directly to Workspace
    const btnPlaceOrder = document.getElementById('cp-btn-place-order');
    if (btnPlaceOrder) {
        btnPlaceOrder.addEventListener('click', async () => {
            const items = Object.values(cart);
            if (items.length === 0) {
                alert("Your cart is empty! Please add products before placing an order.");
                return;
            }

            const custName = (document.getElementById('cp-checkout-name')?.value || '').trim();
            const custPhone = (document.getElementById('cp-checkout-phone')?.value || '').trim();
            const custAddress = (document.getElementById('cp-checkout-address')?.value || '').trim();
            const custNote = (document.getElementById('cp-checkout-note')?.value || '').trim();

            if (!custName || custName.length < 2) {
                alert("Please enter your Full Name (minimum 2 characters).");
                document.getElementById('cp-checkout-name')?.focus();
                return;
            }

            if (!custPhone || custPhone.length < 5) {
                alert("Please enter a valid Phone Number (minimum 5 digits).");
                document.getElementById('cp-checkout-phone')?.focus();
                return;
            }

            if (!custAddress || custAddress.length < 3) {
                alert("Please enter your Delivery Address.");
                document.getElementById('cp-checkout-address')?.focus();
                return;
            }

            const { total } = getCartTotals();

            // Set loading state
            btnPlaceOrder.disabled = true;
            btnPlaceOrder.innerHTML = `
                <div style="width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                <span>Sending Order to Workspace...</span>
            `;

            try {
                const orderService = getOrderService(currentWorkspaceId);

                const orderPayload = {
                    customerName: custName,
                    customerPhone: custPhone,
                    customerAddress: custAddress,
                    orderNote: custNote,
                    currencySymbol: storeSettings.currencySymbol || '$',
                    items: items.map(it => ({
                        productId: it.product.id || it.product.uniqueId,
                        productName: it.product.name,
                        quantity: Number(it.quantity) || 1,
                        unitPrice: Number(it.product.sellingPrice || it.product.price || 0),
                        totalPrice: (Number(it.quantity) || 1) * Number(it.product.sellingPrice || it.product.price || 0),
                        imageUri: it.product.imageUrl || '',
                        sizeWeight: it.product.size || ''
                    })),
                    subtotal: total,
                    totalAmount: total,
                    status: 'PENDING',
                    paymentMethod: 'Cash on Delivery (COD)',
                    source: 'CUSTOMER_PORTAL'
                };

                const createdOrder = await orderService.createOrder(orderPayload);

                // Clear cart after successful order placement
                cart = {};
                saveCartToStorage();
                renderProductCardsGrid();
                updateCartHeaderBadge();

                // Close cart drawer
                const cartOverlay = document.getElementById('cp-cart-overlay');
                if (cartOverlay) cartOverlay.classList.remove('open');

                // Display dedicated Order Confirmation Slip Modal
                showCustomerPlacedOrderSlipModal(createdOrder);

            } catch (err) {
                console.error("Order placement error:", err);
                alert("Could not place order: " + (err.message || 'Please check your connection.'));
            } finally {
                btnPlaceOrder.disabled = false;
                btnPlaceOrder.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Place Order (Send to Workspace)
                `;
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

            const custName = document.getElementById('cp-checkout-name')?.value?.trim() || 'Customer';
            const custPhone = document.getElementById('cp-checkout-phone')?.value?.trim() || '';
            const custAddress = document.getElementById('cp-checkout-address')?.value?.trim() || '';
            const custNote = document.getElementById('cp-checkout-note')?.value?.trim() || '';
            const { total } = getCartTotals();

            let msg = `🛒 *New Order from ${custName}*\n`;
            if (custPhone) msg += `📞 *Phone:* ${custPhone}\n`;
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
                msg += `📍 *Delivery Address:* ${custAddress}\n`;
            }
            if (custNote) {
                msg += `📝 *Note:* ${custNote}\n`;
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

    // Print Estimate Order Slip
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
 * Display Confirmed Order Slip Modal after placing order
 */
const showCustomerPlacedOrderSlipModal = (order) => {
    let container = document.getElementById('cp-order-slip-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cp-order-slip-modal-container';
        document.body.appendChild(container);
    }

    const curr = order.currencySymbol || storeSettings.currencySymbol || '$';
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
    });

    container.innerHTML = `
        <div style="position:fixed; inset:0; background:rgba(15,23,42,0.8); backdrop-filter:blur(8px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;">
            <div class="card" style="background:#ffffff; border-radius:18px; max-width:540px; width:100%; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); overflow:hidden; border:1px solid rgba(225,29,72,0.2); animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <!-- MODAL HEADER -->
                <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); padding:1.5rem; text-align:center; color:#ffffff; position:relative;">
                    <div style="width:48px; height:48px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h3 style="margin:0 0 0.25rem 0; font-size:1.35rem; font-weight:800;">Order Placed Successfully!</h3>
                    <p style="margin:0; font-size:0.85rem; opacity:0.95;">Sent directly to workspace team for fast confirmation & dispatch</p>
                </div>

                <!-- SLIP BODY -->
                <div id="placed-slip-content" style="padding:1.5rem; font-size:0.88rem; color:var(--text-primary); max-height:65vh; overflow-y:auto;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; border-bottom:1px dashed var(--border-color); padding-bottom:1rem;">
                        <div>
                            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Order Number</span>
                            <div style="font-size:1.15rem; font-weight:800; color:var(--primary); font-family:monospace;">#${escapeHtml(order.orderNumber || order.id)}</div>
                            <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Order Status</span>
                            <div style="margin-top:0.2rem;"><span style="background:#fef3c7; color:#b45309; font-weight:700; font-size:0.78rem; padding:0.2rem 0.6rem; border-radius:999px;">🟡 Pending Confirmation</span></div>
                        </div>
                    </div>

                    <!-- Customer Info Box -->
                    <div style="background:var(--surface-50); border-radius:10px; padding:0.9rem; margin-bottom:1.25rem; border:1px solid var(--border-color);">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Customer Details</span>
                        <div style="font-weight:700; color:var(--text-primary); font-size:0.95rem;">${escapeHtml(order.customerName)}</div>
                        <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">📞 ${escapeHtml(order.customerPhone)}</div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.2rem;">📍 ${escapeHtml(order.customerAddress)}</div>
                        ${order.orderNote ? `
                            <div style="font-size:0.8rem; color:#b45309; background:#fef3c7; padding:0.25rem 0.5rem; border-radius:6px; margin-top:0.4rem;">
                                <strong>Note:</strong> ${escapeHtml(order.orderNote)}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Items List -->
                    <div style="margin-bottom:1.25rem;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                            <thead>
                                <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                                    <th style="text-align:left; padding:0.4rem 0;">Item</th>
                                    <th style="text-align:center; padding:0.4rem 0;">Qty</th>
                                    <th style="text-align:right; padding:0.4rem 0;">Price</th>
                                    <th style="text-align:right; padding:0.4rem 0;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(order.items || []).map(item => `
                                    <tr style="border-bottom:1px solid var(--surface-100);">
                                        <td style="padding:0.5rem 0; font-weight:600; color:var(--text-primary);">${escapeHtml(item.productName)}</td>
                                        <td style="padding:0.5rem 0; text-align:center;">${item.quantity}</td>
                                        <td style="padding:0.5rem 0; text-align:right;">${curr}${Number(item.unitPrice || 0).toFixed(2)}</td>
                                        <td style="padding:0.5rem 0; text-align:right; font-weight:700;">${curr}${Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Total Breakdown -->
                    <div style="border-top:1px dashed var(--border-color); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.35rem;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary);">
                            <span>Subtotal</span>
                            <span>${curr}${Number(order.subtotal || order.totalAmount || 0).toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:800; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.5rem; margin-top:0.25rem;">
                            <span>Total Payable (COD)</span>
                            <span style="color:var(--primary);">${curr}${Number(order.totalAmount || 0).toFixed(2)}</span>
                        </div>
                    </div>

                </div>

                <!-- MODAL FOOTER -->
                <div style="background:var(--surface-50); border-top:1px solid var(--border-color); padding:1rem 1.5rem; display:flex; justify-content:space-between; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                    <button type="button" id="btn-print-placed-slip" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print Slip
                    </button>
                    ${storeSettings.whatsappNumber ? `
                        <button type="button" id="btn-wa-placed-slip" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem; color:#059669;">
                            WhatsApp Share
                        </button>
                    ` : ''}
                    <button type="button" id="btn-close-placed-slip" class="btn btn-primary" style="font-weight:700; font-size:0.85rem; padding:0.5rem 1.25rem; background:linear-gradient(135deg, #10b981 0%, #059669 100%);">
                        Continue Browsing
                    </button>
                </div>

            </div>
        </div>
    `;

    document.getElementById('btn-close-placed-slip')?.addEventListener('click', () => container.remove());
    document.getElementById('btn-print-placed-slip')?.addEventListener('click', () => {
        const printContent = document.getElementById('placed-slip-content').innerHTML;
        const printWindow = window.open('', '', 'width=650,height=750');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Order Slip - #${order.orderNumber || order.id}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 2rem; color: #0f172a; line-height: 1.5; }
                        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                        th, td { padding: 0.5rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
                        th { text-align: left; background: #f8fafc; font-size: 0.75rem; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <h2 style="margin:0 0 0.25rem 0;">${escapeHtml(storeSettings.storeName)} — Order Slip</h2>
                    ${printContent}
                    <script>window.print(); window.close();</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    });

    const waBtn = document.getElementById('btn-wa-placed-slip');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            let msg = `✅ *Confirmed Order #${order.orderNumber || order.id}*\n`;
            msg += `Customer: *${order.customerName}* (📞 ${order.customerPhone})\n`;
            msg += `Store: *${storeSettings.storeName}*\n`;
            msg += `----------------------------------------\n`;
            (order.items || []).forEach((item, idx) => {
                msg += `${idx + 1}. *${item.productName}* × ${item.quantity} = ${curr}${Number(item.totalPrice).toFixed(2)}\n`;
            });
            msg += `----------------------------------------\n`;
            msg += `💰 *Total: ${curr}${Number(order.totalAmount).toFixed(2)}*\n`;
            if (order.customerAddress) msg += `📍 *Address:* ${order.customerAddress}\n`;

            let cleanPhone = (storeSettings.whatsappNumber || '').replace(/[^0-9]/g, '');
            if (!cleanPhone.startsWith('880') && cleanPhone.startsWith('01')) cleanPhone = '88' + cleanPhone;
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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
                            ${storeSettings.phone ? `<div>Phone: ${escapeHtml(storeSettings.phone)}</div>` : ''}
                            ${storeSettings.email ? `<div>Email: ${escapeHtml(storeSettings.email)}</div>` : ''}
                            ${storeSettings.address ? `<div>Address: ${escapeHtml(storeSettings.address)}</div>` : ''}
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
                    ${storeSettings.phone ? `<div>Phone: ${escapeHtml(storeSettings.phone)}</div>` : ''}
                    ${storeSettings.whatsappNumber ? `<div>WhatsApp: ${escapeHtml(storeSettings.whatsappNumber)}</div>` : ''}
                    ${storeSettings.email ? `<div>Email: ${escapeHtml(storeSettings.email)}</div>` : ''}
                    ${storeSettings.address ? `<div>Address: ${escapeHtml(storeSettings.address)}</div>` : ''}
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
            <div style="width:48px; height:48px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; color:var(--text-muted);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </div>
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
            <div style="width:48px; height:48px; border-radius:50%; background:#fff1f2; color:#e11d48; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h1 class="cp-closed-title">Notice</h1>
            <p class="cp-closed-message">${escapeHtml(msg)}</p>
        </div>
    `;
};
