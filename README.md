# Steep & Sip — Milk Tea and Beverage POS

A college-level POS built with PHP, SQLite, HTML, CSS, and JavaScript.

## Requirements and setup

PHP 8.1+ with PDO_SQLITE enabled. No Composer or npm dependencies.

On Windows, double-click `start.cmd` or run it from this folder. On other platforms:

```sh
php -S 127.0.0.1:8080 -t public
```

Open http://127.0.0.1:8080. The database and sample menu initialize automatically.

## Structure

```text
app/       Shared PHP, PDO database connection, and business logic
database/  SQLite schema and seed data (runtime database is ignored)
public/    Cashier page, endpoints, pages, CSS, JavaScript, and SVG images
scripts/   Optional setup and documentation helpers
```

Currency: PHP. Timezone: Asia/Manila. Large size: +₱20; pearls/nata: +₱15; pudding/coffee jelly: +₱20.

## Repository history

This repository is assembled from the completed project in three staged snapshots.
The commits are created during submission preparation, rather than backdated development records.

## Current stage

PDO SQLite setup, database schema/seed menu, responsive cashier interface,
product cards, categories, search, and layout for the cart/payment controls.
Ordering and payment are intentionally disabled until the next commit.
