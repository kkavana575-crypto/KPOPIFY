
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
            "Customers should check the payment options displayed at checkout."
    },
    returns: {
        policy: ""
    },
    tracking: {
        enabled: true,
        details:
            "The current order-tracking page is for demonstration purposes."
    }
};

// Health check
router.get("/test", (_req, res) => {
    res.json({
        success: true,
        message: "KPOPIFY AI is ready! 💗"
    });
});

// Detect store-policy questions and greetings.
function getIntent(message) {
    const text = message.toLowerCase().trim();

    if (/\b(cod|cash on delivery|pay on delivery)\b/.test(text)) {
        return "cod";
    }

    if (
        /\b(delivery|deliver|shipping|shipping fee|shipping charges|dispatch|arrival)\b/.test(text)
    ) {
        return "delivery";
    }

    if (
        /\b(payment|payments|pay|upi|credit card|debit card)\b/.test(text)
    ) {
        return "payments";
    }

    if (
        /\b(track|tracking|order status|where is my order|my parcel|my package)\b/.test(text)
    ) {
        return "tracking";
    }

    if (
        /\b(return|returns|refund|refunds|exchange|damaged order)\b/.test(text)
    ) {
        return "returns";
    }

    if (
        /^(hi|hii+|hello|hey|heyy+|annyeong|안녕|yo)[!.💗🎀\s]*$/i.test(text)
    ) {
        return "greeting";
    }

    return "shopping";
}

// Read products directly from Firebase.
async function getFirebaseProducts() {
    const snapshot = await firebaseDb.ref("products").once("value");
    const data = snapshot.val() || {};

    return Object.entries(data)
        .filter(([, product]) => product && typeof product === "object")
        .map(([key, product]) => ({
            ...product,
            id: String(product.id || key),

            // Support common image field names.
            image:
                product.image ||
                product.image_url ||
                product.imageUrl ||
                product.thumbnail ||
                "",

            // Support common product-name field names.
            name:
                product.name ||
                product.product_name ||
                product.title ||
                "Unnamed product",

            // Keep the original price value from Firebase.
            price: product.price ?? product.selling_price ?? null
        }));
}

// Normalize abbreviations and common spelling variations.
function normalizeQuery(message) {
    return String(message || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\bfigs?\b/g, " figure ")
        .replace(/\bfigurine(s)?\b/g, " figure ")
        .replace(/\bver(s)?\b/g, " version ")
        .replace(/\bpart[\s-]*2\b/g, " part2 ")
        .replace(/\bno[\s-]*label\b/g, " nolabel ")
        .replace(/\s+/g, " ")
        .trim();
}

// Identify what the customer is looking for.
function getSearchOptions(message) {
    const text = normalizeQuery(message);

    return {
        text,
        wantsTxt:
            /\btxt\b/.test(text) ||
            text.includes("tomorrow x together") ||
            text.includes("tubatu"),

        wantsPpulbatu:
            /\bppulbatu\b/.test(text) ||
            /\btubatu\b/.test(text),

        wantsAlbum: /\balbums?\b/.test(text),

        wantsFigure: /\bfigure\b/.test(text),

        wantsNoLabel: /\bnolabel\b/.test(text),

        wantsPart2: /\bpart2\b/.test(text),

        wantsBrowse:
            /\b(show|list|display|browse|available|have|stock|products|options)\b/.test(text) ||
            /\bwhich\b.*\b(have|available|stock)\b/.test(text)
    };
}

