<?php
declare(strict_types=1);

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }
    $path = getenv('POS_DB_PATH') ?: dirname(__DIR__) . '/database/pos.sqlite';
    $connection = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $connection->exec('PRAGMA foreign_keys = ON');
    $connection->exec('PRAGMA busy_timeout = 5000');
    $connection->exec('PRAGMA journal_mode = WAL');

    // Initialize once, under a write lock; reopening the app never resets stock.
    $connection->exec('BEGIN IMMEDIATE');
    try {
        $exists = $connection->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?");
        $exists->execute(['products']);
        if (!$exists->fetch()) {
            $connection->exec(file_get_contents(dirname(__DIR__) . '/database/schema.sql'));
            $connection->exec(file_get_contents(dirname(__DIR__) . '/database/seed.sql'));
        }
        $connection->exec('COMMIT');
    } catch (Throwable $error) {
        $connection->exec('ROLLBACK');
        throw $error;
    }
    return $connection;
}
