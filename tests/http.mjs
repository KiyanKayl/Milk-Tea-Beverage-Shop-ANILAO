// End-to-end HTTP checks against a separate SQLite file and PHP server.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = resolve(root, 'tests/tmp');
mkdirSync(temp, { recursive: true });
const database = resolve(temp, `http-${Date.now()}.sqlite`);
const initializationDatabase = database + '.init.sqlite';
const phpArgs = process.env.PHP_SQLITE_EXT_DIR ? ['-d', `extension_dir=${process.env.PHP_SQLITE_EXT_DIR}`, '-d', 'extension=pdo_sqlite'] : [];
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const server = spawn('php', [...phpArgs, '-S', `127.0.0.1:${port}`, '-t', resolve(root, 'public')], { env: { ...process.env, POS_DB_PATH: database }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stderr.on('data', chunk => { logs += chunk; });
server.on('error', error => { logs += error.message; });
let cookie = '';
let csrf = '';
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; console.log(`PASS: ${message}`); }
async function request(path, options = {}) {
    const response = await fetch(base + path, { redirect: 'manual', ...options, headers: { Cookie: cookie, ...options.headers } });
    const sessionCookie = response.headers.get('set-cookie');
    if (sessionCookie) cookie = sessionCookie.split(';')[0];
    return response;
}
async function payment(data, token = csrf) {
    return request('/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(data) });
}
async function admin(data) {
    return request('/admin.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, ...data }) });
}
try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
        try { const response = await request('/'); if (response.ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `PHP server failed to start: ${logs}`);
    const home = await (await request('/')).text();
    csrf = home.match(/name="csrf-token" content="([^"]+)"/)[1];
    check(home.includes('What’s brewing?') && home.includes('customize-dialog'), 'Cashier page renders customization and payment controls');
    let catalog = await (await request('/api.php')).json();
    check(catalog.products.length === 12 && catalog.addons.length === 4, 'API supplies real SQLite product and add-on data');
    check((await request('/admin.php')).status === 200 && (await request('/sales.php')).status === 200, 'Product admin and sales pages respond');
    check((await request('/database/pos.sqlite')).status === 404, 'Database files are outside the web document root');
    const data = { request_key: 'http-order-unique-reference-001', cash: '500.00', expected_total: 30000, items: [{ product_id: 1, quantity: 2, size: 'Large', sweetness: 50, ice: 'No Ice', addons: [1, 3] }] };
    check((await payment(data, 'invalid')).status === 403, 'Checkout enforces the session CSRF token');
    check((await payment({ ...data, cash: '100.00' })).status === 422, 'HTTP checkout rejects insufficient payment');
    check((await payment({ ...data, cash: '-500.00' })).status === 422, 'HTTP checkout rejects negative payment amounts');
    check((await payment({ ...data, items: [{ ...data.items[0], quantity: -1 }] })).status === 422, 'HTTP checkout rejects negative quantities');
    check((await payment({ ...data, items: [{ ...data.items[0], product_id: '1 OR 1=1' }] })).status === 422, 'HTTP checkout rejects SQL injection in product IDs');
    check((await payment({ ...data, expected_total: 29900 })).status === 422, 'HTTP checkout rejects an outdated displayed total');
    check((await payment({ ...data, cash: '100000.00', items: [{ ...data.items[0], quantity: 21 }, { ...data.items[0], quantity: 21, sweetness: 25 }] })).status === 422, 'HTTP checkout aggregates stock across different customizations');
    check((await (await request('/api.php')).json()).products[0].stock === 40, 'Rejected HTTP payment does not reduce inventory');
    const response = await payment(data);
    const result = await response.json();
    check(response.ok && result.success && result.sale.id === 1, 'HTTP checkout commits a complete sale');
    check((await (await request('/api.php')).json()).products[0].stock === 38, 'Committed HTTP sale deducts correct stock');
    const again = await (await payment(data)).json();
    check(again.sale.id === result.sale.id && (await (await request('/api.php')).json()).products[0].stock === 38, 'HTTP payment retry remains idempotent');
    const receipt = await (await request(`/receipt.php?id=${result.sale.id}`)).text();
    check(receipt.includes('₱300.00') && receipt.includes('₱200.00') && receipt.includes('50% sugar') && receipt.includes('Pearls, Pudding'), 'Receipt shows customizations, total, cash and change');
    const savedRetry = await payment({ ...data, expected_total: 99999 });
    check(savedRetry.status === 200 && (await savedRetry.json()).sale.id === result.sale.id, 'Saved checkout is resolved before checking newer menu totals');
    check((await request('/receipt.php?id=99999')).status === 404, 'Unknown receipt returns HTTP 404');
    const history = await (await request(`/sales.php?id=${result.sale.id}`)).text();
    check(history.includes(result.sale.transaction_number) && history.includes('₱300.00'), 'Sales history displays saved transaction details');
    const create = await admin({ action: 'save', id: '0', name: 'HTTP Test Drink', category_id: '1', price: '79.50', image: 'taro', stock: '5' });
    check(create.status === 302, 'Admin creates product through a form POST');
    catalog = await (await request('/api.php')).json();
    const product = catalog.products.find(product => product.name === 'HTTP Test Drink');
    check(product.price === 7950 && product.stock === 5, 'Created product has exact price and initial stock');
    check((await admin({ action: 'restock', id: String(product.id), quantity: '7' })).status === 302, 'Admin restock form succeeds');
    catalog = await (await request('/api.php')).json();
    check(catalog.products.find(item => item.id === product.id).stock === 12, 'Restock form adds inventory');
    check((await admin({ action: 'save', id: String(product.id), name: 'Edited HTTP Drink', category_id: '2', price: '80.00', image: 'peach' })).status === 302, 'Admin editing preserves inventory without needing a stock input');
    check((await admin({ action: 'delete', id: String(product.id) })).status === 302, 'Admin delete form succeeds');
    check(!(await (await request('/api.php')).json()).products.some(item => item.id === product.id), 'Deleted product disappears from cashier menu');
    const malformedProduct = await admin({ action: 'save', 'name[]': 'invalid', category_id: '1', price: '50.00', image: 'taro', stock: '5' });
    check((await malformedProduct.text()).includes('Product name must be text.'), 'Malformed array product names show a useful validation error');
    check((await (await request('/api.php')).json()).products.length === 12, 'Rejected malformed product creates no inventory or menu row');
    const invalid = await request('/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: '{broken' });
    check(invalid.status === 422, 'Malformed JSON produces a controlled validation error');
    const filtered = await (await request('/sales.php?date=2099-01-01')).text();
    check(filtered.includes('No sales yet on this date'), 'Date filter shows a useful empty state');
    // Force seed failure, repair the fixture, and retry in the same PHP process.
    // A failed database() call must not retain an uninitialized PDO connection.
    const initializationTest = spawnSync('php', [...phpArgs, '-r', `
        require 'app/database.php';
        $fixture = new PDO('sqlite:' . getenv('POS_DB_PATH'), null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $fixture->exec('CREATE TABLE categories (id INTEGER PRIMARY KEY)');
        $failed = false;
        try { database(); } catch (PDOException $error) { $failed = true; }
        $fixture->exec('ALTER TABLE categories ADD COLUMN name TEXT');
        $connection = database();
        $statement = $connection->prepare('SELECT COUNT(*) FROM products');
        $statement->execute();
        if (!$failed || $statement->fetchColumn() !== 12) throw new RuntimeException('Initialization retry failed');
        echo 'Initialization retry passed';
    `], { cwd: root, env: { ...process.env, POS_DB_PATH: initializationDatabase }, encoding: 'utf8', windowsHide: true });
    check(initializationTest.status === 0 && initializationTest.stdout.includes('Initialization retry passed'), 'Failed database initialization can be repaired and retried without a stale cached connection');
    check(!/PHP (Warning|Fatal|Parse error)/.test(logs), 'HTTP flows have no PHP warnings or fatal errors');
    console.log(`\nAll ${checks} integration checks passed (HTTP and database initialization).`);
} finally {
    server.kill();
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    // Delete only this test's explicitly named files, all inside tests/tmp.
    for (const fixture of [database, initializationDatabase]) {
        for (const suffix of ['', '-wal', '-shm']) {
            const path = fixture + suffix;
            if (existsSync(path)) unlinkSync(path);
        }
    }
}
