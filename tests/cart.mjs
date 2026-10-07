// Exercise the actual cashier JavaScript with a small DOM/fetch harness.
// No external packages, browser installation, or live database are needed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = readFileSync(fileURLToPath(new URL('../public/assets/js/pos.js', import.meta.url)), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; console.log(`PASS: ${message}`); }
const initial = {
    products: [{ id: 1, category_id: 1, category: 'Milk Tea', name: 'Classic Milk Tea', price: 9500, stock: 40, image: 'assets/images/milk-tea.svg' }],
    addons: [{ id: 1, name: 'Pearls', price: 1500 }, { id: 3, name: 'Pudding', price: 2000 }],
    large_surcharge: 2000,
};
const copy = object => JSON.parse(JSON.stringify(object));
const storage = new Map();
let menu = copy(initial);
let posts = [];
let menuUnavailable = false;
let postHandler = async () => {
    menu.products[0].stock = 1;
    menu.products[0].price = 11000;
    throw new Error('Connection lost after saving sale');
};

class Element {
    constructor() { this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = true; this.disabled = false; this.events = {}; this.dataset = {}; this.classList = { toggle() {} }; this.content = 'test-csrf-token'; }
    addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
    async dispatch(type, target = this) { for (const callback of this.events[type] || []) await callback({ target, preventDefault() {} }); }
    querySelector() { return this.span ||= new Element(); }
    setAttribute() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
}

function harness() {
    const elements = new Map();
    const element = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
    const form = element('#customize-form');
    form.reset = () => { form.fields = { size: 'Regular', sweetness: '100', ice: 'Regular Ice', addons: [] }; element('#drink-quantity').value = '1'; };
    form.reset();
    const category = new Element(); category.dataset.category = 'all';
    const shortcut = new Element(); shortcut.dataset.cash = 'exact';
    const context = vm.createContext({
        console, Intl,
        document: { querySelector: element, getElementById: id => element('#' + id), querySelectorAll: selector => selector === '.category' ? [category] : selector === '[data-cash]' ? [shortcut] : selector === 'dialog' ? [element('#customize-dialog'), element('#success-dialog')] : [] },
        window: { addEventListener() {} },
        sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        crypto: { randomUUID: () => 'cart-test-reference-0001' },
        FormData: class { constructor(form) { this.form = form; } get(key) { return key === 'quantity' ? element('#drink-quantity').value : this.form.fields[key]; } getAll(key) { return this.form.fields[key]; } },
        fetch: async (url, options) => {
            if (!options?.method) {
                if (menuUnavailable) throw new Error('Menu refresh unavailable');
                return { ok: true, json: async () => copy(menu) };
            }
            const payload = JSON.parse(options.body);
            posts.push(payload);
            return postHandler(payload);
        },
        confirm: () => true,
        location: { reload() {} },
        setTimeout: () => 1, clearTimeout() {},
    });
    vm.runInContext(source, context);
    return { element, run: code => vm.runInContext(code, context), shortcut };
}

const h = harness();
await new Promise(resolve => setImmediate(resolve));
check(h.run('state.catalogReady') === true, 'Cashier loads the catalog');
h.run('openCustomization(1)');
h.element('#customize-form').fields = { size: 'Large', sweetness: '25', ice: 'Less Ice', addons: ['1', '3'] };
h.element('#drink-quantity').value = '2';
h.run('updateCustomization()');
check(h.element('#custom-price').textContent.includes('300.00'), 'Customization preview calculates quantity, size and add-ons');
await h.element('#customize-form').dispatch('submit');
check(h.run('cartTotal()') === 30000 && h.run('reserved(1)') === 2, 'Adding customized drinks calculates the cart total and reserved stock');
h.element('#cash').value = '-1'; h.run('renderPayment()');
check(h.element('#checkout').disabled, 'Negative cash cannot enable payment');
h.element('#cash').value = '299.99'; h.run('renderPayment()');
await h.element('#checkout').dispatch('click');
check(h.element('#checkout').disabled && posts.length === 0, 'Underpayment never sends a checkout request');
h.element('#cash').value = '500.00'; h.run('renderPayment()');
check(!h.element('#checkout').disabled && h.element('#change').textContent.includes('200.00'), 'Sufficient cash enables payment and shows correct change');

// Confirm refreshed prices and stock affect existing cart lines.
menu.products[0].price = 10000;
await h.run('loadCatalog()');
check(h.run('cartTotal()') === 31000 && h.element('#total').textContent.includes('310.00'), 'Menu refresh recalculates existing cart prices and displayed total');
menu.products[0].stock = 1;
await h.run('loadCatalog()');
check(h.element('#checkout').disabled && h.element('#payment-error').textContent.includes('only 1'), 'Reduced stock blocks payment until cart quantities are corrected');
menu.products[0].stock = 40;
await h.run('loadCatalog()');

