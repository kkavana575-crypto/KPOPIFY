const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "kpopify.db");
const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        group_name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Add new fields safely to existing databases (does not delete existing products).
const columns = db.prepare("PRAGMA table_info(products)").all().map(column => column.name);
if (!columns.includes("category")) {
    db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'TXT'");
}
if (!columns.includes("is_bestseller")) {
    db.exec("ALTER TABLE products ADD COLUMN is_bestseller INTEGER NOT NULL DEFAULT 0");
}

console.log("KPOPIFY database connected successfully!");
module.exports = db;
