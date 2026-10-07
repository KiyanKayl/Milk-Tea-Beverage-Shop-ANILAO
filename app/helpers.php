<?php
declare(strict_types=1);

function escape(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function money(int $centavos): string
{
    return '₱' . number_format($centavos / 100, 2);
}

function query(PDO $db, string $sql, array $parameters = []): PDOStatement
{
    $statement = $db->prepare($sql);
    $statement->execute($parameters);
    return $statement;
}

function integer(mixed $value, string $label, int $min = 0, int $max = 1000000): int
{
    if ((!is_int($value) && !is_string($value)) || !preg_match('/^\d+$/D', (string) $value)) {
        throw new InvalidArgumentException("$label must be a whole number.");
    }
    $number = filter_var($value, FILTER_VALIDATE_INT);
    if ($number === false || $number < $min || $number > $max) {
        throw new InvalidArgumentException("$label must be between $min and $max.");
    }
    return $number;
}

function parse_money(mixed $value): int
{
    // Accept decimal input but perform all calculations with integer centavos.
    if (!is_string($value) || !preg_match('/^(\d{1,7})(?:\.(\d{1,2}))?$/D', trim($value), $match)) {
        throw new InvalidArgumentException('Enter a valid amount with at most two decimal places.');
    }
    return ((int) $match[1] * 100) + (int) str_pad($match[2] ?? '', 2, '0');
}

function require_csrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) {
        http_response_code(403);
        throw new InvalidArgumentException('Your session has changed. Refresh the page and try again.');
    }
}

function catalog(PDO $db): array
{
    return query($db, 'SELECT p.*, i.stock, c.name AS category FROM products p
        JOIN inventory i ON i.product_id = p.id JOIN categories c ON c.id = p.category_id
        WHERE p.active = ? ORDER BY c.id, p.id', [1])->fetchAll();
}

function sale_details(PDO $db, int $id): ?array
{
    $sale = query($db, 'SELECT * FROM transactions WHERE id = ?', [$id])->fetch();
    if (!$sale) {
        return null;
    }
    $sale['items'] = query($db, 'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id', [$id])->fetchAll();
    return $sale;
}

function icon(string $name): string
{
    $paths = [
        'cup' => '<path d="M6 6h12l-1.5 15h-9zM5 6h14M13 6l2-4M8 11h8"/>',
        'grid' => '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
        'box' => '<path d="m12 3 9 5-9 5-9-5zM3 8v10l9 5 9-5V8M12 13v10M7 5l10 6"/>',
        'history' => '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
        'search' => '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        'plus' => '<path d="M12 5v14M5 12h14"/>',
        'trash' => '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
        'arrow' => '<path d="M5 12h14m-5-5 5 5-5 5"/>',
        'check' => '<path d="m5 12 4 4L19 6"/>',
    ];
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . ($paths[$name] ?? $paths['cup']) . '</svg>';
}
