require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./src/database/database");
const productsRouter = require("./src/routes/products");
const chatRouter = require("./src/routes/chat");
const ordersRouter = require("./src/routes/orders");
const firebaseTestRouter = require("./src/database/firebase-test");
const firebaseProductsRouter = require("./src/routes/firebase-products");
console.log("CHAT ROUTER LOADED:", typeof chatRouter);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded product images are saved in public/uploads/products
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/products", productsRouter);
app.use("/api/firebase-products", firebaseProductsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/firebase-test", firebaseTestRouter);
console.log("FIREBASE TEST ROUTE REGISTERED");

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "KPOPIFY backend is running!"
    });
});

app.listen(PORT, () => {
    console.log("KPOPIFY backend is running on port " + PORT);
});
