'use strict';

const $ = selector => document.querySelector(selector);
const formatMoney = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
const state = { products: [], addons: [], surcharge: 2000, cart: [], category: 'all', selected: null, busy: false, requestKey: null, pendingPayment: null, catalogReady: false };
const safe = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
let toastTimer;

function toast(message) {
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}

async function loadCatalog() {
    const response = await fetch('api.php', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load the menu.');
    state.products = data.products;
    state.addons = data.addons;
    state.surcharge = data.large_surcharge;
    state.catalogReady = true;
    // Do not change an uncertain payment; retries must send its original data.
    if (!state.pendingPayment) refreshCartPrices();
    $('#product-count').textContent = state.products.length;
    renderCart();
}

function priceFor(product, size, addonIds) {
    return product.price + (size === 'Large' ? state.surcharge : 0)
        + addonIds.reduce((sum, id) => sum + (state.addons.find(addon => addon.id === id)?.price || 0), 0);
}

function refreshCartPrices() {
    for (const item of state.cart) {
        const product = state.products.find(product => product.id === item.product_id);
        if (!product) continue; // Keep unavailable items visible so they can be removed.
        item.name = product.name;
        item.image = product.image;
        item.unit_price = priceFor(product, item.size, item.addons);
    }
}

function cartIssue() {
    if (!state.catalogReady) return 'Load the menu before completing payment.';
    const required = new Map();
    for (const item of state.cart) {
        const product = state.products.find(product => product.id === item.product_id);
        if (!product) return `${item.name} is no longer available. Remove it from the order.`;
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) return 'Choose a valid whole-number quantity.';
        if (item.addons.some(id => !state.addons.some(addon => addon.id === id))) return 'An add-on is no longer available. Remove that drink and select it again.';
        required.set(item.product_id, (required.get(item.product_id) || 0) + item.quantity);
        if (required.get(item.product_id) > product.stock) return `${product.name} has only ${product.stock} in stock. Update your order.`;
    }
    return null;
}

function orderLocked() {
    return state.busy || Boolean(state.pendingPayment);
}

const pendingStorageKey = 'steep-sip-pending-payment';

function savePendingPayment() {
    try {
        sessionStorage.setItem(pendingStorageKey, JSON.stringify({ payment: state.pendingPayment, cart: state.cart }));
    } catch {
        toast('Keep this tab open until the payment is resolved.');
    }
}

function clearPendingPayment() {
    state.pendingPayment = null;
    state.requestKey = null;
    try { sessionStorage.removeItem(pendingStorageKey); } catch { /* Memory retry still works. */ }
}

function restorePendingPayment() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(pendingStorageKey) || 'null');
        if (!saved) return;
        const payment = saved.payment;
        if (!payment || !/^[a-zA-Z0-9-]{16,80}$/.test(payment.request_key)
            || typeof payment.cash !== 'string' || !Array.isArray(payment.items)
            || !Array.isArray(saved.cart) || saved.cart.length < 1 || saved.cart.length > 100
            || saved.cart.some(item => !item || !Number.isInteger(item.product_id)
                || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999
                || !Number.isSafeInteger(item.unit_price) || item.unit_price < 1
                || typeof item.name !== 'string' || typeof item.image !== 'string' || !Array.isArray(item.addons))) {
            throw new Error('Invalid saved payment.');
        }
        state.pendingPayment = payment;
        state.requestKey = payment.request_key;
        state.cart = saved.cart;
        $('#cash').value = payment.cash;
    } catch {
        clearPendingPayment();
    }
}

