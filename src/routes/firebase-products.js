const express = require("express");
const router = express.Router();
const firebaseDb = require("../database/firebase");

// GET: Fetch all products
router.get("/", async (req, res) => {
    try {
        const snapshot = await firebaseDb.ref("products").once("value");
        const data = snapshot.val() || {};

        const products = Object.entries(data).map(([id, product]) => ({
            ...product,
            id: product.id ?? id
        }));

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Firebase product fetch failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products."
        });
    }
});

// POST: Add a product
router.post("/", async (req, res) => {
    try {
        const {
            name,
            group_name,
            price,
            stock,
            image,
            description,
            category,
            is_bestseller
        } = req.body;

        if (!name || !group_name || price === undefined || stock === undefined) {
            return res.status(400).json({
                success: false,
                message: "Name, group, price and stock are required."
            });
        }

        const newProductRef = firebaseDb.ref("products").push();

        const product = {
            id: newProductRef.key,
            name: String(name).trim(),
            group_name: String(group_name).trim(),
            price: Number(price),
            stock: Number(stock),
            image: image || "",
            description: description || "",
            category: category || "Albums",
            is_bestseller: Number(is_bestseller) ? 1 : 0,
            created_at: new Date().toISOString()
        };

        if (
            !product.name ||
            !product.group_name ||
            !Number.isFinite(product.price) ||
            product.price < 0 ||
            !Number.isInteger(product.stock) ||
            product.stock < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid product details."
            });
        }

        await newProductRef.set(product);

        res.status(201).json({
            success: true,
            product
        });
    } catch (error) {
        console.error("Firebase product creation failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add product."
        });
    }
});

// PUT: Update a product
router.put("/:id", async (req, res) => {
    try {
        const productRef = firebaseDb.ref(`products/${req.params.id}`);
        const snapshot = await productRef.once("value");

        if (!snapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const current = snapshot.val();
        const updates = { ...req.body };

        if (updates.price !== undefined) {
            updates.price = Number(updates.price);
            if (!Number.isFinite(updates.price) || updates.price < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be a valid non-negative number."
                });
            }
        }

        if (updates.stock !== undefined) {
            updates.stock = Number(updates.stock);
            if (!Number.isInteger(updates.stock) || updates.stock < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Stock must be a non-negative whole number."
                });
            }
        }

        if (updates.is_bestseller !== undefined) {
            updates.is_bestseller = Number(updates.is_bestseller) ? 1 : 0;
        }

        delete updates.id;
        delete updates.created_at;

        const updatedProduct = { ...current, ...updates };
        await productRef.set(updatedProduct);

        res.json({
            success: true,
            product: updatedProduct
        });
    } catch (error) {
        console.error("Firebase product update failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update product."
        });
    }
});

// DELETE: Remove a product
router.delete("/:id", async (req, res) => {
    try {
        const productRef = firebaseDb.ref(`products/${req.params.id}`);
        const snapshot = await productRef.once("value");

        if (!snapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        await productRef.remove();

        res.json({
            success: true,
            message: "Product deleted successfully."
        });
    } catch (error) {
        console.error("Firebase product deletion failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete product."
        });
    }
});

module.exports = router;
