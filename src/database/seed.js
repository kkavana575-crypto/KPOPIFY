const db = require("./database");

const products = [
    {
        name: "The Name Chapter: TEMPTATION",
        group_name: "TXT",
        price: 1800,
        stock: 10,
        image: "/images/temptation.jpg",
        description: "TXT's The Name Chapter: TEMPTATION album."
    },
    {
        name: "The Name Chapter: FREEFALL",
        group_name: "TXT",
        price: 2000,
        stock: 8,
        image: "/images/freefall.jpg",
        description: "TXT's The Name Chapter: FREEFALL album."
    },
    {
        name: "minisode 3: TOMORROW",
        group_name: "TXT",
        price: 1900,
        stock: 5,
        image: "/images/tomorrow.jpg",
        description: "TXT's minisode 3: TOMORROW album."
    }
];

const insertProduct = db.prepare(`
    INSERT INTO products
    (name, group_name, price, stock, image, description)
    VALUES (@name, @group_name, @price, @stock, @image, @description)
`);

const insertMany = db.transaction((items) => {
    for (const product of items) {
        insertProduct.run(product);
    }
});

const existingProducts = db.prepare(
    "SELECT COUNT(*) AS total FROM products"
).get().total;

if (existingProducts === 0) {
    insertMany(products);
    console.log("Sample TXT albums added successfully!");
} else {
    console.log("Products already exist. No duplicates added.");
}

db.close();
