
const productGrid = document.getElementById("productGrid");
const bestsellerGrid = document.getElementById("bestsellerGrid");
const albumCount = document.getElementById("albumCount");
const cartCount = document.getElementById("cartCount");

const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartClose = document.getElementById("cartClose");
const cartItems = document.getElementById("cartItems");
const cartFooter = document.getElementById("cartFooter");

let products = [];
let activeCategory = 'All';
let searchTerm = '';

let cart = [];

try {
    cart = JSON.parse(localStorage.getItem("kpopifyCart") || "[]");

    if (!Array.isArray(cart)) {
        cart = [];
    }
} catch (error) {
    cart = [];
}

// Save cart in the browser
function saveCart() {
    localStorage.setItem("kpopifyCart", JSON.stringify(cart));
}

// Load products from the backend
async function loadProducts() {
    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Could not load products.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error("Could not load albums.");
        }

        products = data.products;

        // Refresh saved cart information using current product data
        cart = cart
            .map(item => {
                const product = products.find(p => Number(p.id) === Number(item.id));

                if (!product) return null;

                return {
                    id: product.id,
                    name: product.name,
                    price: Number(product.price),
                    image: product.image,
                    stock: product.stock,
                    quantity: Math.min(
                        Math.max(1, Number(item.quantity) || 1),
                        product.stock
                    )
                };
            })
            .filter(item => item && item.stock > 0);

        saveCart();

        if (albumCount) {
            albumCount.textContent = `${products.length} albums`;
        }

        
        ensureStoreFilters();
        renderStore();

        renderCart();

    } catch (error) {
        console.error("Product loading error:", error);

        if (albumCount) albumCount.textContent = "Unavailable";

        if (productGrid) {
            productGrid.innerHTML =
                "<p>Albums couldn't load. Please check your server.</p>";
        }
    }
}

// Add search and category filters automatically before the main album grid

function ensureStoreFilters() {
    if (!productGrid || document.getElementById("storeFilters")) return;

    const filters = document.createElement("section");
    filters.id = "storeFilters";
    filters.className = "store-filters";

    filters.innerHTML = `
        <div class="store-filters-heading">
            <span class="store-filter-kicker">FIND YOUR NEXT FAVOURITE</span>
            <label class="store-search-label" for="storeSearch">
                Search the collection
            </label>
        </div>

        <div class="store-search-wrap">
            <span class="store-search-icon" aria-hidden="true">⌕</span>
            <input
                id="storeSearch"
                class="store-search"
                type="search"
                placeholder="Search albums or artists..."
                autocomplete="off"
            >
            <button
                type="button"
                id="clearStoreSearch"
                class="clear-store-search"
                aria-label="Clear search"
                hidden
            >×</button>
        </div>

        <div class="store-category-filters" aria-label="Filter products">
            <button type="button" class="store-filter active" data-category="All">All Products</button>
<button type="button" class="store-filter" data-category="Albums">Albums</button>
<button type="button" class="store-filter" data-category="PPULBATU">PPULBATU</button>
        </div>
    `;

    // Insert search controls before the collection heading.
    const collectionSection = productGrid.closest(".albums-section");

    if (collectionSection) {
        const sectionHeading = collectionSection.querySelector(".section-heading");

        if (sectionHeading) {
            collectionSection.insertBefore(filters, sectionHeading);
        } else {
            collectionSection.insertBefore(filters, productGrid);
        }
    } else {
        productGrid.parentNode.insertBefore(filters, productGrid);
    }

    const search = filters.querySelector("#storeSearch");
    const clear = filters.querySelector("#clearStoreSearch");

    search.addEventListener("input", () => {
        searchTerm = search.value.trim().toLowerCase();
        clear.hidden = !search.value;
        renderStore();
    });

    clear.addEventListener("click", () => {
        search.value = "";
        searchTerm = "";
        clear.hidden = true;
        renderStore();
        search.focus();
    });

    filters.addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;

        activeCategory = button.dataset.category;

        filters.querySelectorAll("[data-category]").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderStore();
    });
}


