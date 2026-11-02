/**
 * Regional Localization & Continental Adaptation Engine
 * PriceLister Enterprise Platform
 * 
 * Silently adapts terminology, payment semantics, and recognizable enterprise examples
 * based on the active workspace country without exposing underlying adaptive rules to the user.
 * 
 * 4 Regional Zones:
 * 1. ASIA (India, Bangladesh, Pakistan, Japan, Singapore, etc.):
 *    - Uses "EMI" (Equated Monthly Installment)
 *    - Recognizable brands: Samsung, Tata, RFL, Nestle, etc.
 * 
 * 2. MIDDLE EAST (UAE, Saudi Arabia, Qatar, etc.):
 *    - Uses "EMI / Installment Plan", down payment emphasis
 *    - Recognizable brands: Emirates Group, Emaar, Almarai, Aramco, etc.
 * 
 * 3. EUROPE (UK, Germany, France, Italy, Spain, Netherlands, Switzerland, etc.):
 *    - Uses "Monthly Payment" (avoiding unfamiliar "EMI" jargon)
 *    - Recognizable brands: Siemens, Unilever, Bosch, SAP, Nestlé, L'Oréal, etc.
 * 
 * 4. AMERICAS (USA, Canada, Mexico, Brazil, etc.):
 *    - Uses "Monthly Payment" / "Installment Plan"
 *    - Recognizable brands: Nvidia, Apple, Tesla, Amazon, Microsoft, etc.
 */

export const REGIONS = {
    ASIA: 'asia',
    MIDDLE_EAST: 'middle_east',
    EUROPE: 'europe',
    AMERICAS: 'americas'
};

const COUNTRY_REGION_MAP = {
    // Asia (India, Bangladesh, Pakistan, etc.)
    'BD': REGIONS.ASIA,
    'IN': REGIONS.ASIA,
    'PK': REGIONS.ASIA,
    'SG': REGIONS.ASIA,
    'MY': REGIONS.ASIA,
    'JP': REGIONS.ASIA,
    'ID': REGIONS.ASIA,
    'CN': REGIONS.ASIA,
    'KR': REGIONS.ASIA,
    'TH': REGIONS.ASIA,
    'VN': REGIONS.ASIA,
    'LK': REGIONS.ASIA,
    'NP': REGIONS.ASIA,

    // Middle East
    'AE': REGIONS.MIDDLE_EAST,
    'SA': REGIONS.MIDDLE_EAST,
    'QA': REGIONS.MIDDLE_EAST,
    'KW': REGIONS.MIDDLE_EAST,
    'OM': REGIONS.MIDDLE_EAST,
    'BH': REGIONS.MIDDLE_EAST,
    'TR': REGIONS.MIDDLE_EAST,
    'EG': REGIONS.MIDDLE_EAST,
    'JO': REGIONS.MIDDLE_EAST,
    'LB': REGIONS.MIDDLE_EAST,

    // Europe
    'GB': REGIONS.EUROPE,
    'DE': REGIONS.EUROPE,
    'FR': REGIONS.EUROPE,
    'IT': REGIONS.EUROPE,
    'ES': REGIONS.EUROPE,
    'NL': REGIONS.EUROPE,
    'CH': REGIONS.EUROPE,
    'SE': REGIONS.EUROPE,
    'NO': REGIONS.EUROPE,
    'DK': REGIONS.EUROPE,
    'PL': REGIONS.EUROPE,
    'BE': REGIONS.EUROPE,
    'AT': REGIONS.EUROPE,
    'IE': REGIONS.EUROPE,
    'PT': REGIONS.EUROPE,
    'FI': REGIONS.EUROPE,
    'GR': REGIONS.EUROPE,

    // Americas
    'US': REGIONS.AMERICAS,
    'CA': REGIONS.AMERICAS,
    'MX': REGIONS.AMERICAS,
    'BR': REGIONS.AMERICAS,
    'AR': REGIONS.AMERICAS,
    'CL': REGIONS.AMERICAS,
    'CO': REGIONS.AMERICAS
};