// A successful server commit with a lost response must retain one retry key.
await h.element('#checkout').dispatch('click');
check(posts.length === 1 && posts[0].expected_total === 31000, 'Checkout sends the displayed total as a consistency check');
const originalPayload = JSON.stringify(posts[0]);
check(h.run('orderLocked()') && h.element('#cash').disabled && h.element('#clear-cart').disabled, 'Uncertain payments lock cash and cart edits');
check(!h.element('#checkout').disabled && h.element('#checkout').querySelector('span').textContent === 'Retry payment', 'Uncertain payment can be retried even if its stock was already deducted');
check(storage.size === 1, 'Uncertain payment is saved for page-refresh recovery');
check(h.run('cartTotal()') === 31000 && h.run('cartIssue()') !== null, 'Uncertain payment keeps original prices despite changed catalog and insufficient remaining stock');
await h.shortcut.dispatch('click');
await h.element('#clear-cart').dispatch('click');
check(h.run('cartTotal()') === 31000 && h.element('#cash').value === '500.00', 'Cash shortcuts and clear-order controls cannot change an uncertain payment');

const restored = harness();
await new Promise(resolve => setImmediate(resolve));
check(restored.run('state.pendingPayment !== null') && restored.run('cartTotal()') === 31000, 'Page reload restores the unresolved payment and its cart');
postHandler = async () => ({ ok: true, status: 200, json: async () => ({ success: true, sale: { id: 1, transaction_number: 'TEST-SALE-001' } }) });
await restored.element('#checkout').dispatch('click');
check(JSON.stringify(posts.at(-1)) === originalPayload, 'Retry sends exactly the original checkout payload');
check(restored.run('state.cart.length') === 0 && storage.size === 0, 'Confirmed success clears the cart and stored pending payment');
check(restored.element('#payment-error').hidden && restored.element('#success-dialog').open, 'Successful retry shows receipt dialog without stale payment errors');

// Explicit rejection releases the cart and applies refreshed stock/prices.
menu.products[0].stock = 40;
menu.products[0].price = 10000;
await restored.run('loadCatalog()');
restored.run('openCustomization(1)');
await restored.element('#customize-form').dispatch('submit');
restored.element('#cash').value = '500.00';
postHandler = async () => ({ ok: false, status: 422, json: async () => ({ error: 'Menu prices changed. Review the updated total before paying.' }) });
menu.products[0].price = 10500;
await restored.element('#checkout').dispatch('click');
check(!restored.run('orderLocked()') && storage.size === 0, 'Explicit server rejection unlocks the order and clears the retry key');
check(restored.run('cartTotal()') === 10500 && restored.element('#total').textContent.includes('105.00'), 'Rejected stale payment refreshes the cart before retrying');

// Preserve aggregate quantities and reject invalid customization quantities.
restored.run('openCustomization(1)');
restored.element('#drink-quantity').value = '2';
await restored.element('#customize-form').dispatch('submit');
check(restored.run('state.cart.length') === 1 && restored.run('state.cart[0].quantity') === 3, 'Identical customization lines merge quantities');
restored.run('openCustomization(1)');
restored.element('#drink-quantity').value = '-2';
await restored.element('#customize-form').dispatch('submit');
check(restored.run('reserved(1)') === 3, 'Negative customization quantities cannot change the cart');
const quantityTarget = delta => ({ closest: selector => selector === '[data-quantity]' ? { dataset: { quantity: '0', delta: String(delta) } } : null });
await restored.element('#cart').dispatch('click', quantityTarget(1));
check(restored.run('state.cart[0].quantity') === 4 && restored.run('cartTotal()') === 42000, 'Plus control updates quantity and total');
await restored.element('#cart').dispatch('click', quantityTarget(-1));
check(restored.run('state.cart[0].quantity') === 3 && restored.run('cartTotal()') === 31500, 'Minus control updates quantity and total');
for (let index = 0; index < 3; index++) await restored.element('#cart').dispatch('click', quantityTarget(-1));
check(restored.run('state.cart.length') === 0 && restored.run('cartTotal()') === 0, 'Reducing the last unit removes the line without negative quantity');
storage.set('steep-sip-pending-payment', '{broken');
const corrupt = harness();
await new Promise(resolve => setImmediate(resolve));
check(!corrupt.run('orderLocked()') && storage.size === 0, 'Malformed saved payment cannot crash the cashier page');
corrupt.run('openCustomization(1)');
await corrupt.element('#customize-form').dispatch('submit');
corrupt.element('#cash').value = '500.00';
postHandler = async () => {
    menuUnavailable = true;
    return { ok: true, status: 200, json: async () => ({ success: true, sale: { id: 2, transaction_number: 'TEST-SALE-002' } }) };
};
await corrupt.element('#checkout').dispatch('click');
check(corrupt.run('state.products[0].stock') === 39 && corrupt.run('state.cart.length') === 0, 'Confirmed sale deducts local availability even if refreshing the menu fails');
check(!corrupt.run('state.catalogReady') && corrupt.element('#checkout').disabled, 'Failed post-sale menu refresh blocks new payments until the catalog reloads');
console.log(`\nAll ${checks} cashier JavaScript checks passed.`);