function renderStore() {
    const filtered = products.filter(product => {
        const category = String(product.category || "Albums").trim();

        // Match the saved category exactly, ignoring letter case.
        const matchesCategory =
            activeCategory === "All" ||
            category.toLowerCase() === activeCategory.toLowerCase();

        const searchable = `
            ${product.name || ""}
            ${product.group_name || ""}
            ${product.description || ""}
            ${category}
        `.toLowerCase();

        return matchesCategory && searchable.includes(searchTerm);
    });

    renderProducts(productGrid, filtered);

    if (bestsellerGrid) {
        const bestsellers = products.filter(
            product => Number(product.is_bestseller) === 1
        );

        renderProducts(bestsellerGrid, bestsellers);
    }
}

// Display album cards with a simple Add to Cart button
function renderProducts(container, albumList) {
    if (!container) return;

    if (albumList.length === 0) {
        container.innerHTML = "<p>No albums available yet. ♡</p>";
        return;
    }

    container.innerHTML = albumList.map(product => {
        const inCart = cart.find(item => Number(item.id) === Number(product.id));

        const image = product.image
            ? `<img class="product-image"
                    src="${product.image}"
                    alt="${product.name}"
                    onerror="this.outerHTML='<div class=&quot;image-placeholder&quot;>♡</div>'">`
            : '<div class="image-placeholder">♡</div>';

        return `
            <article class="product-card" data-product-page="${product.id}" style="cursor:pointer;">
                ${image}
                <div class="product-info">
                    <p class="product-group">${product.group_name || "TXT"}</p>
                    <h3>${product.name}</h3>

                    <div class="product-bottom">
                        <span class="product-price">₹${Number(product.price).toLocaleString("en-IN")}</span>
                    </div>

                    <div class="product-card-actions">
    ${
        inCart
        ? `
            <div class="product-card-actions">
    ${
        inCart
        ? `
            <button
                type="button"
                class="view-cart-button"
                data-view-cart
            >
                View Cart ♡
            </button>
          `
        : `
            <button
                type="button"
                class="add-button"
                data-add="${product.id}"
                ${product.stock <= 0 ? "disabled" : ""}
            >
                ${product.stock <= 0 ? "Sold Out" : "Add to Cart ♡"}
            </button>
          `
    }
</div>
          `
        : `
            <button type="button" class="add-button" data-add="${product.id}"
                ${product.stock <= 0 ? "disabled" : ""}>
                ${product.stock <= 0 ? "Sold Out" : "Add to Cart ♡"}
            </button>
          `
    }
</div>

                    <p class="stock-label">${product.stock > 0 ? `${product.stock} in stock` : "Sold out"}</p>
                    ${inCart ? `<p class="in-cart-note">In your cart: ${inCart.quantity}</p>` : ""}
                </div>
            </article>
        `;
    }).join("");
}
// Open product details only when the product is double-clicked.
document.addEventListener("dblclick", event => {
    // Ignore buttons and quantity controls.
    if (event.target.closest("button")) return;

    // Only open when the image or product name is double-clicked.
    const card = event.target.closest("[data-product-page]");
    if (!card) return;

    const isImage = event.target.closest(".product-image");
    const isName = event.target.closest(".product-info h3");

    if (!isImage && !isName) return;

    window.open(
        `/product.html?id=${card.dataset.productPage}`,
        "_blank",
        "noopener"
    );
});
// Add one album to the cart each time Add to Cart is clicked
function addToCart(productId) {
    const product = products.find(p => Number(p.id) === Number(productId));
    if (!product || product.stock <= 0) return;

    const existingItem = cart.find(item => Number(item.id) === Number(productId));
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity >= product.stock) {
        alert(`Only ${product.stock} unit(s) of this album are in stock.`);
        return;
    }

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image: product.image,
            stock: product.stock,
            quantity: 1
        });
    }

    saveCart();
    renderCart();
    renderStore();
}

