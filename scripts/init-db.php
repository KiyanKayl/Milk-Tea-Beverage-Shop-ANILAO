<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
$db = database();
echo 'Database ready: ' . query($db, 'SELECT COUNT(*) FROM products WHERE active = ?', [1])->fetchColumn() . " active products.\n";
