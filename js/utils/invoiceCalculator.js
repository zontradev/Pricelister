/**
 * invoiceCalculator.js
 * Centralized calculation logic for invoices.
 */

export const calculateInvoiceItem = (quantity, unitPrice, unitCost) => {
    const qty = parseInt(quantity || 0, 10);
    const price = parseFloat(unitPrice || 0);
    const cost = parseFloat(unitCost || 0);

    const totalPrice = qty * price;
    const itemProfit = totalPrice - (qty * cost);

    return {
        totalPrice,
        itemProfit
    };
};

export const calculateInvoiceTotal = (items, discountPercent, additionalCut, taxPercent = 0, shippingCost = 0, cutSign = null) => {
    let subtotal = 0;
    let totalProfit = 0;

    // Sum all items
    if (items && items.length > 0) {
        items.forEach(item => {
            const itemCalc = calculateInvoiceItem(item.quantity, item.unitPrice, item.unitCost);
            subtotal += itemCalc.totalPrice;
            totalProfit += itemCalc.itemProfit;
        });
    }

    let grandTotal = subtotal;
    let finalProfit = totalProfit;

    const discPct = parseFloat(discountPercent || 0);
    let discountAmount = 0;
    if (discPct > 0) {
        discountAmount = grandTotal * (discPct / 100);
        grandTotal -= discountAmount;
        finalProfit -= discountAmount; // discount eats into profit
    }

    let addCut = parseFloat(additionalCut || 0);
    // If cutSign is explicitly provided, apply it: '-' cuts (subtracts), '+' adds
    if (cutSign === '-') {
        addCut = -Math.abs(addCut);
    } else if (cutSign === '+') {
        addCut = Math.abs(addCut);
    }

    if (addCut !== 0) {
        grandTotal += addCut;
        finalProfit += addCut;
    }

    const taxPct = parseFloat(taxPercent || 0);
    let taxAmount = 0;
    if (taxPct > 0) {
        taxAmount = Math.max(0, grandTotal) * (taxPct / 100);
        grandTotal += taxAmount; 
    }

    const shipping = parseFloat(shippingCost || 0);
    if (shipping > 0) {
        grandTotal += shipping;
    }

    return {
        subtotal,
        discountAmount,
        additionalCut: addCut,
        taxAmount,
        shippingAmount: shipping,
        grandTotal: Math.max(0, grandTotal),
        totalProfit: finalProfit
    };
};
