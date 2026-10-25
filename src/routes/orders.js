
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../database/database");

// Create order tables if they don't exist.
db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT NOT NULL,
        instructions TEXT,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Placed',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
            ON DELETE CASCADE
    );
`);

// Create a new order.
router.post("/", (req, res) => {
    const { customer, items } = req.body;

    if (!customer || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Please provide customer details and cart items."
        });
    }

    const requiredFields = [
        "name", "phone", "email", "address",
        "city", "state", "pincode"
    ];

    for (const field of requiredFields) {
        if (
            typeof customer[field] !== "string" ||
            !customer[field].trim()
        ) {
            return res.status(400).json({
                success: false,
                message: `Please provide your ${field}.`
            });
        }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid email address."
        });
    }

    if (!/^[0-9]{10}$/.test(customer.phone.trim())) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid 10-digit mobile number."
        });
    }

    if (!/^[0-9]{6}$/.test(customer.pincode.trim())) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid 6-digit PIN code."
        });
    }

    try {
        const createOrder = db.transaction(() => {
            let total = 0;
            const verifiedItems = [];

            for (const item of items) {
                const id = Number(item.id);
                const quantity = Number(item.quantity);

                if (
                    !Number.isSafeInteger(id) ||
                    id <= 0 ||
                    !Number.isSafeInteger(quantity) ||
                    quantity <= 0
                ) {
                    throw new Error("Invalid product or quantity.");
                }

                const product = db.prepare(`
                    SELECT id, name, price, stock
                    FROM products
                    WHERE id = ?
                `).get(id);

                if (!product) {
                    throw new Error(
                        "A product in your cart no longer exists."
                    );
                }

                if (product.stock < quantity) {
                    throw new Error(
                        `${product.name} does not have enough stock available.`
                    );
                }

                const subtotal = Number(product.price) * quantity;
                total += subtotal;

                verifiedItems.push({
                    product,
                    quantity,
                    subtotal
                });
            }

            const orderNumber =
                "KPF-" +
                crypto.randomBytes(5).toString("hex").toUpperCase();

            const result = db.prepare(`
                INSERT INTO orders (
                    order_number, customer_name, phone, email,
                    address, city, state, pincode, instructions, total
                )
                VALUES (
                    @order_number, @customer_name, @phone, @email,
                    @address, @city, @state, @pincode, @instructions, @total
                )
            `).run({
                order_number: orderNumber,
                customer_name: customer.name.trim(),
                phone: customer.phone.trim(),
                email: customer.email.trim(),
                address: customer.address.trim(),
                city: customer.city.trim(),
                state: customer.state.trim(),
                pincode: customer.pincode.trim(),
                instructions: String(customer.instructions || "").trim(),
                total
            });

            const insertItem = db.prepare(`
                INSERT INTO order_items (
                    order_id, product_id, product_name,
                    price, quantity, subtotal
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            const reduceStock = db.prepare(`
                UPDATE products
                SET stock = stock - ?
                WHERE id = ? AND stock >= ?
            `);

            for (const item of verifiedItems) {
                insertItem.run(
                    result.lastInsertRowid,
                    item.product.id,
                    item.product.name,
                    item.product.price,
                    item.quantity,
                    item.subtotal
                );

                const update = reduceStock.run(
                    item.quantity,
                    item.product.id,
                    item.quantity
                );

                if (update.changes !== 1) {
                    throw new Error(
                        `${item.product.name} stock changed. Please try again.`
                    );
                }
            }

            return { orderNumber, total };
        });

        const order = createOrder();

        res.status(201).json({
            success: true,
            message: "Your order has been placed successfully!",
            orderNumber: order.orderNumber,
            total: order.total
        });

    } catch (error) {
        console.error("Order creation error:", error.message);

        res.status(400).json({
            success: false,
            message: error.message || "Could not place your order."
        });
    }
});

// Track an order using its order number and registered phone number.
router.post("/track", (req, res) => {
    const orderNumber =
        typeof req.body.orderId === "string"
            ? req.body.orderId.trim()
            : "";

    const phone =
        typeof req.body.phone === "string"
            ? req.body.phone.trim()
            : "";

    if (!orderNumber || !/^[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
            success: false,
            message: "Enter your order ID and valid 10-digit mobile number."
        });
    }

    try {
        const order = db.prepare(`
            SELECT order_number, customer_name, phone, total,
                   status, created_at
            FROM orders
            WHERE order_number = ? AND phone = ?
        `).get(orderNumber, phone);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "We couldn't find an order matching those details. Please check your order ID and mobile number."
            });
        }

        const items = db.prepare(`
            SELECT product_name, price, quantity, subtotal
            FROM order_items
            WHERE order_id = (
                SELECT id FROM orders WHERE order_number = ?
            )
        `).all(order.order_number);

        res.json({
            success: true,
            order: {
                orderNumber: order.order_number,
                customerName: order.customer_name,
                status: order.status,
                total: order.total,
                createdAt: order.created_at,
                items
            }
        });

    } catch (error) {
        console.error("Order tracking error:", error.message);

        res.status(500).json({
            success: false,
            message: "Couldn't retrieve your order right now. Please try again."
        });
    }
});

// Test the orders API.
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "KPOPIFY orders API is working! ♡"
    });
});

module.exports = router;
