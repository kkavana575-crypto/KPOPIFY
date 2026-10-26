const express = require("express");
const router = express.Router();

router.get("/", async (_req, res) => {
    try {
        const firebaseDb = require("./firebase");

        await firebaseDb.ref("connection_test").set({
            connected: true,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: "Firebase Realtime Database connected!"
        });
    } catch (error) {
        console.error("Firebase connection test failed:", error);

        res.status(500).json({
            success: false,
            message: "Firebase connection failed.",
            error: error.message
        });
    }
});

module.exports = router;
