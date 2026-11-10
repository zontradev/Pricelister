/**
 * PriceLister Enterprise Theme Manager
 * Manages 3 theme modes: 'light' (default), 'dark' (Premium Graphite), and 'system' (OS sync)
 * Strictly eliminates AMOLED pure black (#000000).
 */

export const THEME_MODES = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
};

/**
 * Get current configured theme mode from localStorage.
 * Falls back to 'light' (default).
 */
export const getThemeMode = () => {
    try {
        let mode = localStorage.getItem('pricelister_color_mode') || 'light';
        // Cleanse any legacy/AMOLED keys
        if (mode !== 'light' && mode !== 'dark' && mode !== 'system') {
            mode = 'light';
            localStorage.setItem('pricelister_color_mode', 'light');
        }
        return mode;
    } catch (e) {
        return 'light';
    }
};

/**
 * Determine effective applied mode ('light' or 'dark')
 */
export const getEffectiveThemeMode = (mode = getThemeMode()) => {
    if (mode === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    }
    return mode === 'dark' ? 'dark' : 'light';
};

/**
 * Apply theme mode across the DOM
 */
export const applyThemeMode = (mode) => {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') {
        mode = 'light';
    }
    try {
        localStorage.setItem('pricelister_color_mode', mode);
    } catch (e) {}

    const effective = getEffectiveThemeMode(mode);
    document.documentElement.setAttribute('data-color-mode', effective);
    document.documentElement.setAttribute('data-theme-setting', mode);

    // Update icons and active state across all theme switcher UI elements
    updateThemeUIElements(mode, effective);

    // Dispatch global event for interactive charts, canvas, or modals
    window.dispatchEvent(new CustomEvent('pricelister-theme-changed', {
        detail: { mode, effective }
    }));

    return effective;
};

/**
 * Sync all theme switcher buttons / cards in the DOM
 */
const updateThemeUIElements = (mode, effective) => {
    // 1. Topbar trigger button icon and label
    const topbarBtn = document.getElementById('topbar-theme-toggle-btn');
    if (topbarBtn) {
        const iconWrap = topbarBtn.querySelector('.theme-btn-icon-wrap');
        const labelWrap = topbarBtn.querySelector('.theme-btn-label');
        if (iconWrap) {
            if (mode === 'system') {
                iconWrap.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
            } else if (mode === 'dark') {
                iconWrap.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
            } else {
                iconWrap.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
            }
        }
        if (labelWrap) {
            labelWrap.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        }
        topbarBtn.setAttribute('title', `Theme: ${mode.charAt(0).toUpperCase() + mode.slice(1)} (Active: ${effective})`);
    }

    // 2. Dropdown options active class
    document.querySelectorAll('.theme-menu-option').forEach(opt => {
        const optMode = opt.getAttribute('data-theme-mode');
        const isActive = optMode === mode;
        opt.classList.toggle('active', isActive);
        const checkIcon = opt.querySelector('.theme-check-icon');
        if (checkIcon) {
            checkIcon.style.opacity = isActive ? '1' : '0';
        }
    });

    // 3. Settings page theme cards
    document.querySelectorAll('.settings-theme-card').forEach(card => {
        const cardMode = card.getAttribute('data-theme-mode');
        const isSelected = cardMode === mode;
        card.classList.toggle('selected', isSelected);
        if (isSelected) {
            card.style.borderColor = effective === 'dark' ? '#E6E6E6' : '#18181B';
            card.style.boxShadow = '0 0 0 2px rgba(80, 80, 80, 0.2)';
        } else {
            card.style.borderColor = 'var(--border-color)';
            card.style.boxShadow = 'none';
        }
        const radioDot = card.querySelector('.settings-theme-dot');
        if (radioDot) {
            radioDot.style.background = isSelected ? (effective === 'dark' ? '#E6E6E6' : '#18181B') : 'transparent';
        }
    });

    // 4. Critical board theme buttons
    document.querySelectorAll('.cb-theme-btn').forEach(btn => {
        const btnMode = btn.getAttribute('data-theme-mode');
        const isSelected = btnMode === mode;
        btn.classList.toggle('btn-primary', isSelected);
        btn.classList.toggle('btn-secondary', !isSelected);
    });

    // 5. Profile dialer theme drawer items (Inside Right Profile Dialer)
    const drawerLabel = document.getElementById('drawer-active-theme-label');
    if (drawerLabel) {
        drawerLabel.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    }
    document.querySelectorAll('.theme-drawer-item').forEach(item => {
        const itemMode = item.getAttribute('data-mode');
        const isMatch = itemMode === mode;
        item.classList.toggle('active', isMatch);
        item.style.borderColor = isMatch ? 'var(--text-primary)' : 'transparent';
        item.style.background = isMatch ? 'var(--surface-100)' : 'transparent';
        const check = item.querySelector('.drawer-check');
        if (check) check.style.visibility = isMatch ? 'visible' : 'hidden';
    });
};

/**
 * Setup Profile Dialer Theme Menu & Clean Topbar
 * Keeps Theme & Mode strictly inside the right profile dialer instead of header as a button.
 */
export const setupTopbarThemeMenu = () => {
    // Remove standalone topbar button if present in DOM
    const oldBtn = document.getElementById('topbar-theme-menu-container');
    if (oldBtn) oldBtn.remove();

    const currentMode = getThemeMode();
    const currentEffective = getEffectiveThemeMode(currentMode);
    updateThemeUIElements(currentMode, currentEffective);
};

/**
 * Initialize Theme System on app boot
 */
export const initThemeSystem = () => {
    const currentMode = getThemeMode();
    applyThemeMode(currentMode);

    // Setup media query listener for OS changes
    if (window.matchMedia) {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', () => {
            if (getThemeMode() === 'system') {
                applyThemeMode('system');
            }
        });
    }

    // Insert Topbar theme toggle if topbar is in DOM
    setupTopbarThemeMenu();
};

