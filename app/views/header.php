<?php
// Each page supplies $page and $title before including this shared layout.
$nav = ['pos' => ['index.php', 'grid', 'Point of sale']];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Steep & Sip beverage shop point of sale">
    <meta name="csrf-token" content="<?= escape($_SESSION['csrf']) ?>">
    <title><?= escape($title) ?> · Steep & Sip</title>
    <link rel="icon" href="assets/images/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<aside class="sidebar">
    <a href="index.php" class="brand"><span class="brand-icon"><?= icon('cup') ?></span><span>steep<span class="brand-amp">&</span>sip<small>A little sip of happiness.</small></span></a>
    <p class="nav-label">WORKSPACE</p>
    <nav aria-label="Main navigation">
        <?php foreach ($nav as $key => [$url, $symbol, $label]): ?>
        <a href="<?= $url ?>" class="nav-link <?= $page === $key ? 'active' : '' ?>" <?= $page === $key ? 'aria-current="page"' : '' ?>><?= icon($symbol) ?><span><?= $label ?></span></a>
        <?php endforeach; ?>
    </nav>
    <div class="sidebar-note"><span class="note-flower">✳</span><strong>Made fresh.<br>Served with a smile.</strong><p>Good drinks. Great days.</p></div>
    <div class="cashier"><span class="avatar">C</span><span><strong>Cashier</strong><small><i></i> Ready to serve</small></span></div>
</aside>
<div class="workspace">
    <header class="topbar"><div><span class="shop-label">STEEP & SIP</span><span class="topbar-divider">/</span><span><?= escape($title) ?></span></div><div class="date-label"><?= date('D, M j, Y') ?><span class="status-dot"></span> Shop open</div></header>
    <main class="<?= $page === 'pos' ? 'pos-layout' : 'page-content' ?>">
