'use strict';
const $ = selector => document.querySelector(selector);
const formatMoney = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
const safe = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const state = { products: [], category: 'all' };
function renderProducts() {
    const search = $('#search').value.trim().toLowerCase();
    const products = state.products.filter(product => (state.category === 'all' || String(product.category_id) === state.category) && product.name.toLowerCase().includes(search));
    $('#menu-title').textContent = state.category === 'all' ? 'Our menu' : document.querySelector(`.category[data-category="${state.category}"]`).textContent;
    $('#menu-count').textContent = `${products.length} drinks to discover`;
    $('#products').innerHTML = products.length ? products.map(product => {
        const remaining = product.stock;
        return `<button class="product-card ${remaining <= 0 ? 'sold-out' : ''}" data-product="${product.id}" disabled>
            <div class="product-image"><img src="${safe(product.image)}" alt="${safe(product.name)}"><span class="stock-pill ${remaining < 10 ? 'low-stock' : ''}">${remaining > 0 ? `${remaining} available` : 'Sold out'}</span></div>
            <div class="product-info"><span class="product-category">${safe(product.category)}</span><h3>${safe(product.name)}</h3><div class="product-bottom"><strong>${formatMoney(product.price)}</strong><span class="add-product" aria-hidden="true">+</span></div></div></button>`;
    }).join('') : '<div class="empty-message">No drinks found. Try another search or category.</div>';
}


$('#cart').innerHTML = '<div class="empty-cart"><h3>Your next great drink starts here.</h3><p>Ordering will be enabled in the next project stage.</p></div>';
$('#clear-cart').disabled = true;
$('#cash').disabled = true;
document.querySelectorAll('[data-cash]').forEach(button => { button.disabled = true; });
$('#search').addEventListener('input', renderProducts);
document.querySelectorAll('.category').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    document.querySelectorAll('.category').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
    });
    renderProducts();
}));
fetch('api.php').then(response => response.json()).then(data => {
    state.products = data.products;
    $('#product-count').textContent = state.products.length;
    renderProducts();
}).catch(() => { $('#products').textContent = 'Unable to load the menu.'; });
