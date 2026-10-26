
const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// Place an order WITHOUT saving order details to any database.
router.post("/", async (req, res) => {
    try {
        const { customer, items } = req.body || {};

        // Check that customer details and cart items are provided.
        if (!customer || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide customer details and cart items."
            });
        }

        // Validate required customer fields.
        const requiredFields = [
            "name",
            "phone",
            "email",
            "address",
            "city",
            "state",
            "pincode"
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

        // Validate email.
        const email = customer.email.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Validate mobile number.
        const phone = customer.phone.trim();

        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit mobile number."
            });
        }

        // Validate PIN code.
        const pincode = customer.pincode.trim();

        if (!/^[0-9]{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 6-digit PIN code."
            });
        }

        // Validate cart quantities and prices.
        let total = 0;

        for (const item of items) {
            const quantity = Number(item.quantity);
            const price = Number(item.price);

            if (
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Your cart contains invalid items. Please check your cart."
                });
            }

            total += price * quantity;
        }

        // Generate a confirmation number in memory only.
        // Nothing is written to SQLite or Firebase.
        const orderNumber =
            "KPF-" +
            crypto.randomBytes(5).toString("hex").toUpperCase();

        // Return order confirmation to the browser.
        res.status(201).json({
            success: true,
            message: "Your order has been placed successfully!",
            orderNumber,
            total
        });

    } catch (error) {
        console.error("Order processing error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not process your order. Please try again."
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
