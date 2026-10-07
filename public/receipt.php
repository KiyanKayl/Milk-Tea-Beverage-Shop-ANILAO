<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
$sale = null;
try { $sale = sale_details(database(), integer($_GET['id'] ?? null, 'Transaction', 1)); }
catch (InvalidArgumentException $error) { /* Invalid and unknown IDs receive the same safe 404. */ }
if (!$sale) http_response_code(404);
?>
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title><?= $sale ? escape($sale['transaction_number']) : 'Receipt not found' ?> · Receipt</title><link rel="icon" href="assets/images/favicon.svg"><link rel="stylesheet" href="assets/css/receipt.css"></head><body>
<div class="receipt-actions"><a href="sales.php">← Sales history</a><?php if ($sale): ?><button id="print-receipt">Print receipt</button><?php endif; ?></div>
<main class="receipt">
<?php if (!$sale): ?><h1>Receipt not found</h1><p>Open a completed transaction from sales history.</p><?php else: ?>
<header><div class="receipt-mark">✳</div><h1>steep & sip</h1><p>MILK TEA & BEVERAGES</p><p>A little sip of happiness.</p></header>
<div class="receipt-meta"><strong><?= escape($sale['transaction_number']) ?></strong><p><?= escape(date('M j, Y · g:i:s A', strtotime($sale['created_at']))) ?><br>Asia/Manila · Takeaway · Cash</p></div>
<table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody><?php foreach ($sale['items'] as $item): ?><tr><td><strong><?= $item['quantity'] ?> × <?= escape($item['product_name']) ?></strong><small><?= escape($item['size']) ?> · <?= $item['sweetness'] ?>% sugar<br><?= escape($item['ice']) ?><?php $addons = json_decode($item['addons_json'], true); if ($addons): ?><br>+ <?= escape(implode(', ', array_column($addons, 'name'))) ?><?php endif; ?><br><?= money((int) $item['unit_price']) ?> each</small></td><td><?= money((int) $item['subtotal']) ?></td></tr><?php endforeach; ?></tbody></table>
<div class="receipt-totals"><div class="receipt-total"><strong>Total</strong><strong><?= money((int) $sale['total']) ?></strong></div><div><span>Cash received</span><span><?= money((int) $sale['cash']) ?></span></div><div><span>Change</span><span><?= money((int) $sale['change_amount']) ?></span></div></div>
<footer><strong>Thanks for sipping with us!</strong><p>Made fresh. Served with a smile.</p><p>Come back for another happy cup.</p><small>College project · Transaction receipt</small></footer>
<?php endif; ?></main><script src="assets/js/receipt.js" defer></script></body></html>
