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

    trackingMessage.style.color = "#b42318";

    if (!orderId || !/^[0-9]{10}$/.test(phone)) {
        trackingMessage.textContent =
            "Please enter a valid order ID and 10-digit mobile number.";
        return;
    }

    let savedOrders = [];

    try {
        savedOrders = JSON.parse(
            localStorage.getItem("kpopifyOrders") || "[]"
        );

        if (!Array.isArray(savedOrders)) savedOrders = [];
    } catch {
        savedOrders = [];
    }

    const order = savedOrders.find(item =>
        String(item.orderNumber).toUpperCase() === orderId.toUpperCase() &&
        String(item.phone) === phone
    );

    if (!order) {
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

    const currentStatus = Math.max(0, statuses.indexOf(order.status || "Placed"));

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
                <div><strong>${escapeHTML(status)}</strong></div>
            </div>
        `;
    }).join("");

    const items = (order.items || []).map(item => `
        <div style="
            display:flex;
            justify-content:space-between;
            gap:12px;
            padding:10px 0;
            border-bottom:1px solid #e4e7e9;
        ">
            <span>${escapeHTML(item.name)} × ${Number(item.quantity) || 1}</span>
            <span>₹${(
                (Number(item.price) || 0) *
                (Number(item.quantity) || 1)
            ).toLocaleString("en-IN")}</span>
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
            <h2>Your K-pop goodies ♡</h2>
            <p><strong>Order ID:</strong> ${escapeHTML(order.orderNumber)}</p>
            <p><strong>Status:</strong> ${escapeHTML(order.status || "Placed")}</p>
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
                <span>₹${(Number(order.total) || 0).toLocaleString("en-IN")}</span>
            </div>
            <p style="color:#657788;font-size:13px;">
                Demonstration only. This is not live courier tracking.
            </p>
        </section>
    `;
});
