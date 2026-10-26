
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
let activeCategory = "All";
let searchTerm = "";
let cart = [];

try {
    cart = JSON.parse(localStorage.getItem("kpopifyCart") || "[]");
    if (!Array.isArray(cart)) cart = [];
} catch {
    cart = [];
}

function saveCart() {
    localStorage.setItem("kpopifyCart", JSON.stringify(cart));
}

function sameId(a, b) {
    return String(a) === String(b);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Load products from Firebase
async function loadProducts() {
    try {
        const response = await fetch("/api/firebase-products");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load products.");
        }

        products = Array.isArray(data.products) ? data.products : [];

        // Refresh saved cart items using the current Firebase product data
        cart = cart.map(item => {
            const product = products.find(p => sameId(p.id, item.id));

            if (!product) return null;

            const stock = Math.max(0, Number(product.stock) || 0);
            if (stock < 1) return null;

            return {
                id: product.id,
                name: product.name,
                price: Number(product.price) || 0,
                image: product.image || "",
                stock,
                quantity: Math.min(
                    Math.max(1, Number(item.quantity) || 1),
                    stock
                )
            };
        }).filter(Boolean);

        saveCart();

        if (albumCount) {
            albumCount.textContent = `${products.length} products`;
        }

        ensureStoreFilters();
        renderStore();
        renderCart();

    } catch (error) {
        console.error("Product loading error:", error);

        if (albumCount) albumCount.textContent = "Unavailable";

        if (productGrid) {
            productGrid.innerHTML =
                "<p>Products couldn't load. Please check the Firebase products API.</p>";
        }
    }
}

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
            <button type="button" class="store-filter" data-category="Members">Members</button>
        </div>
    `;

    const collectionSection = productGrid.closest(".albums-section");

    if (collectionSection) {
        const heading = collectionSection.querySelector(".section-heading");

        if (heading) {
            collectionSection.insertBefore(filters, heading);
        } else {
            collectionSection.insertBefore(filters, productGrid);
        }
    } else if (productGrid.parentNode) {
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

function normalizeCategory(value) {
    const category = String(value || "Albums").trim().toLowerCase();

    if (["albums", "txt"].includes(category)) return "Albums";
    if (["ppulbatu", "tubatu"].includes(category)) return "PPULBATU";
    if (["members", "member"].includes(category)) return "Members";

    return category;
}

function renderStore() {
    const filtered = products.filter(product => {
        const category = normalizeCategory(product.category);

        const matchesCategory =
            activeCategory === "All" ||
            category === activeCategory;

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
            product =>
                Number(product.is_bestseller) === 1 ||
                product.is_bestseller === true
        );

        renderProducts(bestsellerGrid, bestsellers);
    }
}

function renderProducts(container, productList) {
    if (!container) return;

    if (!productList.length) {
        container.innerHTML = "<p>No products available yet. ♡</p>";
        return;
    }

    container.innerHTML = productList.map(product => {
        const inCart = cart.find(item => sameId(item.id, product.id));
        const id = escapeHTML(product.id);
        const name = escapeHTML(product.name || "Untitled product");
        const group = escapeHTML(product.group_name || "TXT");
        const category = normalizeCategory(product.category);
        const price = Number(product.price) || 0;
        const stock = Math.max(0, Number(product.stock) || 0);
        const imageURL = String(product.image || "").trim();

        const image = imageURL
            ? `<img class="product-image"
                    src="${escapeHTML(imageURL)}"
                    alt="${name}"
                    onerror="this.outerHTML='<div class=&quot;image-placeholder&quot;>♡</div>'">`
            : '<div class="image-placeholder">♡</div>';

        const actionButton = inCart
            ? `<button type="button" class="view-cart-button" data-view-cart>View Cart ♡</button>`
            : `<button
                    type="button"
                    class="add-button"
                    data-add="${id}"
                    ${stock <= 0 ? "disabled" : ""}
                >${stock <= 0 ? "Sold Out" : "Add to Cart ♡"}</button>`;

        return `
            <article class="product-card" data-product-page="${id}" style="cursor:pointer;">
                ${image}

                <div class="product-info">
                    <p class="product-group">${group}</p>
                    <h3>${name}</h3>

                    <div class="product-bottom">
                        <span class="product-price">₹${price.toLocaleString("en-IN")}</span>
                    </div>

                    <div class="product-card-actions">
                        ${actionButton}
                    </div>

                    <p class="stock-label">
                        ${stock > 0 ? `${stock} in stock` : "Sold out"}
                    </p>

                    ${inCart ? `<p class="in-cart-note">In your cart: ${inCart.quantity}</p>` : ""}
                </div>
            </article>
        `;
    }).join("");
}

// Open the product page when the image or product name is double-clicked
document.addEventListener("dblclick", event => {
    if (event.target.closest("button")) return;

    const card = event.target.closest("[data-product-page]");
    if (!card) return;

    if (
        !event.target.closest(".product-image") &&
        !event.target.closest(".product-info h3")
    ) {
        return;
    }

    window.location.href =
        `/product.html?id=${encodeURIComponent(card.dataset.productPage)}`;
});

function addToCart(productId) {
    const product = products.find(p => sameId(p.id, productId));

    if (!product) {
        alert("This product could not be found. Please refresh the page.");
        return;
    }

    const stock = Math.max(0, Number(product.stock) || 0);

    if (stock <= 0) {
        alert("This product is sold out.");
        return;
    }

    const existingItem = cart.find(item => sameId(item.id, product.id));
    const currentQuantity = existingItem
        ? Number(existingItem.quantity) || 0
        : 0;

    if (currentQuantity >= stock) {
        alert(`Only ${stock} unit(s) of this product are in stock.`);
        return;
    }

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            image: product.image || "",
            stock,
            quantity: 1
        });
    }

    saveCart();
    renderCart();
    renderStore();
}

function renderCart() {
    const totalQuantity = cart.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
    );

    if (cartCount) cartCount.textContent = totalQuantity;

    if (!cartItems || !cartFooter) return;

    if (!cart.length) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <span>♡</span>
                <h3>Your cart is waiting</h3>
                <p>Looks like you haven't added anything yet.</p>
                <a href="#albums" class="primary-button" id="exploreAlbums">
                    EXPLORE PRODUCTS
                </a>
            </div>
        `;

        cartFooter.innerHTML = "";
        return;
    }

    cartItems.innerHTML = cart.map(item => {
        const image = item.image
            ? `<img class="cart-item-image"
                    src="${escapeHTML(item.image)}"
                    alt="${escapeHTML(item.name)}"
                    onerror="this.style.display='none'">`
            : "";

        return `
            <article class="cart-item">
                ${image}

                <div class="cart-item-info">
                    <h4>${escapeHTML(item.name)}</h4>
                    <p>₹${(Number(item.price) || 0).toLocaleString("en-IN")}</p>

                    <div class="cart-quantity">
                        <button type="button" data-minus="${escapeHTML(item.id)}" aria-label="Decrease quantity">−</button>
                        <span>${Number(item.quantity) || 1}</span>
                        <button type="button" data-plus="${escapeHTML(item.id)}" aria-label="Increase quantity">+</button>
                    </div>

                    <button type="button" class="remove-item" data-remove="${escapeHTML(item.id)}">
                        Remove ♡
                    </button>
                </div>

                <p class="cart-item-subtotal">
                    ₹${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString("en-IN")}
                </p>
            </article>
        `;
    }).join("");

    const total = cart.reduce(
        (sum, item) =>
            sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
    );

    cartFooter.innerHTML = `
        <p class="cart-total">Total: ₹${total.toLocaleString("en-IN")}</p>
        <button type="button" class="checkout-button" id="checkoutButton">
            Proceed to Checkout ♡
        </button>
        <p class="checkout-note">
            Checkout still needs to be connected to Firebase products.
        </p>
    `;
}

