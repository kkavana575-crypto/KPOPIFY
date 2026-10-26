const admin = require("firebase-admin");

const serviceAccountPath =
    "/etc/secrets/firebase-service-account.json";

if (!admin.apps.length) {
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
            process.env.FIREBASE_DATABASE_URL ||
            "https://kpopify-95ca5-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}

const firebaseDb = admin.database();

module.exports = firebaseDb;
