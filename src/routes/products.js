
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const db = require("../database/database");

const uploadDir = path.join(__dirname, "..", "..", "public", "uploads", "products");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
            return cb(new Error("Please upload an image file."));
        }
        cb(null, true);
    }
});

// Use the same category names as the store filters.
function normalizeCategory(value) {
    const category = String(value || "Albums").trim().toLowerCase();

    if (["albums", "txt"].includes(category)) return "Albums";
    if (["ppulbatu", "tubatu"].includes(category)) return "PPULBATU";
    if (["members", "member"].includes(category)) return "Members";

    return null;
}

function validateProduct(body) {
    const name = String(body.name || "").trim();
    const groupName = String(body.group_name || "").trim();
    const description = String(body.description || "").trim();
    const category = normalizeCategory(body.category);
    const price = Number(body.price);
    const stock = Number(body.stock);

    const isBestseller =
        body.is_bestseller === "1" ||
        body.is_bestseller === "on" ||
        body.is_bestseller === "true" ||
        body.is_bestseller === true;

    if (
        !name ||
        !groupName ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        return {
            error: "Enter a name, group/artist, valid price, and whole-number stock (0 or more)."
        };
    }

    if (!category) {
        return {
            error: "Choose Albums, PPULBATU, or Members for the category."
        };
    }

    return {
        name,
        groupName,
        description,
        category,
        price,
        stock,
        isBestseller: isBestseller ? 1 : 0
    };
}

// Return products with consistent category names.
router.get("/", (_req, res) => {
    try {
        const products = db.prepare("SELECT * FROM products ORDER BY id DESC").all();

        const normalizedProducts = products.map(product => ({
            ...product,
            category: normalizeCategory(product.category) || product.category
        }));

        res.json({
            success: true,
            count: normalizedProducts.length,
            products: normalizedProducts
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({
            success: false,
            message: "Could not fetch products."
        });
    }
});

// Add a product.
router.post("/", upload.single("image"), (req, res) => {
    try {
        const fields = validateProduct(req.body);

        if (fields.error) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(400).json({
                success: false,
                message: fields.error
            });
        }

        const imagePath = req.file
            ? `/uploads/products/${req.file.filename}`
            : (String(req.body.image_url || "").trim() || null);

        const result = db.prepare(`
            INSERT INTO products
            (name, group_name, price, stock, image, description, category, is_bestseller)
            VALUES
            (@name, @groupName, @price, @stock, @image, @description, @category, @isBestseller)
        `).run({
            ...fields,
            image: imagePath
        });

        const product = db.prepare(
            "SELECT * FROM products WHERE id = ?"
        ).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            product: {
                ...product,
                category: normalizeCategory(product.category) || product.category
            }
        });
    } catch (error) {
        console.error("Error adding product:", error);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({
            success: false,
            message: "Could not add product."
        });
    }
});

// Update a product.
router.put("/:id", upload.single("image"), (req, res) => {
    try {
        const id = Number(req.params.id);
        const oldProduct = db.prepare(
            "SELECT * FROM products WHERE id = ?"
        ).get(id);

        if (!oldProduct) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const fields = validateProduct(req.body);

        if (fields.error) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(400).json({
                success: false,
                message: fields.error
            });
        }

        const imagePath = req.file
            ? `/uploads/products/${req.file.filename}`
            : oldProduct.image;

        db.prepare(`
            UPDATE products
            SET name = @name,
                group_name = @groupName,
                price = @price,
                stock = @stock,
                image = @image,
                description = @description,
                category = @category,
                is_bestseller = @isBestseller
            WHERE id = @id
        `).run({
            ...fields,
            image: imagePath,
            id
        });

        const product = db.prepare(
            "SELECT * FROM products WHERE id = ?"
        ).get(id);

        res.json({
            success: true,
            product: {
                ...product,
                category: normalizeCategory(product.category) || product.category
            }
        });
    } catch (error) {
        console.error("Error updating product:", error);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({
            success: false,
            message: "Could not update product."
        });
    }
});

// Delete a product.
router.delete("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = db.prepare(
            "DELETE FROM products WHERE id = ?"
        ).run(id);

        if (!result.changes) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.json({
            success: true,
            message: "Product deleted."
        });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({
            success: false,
            message: "Could not delete product."
        });
    }
});

router.use((error, _req, res, _next) => {
    const message =
        error.code === "LIMIT_FILE_SIZE"
            ? "Image must be 5 MB or smaller."
            : error.message || "Upload failed.";

    res.status(400).json({
        success: false,
        message
    });
});

module.exports = router;
