'use strict';
const products = JSON.parse(document.getElementById('admin-products').textContent);
const field = id => document.getElementById(id);
function productDialog(product = null) {
    field('product-form').reset();
    field('product-id').value = product?.id || 0;
    field('product-modal-title').textContent = product ? 'Edit product' : 'Add product';
    field('product-name').value = product?.name || '';
    field('product-price').value = product ? (product.price / 100).toFixed(2) : '';
    field('product-category').value = product?.category_id || 1;
    field('product-image').value = product ? product.image.split('/').pop().replace('.svg', '') : 'milk-tea';
    field('initial-stock-field').hidden = Boolean(product);
    field('product-stock').disabled = Boolean(product);
    field('edit-stock-note').hidden = !product;
    field('product-dialog').showModal();
}
field('new-product').addEventListener('click', () => productDialog());
document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => productDialog(products.find(product => product.id === Number(button.dataset.edit)))));
document.querySelectorAll('[data-restock]').forEach(button => button.addEventListener('click', () => {
    const product = products.find(product => product.id === Number(button.dataset.restock));
    field('restock-id').value = product.id;
    field('restock-name').textContent = `${product.name} · ${product.stock} cups currently available`;
    field('restock-quantity').value = 10;
    field('restock-dialog').showModal();
}));
document.querySelectorAll('.delete-form').forEach(form => form.addEventListener('submit', event => {
    if (!confirm('Delete this drink from the menu? Previous sales and receipts will be kept.')) event.preventDefault();
}));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => field(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