document.addEventListener("click", event => {
    if (event.target.closest("[data-view-cart]")) {
        openCart();
        return;
    }

    const addButton = event.target.closest("[data-add]");
    if (addButton) {
        addToCart(addButton.dataset.add);
        return;
    }

    const plusButton = event.target.closest("[data-plus]");
    if (plusButton) {
        const item = cart.find(p => sameId(p.id, plusButton.dataset.plus));

        if (item) {
            if (item.quantity >= item.stock) {
                alert("You've reached the available stock. ♡");
                return;
            }

            item.quantity++;
            saveCart();
            renderCart();
            renderStore();
        }
        return;
    }

    const minusButton = event.target.closest("[data-minus]");
    if (minusButton) {
        const id = minusButton.dataset.minus;
        const item = cart.find(p => sameId(p.id, id));

        if (item) {
            item.quantity--;

            if (item.quantity <= 0) {
                cart = cart.filter(p => !sameId(p.id, id));
            }

            saveCart();
            renderCart();
            renderStore();
        }
        return;
    }

    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
        const id = removeButton.dataset.remove;
        cart = cart.filter(p => !sameId(p.id, id));

        saveCart();
        renderCart();
        renderStore();
        return;
    }

    if (event.target.closest("#checkoutButton")) {
        alert("Checkout is not yet connected to Firebase products. Your cart is saved, but orders are not being submitted.");
    }
});