// Display the shopping cart
function renderCart() {
    const totalQuantity = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    if (cartCount) {
        cartCount.textContent = totalQuantity;
    }

    if (!cartItems || !cartFooter) return;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <span>♡</span>
                <h3>Your cart is waiting</h3>
                <p>Looks like you haven't added anything yet.</p>
                <a href="#albums" class="primary-button" id="exploreAlbums">
                    EXPLORE ALBUMS
                </a>
            </div>
        `;

        cartFooter.innerHTML = "";
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <article class="cart-item">
            ${item.image
                ? `<img
                    class="cart-item-image"
                    src="${item.image}"
                    alt="${item.name}"
                    onerror="this.style.display='none'"
                >`
                : ""}

            <div class="cart-item-info">
                <h4>${item.name}</h4>

                <p>₹${item.price.toLocaleString("en-IN")}</p>

                <div class="cart-quantity">
                    <button
                        type="button"
                        data-minus="${item.id}"
                        aria-label="Decrease quantity"
                    >−</button>

                    <span>${item.quantity}</span>

                    <button
                        type="button"
                        data-plus="${item.id}"
                        aria-label="Increase quantity"
                    >+</button>
                </div>

                <button
                    type="button"
                    class="remove-item"
                    data-remove="${item.id}"
                >
                    Remove ♡
                </button>
            </div>

            <p class="cart-item-subtotal">
                ₹${(item.price * item.quantity).toLocaleString("en-IN")}
            </p>
        </article>
    `).join("");

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    cartFooter.innerHTML = `
        <p class="cart-total">
            Total: ₹${total.toLocaleString("en-IN")}
        </p>

        <button type="button" class="checkout-button" id="checkoutButton">
            Proceed to Checkout ♡
        </button>

        <p class="checkout-note">
            Checkout will be connected in a later step.
        </p>
    `;
}

// Handle all cart and product buttons
document.addEventListener("click", event => {
        // Open the cart when View Cart is clicked.
    if (event.target.closest("[data-view-cart]")) {
        openCart();
        return;
    }
    const addButton = event.target.closest("[data-add]");

    if (addButton) {
        addToCart(Number(addButton.dataset.add));
        return;
    }

    const plusButton = event.target.closest("[data-plus]");

    if (plusButton) {
        const item = cart.find(
            p => p.id === Number(plusButton.dataset.plus)
        );

        if (item) {
            if (item.quantity >= item.stock) {
                alert("You've reached the available stock. ♡");
                return;
            }

            item.quantity++;
            saveCart();
            renderCart();
            renderProducts(productGrid, products);

            if (bestsellerGrid) {
                renderProducts(bestsellerGrid, products.slice(0, 3));
            }
        }

        return;
    }

    const minusButton = event.target.closest("[data-minus]");

    if (minusButton) {
        const id = Number(minusButton.dataset.minus);
        const item = cart.find(p => p.id === id);

        if (item) {
            item.quantity--;

            if (item.quantity <= 0) {
                cart = cart.filter(p => p.id !== id);
            }

            saveCart();
            renderCart();
            renderProducts(productGrid, products);

            if (bestsellerGrid) {
                renderProducts(bestsellerGrid, products.slice(0, 3));
            }
        }

        return;
    }

    const removeButton = event.target.closest("[data-remove]");

    if (removeButton) {
        const id = Number(removeButton.dataset.remove);

        cart = cart.filter(p => p.id !== id);

        saveCart();
        renderCart();
        ensureStoreFilters();
        renderStore();

        return;
    }

    if (event.target.closest("#checkoutButton")) {
    window.location.href = "/checkout.html";
    return;
}
});

// Open cart drawer
function openCart() {
    if (cartOverlay) cartOverlay.classList.add("active");
    if (cartDrawer) cartDrawer.classList.add("active");

    if (cartDrawer) {
        cartDrawer.setAttribute("aria-hidden", "false");
    }

    document.body.style.overflow = "hidden";
}

// Close cart drawer
function closeCart() {
    if (cartOverlay) cartOverlay.classList.remove("active");
    if (cartDrawer) cartDrawer.classList.remove("active");

    if (cartDrawer) {
        cartDrawer.setAttribute("aria-hidden", "true");
    }

    document.body.style.overflow = "";
}


// Connect the cart button in the navigation
const cartButton = document.getElementById("cartButton");

if (cartButton) {
    cartButton.addEventListener("click", openCart);
}

document.addEventListener("click", event => {
    if (event.target.closest("#exploreAlbums")) {
        closeCart();
    }
});


