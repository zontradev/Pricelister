/**
 * PriceLister - Workspace Banner Picker & Presets Modal
 * Provides curated, high-resolution internet banner presets across multiple categories
 * alongside custom URL and upload integration.
 */

export const CURATED_BANNER_PRESETS = [
    {
        id: 'banner_dark_carbon',
        category: 'Executive Dark',
        title: 'Carbon Modernist',
        description: 'Sleek dark geometric architecture with subtle studio illumination',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_aurora_gradient',
        category: 'Modern Gradient',
        title: 'Aurora Nightfall',
        description: 'Deep midnight indigo and violet chromatic blend',
        url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_tech_grid',
        category: 'Tech & Digital',
        title: 'Digital Matrix Horizon',
        description: 'Futuristic network grid with cyan and slate depth',
        url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_minimal_store',
        category: 'Retail & Shop',
        title: 'Minimalist Storefront',
        description: 'Premium boutique interior with warm natural lighting',
        url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_architectural_stone',
        category: 'Creative Studio',
        title: 'Architectural Stone & Glass',
        description: 'Contemporary gallery space with clean lines',
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_prism_refract',
        category: 'Abstract Geometry',
        title: 'Prism Refraction',
        description: 'Soft iridescent crystal refractions on clean dark plane',
        url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_emerald_wave',
        category: 'Modern Gradient',
        title: 'Emerald Wave Flow',
        description: 'Luxurious deep forest green and teal satin waves',
        url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_cyber_mesh',
        category: 'Tech & Digital',
        title: 'Deep Cyber Mesh',
        description: 'Geometric topography with electric blue accents',
        url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_artisan_espresso',
        category: 'Food & Cafe',
        title: 'Artisan Espresso Roastery',
        description: 'Warm cafe ambiance with rich dark tones',
        url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_apparel_boutique',
        category: 'Retail & Shop',
        title: 'Boutique Apparel Gallery',
        description: 'Modern lifestyle fashion and retail showroom',
        url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_obsidian_marble',
        category: 'Executive Dark',
        title: 'Obsidian Marble Veins',
        description: 'High-contrast natural stone texture with organic depth',
        url: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=480&q=70'
    },
    {
        id: 'banner_crimson_horizon',
        category: 'Modern Gradient',
        title: 'Crimson Amber Horizon',
        description: 'Bold cinematic sunset gradients with soft mist',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
        thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=480&q=70'
    }
];

export const BANNER_CATEGORIES = [
    'ALL',
    'Executive Dark',
    'Modern Gradient',
    'Tech & Digital',
    'Retail & Shop',
    'Creative Studio',
    'Abstract Geometry',
    'Food & Cafe'
];

/**
 * Open Banner Picker & Internet Presets Modal
 * @param {string} currentBannerUrl - Currently active banner URL (if any)
 * @param {Function} onSelectCallback - Function called when user selects/confirms a banner
 */