// Cart drawer controls
function openCart() {
    if (cartOverlay) cartOverlay.classList.add("active");
    if (cartDrawer) {
        cartDrawer.classList.add("active");
        cartDrawer.setAttribute("aria-hidden", "false");
    }
    document.body.style.overflow = "hidden";
}

function closeCart() {
    if (cartOverlay) cartOverlay.classList.remove("active");
    if (cartDrawer) {
        cartDrawer.classList.remove("active");
        cartDrawer.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "";
}

const cartButton = document.getElementById("cartButton");
if (cartButton) cartButton.addEventListener("click", openCart);

if (cartClose) cartClose.addEventListener("click", closeCart);
if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

document.addEventListener("click", event => {
    if (event.target.closest("#exploreAlbums")) closeCart();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCart();
});

// Start the store
renderCart();

loadProducts().then(() => {
    if (sessionStorage.getItem("kpopifyOpenCart") === "yes") {
        sessionStorage.removeItem("kpopifyOpenCart");
        openCart();
    }
});

// Hamburger navigation
document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.getElementById("kpopifyMenuButton");
    const menuPanel = document.getElementById("kpopifyMenuPanel");

    if (!menuButton || !menuPanel) return;

    function closeMenu() {
        menuPanel.classList.remove("visible");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
    }

    menuButton.addEventListener("click", event => {
        event.stopPropagation();

        const isOpen = menuPanel.classList.toggle("visible");

        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.setAttribute("aria-label", isOpen
            ? "Close navigation menu"
            : "Open navigation menu");
    });

    menuPanel.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", event => {
        if (!menuPanel.contains(event.target) && !menuButton.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
    });
});

// KPOPIFY AI Chatbot
(() => {
    const toggle = document.getElementById("chat-toggle");
    const close = document.getElementById("chat-close");
    const chatWindow = document.getElementById("chat-window");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const messages = document.getElementById("chat-messages");

    if (!toggle || !close || !chatWindow || !chatForm || !chatInput || !messages) {
        return;
    }

    toggle.addEventListener("click", () => {
        chatWindow.classList.remove("chat-hidden");
        chatWindow.style.display = "flex";
        toggle.style.display = "none";
        chatInput.focus();
    });

    close.addEventListener("click", () => {
        chatWindow.classList.add("chat-hidden");
        chatWindow.style.display = "none";
        toggle.style.display = "flex";
    });

    function addMessage(text, className) {
        const message = document.createElement("div");
        message.className = className;
        message.textContent = text;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
    }

    chatForm.addEventListener("submit", async event => {
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
                headers: { "Content-Type": "application/json" },
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
                    img.alt = product.name || "Product image";
                    img.style.cssText = "width:100%;max-height:140px;object-fit:contain;border-radius:8px;";
                    img.onerror = () => img.style.display = "none";
                    card.appendChild(img);
                }

                const title = document.createElement("strong");
                title.textContent = product.name || "Product";
                title.style.display = "block";
                title.style.marginTop = "8px";
                card.appendChild(title);

                const price = document.createElement("p");
                price.textContent = `₹${(Number(product.price) || 0).toLocaleString("en-IN")}`;
                price.style.margin = "6px 0";
                card.appendChild(price);

                const stock = document.createElement("p");
                stock.textContent = Number(product.stock) > 0
                    ? "In stock 💗"
                    : "Currently out of stock";
                stock.style.margin = "4px 0 8px";
                card.appendChild(stock);

                const link = document.createElement("a");
                link.href = `/product.html?id=${encodeURIComponent(product.id)}`;
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
