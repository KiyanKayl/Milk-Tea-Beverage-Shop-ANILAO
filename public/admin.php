<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
$db = database();
$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        require_csrf();
        manage_product($db, $_POST);
        $_SESSION['flash'] = 'Product changes saved.';
        header('Location: admin.php');
        exit;
    } catch (InvalidArgumentException $exception) {
        $error = $exception->getMessage();
    } catch (Throwable $exception) {
        error_log((string) $exception);
        $error = 'Unable to save this change. Please try again.';
    }
}
$products = catalog($db);
$categories = query($db, 'SELECT * FROM categories ORDER BY id')->fetchAll();
$page = 'admin';
$title = 'Products';
require dirname(__DIR__) . '/app/views/header.php';
?>
<div class="page-heading"><div><p class="eyebrow">A WELL-STOCKED HAPPY PLACE</p><h1>Your drink collection</h1><p>Manage the menu and keep the good stuff coming.</p></div><button id="new-product" class="button primary"><?= icon('plus') ?> Add product</button></div>
<?php if ($error): ?><p class="alert error" role="alert"><?= escape($error) ?></p><?php endif; ?>
<?php if (isset($_SESSION['flash'])): ?><p class="alert success" role="status"><?= escape($_SESSION['flash']) ?></p><?php unset($_SESSION['flash']); endif; ?>
<div class="summary-grid"><div class="summary-card"><span>Drinks on the menu</span><strong><?= count($products) ?></strong><small>Across <?= count($categories) ?> categories</small></div><div class="summary-card"><span>Cups available</span><strong><?= array_sum(array_column($products, 'stock')) ?></strong><small>Ready for their next order</small></div><div class="summary-card"><span>Low stock</span><strong><?= count(array_filter($products, fn($product) => $product['stock'] < 10)) ?></strong><small>Products with fewer than 10 cups</small></div></div>
<div class="table-panel"><div class="table-heading"><h2>All products</h2><span><?= count($products) ?> drinks</span></div><div class="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Regular price</th><th>Available stock</th><th>Actions</th></tr></thead><tbody>
<?php foreach ($products as $product): ?>
<tr><td><div class="table-product"><img src="<?= escape($product['image']) ?>" alt=""><strong><?= escape($product['name']) ?></strong></div></td><td><?= escape($product['category']) ?></td><td><?= money((int) $product['price']) ?></td><td><span class="inventory-badge <?= $product['stock'] < 10 ? 'low-stock' : '' ?>"><?= $product['stock'] ?> cups</span></td><td><div class="table-actions"><button class="text-button" data-edit="<?= $product['id'] ?>">Edit</button><button class="text-button" data-restock="<?= $product['id'] ?>">Restock</button><form method="post" class="delete-form"><input type="hidden" name="csrf" value="<?= escape($_SESSION['csrf']) ?>"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $product['id'] ?>"><button class="text-button danger" type="submit">Delete</button></form></div></td></tr>
<?php endforeach; ?>
<?php if (!$products): ?><tr><td colspan="5" class="empty-message">Your menu is empty. Add your first drink.</td></tr><?php endif; ?>
</tbody></table></div></div>
<dialog id="product-dialog" class="modal"><form method="post" id="product-form"><input type="hidden" name="csrf" value="<?= escape($_SESSION['csrf']) ?>"><input type="hidden" name="action" value="save"><input type="hidden" name="id" value="0" id="product-id"><div class="modal-header"><h2 id="product-modal-title">Add product</h2><button type="button" class="close-button" data-close="product-dialog" aria-label="Close">×</button></div>
<label class="form-field">Product name<input name="name" id="product-name" maxlength="100" required></label>
<div class="form-row"><label class="form-field">Category<select name="category_id" id="product-category"><?php foreach ($categories as $category): ?><option value="<?= $category['id'] ?>"><?= escape($category['name']) ?></option><?php endforeach; ?></select></label><label class="form-field">Regular price (₱)<input name="price" id="product-price" type="number" min="0.01" max="1000000" step="0.01" required></label></div>
<label class="form-field">Product image<select name="image" id="product-image"><?php foreach (product_images() as $image): ?><option value="<?= $image ?>"><?= escape(ucwords(str_replace('-', ' ', $image))) ?></option><?php endforeach; ?></select></label>
<label class="form-field" id="initial-stock-field">Initial stock<input name="stock" id="product-stock" type="number" min="0" max="1000000" step="1" value="0" required></label>
<p class="helper-text" id="edit-stock-note" hidden>Use Restock to add inventory. Current stock is kept when editing.</p>
<div class="modal-footer"><button type="button" class="button secondary" data-close="product-dialog">Cancel</button><button type="submit" class="button primary">Save product</button></div></form></dialog>
<dialog id="restock-dialog" class="modal"><form method="post"><input type="hidden" name="csrf" value="<?= escape($_SESSION['csrf']) ?>"><input type="hidden" name="action" value="restock"><input type="hidden" name="id" id="restock-id"><div class="modal-header"><h2>Restock drink</h2><button type="button" class="close-button" data-close="restock-dialog" aria-label="Close">×</button></div><p id="restock-name"></p><label class="form-field">Cups to add<input name="quantity" id="restock-quantity" type="number" min="1" max="1000000" step="1" value="10" required></label><div class="modal-footer"><button type="submit" class="button primary">Add to stock</button></div></form></dialog>
<script type="application/json" id="admin-products"><?= json_encode($products, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
<script src="assets/js/admin.js" defer></script>
<?php require dirname(__DIR__) . '/app/views/footer.php'; ?>
