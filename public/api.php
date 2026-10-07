<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'Ordering is implemented in the next stage.']);
    exit;
}
$db = database();
echo json_encode(['products' => catalog($db), 'addons' => query($db, 'SELECT * FROM addons ORDER BY id')->fetchAll(), 'large_surcharge' => 2000], JSON_THROW_ON_ERROR);
