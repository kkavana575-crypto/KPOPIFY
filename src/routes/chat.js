
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const firebaseDb = require("../database/firebase");

const router = express.Router();

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODEL = "gemini-3.5-flash-lite";

const STORE = {
    cod: {
        status: "unavailable",
        details: "KPOPIFY currently accepts online payment only."
    },
    delivery: {
        estimate: "",
        shippingFee: "",
        details: ""
    },
    payments: {
        details:
            "UPI is planned, but customers should check the payment options displayed at checkout."
    },
    returns: {
        policy: ""
    },
    tracking: {
        enabled: true,
        details:
            "Customers can visit /track-order.html to use the store's demo order-tracking page."
    }
};

// Health check
router.get("/test", (_req, res) => {
    res.json({
        success: true,
        message: "KPOPIFY AI is ready! 💗"
    });
});

// Detect common customer intentions.
function getIntent(message) {
    const text = message.toLowerCase().trim();

    if (/\b(cod|cash on delivery|pay on delivery)\b/.test(text)) {
        return "cod";
    }

    if (/\b(delivery|deliver|shipping|shipping fee|shipping charges|dispatch|arrival)\b/.test(text)) {
        return "delivery";
    }

    if (/\b(payment|payments|pay|upi|credit card|debit card)\b/.test(text)) {
        return "payments";
    }

    if (/\b(track|tracking|order status|where is my order|my parcel|my package)\b/.test(text)) {
        return "tracking";
    }

    if (/\b(return|returns|refund|refunds|exchange|damaged order)\b/.test(text)) {
        return "returns";
    }

    if (/^(hi|hii+|hello|hey|heyy+|annyeong|안녕|yo)[!.💗🎀\s]*$/i.test(text)) {
        return "greeting";
    }

    return "shopping";
}

// Read products from Firebase.
async function getFirebaseProducts() {
    const snapshot = await firebaseDb.ref("products").once("value");
    const data = snapshot.val() || {};

    return Object.entries(data).map(([key, product]) => ({
        ...product,
        id: String(product.id || key)
    }));
}

// Search actual Firebase products.
// Short follow-up messages are supported.
async function searchProducts(message) {
    const products = await getFirebaseProducts();
    const text = message.toLowerCase().trim();

    if (!products.length) {
        return [];
    }

    const aliases = {
        txt: ["txt", "tomorrow x together", "tubatu"],
        "tomorrow x together": ["txt", "tomorrow x together", "tubatu"],
        tubatu: ["tubatu", "ppulbatu"],
        ppulbatu: ["ppulbatu", "tubatu"],
        album: ["album", "albums"],
        albums: ["album", "albums"],
        figure: ["figure", "figurine", "figure ver", "figure version"],
        "figure ver": ["figure", "figurine", "figure ver", "figure version"],
        "figure version": ["figure", "figurine", "figure ver", "figure version"],
        "no label": ["no label"],
        "part 2": ["part 2", "part2"],
        "part2": ["part 2", "part2"]
    };

    const searchText = text
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const terms = new Set([searchText]);

    for (const [alias, variants] of Object.entries(aliases)) {
        if (searchText.includes(alias)) {
            variants.forEach(value => terms.add(value));
        }
    }

    // Recognize the customer's intended category.
    const wantsAlbums = /\balbum(s)?\b/.test(searchText);
    const wantsPpulbatu = /\b(ppulbatu|tubatu)\b/.test(searchText);
    const wantsTxt = /\btxt\b|tomorrow x together/.test(searchText);
    const wantsFigure = /\b(figure|figurine)\b/.test(searchText);
    const wantsNoLabel = /\bno[\s-]*label\b/.test(searchText);
    const wantsPart2 = /\bpart[\s-]*2\b/.test(searchText);

    const scored = products.map(product => {
        const name = String(product.name || "").toLowerCase();
        const group = String(product.group_name || "").toLowerCase();
        const category = String(product.category || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();

        const searchable = `${name} ${group} ${category} ${description}`;
        let score = 0;

        for (const term of terms) {
            if (term.length > 1 && searchable.includes(term)) {
                score += term.length >= 5 ? 5 : 2;
            }
        }

        if (wantsTxt && /\btxt\b|tomorrow x together/.test(group + " " + category)) {
            score += 10;
        }

        if (wantsPpulbatu && /ppulbatu|tubatu/.test(group + " " + category)) {
            score += 10;
        }

        if (wantsAlbums && /album/.test(category + " " + name + " " + description)) {
            score += 5;
        }

        if (wantsFigure && /figure|figurine/.test(name + " " + description)) {
            score += 10;
        }

        if (wantsNoLabel && /no[\s-]*label/.test(name + " " + description)) {
            score += 12;
        }

        if (wantsPart2 && /part[\s-]*2/.test(name + " " + description)) {
            score += 8;
        }

        if (Number(product.is_bestseller) === 1) {
            score += 1;
        }

        return { product, score };
    });

    const meaningfulMatches = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.product);

    // If the user only says "TXT" or "album", return products
    // from that group/category instead of claiming no products exist.
    if (meaningfulMatches.length) {
        return meaningfulMatches;
    }

    if (wantsTxt) {
        return products.filter(product =>
            /txt|tomorrow x together|tubatu/i.test(
                `${product.group_name || ""} ${product.category || ""}`
            )
        ).slice(0, 5);
    }

    if (wantsPpulbatu) {
        return products.filter(product =>
            /ppulbatu|tubatu/i.test(
                `${product.group_name || ""} ${product.category || ""}`
            )
        ).slice(0, 5);
    }

    if (wantsAlbums) {
        return products.filter(product =>
            /album/i.test(
                `${product.name || ""} ${product.category || ""} ${product.description || ""}`
            )
        ).slice(0, 5);
    }

    return [];
}

