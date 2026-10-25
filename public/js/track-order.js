const trackingForm = document.getElementById("tracking-form");
const trackingMessage = document.getElementById("tracking-message");

trackingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const orderId = document.getElementById("order-id").value.trim();
    const phone = document.getElementById("order-phone").value.trim();

    trackingMessage.textContent = "Looking for your order... 💗";
    trackingMessage.style.color = "#657788";

    const button = trackingForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Checking...";

    try {
        const response = await fetch("/api/orders/track", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ orderId, phone })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to find your order.");
        }

        const order = data.order;

        const statuses = [
            "Placed",
            "Confirmed",
            "Processing",
            "Shipped",
            "Out for delivery",
            "Delivered"
        ];

        const currentStatus = statuses.indexOf(order.status);

        const timeline = statuses.map((status, index) => {
            const completed = currentStatus >= index;

            return `
                <div style="
                    display:flex;
                    gap:12px;
                    align-items:flex-start;
                    margin:18px 0;
                    color:${completed ? "#10263f" : "#9aa7b2"};
                ">
                    <span style="
                        width:24px;
                        height:24px;
                        min-width:24px;
                        border-radius:50%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:${completed ? "#f28bb5" : "#e0e4e8"};
                        color:#10263f;
                        font-weight:bold;
                    ">${completed ? "✓" : index + 1}</span>

                    <div>
                        <strong>${status}</strong>
                        ${index === currentStatus
                            ? '<div style="font-size:13px;margin-top:4px;">Current order status</div>'
                            : ""}
                    </div>
                </div>
            `;
        }).join("");

        const items = order.items.map(item => `
            <div style="
                display:flex;
                justify-content:space-between;
                gap:12px;
                padding:10px 0;
                border-bottom:1px solid #e4e7e9;
            ">
                <span>${escapeHTML(item.product_name)} × ${item.quantity}</span>
                <span>₹${Number(item.subtotal).toFixed(2)}</span>
            </div>
        `).join("");

        trackingMessage.style.color = "#10263f";

        trackingMessage.innerHTML = `
            <section style="
                margin-top:22px;
                padding:20px;
                background:#f5f2ec;
                border-radius:12px;
                color:#10263f;
            ">
                <h2 style="margin-top:0;">Your K-pop goodies ♡</h2>

                <p><strong>Order ID:</strong> ${escapeHTML(order.orderNumber)}</p>
                <p><strong>Customer:</strong> ${escapeHTML(order.customerName)}</p>
                <p><strong>Placed:</strong> ${escapeHTML(order.createdAt)}</p>
                <p><strong>Status:</strong> ${escapeHTML(order.status)}</p>

                <h3>Tracking progress</h3>
                ${timeline}

                <h3>Order items</h3>
                ${items}

                <div style="
                    display:flex;
                    justify-content:space-between;
                    gap:12px;
                    margin-top:18px;
                    font-size:18px;
                    font-weight:bold;
                ">
                    <span>Total</span>
                    <span>₹${Number(order.total).toFixed(2)}</span>
                </div>
            </section>
        `;

    } catch (error) {
        trackingMessage.textContent = error.message;
        trackingMessage.style.color = "#b42318";

    } finally {
        button.disabled = false;
        button.textContent = "Track My Order ♡";
    }
});

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}
