const productImage = document.getElementById("productImage");
const productGroup = document.getElementById("productGroup");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productDescription = document.getElementById("productDescription");
const productStock = document.getElementById("productStock");
const addToCartButton = document.getElementById("addToCartButton");
const statusMessage = document.getElementById("statusMessage");

let currentProduct = null;

// Get the existing shopping cart.
function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("kpopifyCart") || "[]");
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

// Save the shopping cart.
function saveCart(cart) {
    localStorage.setItem("kpopifyCart", JSON.stringify(cart));
}

// Display category names consistently.
function getCategoryLabel(category) {
    const categories = {
        TXT: "Albums",
        Tubatu: "PPULBATU",
        Albums: "Albums",
        PPULBATU: "PPULBATU"
    };

    return categories[category] || category || "Albums";
}

// Create the quantity selector and Buy Now button.
function setupShoppingControls() {
    if (!addToCartButton || document.getElementById("quantitySelect")) {
        return;
    }

    const label = document.createElement("label");
    label.htmlFor = "quantitySelect";
    label.textContent = "Quantity";
    label.style.cssText =
        "display:block;margin:20px 0 8px;font-weight:600;";

    const select = document.createElement("select");
    select.id = "quantitySelect";
    select.style.cssText =
        "width:100%;padding:13px;border:1px solid #b8c8d8;border-radius:12px;background:white;color:#10263f;font-size:16px;margin-bottom:16px;";

    addToCartButton.insertAdjacentElement("beforebegin", label);
    label.insertAdjacentElement("afterend", select);

    addToCartButton.style.cssText =
        "width:100%;padding:15px;margin-bottom:12px;border:0;border-radius:30px;background:#10263f;color:white;font-size:16px;font-weight:bold;cursor:pointer;";

    let buyNowButton = document.getElementById("buyNowButton");

    if (!buyNowButton) {
        buyNowButton = document.createElement("button");
        buyNowButton.id = "buyNowButton";
        buyNowButton.type = "button";
        buyNowButton.textContent = "Buy Now ♡";
        buyNowButton.style.cssText =
            "width:100%;padding:15px;border:2px solid #f28bb5;border-radius:30px;background:#f28bb5;color:#10263f;font-size:16px;font-weight:bold;cursor:pointer;";

        addToCartButton.insertAdjacentElement("afterend", buyNowButton);

        buyNowButton.addEventListener("click", () => {
            addSelectedQuantityToCart(true);
        });
    }
}

// Update quantity options according to available stock.
function updateQuantityOptions() {
    const select = document.getElementById("quantitySelect");

    if (!select || !currentProduct) return;

    select.innerHTML = "";

    const stock = Math.max(0, Number(currentProduct.stock) || 0);

    if (stock === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Out of stock";
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    for (let quantity = 1; quantity <= Math.min(stock, 10); quantity++) {
        const option = document.createElement("option");
        option.value = quantity;
        option.textContent = `Quantity: ${quantity}`;
        select.appendChild(option);
    }

    select.disabled = false;
}

// Load product details from the database.
async function loadProduct() {
    const productId = new URLSearchParams(window.location.search).get("id");

    if (!productId || !/^\d+$/.test(productId)) {
        productName.textContent = "Invalid product";
        addToCartButton.style.display = "none";
        return;
    }

    try {
        const response = await fetch("/api/products");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load products.");
        }

        currentProduct = (data.products || []).find(
            product => Number(product.id) === Number(productId)
        );

        if (!currentProduct) {
            productName.textContent = "Product not found ♡";

            if (productDescription) {
                productDescription.textContent =
                    "This product may no longer be available.";
            }

            addToCartButton.style.display = "none";
            return;
        }

        // Display product information.
        document.title = `${currentProduct.name} | KPOPIFY`;

        productName.textContent = currentProduct.name;

        // Show the artist/group name and category.
        if (productGroup) {
            const groupName = currentProduct.group_name || "K-pop";
            const category = getCategoryLabel(currentProduct.category);

            productGroup.textContent =
                `${groupName} · ${category}`;
        }

        productPrice.textContent =
            `₹${Number(currentProduct.price).toLocaleString("en-IN")}`;

        productDescription.textContent =
            currentProduct.description ||
            "A special item for your collection. ♡";

        const stock = Math.max(0, Number(currentProduct.stock) || 0);

        productStock.textContent = stock > 0
            ? `${stock} in stock 💗`
            : "Currently sold out";

        // Display the product image.
        if (productImage) {
            if (currentProduct.image) {
                productImage.src = currentProduct.image;
                productImage.alt = currentProduct.name;
                productImage.style.visibility = "visible";

                productImage.onerror = () => {
                    productImage.style.visibility = "hidden";
                };
            } else {
                productImage.style.visibility = "hidden";
            }
        }

        setupShoppingControls();
        updateQuantityOptions();

        const available = stock > 0;

        addToCartButton.disabled = !available;
        addToCartButton.textContent = available
            ? "Add to Cart ♡"
            : "Sold Out";

        const buyNowButton = document.getElementById("buyNowButton");

        if (buyNowButton) {
            buyNowButton.disabled = !available;
            buyNowButton.style.opacity = available ? "1" : "0.6";
        }

        if (statusMessage) {
            statusMessage.textContent = "";
        }

    } catch (error) {
        console.error("Product details error:", error);

        productName.textContent = "Couldn't load this product.";

        if (statusMessage) {
            statusMessage.textContent = error.message;
        }

        addToCartButton.style.display = "none";
    }
}

// Add the selected quantity to the cart.
function addSelectedQuantityToCart(buyNow = false) {
    if (!currentProduct || Number(currentProduct.stock) <= 0) {
        return;
    }

    const select = document.getElementById("quantitySelect");
    const quantity = Number(select?.value || 1);

    if (!Number.isInteger(quantity) || quantity < 1) {
        return;
    }

    const cart = getCart();

    const existingItem = cart.find(
        item => Number(item.id) === Number(currentProduct.id)
    );

    const existingQuantity = existingItem
        ? Number(existingItem.quantity) || 0
        : 0;

    if (existingQuantity + quantity > Number(currentProduct.stock)) {
        if (statusMessage) {
            statusMessage.textContent =
                `Only ${currentProduct.stock} unit(s) are available in total.`;
        }

        return;
    }

    if (existingItem) {
        existingItem.quantity = existingQuantity + quantity;
        existingItem.stock = Number(currentProduct.stock);
    } else {
        cart.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: Number(currentProduct.price),
            image: currentProduct.image,
            stock: Number(currentProduct.stock),
            quantity: quantity
        });
    }

    saveCart(cart);

    if (buyNow) {
        // Return to the storefront and request the cart to open.
        sessionStorage.setItem("kpopifyOpenCart", "yes");
        window.location.href = "/index.html";
        return;
    }

    if (statusMessage) {
        statusMessage.textContent =
            `${quantity} item(s) added to your cart successfully! 💗`;
    }
}

// Add to Cart button.
if (addToCartButton) {
    addToCartButton.addEventListener("click", () => {
        addSelectedQuantityToCart(false);
    });
}

// Start loading the product.
loadProduct();
