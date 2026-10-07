<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $db = database();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['products' => catalog($db), 'addons' => query($db, 'SELECT * FROM addons ORDER BY id')->fetchAll(), 'large_surcharge' => LARGE_SURCHARGE], JSON_THROW_ON_ERROR);
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        require_csrf();
        $input = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($input)) {
            throw new InvalidArgumentException('Invalid checkout data.');
        }
        $sale = checkout($db, $input);
        echo json_encode(['success' => true, 'sale' => $sale], JSON_THROW_ON_ERROR);
    } else {
        http_response_code(405);
        header('Allow: GET, POST');
        echo json_encode(['error' => 'Method not allowed.']);
    }
} catch (InvalidArgumentException | JsonException $error) {
    if (http_response_code() !== 403) {
        http_response_code(422);
    }
    echo json_encode(['error' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log((string) $error);
    http_response_code(500);
    echo json_encode(['error' => 'Unable to complete the request. Please try again.']);
}