function renderProducts() {
    const search = $('#search').value.trim().toLowerCase();
    const products = state.products.filter(product => (state.category === 'all' || String(product.category_id) === state.category) && product.name.toLowerCase().includes(search));
    $('#menu-title').textContent = state.category === 'all' ? 'Our menu' : document.querySelector(`.category[data-category="${state.category}"]`).textContent;
    $('#menu-count').textContent = `${products.length} drinks to discover`;
    $('#products').innerHTML = products.length ? products.map(product => {
        const remaining = Math.max(0, product.stock - reserved(product.id));
        return `<button class="product-card ${remaining <= 0 ? 'sold-out' : ''}" data-product="${product.id}" ${remaining <= 0 || !state.catalogReady || orderLocked() ? 'disabled' : ''}>
            <div class="product-image"><img src="${safe(product.image)}" alt="${safe(product.name)}"><span class="stock-pill ${remaining < 10 ? 'low-stock' : ''}">${remaining > 0 ? `${remaining} available` : 'Sold out'}</span></div>
            <div class="product-info"><span class="product-category">${safe(product.category)}</span><h3>${safe(product.name)}</h3><div class="product-bottom"><strong>${formatMoney(product.price)}</strong><span class="add-product" aria-hidden="true">+</span></div></div></button>`;
    }).join('') : '<div class="empty-message">No drinks found. Try another search or category.</div>';
}

function reserved(productId) {
    return state.cart.filter(item => item.product_id === productId).reduce((sum, item) => sum + item.quantity, 0);
}

function openCustomization(id) {
    if (orderLocked()) return;
    const product = state.products.find(item => item.id === id);
    if (!product || product.stock <= reserved(id)) return;
    state.selected = product;
    $('#customize-form').reset();
    $('#drink-name').textContent = product.name;
    $('#drink-image').src = product.image;
    $('#drink-image').alt = product.name;
    $('#drink-base-price').textContent = formatMoney(product.price);
    const available = Math.min(999, product.stock - reserved(id));
    $('#drink-stock').textContent = `${available} available for this order`;
    $('#drink-quantity').max = available;
    $('#addon-options').innerHTML = state.addons.map(addon => `<label class="addon-option"><input type="checkbox" name="addons" value="${addon.id}"><span>${safe(addon.name)}</span><small>+ ${formatMoney(addon.price)}</small></label>`).join('');
    updateCustomization();
    $('#customize-dialog').showModal();
}

function customization() {
    const form = new FormData($('#customize-form'));
    const addons = form.getAll('addons').map(Number).sort((a, b) => a - b);
    const size = form.get('size');
    const price = priceFor(state.selected, size, addons);
    return { product_id: state.selected.id, name: state.selected.name, image: state.selected.image, size, sweetness: Number(form.get('sweetness')), ice: form.get('ice'), addons, quantity: Number(form.get('quantity')), unit_price: price };
}

function updateCustomization() {
    if (!state.selected) return;
    const item = customization();
    $('#custom-price').textContent = formatMoney(item.unit_price * (Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1));
}

function itemKey(item) {
    return JSON.stringify([item.product_id, item.size, item.sweetness, item.ice, item.addons]);
}

function invalidateCheckout() {
    // Edits are only allowed when there is no uncertain payment to resolve.
    if (state.pendingPayment) return;
    state.requestKey = null;
    $('#payment-error').hidden = true;
}

function renderCart() {
    const quantity = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    $('#cart-count').textContent = quantity;
    $('#clear-cart').disabled = !quantity || orderLocked();
    $('#cart').innerHTML = state.cart.length ? state.cart.map((item, index) => {
        const extras = item.addons.map(id => state.addons.find(addon => addon.id === id)?.name || 'Add-on');
        return `<div class="cart-item"><img src="${safe(item.image)}" alt=""><div class="cart-item-content"><div class="cart-item-heading"><h3>${safe(item.name)}</h3><button class="remove-item" data-remove="${index}" aria-label="Remove ${safe(item.name)}" ${orderLocked() ? 'disabled' : ''}>×</button></div>
            <p>${safe(item.size)} · ${item.sweetness}% sugar · ${safe(item.ice)}</p>${extras.length ? `<p class="cart-addons">+ ${safe(extras.join(', '))}</p>` : ''}
            <div class="cart-item-bottom"><div class="quantity-control"><button data-quantity="${index}" data-delta="-1" aria-label="Decrease quantity" ${orderLocked() ? 'disabled' : ''}>−</button><span>${item.quantity}</span><button data-quantity="${index}" data-delta="1" aria-label="Increase quantity" ${orderLocked() ? 'disabled' : ''}>+</button></div><div class="line-price"><strong>${formatMoney(item.unit_price * item.quantity)}</strong><small>${formatMoney(item.unit_price)} each</small></div></div></div></div>`;
    }).join('') : '<div class="empty-cart"><div class="empty-cart-icon">♧</div><h3>Your next great drink<br>starts here.</h3><p>Choose a drink from the menu<br>to start a new order.</p></div>';
    renderPayment();
    renderProducts();
}

