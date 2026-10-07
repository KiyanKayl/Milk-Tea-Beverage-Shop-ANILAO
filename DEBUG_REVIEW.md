# POS debugging review and corrected code

The existing system was reviewed and patched in place. The interface, categories, drink choices, shopping cart, checkout, receipt printing, product management, and sales history were preserved. No database schema change or inventory reset was necessary.

## What was already working

- PDO SQLite connections use exception mode and associative fetches.
- User-supplied query values are passed to `prepare()` / `execute()` rather than interpolated into SQL. The sales page combines only fixed SQL fragments and binds filter/pagination values. This follows the [PHP PDO prepared-statement guidance](https://www.php.net/manual/en/pdo.prepared-statements.php).
- PHP recalculates each item's price from the product, size, and add-on prices in SQLite. Browser-supplied item prices cannot override it.
- Currency arithmetic uses integer centavos. Quantities must be positive whole numbers; cash must be a nonnegative decimal string with no more than two decimal places.
- Underpayment, unavailable products, invalid options, duplicate add-ons, and insufficient aggregate stock are rejected by PHP.
- `BEGIN IMMEDIATE` encloses transaction insertion, item insertion, and every inventory deduction. `COMMIT` occurs only when all operations succeed. A failure rolls back the checkout. Stock is checked across all cart lines for the same product, even with different customizations.
- Successful sales retain snapshots of product names, customizations, and prices, so subsequent product edits/deletion do not change old receipts.
- HTML output is escaped, embedded JSON uses the appropriate escaping flags, and state-changing requests require a session CSRF token.
- No confirmed syntax/layout defect required changing HTML, CSS, receipt templates, or the database schema. Visual rendering was not checked with a real browser.

## Issue 1: Refreshed menu prices could disagree with cart totals

**Problem:** After a product price changed, refreshing the catalog updated product cards but existing cart lines retained their old `unit_price`. PHP used the new database prices, so the receipt could differ from the cashier's displayed total when cash covered both totals.

**Why:** `loadCatalog()` replaced `state.products` but did not recalculate `state.cart`. Checkout did not compare the displayed total with its authoritative calculation.

**Change:** In `public/assets/js/pos.js`, refresh cart prices and render the cart after loading the catalog. Send `expected_total`. In `app/pos.php`, compare it with the computed database total before recording a new sale. A mismatch rejects the attempt; the refreshed cart then shows the updated total for review. Existing confirmed checkout references are resolved before this comparison so retries still work after later price changes. The total is a consistency check, not a trusted replacement for server-side prices.

**Corrected JavaScript:**

```javascript
function priceFor(product, size, addonIds) {
    return product.price + (size === 'Large' ? state.surcharge : 0)
        + addonIds.reduce((sum, id) => sum + (state.addons.find(addon => addon.id === id)?.price || 0), 0);
}

function refreshCartPrices() {
    for (const item of state.cart) {
        const product = state.products.find(product => product.id === item.product_id);
        if (!product) continue;
        item.name = product.name;
        item.image = product.image;
        item.unit_price = priceFor(product, item.size, item.addons);
    }
}
```

After assigning the catalog in `loadCatalog()`:

```javascript
state.catalogReady = true;
if (!state.pendingPayment) refreshCartPrices();
$('#product-count').textContent = state.products.length;
renderCart();
```

The checkout payload now includes:

```javascript
expected_total: cartTotal(),
```

**Corrected PHP**, immediately before the cash sufficiency check:

```php
if (array_key_exists('expected_total', $input)
    && integer($input['expected_total'], 'Displayed total', 1, PHP_INT_MAX) !== $total) {
    throw new InvalidArgumentException('Menu prices changed. Review the updated total before paying.');
}
if ($cash < $total) {
    throw new InvalidArgumentException('Cash received is less than the order total.');
}
```

The field remains optional for existing direct API callers; the updated cashier always sends it. Server-side pricing and stock/payment validation still apply to every caller.

## Issue 2: Refreshed stock did not disable an invalid cart

**Problem:** After another sale reduced stock, the existing cart could contain more units than were now available. Product cards refreshed, but the payment button stayed enabled because it checked only cash and total. Deleted products in an existing cart had the same problem.

**Why:** Payment rendering did not validate cart availability against the refreshed catalog. The PHP server already prevented overselling, but the cashier could repeatedly attempt an impossible payment.

**Change:** Add aggregate cart validation and use it both when rendering payment controls and immediately before sending a new checkout. Leave invalid cart lines visible so the cashier can adjust or remove them.

**Corrected code** in `public/assets/js/pos.js`:

```javascript
function cartIssue() {
    if (!state.catalogReady) return 'Load the menu before completing payment.';
    const required = new Map();
    for (const item of state.cart) {
        const product = state.products.find(product => product.id === item.product_id);
        if (!product) return `${item.name} is no longer available. Remove it from the order.`;
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) return 'Choose a valid whole-number quantity.';
        if (item.addons.some(id => !state.addons.some(addon => addon.id === id))) return 'An add-on is no longer available. Remove that drink and select it again.';
        required.set(item.product_id, (required.get(item.product_id) || 0) + item.quantity);
        if (required.get(item.product_id) > product.stock) return `${product.name} has only ${product.stock} in stock. Update your order.`;
    }
    return null;
}
```

In `renderPayment()`:

```javascript
const issue = cartIssue();
$('#checkout').disabled = state.busy || (!state.pendingPayment && (!total || issue !== null || cash === null || cash < total));
```

In the checkout click handler:

```javascript
if (state.busy || (!state.pendingPayment && (!state.cart.length || cartIssue() || cashCents() === null || cashCents() < cartTotal()))) return;
```

An unresolved payment is allowed to retry even if the current stock is lower: the original sale may already have deducted that stock, and its request key resolves the saved result without another deduction.

## Issue 3: Editing after a lost payment response could duplicate a sale

**Problem:** If PHP saved the sale but the browser did not receive its response, the cashier could edit cash/cart contents. Those edits cleared the original retry key. The next payment then used a new key and could record a second sale. Refreshing the page also lost the reference. A stale error message could remain after a successful retry.

**Why:** The original code retained only `requestKey` in memory, unlocked all controls on network failure, and regenerated the request body from editable state. The `finally` block preserved any old payment error without checking whether the retry had succeeded.

**Change:** Store the exact unresolved payment payload, lock order/cash edits, reuse that payload for retries, and save it in session storage for same-tab refresh recovery. Explicit server rejection or confirmed success releases the lock and clears the saved reference. The existing payment button temporarily says **Retry payment**. Error handling now tracks the current attempt instead of restoring stale messages.

**Corrected state** in `public/assets/js/pos.js`:

```javascript
const state = { products: [], addons: [], surcharge: 2000, cart: [], category: 'all', selected: null, busy: false, requestKey: null, pendingPayment: null, catalogReady: false };

function orderLocked() {
    return state.busy || Boolean(state.pendingPayment);
}

function invalidateCheckout() {
    if (state.pendingPayment) return;
    state.requestKey = null;
    $('#payment-error').hidden = true;
}
```

All cart edit handlers and cash shortcuts now guard with `orderLocked()`; their controls also use it for their disabled state. These functions preserve and clear unresolved requests:

```javascript
const pendingStorageKey = 'steep-sip-pending-payment';

function savePendingPayment() {
    try {
        sessionStorage.setItem(pendingStorageKey, JSON.stringify({ payment: state.pendingPayment, cart: state.cart }));
    } catch {
        toast('Keep this tab open until the payment is resolved.');
    }
}

function clearPendingPayment() {
    state.pendingPayment = null;
    state.requestKey = null;
    try { sessionStorage.removeItem(pendingStorageKey); } catch { /* Memory retry still works. */ }
}

function restorePendingPayment() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(pendingStorageKey) || 'null');
        if (!saved) return;
        const payment = saved.payment;
        if (!payment || !/^[a-zA-Z0-9-]{16,80}$/.test(payment.request_key)
            || typeof payment.cash !== 'string' || !Array.isArray(payment.items)
            || !Array.isArray(saved.cart) || saved.cart.length < 1 || saved.cart.length > 100
            || saved.cart.some(item => !item || !Number.isInteger(item.product_id)
                || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999
                || !Number.isSafeInteger(item.unit_price) || item.unit_price < 1
                || typeof item.name !== 'string' || typeof item.image !== 'string' || !Array.isArray(item.addons))) {
            throw new Error('Invalid saved payment.');
        }
        state.pendingPayment = payment;
        state.requestKey = payment.request_key;
        state.cart = saved.cart;
        $('#cash').value = payment.cash;
    } catch {
        clearPendingPayment();
    }
}
```

Before sending checkout, create the snapshot once:

```javascript
state.busy = true;
state.requestKey ||= globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
state.pendingPayment ||= {
    request_key: state.requestKey,
    cash: $('#cash').value,
    expected_total: cartTotal(),
    items: state.cart.map(({ product_id, size, sweetness, ice, addons, quantity }) => ({ product_id, size, sweetness, ice, addons, quantity })),
};
savePendingPayment();
let paymentError = null;
$('#payment-error').hidden = true;
renderCart();
```

Send `JSON.stringify(state.pendingPayment)` as the existing fetch request's body. Process the response before clearing the cart:

```javascript
if (response.status >= 400 && response.status < 500) clearPendingPayment();
const result = await response.json();
if (!response.ok) {
    throw new Error(result.error || 'Payment could not be completed.');
}
if (!result.success || !Number.isInteger(result.sale?.id) || !result.sale?.transaction_number) {
    throw new Error('Payment response was incomplete. Retry to check its status.');
}
```

On confirmed success call `clearPendingPayment()`. Network failures, incomplete success responses, and server errors retain the payload. Catch/finally now use the current attempt's error:

```javascript
} catch (error) {
    paymentError = error.message || 'Connection interrupted. Retry this payment to check its status.';
    toast(paymentError);
    await loadCatalog().catch(() => {});
} finally {
    state.busy = false;
    renderCart();
    if (paymentError && !state.pendingPayment) {
        $('#payment-error').textContent = paymentError;
        $('#payment-error').hidden = false;
    }
}
```

At startup, before the first `renderCart()`:

```javascript
restorePendingPayment();
window.addEventListener('beforeunload', event => {
    if (state.pendingPayment) {
        event.preventDefault();
        event.returnValue = '';
    }
});
```

Ordinary carts still reset on refresh. Recovery applies only to unresolved payments and relies on session storage in the same browser tab. PHP's unique request key remains the final protection against repeated stock deductions.

## Issue 4: Failed refresh after a successful sale showed old availability

**Problem:** A confirmed sale cleared the cart, then attempted to refresh stock. If that request failed, the displayed stock still included the drinks just sold, and a new order could be started from that outdated menu.

**Why:** Inventory existed only in the fetched catalog; the success handler did not apply the confirmed deduction locally or mark failed refresh data as unavailable for a new payment.

**Change:** Deduct the confirmed cart quantities from the local catalog before clearing the cart. If refresh fails, mark the catalog unready until the page/menu is reloaded. PHP still performs every real inventory update inside its database transaction.

**Corrected code**, inside the successful checkout path before `state.cart = []`:

```javascript
for (const item of state.cart) {
    const product = state.products.find(product => product.id === item.product_id);
    if (product) product.stock = Math.max(0, product.stock - item.quantity);
}
```

The refresh failure handler:

```javascript
await loadCatalog().catch(() => {
    state.catalogReady = false;
    toast('Sale saved. Refresh the menu before starting the next payment.');
});
```

Product buttons include `!state.catalogReady` in their disabled condition. `cartIssue()` also blocks a new payment without a ready catalog. The server's authoritative stock is loaded on the next successful refresh.

## Issue 5: Array product names were converted to the string “Array”

**Problem:** A malformed form submission such as `name[]=invalid` emitted a PHP array-to-string warning and could save a product named `Array`.

**Why:** `manage_product()` cast the name to a string before checking its type and length.

**Change:** Check for a string before trimming. Reject malformed data with a normal validation message. This is a validation defect; prepared statements already prevented that field from executing SQL.

**Corrected code** in `app/products.php`:

```php
if (!is_string($input['name'] ?? null)) {
    throw new InvalidArgumentException('Product name must be text.');
}
$name = trim($input['name']);
if (strlen($name) < 1 || strlen($name) > 100) {
    throw new InvalidArgumentException('Product name must contain 1–100 characters.');
}
```

## Issue 6: A second rollback could hide the real database error

**Problem:** If SQLite had already rolled back the transaction, the catch block's unconditional `ROLLBACK` threw “no transaction is active,” replacing the error that originally caused checkout to fail.

**Why:** Certain SQLite errors and `RAISE(ROLLBACK)` triggers end a transaction automatically. The original catch block assumed a transaction would always remain open. SQLite documents these cases in its [transaction reference](https://www.sqlite.org/lang_transaction.html).

**Change:** Attempt rollback without letting a rollback exception replace the original exception. Continue using explicit SQL transaction commands: this application starts transactions with `BEGIN IMMEDIATE`, which older PDO versions do not track for `inTransaction()`.

**Corrected helper** in `app/helpers.php`:

```php
function rollback_safely(PDO $db): void
{
    try {
        $db->exec('ROLLBACK');
    } catch (PDOException $error) {
        error_log('Rollback could not run: ' . $error->getMessage());
    }
}
```

**Corrected checkout and product-management catch blocks**:

```php
} catch (Throwable $error) {
    rollback_safely($db);
    throw $error;
}
```

Tests force both `RAISE(ABORT)` and `RAISE(ROLLBACK)` after sale/item insertion and an earlier product's stock update. In both cases every new record and stock change disappears, and the original simulated failure remains identifiable. The rollback test intentionally logs the harmless second rollback failure.

## Issue 7: A failed database initialization could leave a cached connection

**Problem:** A second call to `database()` in the same process could return its cached PDO connection even though the first call failed during schema/seed initialization.

**Why:** The function assigned its static connection before initializing the database and did not clear it in the failure path.

**Change:** Clear the cache on initialization failure. Keep the rollback attempt protected so the original initialization exception is preserved. The local catch does not require `helpers.php`, so the standalone database file continues to work.

**Corrected catch block** in `app/database.php`:

```php
} catch (Throwable $error) {
    try { $connection->exec('ROLLBACK'); } catch (PDOException $rollbackError) {
        error_log('Rollback could not run: ' . $rollbackError->getMessage());
    }
    $connection = null;
    throw $error;
}
```

## Issue 8: PHP reported “could not find driver”

**Problem:** The SQLite connection failed before any SQL could run. PDO itself was installed, but its SQLite driver was not enabled in a normally launched PHP process.

**Why:** `php --ini` reported no loaded configuration. The compiled default extension directory was `C:\php\ext`, while the installed driver DLL was in `C:\php-8.2.33-Win32-vs16-x64\ext`. The earlier POS server worked because its launch command explicitly loaded the driver; a plain PHP launch did not.

**Change:** Created the missing `C:\php-8.2.33-Win32-vs16-x64\php.ini` with the verified driver path and enabled PDO_SQLITE, following the [PHP Windows PDO installation instructions](https://www.php.net/manual/en/pdo.installation.php). Updated `start.ps1` to avoid loading an already enabled extension twice and added `start.cmd`, which detects PHP, verifies the driver, and starts the existing application without relying on PowerShell execution policy. No SQL, database records, or interface files were changed for this fix.

**Corrected PHP configuration:**

```ini
extension_dir = "C:/php-8.2.33-Win32-vs16-x64/ext"
extension = pdo_sqlite
```

**Verification:** `php --ini` now loads that configuration, `PDO::getAvailableDrivers()` lists `sqlite`, and the POS responds successfully. Existing server processes must be restarted to load changed PHP configuration. The previously running server at port 8080 already had the driver enabled.

**Launch without special flags:**

```powershell
cd C:\ezamm
.\start.cmd
```

Or, now that the driver is configured:

```powershell
php -S 127.0.0.1:8080 -t public
```

On another machine, adjust `extension_dir` to that PHP installation; the launchers determine the path automatically. The complete launcher code is included in `SOURCE_GUIDE.md`.

## Verification and files

- **48 PHP checks passed:** prices/customizations, exact payment and change, negative/fractional quantities, negative cash/prices/restock, SQL-like input, stock aggregation, duplicate requests, product operations, historical receipts, stale totals, and forced database failures.
- **32 integration checks passed:** real HTTP/SQLite catalog, CSRF, input rejection, checkout/retry, stock changes, receipt/sales pages, product forms, and repair/retry after failed database initialization in one PHP process.
- **28 cashier JavaScript checks passed:** customization preview, cart totals, merging and quantity controls, stock/price refresh, insufficient cash, lost-response locking, same-tab recovery, exact-payload retries, stale error cleanup, malformed saved data, and failed menu refresh after a confirmed sale.
- All PHP files and application JavaScript files passed syntax checks.
- The existing shop database passed `PRAGMA integrity_check` and had zero `PRAGMA foreign_key_check` violations. Tests used an in-memory or disposable database; the shop's inventory and transaction rows were not changed by tests.
- The JavaScript suite executes the actual application script with small DOM/fetch stubs. It does not replace a browser rendering/accessibility test; no automated visual browser checks were available.

Run with PDO_SQLITE enabled:

```sh
php tests/run.php
node tests/http.mjs
node tests/cart.mjs
```

See `README.md` for Windows commands that enable PDO_SQLITE without changing php.ini. The complete corrected files are `app/database.php`, `app/helpers.php`, `app/pos.php`, `app/products.php`, and `public/assets/js/pos.js`. `SOURCE_GUIDE.md` contains their full code, together with every other project source file.
