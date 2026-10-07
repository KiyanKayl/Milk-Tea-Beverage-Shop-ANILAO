<?php
declare(strict_types=1);

const LARGE_SURCHARGE = 2000;

function checkout(PDO $db, array $input): array
{
    $key = $input['request_key'] ?? '';
    if (!is_string($key) || !preg_match('/^[a-zA-Z0-9-]{16,80}$/D', $key)) {
        throw new InvalidArgumentException('Invalid checkout reference. Please refresh.');
    }
    $lines = $input['items'] ?? null;
    if (!is_array($lines) || !array_is_list($lines) || count($lines) < 1 || count($lines) > 100) {
        throw new InvalidArgumentException('Add between 1 and 100 cart lines before checkout.');
    }
    $cash = parse_money($input['cash'] ?? null);

    // Reserve the SQLite write lock before reading inventory. Use explicit SQL
    // COMMIT/ROLLBACK because PDO does not track BEGIN IMMEDIATE on older PHP.
    $db->exec('BEGIN IMMEDIATE');
    try {
        $existing = query($db, 'SELECT id, transaction_number FROM transactions WHERE request_key = ?', [$key])->fetch();
        if ($existing) {
            $db->exec('COMMIT');
            return $existing; // A retried request cannot charge or reduce stock twice.
        }
        $addons = [];
        foreach (query($db, 'SELECT * FROM addons')->fetchAll() as $addon) {
            $addons[(int) $addon['id']] = $addon;
        }
        $prepared = [];
        $required = [];
        $total = 0;
        foreach ($lines as $line) {
            if (!is_array($line)) {
                throw new InvalidArgumentException('Invalid cart item.');
            }
            $id = integer($line['product_id'] ?? null, 'Product', 1);
            $quantity = integer($line['quantity'] ?? null, 'Quantity', 1, 999);
            $product = query($db, 'SELECT p.*, i.stock FROM products p JOIN inventory i ON i.product_id = p.id
                WHERE p.id = ? AND p.active = ?', [$id, 1])->fetch();
            if (!$product) {
                throw new InvalidArgumentException('A product is no longer available. Remove it from the cart.');
            }
            $size = $line['size'] ?? '';
            $sweetness = integer($line['sweetness'] ?? null, 'Sweetness', 0, 100);
            $ice = $line['ice'] ?? '';
            if (!in_array($size, ['Regular', 'Large'], true) || !in_array($sweetness, [0, 25, 50, 75, 100], true)
                || !in_array($ice, ['No Ice', 'Less Ice', 'Regular Ice'], true)) {
                throw new InvalidArgumentException('Choose a valid size, sweetness, and ice level.');
            }
            $addonIds = $line['addons'] ?? [];
            if (!is_array($addonIds) || !array_is_list($addonIds) || count($addonIds) > count($addons)) {
                throw new InvalidArgumentException('Invalid add-on selection.');
            }
            $selected = [];
            $price = (int) $product['price'] + ($size === 'Large' ? LARGE_SURCHARGE : 0);
            foreach ($addonIds as $addonId) {
                $addonId = integer($addonId, 'Add-on', 1);
                if (!isset($addons[$addonId]) || isset($selected[$addonId])) {
                    throw new InvalidArgumentException('An add-on is invalid or duplicated.');
                }
                $selected[$addonId] = ['id' => $addonId, 'name' => $addons[$addonId]['name'], 'price' => (int) $addons[$addonId]['price']];
                $price += (int) $addons[$addonId]['price'];
            }
            $required[$id] = ($required[$id] ?? 0) + $quantity;
            if ($required[$id] > (int) $product['stock']) {
                throw new InvalidArgumentException($product['name'] . ' has only ' . $product['stock'] . ' in stock. Update your cart.');
            }
            $subtotal = $price * $quantity;
            $total += $subtotal;
            $prepared[] = [$id, $product['name'], $size, $sweetness, $ice, json_encode(array_values($selected), JSON_THROW_ON_ERROR), $quantity, $price, $subtotal];
        }
        // Compare the cashier's displayed total with current database prices.
        // This value is a consistency check, never the source of the sale price.
        if (array_key_exists('expected_total', $input)
            && integer($input['expected_total'], 'Displayed total', 1, PHP_INT_MAX) !== $total) {
            throw new InvalidArgumentException('Menu prices changed. Review the updated total before paying.');
        }
        if ($cash < $total) {
            throw new InvalidArgumentException('Cash received is less than the order total.');
        }
        $number = 'SS-' . date('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(3)));
        query($db, 'INSERT INTO transactions (transaction_number, request_key, total, cash, change_amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?)', [$number, $key, $total, $cash, $cash - $total, date('Y-m-d H:i:s')]);
        $saleId = (int) $db->lastInsertId();
        foreach ($prepared as $item) {
            query($db, 'INSERT INTO transaction_items (transaction_id, product_id, product_name, size, sweetness, ice,
                addons_json, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', array_merge([$saleId], $item));
        }
        foreach ($required as $id => $quantity) {
            $changed = query($db, 'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND stock >= ?', [$quantity, $id, $quantity]);
            if ($changed->rowCount() !== 1) {
                throw new InvalidArgumentException('Stock changed. Refresh your cart and try again.');
            }
        }
        $db->exec('COMMIT');
        return ['id' => $saleId, 'transaction_number' => $number];
    } catch (Throwable $error) {
        rollback_safely($db);
        throw $error;
    }
}