export const openBannerPickerModal = (currentBannerUrl = '', onSelectCallback) => {
    const existing = document.getElementById('banner-picker-modal-overlay');
    if (existing) existing.remove();

    let activeCategory = 'ALL';
    let searchQuery = '';
    let selectedUrl = currentBannerUrl || '';

    const overlay = document.createElement('div');
    overlay.id = 'banner-picker-modal-overlay';
    overlay.className = 'modal-backdrop';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(9, 9, 11, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;

    overlay.innerHTML = `
        <div class="modal-card" style="
            background: #ffffff;
            border-radius: 20px;
            width: 100%;
            max-width: 960px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            border: 1.5px solid var(--border-color);
            box-shadow: 0 25px 60px -15px rgba(0,0,0,0.3);
            overflow: hidden;
            transform: scale(0.96);
            transition: transform 0.2s ease;
        ">
            <!-- Modal Header -->
            <div style="padding: 1.25rem 1.75rem; border-bottom: 1.5px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #ffffff;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #18181b 0%, #27272a 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">Choose Workspace Banner</h3>
                            <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; background: rgba(16,185,129,0.12); color: #059669; border: 1px solid rgba(16,185,129,0.3);">
                                1920×1080 (16:9) Recommended
                            </span>
                        </div>
                        <p style="margin: 0.15rem 0 0 0; font-size: 0.82rem; color: var(--text-secondary);">
                            Select from curated high-resolution internet presets or paste any custom high-res image link.
                        </p>
                    </div>
                </div>

                <button type="button" id="btn-close-banner-modal" class="icon-btn" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: all 0.15s ease;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Custom URL Quick Input Bar -->
            <div style="background: var(--surface-50); border-bottom: 1.5px solid var(--border-color); padding: 0.85rem 1.75rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Custom Image URL:</span>
                <div style="flex: 1; min-width: 260px; position: relative;">
                    <input type="url" id="modal-custom-banner-url" class="form-control" placeholder="https://images.unsplash.com/... or any image URL" value="${selectedUrl ? selectedUrl : ''}" style="border-radius: 10px; font-size: 0.84rem; padding: 0.5rem 0.75rem 0.5rem 2.2rem; background: #ffffff;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </div>
                <button type="button" id="btn-apply-custom-banner-url" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; font-weight: 700; padding: 0.5rem 0.95rem; border-radius: 9px; white-space: nowrap;">
                    Preview URL
                </button>
            </div>

            <!-- Category Tabs & Search Row -->
            <div style="padding: 0.85rem 1.75rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: #ffffff;">
                <!-- Category Filter Pills -->
                <div style="display: flex; gap: 0.4rem; overflow-x: auto; max-width: 100%; padding-bottom: 2px;" id="banner-category-pills">
                    ${BANNER_CATEGORIES.map(cat => `
                        <button type="button" class="banner-cat-pill ${cat === 'ALL' ? 'active' : ''}" data-cat="${cat}" style="
                            padding: 0.35rem 0.85rem;
                            font-size: 0.78rem;
                            font-weight: 700;
                            border-radius: 999px;
                            border: 1px solid ${cat === 'ALL' ? '#18181b' : 'var(--border-color)'};
                            background: ${cat === 'ALL' ? '#18181b' : 'var(--surface-50)'};
                            color: ${cat === 'ALL' ? '#ffffff' : 'var(--text-secondary)'};
                            cursor: pointer;
                            white-space: nowrap;
                            transition: all 0.15s ease;
                        ">
                            ${cat === 'ALL' ? '✦ All Presets' : cat}
                        </button>
                    `).join('')}
                </div>

                <!-- Search box -->
                <div style="position: relative; width: 200px;">
                    <input type="text" id="modal-banner-search" class="form-control" placeholder="Search presets..." style="border-radius: 8px; font-size: 0.8rem; padding: 0.35rem 0.65rem 0.35rem 1.9rem; background: var(--surface-50);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
            </div>

            <!-- Presets Grid Container -->
            <div id="banner-presets-grid-scroll" style="flex: 1; overflow-y: auto; padding: 1.25rem 1.75rem; background: var(--surface-50);">
                <div id="banner-presets-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.15rem;">
                    <!-- Dynamically populated -->
                </div>
            </div>

            <!-- Modal Footer -->
            <div style="padding: 1rem 1.75rem; border-top: 1.5px solid var(--border-color); background: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <div id="modal-banner-selected-preview-pill" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                        <span style="font-weight: 700; color: var(--text-primary);">Selected:</span>
                        <span id="modal-banner-selected-name" style="font-weight: 600; color: #18181b; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${selectedUrl ? 'Preset Image' : 'Default Neutral'}
                        </span>
                    </div>
                </div>

                <div style="display: flex; gap: 0.6rem; align-items: center;">
                    <button type="button" id="btn-cancel-banner-modal" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 600; padding: 0.55rem 1.1rem; border-radius: 10px;">
                        Cancel
                    </button>
                    <button type="button" id="btn-confirm-banner-modal" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 700; padding: 0.55rem 1.35rem; border-radius: 10px; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); display: flex; align-items: center; gap: 0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Apply Workspace Banner</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        const card = overlay.querySelector('.modal-card');
        if (card) card.style.transform = 'scale(1)';
    });

    const gridContainer = overlay.querySelector('#banner-presets-grid');
    const customUrlInput = overlay.querySelector('#modal-custom-banner-url');
    const selectedNameEl = overlay.querySelector('#modal-banner-selected-name');
    const searchInput = overlay.querySelector('#modal-banner-search');

    const renderPresets = () => {
        if (!gridContainer) return;

        const filtered = CURATED_BANNER_PRESETS.filter(item => {
            const matchesCat = activeCategory === 'ALL' || item.category === activeCategory;
            const matchesSearch = !searchQuery || 
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });

        if (filtered.length === 0) {
            gridContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 0.5rem; opacity: 0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">No presets found</div>
                    <div style="font-size: 0.82rem; margin-top: 0.2rem;">Try a different keyword or paste a custom image link above.</div>
                </div>
            `;
            return;
        }

        gridContainer.innerHTML = filtered.map(item => {
            const isSelected = selectedUrl === item.url;
            return `
                <div class="banner-preset-card ${isSelected ? 'active' : ''}" data-id="${item.id}" data-url="${item.url}" data-title="${item.title}" style="
                    background: #ffffff;
                    border: 2px solid ${isSelected ? '#18181b' : 'var(--border-color)'};
                    border-radius: 14px;
                    overflow: hidden;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    box-shadow: ${isSelected ? '0 8px 24px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.03)'};
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                ">
                    <!-- Banner Aspect Ratio 16:9 Thumbnail -->
                    <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #18181b; overflow: hidden;">
                        <img src="${item.thumb}" alt="${item.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%);"></div>
                        
                        <!-- Category Badge -->
                        <span style="position: absolute; top: 8px; left: 8px; font-size: 0.68rem; font-weight: 700; background: rgba(0,0,0,0.65); color: #ffffff; backdrop-filter: blur(6px); padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);">
                            ${item.category}
                        </span>

                        ${isSelected ? `
                            <div style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: #18181b; color: #ffffff; display: flex; align-items: center; justify-content: center; border: 1.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Meta -->
                    <div style="padding: 0.75rem 0.9rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-primary); margin-bottom: 0.15rem;">
                                ${item.title}
                            </div>
                            <div style="font-size: 0.74rem; color: var(--text-muted); line-height: 1.35;">
                                ${item.description}
                            </div>
                        </div>

                        <div style="margin-top: 0.65rem; display: flex; justify-content: flex-end;">
                            <button type="button" class="btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}" style="font-size: 0.74rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 6px;">
                                ${isSelected ? '✓ Selected' : 'Use Banner'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Card Click Handlers
        gridContainer.querySelectorAll('.banner-preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const url = card.getAttribute('data-url');
                const title = card.getAttribute('data-title');
                selectedUrl = url;
                if (customUrlInput) customUrlInput.value = url;
                if (selectedNameEl) selectedNameEl.textContent = title;
                renderPresets();
            });
        });
    };

    renderPresets();

    // Category Filter Pills Listeners
    overlay.querySelectorAll('.banner-cat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            activeCategory = pill.getAttribute('data-cat') || 'ALL';
            overlay.querySelectorAll('.banner-cat-pill').forEach(p => {
                const isActive = p === pill;
                p.style.border = isActive ? '1px solid #18181b' : '1px solid var(--border-color)';
                p.style.background = isActive ? '#18181b' : 'var(--surface-50)';
                p.style.color = isActive ? '#ffffff' : 'var(--text-secondary)';
            });
            renderPresets();
        });
    });

    // Search input listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderPresets();
        });
    }

    // Apply custom URL button
    overlay.querySelector('#btn-apply-custom-banner-url')?.addEventListener('click', () => {
        const customVal = (customUrlInput?.value || '').trim();
        if (customVal) {
            selectedUrl = customVal;
            if (selectedNameEl) selectedNameEl.textContent = 'Custom Direct Image Link';
            renderPresets();
        }
    });

    // Close / Cancel Handlers
    const closeModal = () => {
        overlay.style.opacity = '0';
        const card = overlay.querySelector('.modal-card');
        if (card) card.style.transform = 'scale(0.96)';
        setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('#btn-close-banner-modal')?.addEventListener('click', closeModal);
    overlay.querySelector('#btn-cancel-banner-modal')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Confirm selection
    overlay.querySelector('#btn-confirm-banner-modal')?.addEventListener('click', () => {
        const finalUrl = (customUrlInput?.value || selectedUrl || '').trim();
        if (typeof onSelectCallback === 'function') {
            onSelectCallback(finalUrl);
        }
        closeModal();
    });
};
