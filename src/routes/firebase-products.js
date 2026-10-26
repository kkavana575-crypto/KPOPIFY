
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const firebaseDb = require("../database/firebase");

// Temporary/local image upload directory.
// Note: Render's local filesystem may not persist uploaded files after redeployment.
const uploadDir = path.join(
    __dirname,
    "..",
    "..",
    "public",
    "uploads",
    "products"
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName =
            `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
            return cb(new Error("Please upload an image file."));
        }

        cb(null, true);
    }
});

// Normalize categories so the storefront filters work consistently.
function normalizeCategory(value) {
    const category = String(value || "Albums").trim().toLowerCase();

    if (["albums", "txt"].includes(category)) return "Albums";
    if (["ppulbatu", "tubatu"].includes(category)) return "PPULBATU";
    if (["members", "member"].includes(category)) return "Members";

    return null;
}

function parseBestseller(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "on"
    ) ? 1 : 0;
}

function validateProduct(body) {
    const name = String(body.name || "").trim();
    const groupName = String(body.group_name || "").trim();
    const description = String(body.description || "").trim();
    const category = normalizeCategory(body.category);
    const price = Number(body.price);
    const stock = Number(body.stock);

    if (!name || !groupName) {
        return {
            error: "Please enter a product name and group/artist."
        };
    }

    if (
        body.price === undefined ||
        body.price === "" ||
        !Number.isFinite(price) ||
        price <= 0
    ) {
        return {
            error: "Enter a valid price greater than zero."
        };
    }

    if (
        body.stock === undefined ||
        body.stock === "" ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
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
        is_bestseller: parseBestseller(body.is_bestseller)
    };
}

function imagePathFromFile(file) {
    return file
        ? `/uploads/products/${file.filename}`
        : "";
}

// GET: Fetch all products from Firebase.
router.get("/", async (_req, res) => {
    try {
        const snapshot = await firebaseDb.ref("products").once("value");
        const data = snapshot.val() || {};

        const products = Object.entries(data)
            .map(([key, product]) => ({
                ...product,
                id: String(product.id || key),
                category: normalizeCategory(product.category) || product.category || "Albums"
            }))
            .sort((a, b) =>
                String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Firebase product fetch failed:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch products from Firebase."
        });
    }
});

// POST: Add a product to Firebase.
// Supports FormData with an uploaded image or JSON with an image URL.
router.post("/", upload.single("image"), async (req, res) => {
    try {
        const fields = validateProduct(req.body || {});

        if (fields.error) {
            if (req.file) fs.unlink(req.file.path, () => {});

            return res.status(400).json({
                success: false,
                message: fields.error
            });
        }

        // Uploaded image takes priority; otherwise accept an image URL.
        const image = imagePathFromFile(req.file) ||
            String(req.body.image_url || req.body.image || "").trim();

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
            message: "Product saved successfully in Firebase.",
            product
        });
    } catch (error) {
        console.error("Firebase product creation failed:", error);

        if (req.file) fs.unlink(req.file.path, () => {});

        res.status(500).json({
            success: false,
            message: "Failed to save product to Firebase."
        });
    }
});

// PUT: Update a Firebase product.
// If no new image is uploaded, keep the existing image.
router.put("/:id", upload.single("image"), async (req, res) => {
    try {
        const productId = String(req.params.id || "");

        if (!productId || productId.includes(".") ||
            productId.includes("#") || productId.includes("$") ||
            productId.includes("[") || productId.includes("]") ||
            productId.includes("/")) {
            if (req.file) fs.unlink(req.file.path, () => {});

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const productRef = firebaseDb.ref(`products/${productId}`);
        const snapshot = await productRef.once("value");

        if (!snapshot.exists()) {
            if (req.file) fs.unlink(req.file.path, () => {});

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const current = snapshot.val();
        const body = req.body || {};

        const merged = {
            name: body.name ?? current.name,
            group_name: body.group_name ?? current.group_name,
            price: body.price ?? current.price,
            stock: body.stock ?? current.stock,
            description: body.description ?? current.description ?? "",
            category: body.category ?? current.category ?? "Albums",
            is_bestseller: body.is_bestseller ?? current.is_bestseller ?? 0
        };

        const fields = validateProduct(merged);

        if (fields.error) {
            if (req.file) fs.unlink(req.file.path, () => {});

            return res.status(400).json({
                success: false,
                message: fields.error
            });
        }

        const image = imagePathFromFile(req.file) ||
            String(body.image_url || body.image || current.image || "").trim();

        const product = {
            ...current,
            ...fields,
            id: productId,
            image,
            created_at: current.created_at || new Date().toISOString()
        };

        await productRef.set(product);

        res.json({
            success: true,
            message: "Product updated successfully in Firebase.",
            product
        });
    } catch (error) {
        console.error("Firebase product update failed:", error);

        if (req.file) fs.unlink(req.file.path, () => {});

        res.status(500).json({
            success: false,
            message: "Failed to update product in Firebase."
        });
    }
});

// DELETE: Remove a product from Firebase.
router.delete("/:id", async (req, res) => {
    try {
        const productId = String(req.params.id || "");

        if (!productId || productId.includes(".") ||
            productId.includes("#") || productId.includes("$") ||
            productId.includes("[") || productId.includes("]") ||
            productId.includes("/")) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const productRef = firebaseDb.ref(`products/${productId}`);
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
            message: "Product deleted successfully from Firebase."
        });
    } catch (error) {
        console.error("Firebase product deletion failed:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete product from Firebase."
        });
    }
});

// Handle image upload errors.
router.use((error, _req, res, _next) => {
    const message =
        error.code === "LIMIT_FILE_SIZE"
            ? "Image must be 5 MB or smaller."
            : error.message || "Image upload failed.";

    res.status(400).json({
        success: false,
        message
    });
});

module.exports = router;
