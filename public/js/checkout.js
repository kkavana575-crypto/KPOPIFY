
const checkoutForm = document.getElementById("checkout-form");
const checkoutItems = document.getElementById("checkout-items");
const checkoutTotal = document.getElementById("checkout-total");
const checkoutMessage = document.getElementById("checkout-message");
const placeOrderButton = document.getElementById("place-order-button");

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("kpopifyCart") || "[]");
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function renderCheckout() {
    const cart = getCart();

    if (!cart.length) {
        checkoutItems.textContent = "Your cart is empty. Please add an album first.";
        checkoutTotal.textContent = "₹0";
        placeOrderButton.disabled = true;
        return;
    }

    let total = 0;
    checkoutItems.replaceChildren();

    cart.forEach(item => {
        const quantity = Number(item.quantity);
        const price = Number(item.price);

        if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) {
            return;
        }

        const subtotal = price * quantity;
        total += subtotal;

        const row = document.createElement("div");
        row.className = "checkout-summary-item";

        const name = document.createElement("span");
        name.textContent = `${item.name || "Album"} × ${quantity}`;

        const amount = document.createElement("strong");
        amount.textContent = `₹${subtotal.toLocaleString("en-IN")}`;

        row.append(name, amount);
        checkoutItems.appendChild(row);
    });

    checkoutTotal.textContent = `₹${total.toLocaleString("en-IN")}`;

    if (!checkoutItems.children.length) {
        checkoutItems.textContent = "Your cart items could not be read. Return to the store and add them again.";
        placeOrderButton.disabled = true;
    }
}

checkoutForm.addEventListener("submit", async event => {
    event.preventDefault();
    checkoutMessage.textContent = "";

    const cart = getCart();

    if (!cart.length) {
        checkoutMessage.textContent = "Your cart is empty. Please return to the store.";
        return;
    }

    const formData = new FormData(checkoutForm);
    const customer = Object.fromEntries(formData.entries());

    const items = cart.map(item => ({
        id: Number(item.id),
        quantity: Number(item.quantity)
    }));

    if (items.some(item => !Number.isSafeInteger(item.id) || item.id <= 0 ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
        checkoutMessage.textContent = "Your cart contains invalid items. Please return to the store and add them again.";
        return;
    }

    placeOrderButton.disabled = true;
    placeOrderButton.textContent = "Placing your order...";

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customer, items })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not place your order.");
        }

        localStorage.removeItem("kpopifyCart");

        document.getElementById("checkout-content").innerHTML = `
            <section class="success-card">
                <div class="success-icon">♡</div>
                <h1>Order Placed Successfully!</h1>
                <p>Thank you for shopping with KPOPIFY.</p>
                <p>Your order number is:</p>
                <div class="order-number" id="success-order-number"></div>
                <p id="success-order-total"></p>
                <p>Keep your order number for future reference.</p>
                <a class="continue-button" href="/index.html">Continue Shopping ♡</a>
            </section>
        `;

        document.getElementById("success-order-number").textContent = result.orderNumber;
        document.getElementById("success-order-total").textContent =
            `Order total: ₹${Number(result.total).toLocaleString("en-IN")}`;

        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
        checkoutMessage.textContent = error.message || "Something went wrong. Please try again.";
        placeOrderButton.disabled = false;
        placeOrderButton.textContent = "Place Order ♡";
    }
});

renderCheckout();
