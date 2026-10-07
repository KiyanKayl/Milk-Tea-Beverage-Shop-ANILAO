INSERT OR IGNORE INTO categories (id, name) VALUES
    (1, 'Milk Tea'), (2, 'Fruit Tea'), (3, 'Coffee'), (4, 'Other Drinks');

INSERT OR IGNORE INTO addons (id, name, price) VALUES
    (1, 'Pearls', 1500), (2, 'Nata de coco', 1500),
    (3, 'Pudding', 2000), (4, 'Coffee jelly', 2000);

INSERT OR IGNORE INTO products (id, category_id, name, price, image) VALUES
    (1, 1, 'Classic Milk Tea', 9500, 'assets/images/milk-tea.svg'),
    (2, 1, 'Brown Sugar Boba', 12000, 'assets/images/brown-sugar.svg'),
    (3, 1, 'Taro Milk Tea', 11000, 'assets/images/taro.svg'),
    (4, 1, 'Matcha Milk Tea', 12500, 'assets/images/matcha.svg'),
    (5, 2, 'Peach Fruit Tea', 10500, 'assets/images/peach.svg'),
    (6, 2, 'Strawberry Tea', 11000, 'assets/images/strawberry.svg'),
    (7, 2, 'Passion Fruit Tea', 10500, 'assets/images/passion.svg'),
    (8, 3, 'Iced Caramel Latte', 13500, 'assets/images/coffee.svg'),
    (9, 3, 'Iced Americano', 9500, 'assets/images/americano.svg'),
    (10, 4, 'Chocolate Bliss', 11500, 'assets/images/chocolate.svg'),
    (11, 4, 'Fresh Lemonade', 8500, 'assets/images/lemon.svg'),
    (12, 4, 'Strawberry Milk', 11000, 'assets/images/strawberry-milk.svg');

INSERT OR IGNORE INTO inventory (product_id, stock) VALUES
    (1, 40), (2, 32), (3, 24), (4, 18), (5, 30), (6, 22),
    (7, 25), (8, 20), (9, 35), (10, 16), (11, 28), (12, 12);