const REGIONAL_CONFIGS = {
    [REGIONS.ASIA]: {
        region: REGIONS.ASIA,
        paymentTerm: 'EMI',
        paymentTermFull: 'Equated Monthly Installment (EMI)',
        paymentScheduleTitle: 'EMI Installment Schedule',
        calculatorTitle: 'EMI Calculator',
        accountsTabTitle: 'Customer EMI Accounts',
        collectPaymentTitle: 'Collect EMI Payment',
        newAccountModalTitle: 'Create Customer EMI Agreement',
        examples: {
            brandName: 'Samsung / Tata / RFL',
            brandMonogram: 'RFL',
            fixedText: 'RFL, TATA, SAM',
            enterpriseCompany: 'Tata Consultancy / RFL Group / Samsung',
            customerName: 'Rahul Sharma / Tanvir Ahmed',
            customerPhone: '+91 98765 43210 / +880 1711-000000',
            bankName: 'State Bank / HDFC / BRAC Bank / Habib Bank',
            accountName: 'Retail Cash Box / Commercial Checking'
        }
    },
    [REGIONS.MIDDLE_EAST]: {
        region: REGIONS.MIDDLE_EAST,
        paymentTerm: 'EMI / Installment',
        paymentTermFull: 'Installment & EMI Facility',
        paymentScheduleTitle: 'Installment & EMI Schedule',
        calculatorTitle: 'EMI & Installment Calculator',
        accountsTabTitle: 'Customer EMI & Installments',
        collectPaymentTitle: 'Collect Installment Payment',
        newAccountModalTitle: 'Create Customer Installment Agreement',
        examples: {
            brandName: 'Emirates Group / Emaar',
            brandMonogram: 'EK',
            fixedText: 'EK, EMA, AR',
            enterpriseCompany: 'Emirates Group / Emaar Properties / Almarai',
            customerName: 'Ahmed Al Mansoor / Tariq Rashid',
            customerPhone: '+971 50 123 4567 / +966 50 123 4567',
            bankName: 'Emirates NBD / First Abu Dhabi Bank / Al Rajhi Bank',
            accountName: 'Dubai Main Vault / Operating Bank'
        }
    },
    [REGIONS.EUROPE]: {
        region: REGIONS.EUROPE,
        paymentTerm: 'Monthly Payment',
        paymentTermFull: 'Monthly Payment Plan',
        paymentScheduleTitle: 'Monthly Payment Schedule',
        calculatorTitle: 'Monthly Payment Calculator',
        accountsTabTitle: 'Customer Payment Plans',
        collectPaymentTitle: 'Collect Monthly Payment',
        newAccountModalTitle: 'Create Customer Monthly Payment Agreement',
        examples: {
            brandName: 'Siemens / Unilever / Bosch',
            brandMonogram: 'SIE',
            fixedText: 'SIE, BOS, SAP',
            enterpriseCompany: 'Siemens AG / Unilever / Robert Bosch',
            customerName: 'Alexander Mueller / Oliver Smith',
            customerPhone: '+44 20 7946 0912 / +49 30 123456',
            bankName: 'Barclays / Deutsche Bank / BNP Paribas',
            accountName: 'Corporate Operating Bank / Store Cash Till'
        }
    },
    [REGIONS.AMERICAS]: {
        region: REGIONS.AMERICAS,
        paymentTerm: 'Monthly Payment',
        paymentTermFull: 'Monthly Payment & Financing Plan',
        paymentScheduleTitle: 'Monthly Payment Schedule',
        calculatorTitle: 'Monthly Payment Calculator',
        accountsTabTitle: 'Customer Financing & Payment Plans',
        collectPaymentTitle: 'Collect Monthly Payment',
        newAccountModalTitle: 'Create Customer Payment Agreement',
        examples: {
            brandName: 'Nvidia / Tesla / Apple',
            brandMonogram: 'NVD',
            fixedText: 'NVD, AAPL, TSLA',
            enterpriseCompany: 'Nvidia Corp / Tesla Inc / Apple',
            customerName: 'David Chen / Michael Miller',
            customerPhone: '+1 (555) 019-2831',
            bankName: 'JPMorgan Chase / Bank of America / Citibank',
            accountName: 'Citibank Operating Checking / Store Front Safe'
        }
    }
};

/**
 * Detect regional configuration based on country name or 2-letter country code.
 * Defaults seamlessly to global/Americas or Europe depending on context.
 * 
 * @param {string} countryNameOrCode 
 * @returns {object} Regional localized terminology and recognizable company examples
 */
export const getRegionConfig = (countryNameOrCode = '') => {
    if (!countryNameOrCode) {
        return REGIONAL_CONFIGS[REGIONS.EUROPE]; // Default enterprise fallback
    }

    const clean = String(countryNameOrCode).trim().toUpperCase();

    // Check direct code lookup (e.g. 'IN', 'BD', 'AE', 'US', 'GB')
    if (COUNTRY_REGION_MAP[clean]) {
        return REGIONAL_CONFIGS[COUNTRY_REGION_MAP[clean]];
    }

    // Match country name substrings
    const lower = String(countryNameOrCode).toLowerCase();
    
    // Asia check
    if (lower.includes('india') || lower.includes('bangladesh') || lower.includes('pakistan') || 
        lower.includes('japan') || lower.includes('singapore') || lower.includes('malaysia') || 
        lower.includes('china') || lower.includes('korea') || lower.includes('asia') || lower.includes('indonesia')) {
        return REGIONAL_CONFIGS[REGIONS.ASIA];
    }

    // Middle East check
    if (lower.includes('emirates') || lower.includes('uae') || lower.includes('saudi') || 
        lower.includes('qatar') || lower.includes('kuwait') || lower.includes('oman') || 
        lower.includes('bahrain') || lower.includes('turkey') || lower.includes('middle east')) {
        return REGIONAL_CONFIGS[REGIONS.MIDDLE_EAST];
    }

    // Europe check
    if (lower.includes('kingdom') || lower.includes('britain') || lower.includes('england') || 
        lower.includes('germany') || lower.includes('france') || lower.includes('italy') || 
        lower.includes('spain') || lower.includes('netherlands') || lower.includes('switzerland') || 
        lower.includes('sweden') || lower.includes('norway') || lower.includes('europe') || lower.includes('denmark')) {
        return REGIONAL_CONFIGS[REGIONS.EUROPE];
    }

    // Americas check
    if (lower.includes('united states') || lower.includes('america') || lower.includes('usa') || 
        lower.includes('canada') || lower.includes('mexico') || lower.includes('brazil') || lower.includes('argentina')) {
        return REGIONAL_CONFIGS[REGIONS.AMERICAS];
    }

    // Default to Europe/Americas standard
    return REGIONAL_CONFIGS[REGIONS.EUROPE];
};

