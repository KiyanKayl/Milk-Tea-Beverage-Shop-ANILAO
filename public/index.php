<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
$db = database();
$categories = query($db, 'SELECT * FROM categories ORDER BY id')->fetchAll();
$page = 'pos';
$title = 'Point of sale';
require dirname(__DIR__) . '/app/views/header.php';
?>
<section class="menu-panel">
    <div class="page-heading"><div><p class="eyebrow">LET’S MAKE SOMETHING GOOD</p><h1>What’s brewing?</h1><p>Pick a drink, make it theirs.</p></div><span class="pill"><?= icon('cup') ?> Freshly made</span></div>
    <label class="search-box"><?= icon('search') ?><input id="search" type="search" placeholder="Search for a drink…" aria-label="Search drinks"><span class="search-hint">MENU</span></label>
    <div class="categories" role="group" aria-label="Beverage categories">
        <button class="category active" data-category="all" aria-pressed="true">All drinks <span id="product-count">—</span></button>
        <?php foreach ($categories as $category): ?><button class="category" data-category="<?= $category['id'] ?>" aria-pressed="false"><?= escape($category['name']) ?></button><?php endforeach; ?>
    </div>
    <div class="section-heading"><h2 id="menu-title">Our menu</h2><span id="menu-count">Loading drinks…</span></div>
    <div id="products" class="product-grid" aria-live="polite"><p class="empty-message">Getting the menu ready…</p></div>
    <p class="menu-footnote"><span class="status-dot"></span> Every cup, a little moment of joy.</p>
</section>
<aside class="order-panel" aria-label="Current order">
    <div class="order-heading"><div><h2>Current order <span id="cart-count" class="count-badge">0</span></h2><p>A good day starts with a good drink.</p></div><button id="clear-cart" class="icon-button" aria-label="Clear order" title="Clear order"><?= icon('trash') ?></button></div>
    <div class="order-type"><span><?= icon('cup') ?> Takeaway</span><span>Fresh to go</span></div>
    <div id="cart" class="cart-items"></div>
    <div class="checkout-panel">
        <div class="total-line"><span>Subtotal</span><strong id="subtotal">₱0.00</strong></div>
        <div class="total-line final-total"><span>Total amount</span><strong id="total">₱0.00</strong></div>
        <label for="cash" class="field-label">Cash received <span>PHP</span></label>
        <div class="cash-input"><span>₱</span><input id="cash" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></div>
        <div class="cash-shortcuts"><button data-cash="exact">Exact amount</button><button data-cash="500">₱500</button><button data-cash="1000">₱1,000</button></div>
        <div class="change-line"><span>Change</span><strong id="change">₱0.00</strong></div>
        <p id="payment-error" class="inline-error" role="alert" hidden></p>
        <button id="checkout" class="button primary checkout-button" disabled><span>Complete payment</span><?= icon('arrow') ?></button>
        <p class="checkout-note">A receipt is ready after every sale.</p>
    </div>
</aside>
<dialog id="customize-dialog" class="modal">
    <form id="customize-form">
        <div class="modal-header"><div><p class="eyebrow">MAKE IT YOURS</p><h2 id="drink-name">Customize drink</h2></div><button type="button" class="close-button" data-close="customize-dialog" aria-label="Close customization">×</button></div>
        <div class="customize-preview"><img id="drink-image" src="assets/images/milk-tea.svg" alt=""><div><strong id="drink-base-price"></strong><p id="drink-stock"></p></div></div>
        <fieldset><legend>Size</legend><div class="choice-row"><label class="choice"><input type="radio" name="size" value="Regular" checked><span>Regular<small>Original price</small></span></label><label class="choice"><input type="radio" name="size" value="Large"><span>Large<small>+ ₱20.00</small></span></label></div></fieldset>
        <fieldset><legend>Sweetness</legend><div class="choice-row compact"><?php foreach ([0, 25, 50, 75, 100] as $level): ?><label class="choice"><input type="radio" name="sweetness" value="<?= $level ?>" <?= $level === 100 ? 'checked' : '' ?>><span><?= $level ?>%</span></label><?php endforeach; ?></div></fieldset>
        <fieldset><legend>Ice level</legend><div class="choice-row compact"><?php foreach (['No Ice', 'Less Ice', 'Regular Ice'] as $ice): ?><label class="choice"><input type="radio" name="ice" value="<?= $ice ?>" <?= $ice === 'Regular Ice' ? 'checked' : '' ?>><span><?= $ice ?></span></label><?php endforeach; ?></div></fieldset>
        <fieldset><legend>Add a little extra <small>Optional</small></legend><div id="addon-options" class="addon-grid"></div></fieldset>
        <div class="modal-footer"><label class="modal-quantity">Quantity <input id="drink-quantity" name="quantity" type="number" min="1" max="999" value="1" required></label><button id="add-to-cart" class="button primary" type="submit">Add to order · <span id="custom-price"></span></button></div>
    </form>
</dialog>
<dialog id="success-dialog" class="modal success-modal"><div class="success-icon"><?= icon('check') ?></div><p class="eyebrow">ALL SET!</p><h2>One happy order.</h2><p>Payment received. Let’s get brewing.</p><p id="sale-number" class="sale-number"></p><a id="receipt-link" class="button primary" target="_blank" rel="noopener">View & print receipt</a><button class="button secondary" data-close="success-dialog">Start next order</button></dialog>
<script src="assets/js/pos.js" defer></script>
<?php require dirname(__DIR__) . '/app/views/footer.php'; ?>
