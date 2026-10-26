const trackingForm = document.getElementById("tracking-form");
const trackingMessage = document.getElementById("tracking-message");

trackingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const orderId = document.getElementById("order-id").value.trim();

    const button = trackingForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Checking...";

    trackingMessage.style.color = "#10263f";

    const statuses = [
        "Order Placed",
        "Order Confirmed",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered"
    ];

    // Demo tracking: always show Out for Delivery.
    const currentStatus = 4;

    const timeline = statuses.map((status, index) => {
        const completed = index <= currentStatus;

        return `
            <div style="
                display:flex;
                gap:12px;
                align-items:center;
                margin:18px 0;
                color:${completed ? "#10263f" : "#9aa7b2"};
            ">
                <span style="
                    width:28px;
                    height:28px;
                    min-width:28px;
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
                        ? '<div style="font-size:13px;margin-top:4px;color:#d66b9c;">Your package is out for delivery! ♡</div>'
                        : ""}
                </div>
            </div>
        `;
    }).join("");

    trackingMessage.innerHTML = `
        <section style="
            margin-top:22px;
            padding:24px;
            background:#fff7fa;
            border:1px solid #f5d4e2;
            border-radius:16px;
            color:#10263f;
        ">
            <h2 style="margin-top:0;">Your K-pop goodies are almost there! ♡</h2>

            <p><strong>Order ID:</strong> ${escapeHTML(orderId)}</p>

            <div style="
                margin:20px 0;
                padding:16px;
                background:#fce4ef;
                border-radius:12px;
                text-align:center;
            ">
                <div style="font-size:30px;">🚚💗</div>
                <h3 style="margin:8px 0;color:#c34c83;">OUT FOR DELIVERY</h3>
                <p style="margin:0;">Your package is on its way to you!</p>
            </div>

            <h3>Tracking Progress</h3>
            ${timeline}

            <p style="
                margin-top:20px;
                padding:12px;
                background:#eaf5fa;
                border-radius:10px;
                color:#657788;
                font-size:13px;
            ">
                ♡ This is simulated tracking for the KPOPIFY college project.
                It does not represent a real courier update.
            </p>
        </section>
    `;

    button.disabled = false;
    button.textContent = "Track My Order ♡";
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
