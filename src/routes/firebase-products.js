```javascript
const express = require("express");
const router = express.Router();
const firebaseDb = require("../database/firebase");

// GET: Fetch all products from Firebase
router.get("/", async (req, res) => {
  try {
    const snapshot = await firebaseDb.ref("products").once("value");
    const data = snapshot.val() || {};

    const products = Object.entries(data).map(([id, product]) => ({
      ...product,
      id: product.id || id
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
      message: "Failed to fetch products from Firebase."
    });
  }
});

// POST: Add a product and its image to Firebase
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

    if (
      !name ||
      !group_name ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, group, price and stock are required."
      });
    }

    const productName = String(name).trim();
    const groupName = String(group_name).trim();
    const productPrice = Number(price);
    const productStock = Number(stock);
    const productImage = typeof image === "string" ? image : "";

    if (!productName || !groupName) {
      return res.status(400).json({
        success: false,
        message: "Please enter a product name and group/artist."
      });
    }

    if (
      !Number.isFinite(productPrice) ||
      productPrice < 0 ||
      !Number.isInteger(productStock) ||
      productStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid price and non-negative whole-number stock."
      });
    }

    // Limit image data to avoid oversized database records.
    if (productImage.length > 950000) {
      return res.status(413).json({
        success: false,
        message: "Image data is too large. Please resize the image and try again."
      });
    }

    const newProductRef = firebaseDb.ref("products").push();

    const product = {
      id: newProductRef.key,
      name: productName,
      group_name: groupName,
      price: productPrice,
      stock: productStock,
      image: productImage,
      description: String(description || ""),
      category: String(category || "TXT"),
      is_bestseller: Number(is_bestseller) ? 1 : 0,
      created_at: new Date().toISOString()
    };

    await newProductRef.set(product);

    res.status(201).json({
      success: true,
      message: "Product saved successfully.",
      product
    });
  } catch (error) {
    console.error("Firebase product creation failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save product to Firebase."
    });
  }
});

// PUT: Edit a product without losing its existing image
router.put("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const productRef = firebaseDb.ref(`products/${productId}`);
    const snapshot = await productRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const current = snapshot.val();
    const updates = req.body || {};

    const name = String(updates.name ?? current.name ?? "").trim();
    const groupName = String(
      updates.group_name ?? current.group_name ?? ""
    ).trim();

    const price = updates.price === undefined
      ? Number(current.price)
      : Number(updates.price);

    const stock = updates.stock === undefined
      ? Number(current.stock)
      : Number(updates.stock);

    if (!name || !groupName) {
      return res.status(400).json({
        success: false,
        message: "Name and group/artist are required."
      });
    }

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid price and non-negative whole-number stock."
      });
    }

    // Keep the current image unless a new image is supplied.
    const image = updates.image === undefined
      ? (current.image || "")
      : String(updates.image || "");

    if (image.length > 950000) {
      return res.status(413).json({
        success: false,
        message: "Image data is too large. Please resize the image and try again."
      });
    }

    const updatedProduct = {
      ...current,
      id: productId,
      name,
      group_name: groupName,
      price,
      stock,
      image,
      description: String(
        updates.description ?? current.description ?? ""
      ),
      category: String(
        updates.category ?? current.category ?? "TXT"
      ),
      is_bestseller: Number(
        updates.is_bestseller ?? current.is_bestseller ?? 0
      ) ? 1 : 0
    };

    // Preserve the original creation date.
    await productRef.set(updatedProduct);

    res.json({
      success: true,
      message: "Product updated successfully.",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Firebase product update failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product in Firebase."
    });
  }
});

// DELETE: Remove a product from Firebase
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
      message: "Failed to delete product from Firebase."
    });
  }
});

module.exports = router;
```
