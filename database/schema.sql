PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Store money as integer centavos to avoid floating-point rounding errors.
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
    price INTEGER NOT NULL CHECK(price > 0),
    image TEXT NOT NULL DEFAULT 'assets/images/milk-tea.svg',
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS inventory (
    product_id INTEGER PRIMARY KEY REFERENCES products(id),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0)
);

CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    price INTEGER NOT NULL CHECK(price >= 0)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT NOT NULL UNIQUE,
    request_key TEXT NOT NULL UNIQUE,
    total INTEGER NOT NULL CHECK(total > 0),
    cash INTEGER NOT NULL CHECK(cash >= total),
    change_amount INTEGER NOT NULL CHECK(change_amount = cash - total),
    created_at TEXT NOT NULL
);

-- Snapshot names and prices so later product edits do not change old receipts.
CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    size TEXT NOT NULL CHECK(size IN ('Regular', 'Large')),
    sweetness INTEGER NOT NULL CHECK(sweetness IN (0, 25, 50, 75, 100)),
    ice TEXT NOT NULL CHECK(ice IN ('No Ice', 'Less Ice', 'Regular Ice')),
    addons_json TEXT NOT NULL DEFAULT '[]',
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price INTEGER NOT NULL CHECK(unit_price > 0),
    subtotal INTEGER NOT NULL CHECK(subtotal = quantity * unit_price)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_items_transaction ON transaction_items(transaction_id);