if (cartClose) {
    cartClose.addEventListener("click", closeCart);
}

if (cartOverlay) {
    cartOverlay.addEventListener("click", closeCart);
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCart();
});

// Start the app
renderCart();

loadProducts().then(() => {
    if (sessionStorage.getItem("kpopifyOpenCart") === "yes") {
        sessionStorage.removeItem("kpopifyOpenCart");
        openCart();
    }
});

// KPOPIFY Hamburger Navigation
document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.getElementById("kpopifyMenuButton");
    const menuPanel = document.getElementById("kpopifyMenuPanel");

    if (!menuButton || !menuPanel) return;

    function closeMenu() {
        menuPanel.classList.remove("visible");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
    }

    menuButton.addEventListener("click", (event) => {
        event.stopPropagation();

        const isOpen = menuPanel.classList.toggle("visible");

        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );
    });

    menuPanel.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", (event) => {
        if (
            !menuPanel.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
    });
});
/* KPOPIFY AI Chatbot */
(() => {
    const toggle = document.getElementById("chat-toggle");
    const close = document.getElementById("chat-close");
    const chatWindow = document.getElementById("chat-window");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const messages = document.getElementById("chat-messages");

    if (!toggle || !close || !chatWindow || !chatForm || !chatInput || !messages) {
    console.warn("Missing chatbot elements:", {
        toggle: !!toggle,
        close: !!close,
        chatWindow: !!chatWindow,
        chatForm: !!chatForm,
        chatInput: !!chatInput,
        messages: !!messages
    });
    return;
}

    // OPEN CHAT
    toggle.addEventListener("click", () => {
        chatWindow.classList.remove("chat-hidden");
        chatWindow.style.display = "flex";
        toggle.style.display = "none";
        chatInput.focus();
    });

    // CLOSE CHAT
    close.addEventListener("click", () => {
        chatWindow.classList.add("chat-hidden");
        chatWindow.style.display = "none";
        toggle.style.display = "flex";
    });

    // DISPLAY MESSAGES
    function addMessage(text, className) {
        const message = document.createElement("div");
        message.className = className;
        message.textContent = text;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
    }

    // SEND MESSAGE TO GEMINI
    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = chatInput.value.trim();
        if (!message) return;

        addMessage(message, "user-message");
        chatInput.value = "";
        chatInput.disabled = true;

        const sendButton = chatForm.querySelector("button");
        if (sendButton) sendButton.disabled = true;

        const thinking = addMessage("Thinking... 💗", "bot-message");

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Chat request failed.");
            }

            thinking.textContent = data.reply || "Here are your matching products! 💗";

(data.products || []).forEach(product => {
    const card = document.createElement("div");
    card.className = "bot-message";
    card.style.maxWidth = "100%";

    if (product.image) {
        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name;
        img.style.cssText = "width:100%;max-height:140px;object-fit:contain;border-radius:8px;";
        img.onerror = () => img.style.display = "none";
        card.appendChild(img);
    }

    const title = document.createElement("strong");
    title.textContent = product.name;
    title.style.display = "block";
    title.style.marginTop = "8px";
    card.appendChild(title);

    const price = document.createElement("p");
    price.textContent = `₹${Number(product.price).toLocaleString("en-IN")}`;
    price.style.margin = "6px 0";
    card.appendChild(price);

    const stock = document.createElement("p");
    stock.textContent = product.stock > 0 ? "In stock 💗" : "Currently out of stock";
    stock.style.margin = "4px 0 8px";
    card.appendChild(stock);

    const link = document.createElement("a");
    link.href = `/product.html?id=${product.id}`;
link.target = "_blank";
link.rel = "noopener";
    link.textContent = "View product";
    link.style.cssText = "display:inline-block;padding:8px 12px;background:#f28bb5;color:white;border-radius:18px;text-decoration:none;font-size:13px;";
    card.appendChild(link);

    messages.appendChild(card);
});

messages.scrollTop = messages.scrollHeight;
        } catch (error) {
            thinking.textContent = "Sorry, I couldn't reply right now. Please try again. 💗";
            console.error("KPOPIFY chatbot:", error);
        } finally {
            chatInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            chatInput.focus();
        }
    });
})();