// Match products against their actual Firebase fields.
async function searchProducts(message) {
    const products = await getFirebaseProducts();

    if (!products.length) {
        return [];
    }

    const options = getSearchOptions(message);
    const query = options.text;

    const scored = products.map(product => {
        const name = String(product.name || "").toLowerCase();
        const group = String(product.group_name || product.group || "").toLowerCase();
        const category = String(product.category || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();
        const version = String(product.version || "").toLowerCase();
        const artist = String(product.artist || "").toLowerCase();

        const allFields = normalizeQuery(
            `${name} ${group} ${category} ${description} ${version} ${artist}`
        );

        let score = 0;

        // Exact phrase matches receive the highest score.
        if (query && allFields.includes(query)) {
            score += 15;
        }

        if (options.wantsTxt && /txt|tomorrow x together|tubatu/.test(
            `${group} ${category} ${artist}`
        )) {
            score += 12;
        }

        if (options.wantsPpulbatu && /ppulbatu|tubatu/.test(
            `${name} ${group} ${category} ${description}`
        )) {
            score += 12;
        }

        if (options.wantsAlbum && /album|albums/.test(
            `${name} ${category} ${description} ${version}`
        )) {
            score += 10;
        }

        if (options.wantsFigure && /figure|figurine/.test(
            `${name} ${category} ${description} ${version}`
        )) {
            score += 12;
        }

        if (options.wantsNoLabel && /nolabel/.test(allFields)) {
            score += 15;
        }

        if (options.wantsPart2 && /part2/.test(allFields)) {
            score += 10;
        }

        // Match meaningful words, ignoring common filler words.
        const stopWords = new Set([
            "i", "a", "an", "the", "is", "are", "do", "you",
            "have", "want", "me", "my", "your", "please", "can",
            "show", "give", "get", "which", "what", "some", "any",
            "product", "products", "available", "find", "for",
            "of", "and", "to", "in", "on", "with", "it"
        ]);

        const words = [...new Set(query.split(" "))];

        for (const word of words) {
            if (word.length < 2 || stopWords.has(word)) {
                continue;
            }

            if (allFields.split(" ").includes(word)) {
                score += word.length >= 5 ? 4 : 2;
            }
        }

        return { product, score };
    });

    // Keep the most relevant products first.
    let matches = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);

    // A generic "show me albums" request should also check
    // common album categories and product version fields.
    if (options.wantsAlbum && matches.length === 0) {
        matches = products.filter(product =>
            /album/i.test(
                `${product.name || ""} ${product.category || ""} ` +
                `${product.description || ""} ${product.version || ""}`
            )
        );
    }

    // If the customer asks what is available, show actual products
    // instead of asking them to repeat their question.
    if (
    options.wantsBrowse &&
    !options.wantsFigure &&
    !options.wantsNoLabel &&
    !options.wantsPart2 &&
    !options.wantsAlbum &&
    !options.wantsTxt &&
    !options.wantsPpulbatu
) {
    matches = products;
}

    // Avoid returning duplicate products.
    const unique = [];
    const seen = new Set();

    for (const product of matches) {
        if (!seen.has(product.id)) {
            seen.add(product.id);
            unique.push(product);
        }

        if (unique.length >= 6) {
            break;
        }
    }

    return unique;
}

// Build a reply using actual database information.
function buildProductReply(products) {
    if (!products.length) {
        return (
            "Aww, chingu! 💗 I couldn't find a matching product in our " +
            "current database. Try another album name, group, or version!"
        );
    }

    if (products.length === 1) {
        const product = products[0];
        const price = Number(product.price);
        const validPrice = product.price !== null &&
            product.price !== "" &&
            Number.isFinite(price);

        const stock = Number(product.stock);
        const hasStockValue =
            product.stock !== undefined &&
            product.stock !== null &&
            product.stock !== "";

        const stockText = hasStockValue
            ? stock > 0
                ? "It's currently in stock"
                : "It's currently out of stock"
            : "Stock availability hasn't been confirmed";

        const priceText = validPrice
            ? `It's priced at ₹${price.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}.`
            : "Its price hasn't been confirmed.";

        return `Omo, chingu! 💗 I found ${product.name}! ${priceText} ${stockText}. Check out the product card below for details! 🛍️`;
    }

    return (
        `Omo, chingu! 💗 I found ${products.length} matching products ` +
        "in our store! Have a look at the product cards below and choose " +
        "your favourite. 🛍️"
    );
}

// Reply directly to store-policy questions.
function getPolicyReply(intent) {
    if (intent === "cod") {
        return (
            "Aww, chingu! 💗 Cash on Delivery isn't available at " +
            "KPOPIFY right now. " + STORE.cod.details
        );
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
        return (
            "Chingu! 💗 Please check the payment options displayed at " +
            "checkout. I can't confirm that a particular payment method " +
            "is currently connected."
        );
    }

    if (intent === "tracking") {
        return (
            "Omo, chingu! 💗📦 Visit the Track My Order page from the " +
            "store menu. Please remember that the current tracking page " +
            "is a demo and may not retrieve real courier information. 🎀"
        );
    }

    if (intent === "returns") {
        return STORE.returns.policy
            ? `Here's our return policy, chingu! 💗 ${STORE.returns.policy}`
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
                reply:
                    "Annyeong, chingu! 💗 I'm your KPOPIFY shopping bestie! " +
                    "Ask me for TXT albums, No Label versions, figure versions, " +
                    "or PPULBATU merch. I'll look for actual products in our store! 🎀",
                products: []
            });
        }

        // Search Firebase regardless of whether Gemini is available.
        const products = await searchProducts(query);

        // Return factual product information directly from Firebase.
        // Product cards are delivered separately in the products array.
        const reply = buildProductReply(products);

        return res.json({
            success: true,
            reply,
            products
        });

    } catch (error) {
        console.error("KPOPIFY chatbot error:", error.message);

        return res.status(500).json({
            success: false,
            message:
                "Oops, my shopping brain had a tiny hiccup! 💗 Please try again."
        });
    }
});

module.exports = router;
