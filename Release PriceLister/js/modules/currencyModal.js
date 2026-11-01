import { CURRENCY_LIST } from '../utils/currencyData.js';

/**
 * Open Currency Picker Modal
 * @param {string} currentSymbol - Currently selected symbol
 * @param {Function} onSelect - Callback when user chooses a currency (receives selected symbol, code, name)
 */
export const openCurrencyPickerModal = (currentSymbol = '$', onSelect = () => {}) => {
    const existing = document.getElementById('currency-picker-modal-container');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'currency-picker-modal-container';
    modal.className = 'modal-container';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(15, 23, 42, 0.6)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '1rem';

    modal.innerHTML = `
        <div class="card" style="width: 100%; max-width: 520px; max-height: 85vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; animation: scaleUp 0.2s ease;">
            
            <!-- Header -->
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--surface-50);">
                <div>
                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        Find Country & Currency
                    </h3>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">
                        Search country name, currency name, or currency code
                    </p>
                </div>
                <button type="button" id="cpm-close-btn" class="icon-btn" style="background:none; border:none; font-size:1.5rem; color:var(--text-secondary); cursor:pointer; padding:0.25rem; line-height:1;">✕</button>
            </div>

            <!-- Search Bar -->
            <div style="padding: 1rem 1.5rem 0.5rem; background: var(--surface-50);">
                <div style="position: relative;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="cpm-search-input" class="form-control" placeholder="Search country, currency, or code (e.g. Bangladesh, USD, Euro)..." style="width: 100%; padding: 0.65rem 1rem 0.65rem 2.25rem; font-size: 0.9rem; border-radius: 10px;">
                </div>
            </div>

            <!-- Currency List -->
            <div id="cpm-list-container" style="flex: 1; overflow-y: auto; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; min-height: 280px; max-height: 400px;">
                <!-- Dynamically rendered -->
            </div>

            <!-- Footer -->
            <div style="padding: 0.85rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--surface-50); font-size: 0.8rem; color: var(--text-muted);">
                <span id="cpm-count-label">${CURRENCY_LIST.length} Currencies available</span>
                <button type="button" id="cpm-cancel-btn" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.4rem 1rem;">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const listContainer = modal.querySelector('#cpm-list-container');
    const searchInput = modal.querySelector('#cpm-search-input');
    const countLabel = modal.querySelector('#cpm-count-label');
    const closeBtn = modal.querySelector('#cpm-close-btn');
    const cancelBtn = modal.querySelector('#cpm-cancel-btn');

    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const renderList = (filterText = '') => {
        const q = filterText.trim().toLowerCase();
        const filtered = CURRENCY_LIST.filter(c => {
            if (!q) return true;
            return c.name.toLowerCase().includes(q) || 
                   c.code.toLowerCase().includes(q) || 
                   (c.country && c.country.toLowerCase().includes(q)) || 
                   c.symbol.toLowerCase().includes(q);
        });

        countLabel.textContent = `${filtered.length} Currencies found`;

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <p style="margin: 0; font-size: 0.95rem;">No currency found matching "<strong>${filterText}</strong>"</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(c => {
            const isSelected = (c.symbol === currentSymbol || c.code === currentSymbol);
            return `
                <div class="cpm-item" data-code="${c.code}" data-symbol="${c.symbol}" data-name="${c.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; cursor: pointer; transition: all 0.15s ease; border: 1px solid ${isSelected ? 'var(--primary)' : 'transparent'}; background: ${isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-50)'};">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.5rem; line-height: 1;">${c.flag}</span>
                        <div>
                            <div style="font-weight: 600; font-size: 0.92rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                                <span>${c.country || c.name}</span>
                                <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); background: rgba(0,0,0,0.05); padding: 0.1rem 0.35rem; border-radius: 4px;">${c.code}</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem;">
                                ${c.name}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-family: monospace; font-size: 1.25rem; font-weight: 700; color: var(--primary); min-width: 32px; text-align: center;">
                            ${c.symbol}
                        </span>
                        ${isSelected ? `<span style="color: var(--primary); font-size: 0.85rem; font-weight: 700;">✓</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Attach item click handlers
        listContainer.querySelectorAll('.cpm-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(16, 185, 129, 0.12)';
            });
            item.addEventListener('mouseleave', () => {
                const isItemSel = (item.getAttribute('data-symbol') === currentSymbol || item.getAttribute('data-code') === currentSymbol);
                item.style.background = isItemSel ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-50)';
            });
            item.addEventListener('click', () => {
                const sym = item.getAttribute('data-symbol') || '$';
                const code = item.getAttribute('data-code') || 'USD';
                const name = item.getAttribute('data-name') || '';
                onSelect(sym, code, name);
                closeModal();
            });
        });
    };

    renderList();

    searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    setTimeout(() => searchInput.focus(), 50);
};
