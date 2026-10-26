
const productImage = document.getElementById("productImage");
const productGroup = document.getElementById("productGroup");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productDescription = document.getElementById("productDescription");
const productStock = document.getElementById("productStock");
const addToCartButton = document.getElementById("addToCartButton");
const statusMessage = document.getElementById("statusMessage");

const productId = new URLSearchParams(window.location.search).get("id");

let currentProduct = null;

function showError(message) {
    productName.textContent = "Product unavailable";
    productDescription.textContent = message;
    productPrice.textContent = "";
    productGroup.textContent = "";
    productStock.textContent = "";
    productImage.removeAttribute("src");
    addToCartButton.disabled = true;
    addToCartButton.textContent = "Unavailable";
}

function getCart() {
    try {
        const savedCart = JSON.parse(
            localStorage.getItem("kpopifyCart") || "[]"
        );

        return Array.isArray(savedCart) ? savedCart : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem("kpopifyCart", JSON.stringify(cart));
}

async function loadProduct() {
    if (!productId) {
        showError("No product ID was provided.");
        return;
    }

    try {
        // Load products from Firebase.
        const response = await fetch("/api/firebase-products");

        if (!response.ok) {
            throw new Error("The server could not load the products.");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.products)) {
            throw new Error("The product list could not be loaded.");
        }

        // Firebase product IDs are strings, so compare them as strings.
        currentProduct = data.products.find(
            product => String(product.id) === String(productId)
        );

        if (!currentProduct) {
            showError("This product could not be found in the catalogue.");
            return;
        }

        // Display the selected product.
        productName.textContent = currentProduct.name || "Untitled product";
        productGroup.textContent = currentProduct.group_name || "K-pop merchandise";

        productPrice.textContent =
            "₹" + Number(currentProduct.price || 0).toLocaleString("en-IN");

        productDescription.textContent =
            currentProduct.description || "A special item for your collection. ♡";

        const stock = Math.max(0, Number(currentProduct.stock) || 0);

        productStock.textContent = stock > 0
            ? `${stock} available`
            : "Currently sold out";

        if (currentProduct.image) {
            productImage.src = currentProduct.image;
            productImage.alt = currentProduct.name || "Product image";
            productImage.onerror = () => {
                productImage.removeAttribute("src");
                productImage.alt = "Product image unavailable";
            };
        } else {
            productImage.removeAttribute("src");
            productImage.alt = "No product image available";
        }

        addToCartButton.disabled = stock <= 0;
        addToCartButton.textContent = stock > 0
            ? "Add to Cart ♡"
            : "Sold Out";

    } catch (error) {
        console.error("Product details error:", error);
        showError("Could not load this product. Please try again later.");
    }
}

addToCartButton.addEventListener("click", () => {
    if (!currentProduct) return;

    const stock = Math.max(0, Number(currentProduct.stock) || 0);

    if (stock <= 0) {
        statusMessage.textContent = "Sorry, this item is sold out.";
        return;
    }

    const cart = getCart();

    // Compare IDs as strings to support Firebase IDs.
    const existingItem = cart.find(
        item => String(item.id) === String(currentProduct.id)
    );

    if (existingItem) {
        if (Number(existingItem.quantity) >= stock) {
            statusMessage.textContent =
                `Only ${stock} item(s) are available.`;
            return;
        }

        existingItem.quantity = (Number(existingItem.quantity) || 0) + 1;
    } else {
        cart.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: Number(currentProduct.price) || 0,
            image: currentProduct.image || "",
            stock: stock,
            quantity: 1
        });
    }

    saveCart(cart);

    statusMessage.textContent = "Added to your cart successfully! ♡";
    addToCartButton.textContent = "Added to Cart ♡";

    // Update the navigation cart count if it exists.
    const cartCount = document.getElementById("cartCount");

    if (cartCount) {
        cartCount.textContent = cart.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
        );
    }

    // Restore the button label after a short delay.
    setTimeout(() => {
        if (currentProduct && Number(currentProduct.stock) > 0) {
            addToCartButton.textContent = "Add to Cart ♡";
        }
    }, 1500);
});

loadProduct();
