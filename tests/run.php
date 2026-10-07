<?php
declare(strict_types=1);
// Isolated regression tests: never change the shop's actual SQLite database.
date_default_timezone_set('Asia/Manila');
require_once dirname(__DIR__) . '/app/database.php';
require_once dirname(__DIR__) . '/app/helpers.php';
require_once dirname(__DIR__) . '/app/pos.php';
require_once dirname(__DIR__) . '/app/products.php';
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$db->exec(file_get_contents(dirname(__DIR__) . '/database/schema.sql'));
$db->exec(file_get_contents(dirname(__DIR__) . '/database/seed.sql'));
$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException('FAIL: ' . $message);
    $checks++;
    echo "PASS: $message\n";
}
function rejected(callable $callback, string $message): void {
    try { $callback(); } catch (InvalidArgumentException $error) { check(true, $message); return; }
    throw new RuntimeException('FAIL: expected rejection: ' . $message);
}
function stock(PDO $db, int $id = 1): int { return (int) query($db, 'SELECT stock FROM inventory WHERE product_id = ?', [$id])->fetchColumn(); }
function orders(PDO $db): int { return (int) query($db, 'SELECT COUNT(*) FROM transactions')->fetchColumn(); }
$line = ['product_id' => 1, 'quantity' => 2, 'size' => 'Large', 'sweetness' => 25, 'ice' => 'Less Ice', 'addons' => [1, 3]];
$input = ['request_key' => 'test-order-reference-0001', 'cash' => '500.00', 'items' => [$line]];
check(count(catalog($db)) === 12, 'Seeded menu has 12 products and inventory rows');
check(parse_money('95.01') === 9501 && parse_money('5.1') === 510, 'Money parser preserves decimal centavos');
rejected(fn() => parse_money('1.001'), 'Reject more than two decimal places');
$poor = $input; $poor['cash'] = '299.99';
rejected(fn() => checkout($db, $poor), 'Reject cash below customized total');
check(stock($db) === 40 && orders($db) === 0, 'Failed payment leaves stock and transactions unchanged');
$sale = checkout($db, $input);
$details = sale_details($db, (int) $sale['id']);
check($details['total'] === 30000 && $details['change_amount'] === 20000, 'Server calculates size/add-on total and change');
check(stock($db) === 38 && count($details['items']) === 1, 'Successful checkout saves items and decreases stock');
check($details['items'][0]['sweetness'] === 25 && count(json_decode($details['items'][0]['addons_json'], true)) === 2, 'Receipt contains customization snapshots');
$retry = checkout($db, $input);
check((int) $retry['id'] === (int) $sale['id'] && stock($db) === 38 && orders($db) === 1, 'Repeated checkout key does not duplicate sale or stock deduction');
$over = $input; $over['request_key'] = 'test-order-reference-0002'; $over['cash'] = '100000.00';
$over['items'] = [array_replace($line, ['quantity' => 20]), array_replace($line, ['quantity' => 20, 'sweetness' => 50])];
rejected(fn() => checkout($db, $over), 'Different customizations share the same product stock limit');
check(stock($db) === 38 && orders($db) === 1, 'Insufficient combined stock rolls back all changes');
$bad = $input; $bad['request_key'] = 'test-order-reference-0003'; $bad['items'][0]['addons'] = [1, 1];
rejected(fn() => checkout($db, $bad), 'Reject duplicate add-ons');
$bad['items'][0]['addons'] = [99]; rejected(fn() => checkout($db, $bad), 'Reject unknown add-ons');
$bad['items'][0]['addons'] = []; $bad['items'][0]['sweetness'] = 30;
rejected(fn() => checkout($db, $bad), 'Reject unsupported sweetness');
$bad['items'][0]['sweetness'] = 0; $bad['items'][0]['quantity'] = 0;
rejected(fn() => checkout($db, $bad), 'Reject zero quantities');
$bad['items'][0]['quantity'] = 1.5; rejected(fn() => checkout($db, $bad), 'Reject fractional quantities');
$bad['items'] = []; rejected(fn() => checkout($db, $bad), 'Reject empty carts');
manage_product($db, ['action' => 'save', 'id' => '1', 'name' => 'Updated tea', 'category_id' => '1', 'price' => '150.00', 'image' => 'taro']);
check(stock($db) === 38 && sale_details($db, (int) $sale['id'])['items'][0]['product_name'] === 'Classic Milk Tea', 'Product edit preserves stock and historical names');
check(sale_details($db, (int) $sale['id'])['items'][0]['unit_price'] === 15000, 'Product edit preserves historical item prices');
manage_product($db, ['action' => 'restock', 'id' => '1', 'quantity' => '5']);
check(stock($db) === 43, 'Restock increments stock');
manage_product($db, ['action' => 'save', 'id' => '0', 'name' => 'New tea', 'category_id' => '2', 'price' => '88.50', 'image' => 'peach', 'stock' => '3']);
$newId = (int) $db->lastInsertId();
check(stock($db, $newId) === 3 && count(catalog($db)) === 13, 'Add product creates matching inventory');
manage_product($db, ['action' => 'delete', 'id' => '1']);
check(count(catalog($db)) === 12 && sale_details($db, (int) $sale['id']) !== null, 'Delete hides product and preserves receipts');
$bad = $input; $bad['request_key'] = 'test-order-reference-0004';
rejected(fn() => checkout($db, $bad), 'Archived drinks cannot be sold');
rejected(fn() => manage_product($db, ['action' => 'restock', 'id' => '1', 'quantity' => '1']), 'Archived drinks cannot be restocked');
rejected(fn() => manage_product($db, ['action' => 'save', 'name' => 'Bad drink', 'category_id' => '99', 'price' => '100.00', 'image' => 'peach', 'stock' => '5']), 'Reject invalid category without partial product creation');
// A later invalid line must also roll back a valid earlier line.
$mixed = ['request_key' => 'test-order-reference-0005', 'cash' => '500.00', 'items' => [array_replace($line, ['product_id' => 2, 'quantity' => 1]), $line]];
rejected(fn() => checkout($db, $mixed), 'One unavailable cart line rejects the entire sale');
check(stock($db, 2) === 32 && orders($db) === 1, 'Mixed-line failure leaves all product stocks untouched');

