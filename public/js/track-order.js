const trackingForm = document.getElementById("tracking-form");
const trackingMessage = document.getElementById("tracking-message");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

trackingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const orderId = document.getElementById("order-id").value.trim();
    const phone = document.getElementById("order-phone").value.trim();

    const button = trackingForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Checking...";

    try {
        const orders = JSON.parse(
            localStorage.getItem("kpopifyOrders") || "[]"
        );

        const order = orders.find(item =>
            item.orderNumber === orderId &&
            item.phone === phone
        );

        if (!order) {
            trackingMessage.style.color = "#b42318";
            trackingMessage.textContent =
                "Order not found on this device. Orders are not stored on a server, so this page cannot retrieve orders after browser storage is cleared or from another device.";
            return;
        }

        const statuses = [
            "Placed",
            "Confirmed",
            "Processing",
            "Shipped",
            "Out for delivery",
            "Delivered"
        ];

        const currentStatus = Math.max(
            0,
            statuses.indexOf(order.status || "Placed")
        );

        const timeline = statuses.map((status, index) => `
            <div style="display:flex;gap:12px;align-items:center;margin:16px 0;color:${index <= currentStatus ? "#10263f" : "#9aa7b2"}">
                <span style="width:24px;height:24px;min-width:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${index <= currentStatus ? "#f28bb5" : "#e0e4e8"};font-weight:bold">
                    ${index <= currentStatus ? "✓" : index + 1}
                </span>
                <strong>${status}</strong>
                ${index === currentStatus ? "<span>Current status</span>" : ""}
            </div>
        `).join("");

        const items = (order.items || []).map(item => `
            <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #e4e7e9">
                <span>${escapeHTML(item.name)} × ${Number(item.quantity) || 1}</span>
                <strong>₹${(Number(item.price) * (Number(item.quantity) || 1)).toLocaleString("en-IN")}</strong>
            </div>
        `).join("");

        trackingMessage.style.color = "#10263f";
        trackingMessage.innerHTML = `
            <section style="margin-top:22px;padding:20px;background:#f5f2ec;border-radius:12px">
                <h2>Your K-pop goodies ♡</h2>
                <p><strong>Order ID:</strong> ${escapeHTML(order.orderNumber)}</p>
                <p><strong>Customer:</strong> ${escapeHTML(order.customerName || "Customer")}</p>
                <p><strong>Status:</strong> ${escapeHTML(order.status || "Placed")}</p>
                <h3>Tracking progress</h3>
                ${timeline}
                <h3>Order items</h3>
                ${items}
                <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:18px;font-weight:bold">
                    <span>Total</span>
                    <span>₹${Number(order.total || 0).toLocaleString("en-IN")}</span>
                </div>
                <p style="color:#657788;font-size:13px">Demo tracking only. Order information is stored in this browser.</p>
            </section>
        `;

    } catch (error) {
        trackingMessage.style.color = "#b42318";
        trackingMessage.textContent =
            "Unable to read order information. Please try again.";
    } finally {
        button.disabled = false;
        button.textContent = "Track My Order ♡";
    }
});
