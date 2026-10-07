<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
$db = database();
$page = 'sales';
$title = 'Sales history';
$error = null;
$date = is_string($_GET['date'] ?? null) ? $_GET['date'] : '';
if ($date !== '') {
    $valid = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$valid || $valid->format('Y-m-d') !== $date) {
        $error = 'Choose a valid date.';
        $date = '';
    }
}
$currentPage = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: 1;
$where = $date ? ' WHERE created_at >= ? AND created_at < ?' : '';
$parameters = $date ? [$date . ' 00:00:00', (new DateTimeImmutable($date))->modify('+1 day')->format('Y-m-d 00:00:00')] : [];
$summary = query($db, 'SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM transactions' . $where, $parameters)->fetch();
$pages = max(1, (int) ceil($summary['count'] / 20));
$currentPage = min($currentPage, $pages);
$statement = $db->prepare('SELECT t.*, (SELECT SUM(quantity) FROM transaction_items WHERE transaction_id = t.id) AS cups FROM transactions t' . $where . ' ORDER BY id DESC LIMIT ? OFFSET ?');
foreach ($parameters as $index => $value) $statement->bindValue($index + 1, $value, PDO::PARAM_STR);
$statement->bindValue(count($parameters) + 1, 20, PDO::PARAM_INT);
$statement->bindValue(count($parameters) + 2, ($currentPage - 1) * 20, PDO::PARAM_INT);
$statement->execute();
$sales = $statement->fetchAll();
$selected = null;
if (isset($_GET['id'])) {
    try { $selected = sale_details($db, integer($_GET['id'], 'Transaction', 1)); }
    catch (InvalidArgumentException $exception) { $error = $exception->getMessage(); }
    if (!$selected && !$error) $error = 'Transaction was not found.';
}
require dirname(__DIR__) . '/app/views/header.php';
?>
<div class="page-heading"><div><p class="eyebrow">EVERY CUP COUNTS</p><h1>A record of happy sips</h1><p>Browse past orders and revisit any receipt.</p></div><form class="date-filter" method="get"><label for="sales-date">Sales date</label><input type="date" name="date" id="sales-date" value="<?= escape($date) ?>"><button class="button primary" type="submit">Filter</button><?php if ($date): ?><a href="sales.php" class="text-button">Clear</a><?php endif; ?></form></div>
<?php if ($error): ?><p class="alert error" role="alert"><?= escape($error) ?></p><?php endif; ?>
<div class="summary-grid"><div class="summary-card"><span><?= $date ? 'Sales on ' . escape($date) : 'All-time sales' ?></span><strong><?= money((int) $summary['total']) ?></strong><small>Completed cash payments</small></div><div class="summary-card"><span>Completed orders</span><strong><?= $summary['count'] ?></strong><small>Every order, saved</small></div><div class="summary-card"><span>Average order</span><strong><?= money($summary['count'] ? (int) round($summary['total'] / $summary['count']) : 0) ?></strong><small>Per completed transaction</small></div></div>
<?php if ($selected): ?><section class="table-panel sale-detail"><div class="table-heading"><div><h2><?= escape($selected['transaction_number']) ?></h2><p><?= escape($selected['created_at']) ?> · Manila time</p></div><a class="button primary" href="receipt.php?id=<?= $selected['id'] ?>" target="_blank" rel="noopener">Print receipt</a></div><div class="table-scroll"><table><thead><tr><th>Drink & customizations</th><th>Quantity</th><th>Unit price</th><th>Subtotal</th></tr></thead><tbody><?php foreach ($selected['items'] as $item): ?><tr><td><strong><?= escape($item['product_name']) ?></strong><p class="table-small"><?= escape($item['size']) ?> · <?= $item['sweetness'] ?>% sugar · <?= escape($item['ice']) ?><?php $addons = json_decode($item['addons_json'], true); if ($addons): ?><br>+ <?= escape(implode(', ', array_column($addons, 'name'))) ?><?php endif; ?></p></td><td><?= $item['quantity'] ?></td><td><?= money((int) $item['unit_price']) ?></td><td><?= money((int) $item['subtotal']) ?></td></tr><?php endforeach; ?></tbody></table></div><div class="sale-totals"><span>Total <strong><?= money((int) $selected['total']) ?></strong></span><span>Cash <strong><?= money((int) $selected['cash']) ?></strong></span><span>Change <strong><?= money((int) $selected['change_amount']) ?></strong></span></div></section><?php endif; ?>
<section class="table-panel"><div class="table-heading"><h2>Transaction history</h2><span><?= $summary['count'] ?> orders</span></div><div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Date & time</th><th>Cups</th><th>Total</th><th>Cash</th><th>Change</th><th></th></tr></thead><tbody><?php foreach ($sales as $sale): ?><tr><td><strong><?= escape($sale['transaction_number']) ?></strong></td><td><?= escape(date('M j, Y · g:i A', strtotime($sale['created_at']))) ?></td><td><?= $sale['cups'] ?></td><td><?= money((int) $sale['total']) ?></td><td><?= money((int) $sale['cash']) ?></td><td><?= money((int) $sale['change_amount']) ?></td><td><a class="text-button" href="sales.php?<?= escape(http_build_query(['date' => $date, 'page' => $currentPage, 'id' => $sale['id']])) ?>">View details</a></td></tr><?php endforeach; ?><?php if (!$sales): ?><tr><td colspan="7" class="empty-message">No sales yet<?= $date ? ' on this date' : '' ?>. Completed orders will appear here.</td></tr><?php endif; ?></tbody></table></div>
<div class="pagination"><span>Page <?= $currentPage ?> of <?= $pages ?></span><div><?php if ($currentPage > 1): ?><a class="button secondary" href="?<?= escape(http_build_query(['date' => $date, 'page' => $currentPage - 1])) ?>">Previous</a><?php endif; ?><?php if ($currentPage < $pages): ?><a class="button secondary" href="?<?= escape(http_build_query(['date' => $date, 'page' => $currentPage + 1])) ?>">Next</a><?php endif; ?></div></div></section>
<?php require dirname(__DIR__) . '/app/views/footer.php'; ?>