function cartTotal() {
    return state.cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}

function cashCents() {
    const value = $('#cash').value;
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
    const [whole, decimal = ''] = value.split('.');
    return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}

function renderPayment() {
    const total = cartTotal();
    const cash = cashCents();
    const issue = cartIssue();
    $('#subtotal').textContent = formatMoney(total);
    $('#total').textContent = formatMoney(total);
    $('#change').textContent = formatMoney(cash === null ? 0 : Math.max(0, cash - total));
    $('#cash').disabled = orderLocked();
    document.querySelectorAll('[data-cash]').forEach(button => { button.disabled = orderLocked(); });
    $('#checkout').disabled = state.busy || (!state.pendingPayment && (!total || issue !== null || cash === null || cash < total));
    $('#checkout').querySelector('span').textContent = state.busy ? 'Processing payment…' : state.pendingPayment ? 'Retry payment' : 'Complete payment';
    if (!state.busy && state.pendingPayment) {
        $('#payment-error').textContent = 'Payment status is uncertain. Retry this payment before changing the order.';
        $('#payment-error').hidden = false;
    } else if (!state.busy && total && issue) {
        $('#payment-error').textContent = issue;
        $('#payment-error').hidden = false;
    } else if (!state.busy && total && $('#cash').value) {
        $('#payment-error').textContent = cash === null ? 'Enter a valid cash amount.' : cash < total ? `${formatMoney(total - cash)} more needed to complete payment.` : '';
        $('#payment-error').hidden = cash !== null && cash >= total;
    } else if (!state.busy) {
        $('#payment-error').hidden = true;
    }
}

$('#search').addEventListener('input', renderProducts);
document.querySelectorAll('.category').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    document.querySelectorAll('.category').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
    });
    renderProducts();
}));
$('#products').addEventListener('click', event => {
    const button = event.target.closest('[data-product]');
    if (button && !orderLocked()) openCustomization(Number(button.dataset.product));
});
$('#customize-form').addEventListener('input', updateCustomization);
$('#customize-form').addEventListener('submit', event => {
    event.preventDefault();
    if (orderLocked()) return;
    const item = customization();
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || reserved(item.product_id) + item.quantity > state.selected.stock) {
        toast('There isn’t enough stock for that quantity.');
        return;
    }
    const match = state.cart.find(line => itemKey(line) === itemKey(item));
    if (match && match.quantity + item.quantity > 999) {
        toast('A cart line can contain at most 999 drinks.');
        return;
    }
    if (!match && state.cart.length >= 100) {
        toast('An order can contain at most 100 different selections.');
        return;
    }
    if (match) match.quantity += item.quantity;
    else state.cart.push(item);
    invalidateCheckout();
    renderCart();
    $('#customize-dialog').close();
    toast(`${item.name} added to your order.`);
});
$('#cart').addEventListener('click', event => {
    if (orderLocked()) return;
    const remove = event.target.closest('[data-remove]');
    const quantity = event.target.closest('[data-quantity]');
    if (remove) state.cart.splice(Number(remove.dataset.remove), 1);
    else if (quantity) {
        const index = Number(quantity.dataset.quantity);
        const item = state.cart[index];
        const delta = Number(quantity.dataset.delta);
        const product = state.products.find(product => product.id === item.product_id);
        if (delta > 0 && (!product || reserved(item.product_id) >= product.stock || item.quantity >= 999)) {
            toast('You’ve reached the available stock or quantity limit.');
            return;
        }
        item.quantity += delta;
        if (item.quantity === 0) state.cart.splice(index, 1);
    } else return;
    invalidateCheckout();
    renderCart();
});
$('#clear-cart').addEventListener('click', () => {
    if (!orderLocked() && state.cart.length && confirm('Clear all drinks from this order?')) {
        state.cart = [];
        invalidateCheckout();
        renderCart();
    }
});
$('#cash').addEventListener('input', () => { if (!orderLocked()) { invalidateCheckout(); renderPayment(); } });
document.querySelectorAll('[data-cash]').forEach(button => button.addEventListener('click', () => {
    if (orderLocked()) return;
    $('#cash').value = button.dataset.cash === 'exact' ? (cartTotal() / 100).toFixed(2) : button.dataset.cash;
    invalidateCheckout();
    renderPayment();
}));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));

