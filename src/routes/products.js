
const express = require("express");
const router = express.Router();
const firebaseDb = require("../database/firebase");

// Normalize category names used by your store.
function normalizeCategory(value) {
    const category = String(value || "Albums").trim().toLowerCase();

    if (["albums", "txt"].includes(category)) return "Albums";
    if (["ppulbatu", "tubatu"].includes(category)) return "PPULBATU";
    if (["members", "member"].includes(category)) return "Members";

    return null;
}

// Validate product details.
function validateProduct(body, current = {}) {
    const name = String(body.name ?? current.name ?? "").trim();
    const groupName = String(
        body.group_name ?? current.group_name ?? ""
    ).trim();
    const description = String(
        body.description ?? current.description ?? ""
    ).trim();

    const category = normalizeCategory(
        body.category ?? current.category ?? "Albums"
    );

    const price = Number(body.price ?? current.price);
    const stock = Number(body.stock ?? current.stock);

    const bestsellerValue =
        body.is_bestseller ?? current.is_bestseller ?? 0;

    const isBestseller =
        bestsellerValue === true ||
        ["1", "on", "true"].includes(String(bestsellerValue).toLowerCase());

    if (!name || !groupName) {
        return {
            error: "Enter the product name and group/artist."
        };
    }

    if (!Number.isFinite(price) || price < 0) {
        return {
            error: "Enter a valid non-negative product price."
        };
    }

    if (!Number.isInteger(stock) || stock < 0) {
        return {
            error: "Stock must be a whole number of zero or more."
        };
    }

    if (!category) {
        return {
            error: "Choose Albums, PPULBATU, or Members."
        };
    }

    return {
        name,
        group_name: groupName,
        price,
        stock,
        description,
        category,
        is_bestseller: isBestseller ? 1 : 0
    };
}

// GET: Fetch all products from Firebase.
router.get("/", async (req, res) => {
    try {
        const snapshot = await firebaseDb.ref("products").once("value");
        const data = snapshot.val() || {};

        const products = Object.entries(data).map(([key, product]) => ({
            ...product,
            id: product.id || key,
            category: normalizeCategory(product.category) || product.category
        }));

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Error fetching Firebase products:", error);

        res.status(500).json({
            success: false,
            message: "Could not fetch products."
        });
    }
});

// POST: Add a product, including its image data, to Firebase.
router.post("/", async (req, res) => {
    try {
        const fields = validateProduct(req.body || {});

        if (fields.error) {
            return res.status(400).json({
                success: false,
                message: fields.error
            });
        }

        const image = typeof req.body.image === "string"
            ? req.body.image
            : "";

        if (image.length > 950000) {
            return res.status(413).json({
                success: false,
                message: "Image is too large. Please resize it and try again."
            });
        }

        const productRef = firebaseDb.ref("products").push();

        const product = {
            id: productRef.key,
            ...fields,
            image,
            created_at: new Date().toISOString()
        };

        await productRef.set(product);

        res.status(201).json({
            success: true,
            message: "Product saved successfully.",
            product
        });
    } catch (error) {
        console.error("Error saving Firebase product:", error);

        res.status(500).json({
            success: false,
            message: "Could not save product."
        });
    }
});

// PUT: Update a product and preserve its existing image if no new image is sent.
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
        const fields = validateProduct(req.body || {}, current);

        if (fields.error) {
            return res.status(400).json({
                success: false,
                message: fields.error
            });
        }

        const image = req.body.image === undefined
            ? (current.image || "")
            : String(req.body.image || "");

        if (image.length > 950000) {
            return res.status(413).json({
                success: false,
                message: "Image is too large. Please resize it and try again."
            });
        }

        const updatedProduct = {
            ...current,
            ...fields,
            id: req.params.id,
            image
        };

        await productRef.set(updatedProduct);

        res.json({
            success: true,
            message: "Product updated successfully.",
            product: updatedProduct
        });
    } catch (error) {
        console.error("Error updating Firebase product:", error);

        res.status(500).json({
            success: false,
            message: "Could not update product."
        });
    }
});

// DELETE: Remove a product from Firebase.
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
        console.error("Error deleting Firebase product:", error);

        res.status(500).json({
            success: false,
            message: "Could not delete product."
        });
    }
});

module.exports = router;