// Reply directly to store-policy questions.
function getPolicyReply(intent) {
    if (intent === "cod") {
        return STORE.cod.status === "unavailable"
            ? `Aww, chingu! 💗 Cash on Delivery isn't available at KPOPIFY right now. ${STORE.cod.details}`
            : "Our Cash on Delivery policy hasn't been confirmed yet. 💗";
    }

    if (intent === "delivery") {
        const estimate = STORE.delivery.estimate
            ? `Estimated delivery: ${STORE.delivery.estimate}.`
            : "I don't have a confirmed delivery timeframe yet.";

        const fee = STORE.delivery.shippingFee
            ? ` Shipping fee: ${STORE.delivery.shippingFee}.`
            : "";

        return `Let's get your K-pop goodies home safely! 📦💗 ${estimate}${fee}`;
    }

    if (intent === "payments") {
        return "Chingu! 💗 Please check the payment options shown at checkout. I can't confirm that UPI or any other specific payment method is currently connected.";
    }

    if (intent === "tracking") {
        return `Omo, chingu! 💗📦 You can visit the Track My Order page from the store menu. Please remember that the current tracking page is a demo and may not retrieve real courier information. 🎀`;
    }

    if (intent === "returns") {
        return STORE.returns.policy
            ? `Of course, chingu! 💗 Here's our return policy: ${STORE.returns.policy}`
            : "Aww, chingu! 💗 Our confirmed return and refund policy hasn't been added yet. Please contact the store before making a decision about your order.";
    }

    return null;
}

// Main chatbot endpoint.
router.post("/", async (req, res) => {
    try {
        const { message } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a message."
            });
        }

        const query = message.trim();
        const intent = getIntent(query);

        const policyReply = getPolicyReply(intent);

        if (policyReply) {
            return res.json({
                success: true,
                reply: policyReply,
                products: []
            });
        }

        if (intent === "greeting") {
            return res.json({
                success: true,
                reply: "Annyeong! 💗 I'm your KPOPIFY shopping bestie! I can help you find TXT albums, No Label versions, and PPULBATU merch. Tell me what you're hunting for, chingu! 🎀",
                products: []
            });
        }

        const products = intent === "shopping"
            ? await searchProducts(query)
            : [];

        if (!ai) {
            return res.json({
                success: true,
                reply: products.length
                    ? `Omo, chingu! 💗 I found ${products.length} product(s) that might be what you're looking for!`
                    : "Aww, chingu! 💗 I couldn't find an exact match. Try telling me the album name, version, or member you're looking for.",
                products
            });
        }

        const productContext = products.length
            ? products.map(product => `
Product ID: ${product.id}
Name: ${product.name}
Group/artist: ${product.group_name || "Not specified"}
Category: ${product.category || "Not specified"}
Price: ₹${product.price}
Stock: ${Number(product.stock) > 0 ? "In stock" : "Out of stock"}
Description: ${product.description || "Not provided"}
Image: ${product.image || ""}
`).join("\n")
            : "No matching products were found in the Firebase product database.";

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: `
You are KPOPIFY AI, a friendly K-pop shopping bestie.

PERSONALITY:
- Be warm, playful, helpful, and natural.
- Use natural English and occasional expressions like "omo" and "chingu".
- Use a few cute emojis without overdoing them.
- Understand typos, short messages, and informal grammar.
- Remember the current message's context and do not keep asking the same question.
- If the customer says "TXT", "album", "figure ver", or another short follow-up, use the actual product results below to help them.
- If a product is found, name it and mention its actual price and stock.
- If multiple products match, list a few and ask which one they mean.
- Never pretend to have found a product when no matching product is provided.

STORE POLICIES:
- Cash on Delivery: ${STORE.cod.status}. ${STORE.cod.details}
- Delivery estimate: ${STORE.delivery.estimate || "Not confirmed"}
- Shipping fee: ${STORE.delivery.shippingFee || "Not confirmed"}
- Payment details: ${STORE.payments.details}
- Returns: ${STORE.returns.policy || "Not confirmed"}
- Do not invent policies, prices, stock, or delivery dates.

REAL PRODUCTS FROM FIREBASE:
${productContext}

CUSTOMER MESSAGE:
${query}

RULES:
1. Recommend only products listed in the Firebase results.
2. Never invent a product, price, or stock status.
3. If products are found, help the customer choose from those actual products.
4. If no matching products are found, politely explain that and ask for one useful detail.
5. Keep the response conversational and normally under 100 words.
6. Do not repeat the same generic greeting after every message.

Write a helpful response to the customer.
            `,
            config: {
                maxOutputTokens: 250,
                temperature: 0.5
            }
        });

        res.json({
            success: true,
            reply: response.text ||
                (products.length
                    ? "Omo, chingu! 💗 I found some products for you. Have a look at the options!"
                    : "Aww, chingu! 💗 I couldn't find an exact match. Try another album name or version."),
            products
        });

    } catch (error) {
        console.error("KPOPIFY chatbot error:", error.message);

        res.status(500).json({
            success: false,
            message: "Oops, my shopping brain had a tiny hiccup! 💗 Please try again."
        });
    }
});

module.exports = router;