$('#checkout').addEventListener('click', async () => {
    if (state.busy || (!state.pendingPayment && (!state.cart.length || cartIssue() || cashCents() === null || cashCents() < cartTotal()))) return;
    state.busy = true;
    state.requestKey ||= globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Keep the exact payload until the server confirms success or rejection.
    state.pendingPayment ||= {
        request_key: state.requestKey,
        cash: $('#cash').value,
        expected_total: cartTotal(),
        items: state.cart.map(({ product_id, size, sweetness, ice, addons, quantity }) => ({ product_id, size, sweetness, ice, addons, quantity })),
    };
    savePendingPayment();
    let paymentError = null;
    $('#payment-error').hidden = true;
    renderCart();
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': $('meta[name="csrf-token"]').content },
            body: JSON.stringify(state.pendingPayment),
        });
        // Explicit client errors mean checkout was rejected; edits may resume.
        if (response.status >= 400 && response.status < 500) clearPendingPayment();
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Payment could not be completed.');
        }
        if (!result.success || !Number.isInteger(result.sale?.id) || !result.sale?.transaction_number) {
            throw new Error('Payment response was incomplete. Retry to check its status.');
        }
        $('#sale-number').textContent = result.sale.transaction_number;
        $('#receipt-link').href = `receipt.php?id=${result.sale.id}`;
        // Apply the confirmed deduction locally even if refreshing the menu fails.
        for (const item of state.cart) {
            const product = state.products.find(product => product.id === item.product_id);
            if (product) product.stock = Math.max(0, product.stock - item.quantity);
        }
        state.cart = [];
        clearPendingPayment();
        $('#cash').value = '';
        $('#success-dialog').showModal();
        await loadCatalog().catch(() => {
            state.catalogReady = false;
            toast('Sale saved. Refresh the menu before starting the next payment.');
        });
    } catch (error) {
        paymentError = error.message || 'Connection interrupted. Retry this payment to check its status.';
        toast(paymentError);
        await loadCatalog().catch(() => {});
    } finally {
        state.busy = false;
        renderCart();
        if (paymentError && !state.pendingPayment) {
            $('#payment-error').textContent = paymentError;
            $('#payment-error').hidden = false;
        }
    }
});

// Recover only unresolved payments. Ordinary carts still reset on refresh.
restorePendingPayment();
window.addEventListener('beforeunload', event => {
    if (state.pendingPayment) {
        event.preventDefault();
        event.returnValue = '';
    }
});
renderCart();
loadCatalog().catch(error => {
    $('#products').innerHTML = '<p class="empty-message">The menu couldn’t load. <button id="retry-menu" class="button secondary">Try again</button></p>';
    $('#menu-count').textContent = 'Menu unavailable';
    $('#retry-menu').addEventListener('click', () => location.reload());
    toast(error.message);
});
