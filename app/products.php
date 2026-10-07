<?php
declare(strict_types=1);

function product_images(): array
{
    return ['milk-tea', 'brown-sugar', 'taro', 'matcha', 'peach', 'strawberry', 'passion', 'coffee', 'americano', 'chocolate', 'lemon', 'strawberry-milk'];
}

function manage_product(PDO $db, array $input): void
{
    $action = $input['action'] ?? '';
    $db->exec('BEGIN IMMEDIATE');
    try {
        if ($action === 'save') {
            $id = integer($input['id'] ?? '0', 'Product ID');
            $name = trim((string) ($input['name'] ?? ''));
            if (strlen($name) < 1 || strlen($name) > 100) {
                throw new InvalidArgumentException('Product name must contain 1–100 characters.');
            }
            $category = integer($input['category_id'] ?? null, 'Category', 1);
            if (!query($db, 'SELECT id FROM categories WHERE id = ?', [$category])->fetch()) {
                throw new InvalidArgumentException('Choose an existing category.');
            }
            $price = parse_money($input['price'] ?? null);
            if ($price < 1 || $price > 100000000) {
                throw new InvalidArgumentException('Price must be between ₱0.01 and ₱1,000,000.');
            }
            $image = $input['image'] ?? '';
            if (!is_string($image) || !in_array($image, product_images(), true)) {
                throw new InvalidArgumentException('Choose a product image.');
            }
            $path = 'assets/images/' . $image . '.svg';
            if ($id === 0) {
                $stock = integer($input['stock'] ?? null, 'Initial stock');
                query($db, 'INSERT INTO products (name, category_id, price, image) VALUES (?, ?, ?, ?)', [$name, $category, $price, $path]);
                query($db, 'INSERT INTO inventory (product_id, stock) VALUES (?, ?)', [(int) $db->lastInsertId(), $stock]);
            } else {
                $updated = query($db, 'UPDATE products SET name = ?, category_id = ?, price = ?, image = ? WHERE id = ? AND active = ?', [$name, $category, $price, $path, $id, 1]);
                if ($updated->rowCount() !== 1) {
                    throw new InvalidArgumentException('Product was not found.');
                }
            }
        } elseif ($action === 'restock') {
            $id = integer($input['id'] ?? null, 'Product ID', 1);
            $quantity = integer($input['quantity'] ?? null, 'Restock quantity', 1);
            // Increment, rather than overwrite, so simultaneous sales stay accurate.
            $updated = query($db, 'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND stock + ? <= 1000000
                AND EXISTS (SELECT 1 FROM products WHERE id = ? AND active = ?)', [$quantity, $id, $quantity, $id, 1]);
            if ($updated->rowCount() !== 1) {
                throw new InvalidArgumentException('Product missing or stock would exceed 1,000,000.');
            }
        } elseif ($action === 'delete') {
            $id = integer($input['id'] ?? null, 'Product ID', 1);
            // Archive instead of removing referenced rows: receipts remain intact.
            if (query($db, 'UPDATE products SET active = ? WHERE id = ? AND active = ?', [0, $id, 1])->rowCount() !== 1) {
                throw new InvalidArgumentException('Product was not found.');
            }
        } else {
            throw new InvalidArgumentException('Unknown product action.');
        }
        $db->exec('COMMIT');
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}