// Review regressions: strict input validation and authoritative database prices.
rejected(fn() => parse_money('-100.00'), 'Reject negative cash payments');
rejected(fn() => parse_money('10 OR 1=1'), 'Reject SQL-like cash input');
$safeLine = array_replace($line, ['product_id' => 2, 'quantity' => 1, 'size' => 'Regular', 'addons' => []]);
$review = ['request_key' => 'review-order-reference-0001', 'cash' => '500.00', 'expected_total' => 12000, 'items' => [$safeLine]];
$badQuantity = $review; $badQuantity['items'][0]['quantity'] = -1;
rejected(fn() => checkout($db, $badQuantity), 'Reject negative checkout quantities');
$badId = $review; $badId['items'][0]['product_id'] = '2 OR 1=1';
rejected(fn() => checkout($db, $badId), 'Reject SQL injection in product IDs');
$stale = $review; $stale['expected_total'] = 11900;
rejected(fn() => checkout($db, $stale), 'Reject payment when displayed total differs from database total');
check(stock($db, 2) === 32 && orders($db) === 1, 'Stale price rejection leaves inventory and sales unchanged');
rejected(fn() => manage_product($db, ['action' => 'save', 'name' => ['bad'], 'category_id' => '1', 'price' => '50.00', 'image' => 'peach', 'stock' => '5']), 'Reject array product names instead of saving Array');
rejected(fn() => manage_product($db, ['action' => 'save', 'name' => 'Negative price', 'category_id' => '1', 'price' => '-1.00', 'image' => 'peach', 'stock' => '5']), 'Reject negative product prices');
rejected(fn() => manage_product($db, ['action' => 'restock', 'id' => '2', 'quantity' => '-5']), 'Reject negative restock quantities');

// Fail after sale/item inserts and after the first stock update. Everything
// must roll back, including inventory already updated for an earlier product.
$failureSale = ['request_key' => 'review-order-reference-0002', 'cash' => '1000.00', 'items' => [$safeLine, array_replace($safeLine, ['product_id' => 3])]];
$itemCount = (int) query($db, 'SELECT COUNT(*) FROM transaction_items')->fetchColumn();
foreach (['ABORT', 'ROLLBACK'] as $mode) {
    $db->exec("CREATE TEMP TRIGGER simulate_inventory_failure BEFORE UPDATE OF stock ON inventory
        WHEN NEW.product_id = 3 BEGIN SELECT RAISE($mode, 'simulated inventory failure'); END");
    try {
        checkout($db, $failureSale);
        throw new RuntimeException('Expected inventory update failure');
    } catch (PDOException $error) {
        check(str_contains($error->getMessage(), 'simulated inventory failure'), "$mode preserves the original database exception");
    }
    check(orders($db) === 1 && (int) query($db, 'SELECT COUNT(*) FROM transaction_items')->fetchColumn() === $itemCount, "$mode rolls back transaction and item records");
    check(stock($db, 2) === 32 && stock($db, 3) === 24, "$mode rolls back every stock deduction");
    $db->exec('DROP TRIGGER simulate_inventory_failure');
}

$soldOut = ['request_key' => 'review-order-reference-0003', 'cash' => '265.50', 'expected_total' => 26550,
    'items' => [array_replace($safeLine, ['product_id' => $newId, 'quantity' => 3, 'unit_price' => 1, 'subtotal' => 1])]];
$lastSale = checkout($db, $soldOut);
$lastDetails = sale_details($db, (int) $lastSale['id']);
check($lastDetails['total'] === 26550 && $lastDetails['change_amount'] === 0, 'Exact payment succeeds with zero change');
check($lastDetails['items'][0]['unit_price'] === 8850, 'Client-supplied fake prices cannot change the sale price');
check(stock($db, $newId) === 0, 'Buying the exact available stock reaches zero without going negative');
$soldOut['request_key'] = 'review-order-reference-0004'; $soldOut['items'][0]['quantity'] = 1;
rejected(fn() => checkout($db, $soldOut), 'A sold-out product cannot be purchased');
$injectionName = "Tea'); DROP TABLE products; --";
manage_product($db, ['action' => 'save', 'name' => $injectionName, 'category_id' => '1', 'price' => '50.00', 'image' => 'peach', 'stock' => '1']);
check(query($db, 'SELECT COUNT(*) FROM products WHERE name = ?', [$injectionName])->fetchColumn() === 1, 'SQL syntax in a product name is stored as data without executing');
check(!str_contains(escape('<script>alert(1)</script>'), '<script>'), 'HTML output escapes script tags');
echo "\nAll $checks checks passed.\n";
