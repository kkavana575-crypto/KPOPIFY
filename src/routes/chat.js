
const express = require("express");
const firebaseDb = require("../database/firebase");

const router = express.Router();

// Store policies
const STORE = {
    cod: {
        status: "unavailable",
        details: "KPOPIFY currently accepts online payment only."
    },
    delivery: {
        estimate: "",
        shippingFee: ""
    },
    payments: {
        details: "Please check the payment options displayed at checkout."
    },
    returns: {
        policy: ""
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

    return Object.entries(data)
        .filter(([, p]) => p && typeof p === "object")
        .map(([key, p]) => ({
            ...p,
            id: String(p.id || key),
            name: p.name || p.product_name || p.title || "Unnamed product",
            image: p.image || p.image_url || p.imageUrl || p.thumbnail || "",
            price: p.price ?? p.selling_price ?? null
        }));
}

// Normalize common abbreviations and spelling variations.
function normalizeQuery(message) {
    return String(message || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\bfigs?\b/g, " figure ")
        .replace(/\bfigurines?\b/g, " figure ")
        .replace(/\bvers?\b/g, " version ")
        .replace(/\bpart[\s-]*2\b/g, " part2 ")
        .replace(/\bno[\s-]*label\b/g, " nolabel ")
        .replace(/\s+/g, " ")
        .trim();
}

// Understand general browsing requests and specific searches.
function getSearchOptions(message) {
    const text = normalizeQuery(message);

    const wantsTxt =
        /\btxt\b/.test(text) ||
        text.includes("tomorrow x together") ||
        text.includes("tubatu");

    const wantsPpulbatu =
        /\bppulbatu\b/.test(text) ||
        /\btubatu\b/.test(text);

    const wantsAlbum = /\balbums?\b/.test(text);
    const wantsFigure = /\bfigure\b/.test(text);
    const wantsNoLabel = /\bnolabel\b/.test(text);
    const wantsPart2 = /\bpart2\b/.test(text);

    // Recognize broad requests to browse the catalogue.
    const wantsBrowse =
        /\b(buy|shop|sell|selling|store|here|catalogue|catalog|products?|items?|merch|merchandise|available|availability|options|collection|collections|everything|all|browse|list|display|show|have|stock)\b/.test(text) ||
        /\bwhat\b.*\b(can i|get|do you|is there)\b/.test(text) ||
        /\b(which|what)\b.*\b(available|have|sell|buy)\b/.test(text) ||
        /\bdo you have\b/.test(text);

    return {
        text,
        wantsTxt,
        wantsPpulbatu,
        wantsAlbum,
        wantsFigure,
        wantsNoLabel,
        wantsPart2,
        wantsBrowse
    };
}

// Search real products from Firebase.
async function searchProducts(message) {
    const products = await getFirebaseProducts();

    if (!products.length) {
        return [];
    }

    const options = getSearchOptions(message);
    const query = options.text;

    // Broad catalogue requests return actual products directly.
    // Do this BEFORE keyword scoring so unrelated words such as
    // "buy" or "here" cannot accidentally affect product ranking.
    const isGeneralBrowse =
        options.wantsBrowse &&
        !options.wantsFigure &&
        !options.wantsNoLabel &&
        !options.wantsPart2 &&
        !options.wantsAlbum &&
        !options.wantsTxt &&
        !options.wantsPpulbatu;

    if (isGeneralBrowse) {
        return products.slice(0, 6);
    }

    const stopWords = new Set([
        "i", "a", "an", "the", "is", "are", "do", "you",
        "have", "want", "me", "my", "your", "please", "can",
        "show", "give", "get", "which", "what", "some", "any",
        "product", "products", "available", "find", "for",
        "of", "and", "to", "in", "on", "with", "it", "buy",
        "shop", "here", "sell", "selling", "store", "all",
        "everything", "options", "list", "display", "browse"
    ]);

    const words = [...new Set(query.split(" ").filter(
        word => word.length > 1 && !stopWords.has(word)
    ))];

    const scored = products.map(product => {
        const name = String(product.name || "").toLowerCase();
        const group = String(product.group_name || product.group || "").toLowerCase();
        const category = String(product.category || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();
        const version = String(product.version || "").toLowerCase();
        const artist = String(product.artist || "").toLowerCase();

        const rawFields =
            `${name} ${group} ${category} ${description} ${version} ${artist}`;

        const fields = normalizeQuery(rawFields);
        let score = 0;

        if (query && fields.includes(query)) {
            score += 20;
        }

        for (const word of words) {
            if (fields.split(" ").includes(word)) {
                score += word.length >= 5 ? 5 : 3;
            }
        }

        if (
            options.wantsTxt &&
            /txt|tomorrow x together|tubatu/.test(
                `${group} ${category} ${artist} ${name}`
            )
        ) {
            score += 15;
        }

        if (
            options.wantsPpulbatu &&
            /ppulbatu|tubatu/.test(
                `${name} ${group} ${category} ${description}`
            )
        ) {
            score += 15;
        }

        if (
            options.wantsAlbum &&
            /album/.test(
                `${name} ${category} ${description} ${version}`
            )
        ) {
            score += 12;
        }

        if (
            options.wantsFigure &&
            /figure|figurine/.test(
                `${name} ${category} ${description} ${version}`
            )
        ) {
            score += 15;
        }

        if (options.wantsNoLabel && /no[\s-]*label/.test(rawFields)) {
            score += 15;
        }

        if (options.wantsPart2 && /part[\s-]*2/.test(rawFields)) {
            score += 12;
        }

        return { product, score };
    });

    const matches = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);

    // Return unique products, with a maximum of six cards.
    const unique = [];
    const seen = new Set();

    for (const product of matches) {
        if (seen.has(product.id)) {
            continue;
        }

        seen.add(product.id);
        unique.push(product);

        if (unique.length >= 6) {
            break;
        }
    }

    return unique;
}

// Build the reply from actual database results.
function buildProductReply(products, message) {
    if (!products.length) {
        return (
            "Aww, chingu! 💗 I couldn't find a matching product in our " +
            "current database. Try another album name, group, or version!"
        );
    }

    const options = getSearchOptions(message);

    if (
        options.wantsBrowse &&
        !options.wantsFigure &&
        !options.wantsNoLabel &&
        !options.wantsPart2 &&
        !options.wantsAlbum &&
        !options.wantsTxt &&
        !options.wantsPpulbatu
    ) {
        return (
            "Omo, chingu! 💗 Welcome to KPOPIFY! 🎀 " +
            "Here are some products available in our store. " +
            "Check out the product cards below for their prices, pictures, " +
            "and details. Which one catches your eye? 🛍️💜"
        );
    }

    if (products.length === 1) {
        const product = products[0];
        const price = Number(product.price);

        const validPrice =
            product.price !== null &&
            product.price !== "" &&
            Number.isFinite(price);

        const hasStock =
            product.stock !== undefined &&
            product.stock !== null &&
            product.stock !== "";

        const stock = Number(product.stock);

        const priceText = validPrice
            ? `It's priced at ₹${price.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}.`
            : "Its price hasn't been confirmed.";

        const stockText = !hasStock
            ? "Stock availability hasn't been confirmed."
            : stock > 0
                ? "It's currently in stock."
                : "It's currently out of stock.";

        return (
            `Omo, chingu! 💗 I found ${product.name}! ` +
            `${priceText} ${stockText} ` +
            "Check out the product card below! 🛍️"
        );
    }

    return (
        `Omo, chingu! 💗 I found ${products.length} matching products! ` +
        "Have a look at the product cards below and choose your favourite. 🛍️"
    );
}

// Store-policy replies.
function getPolicyReply(intent) {
    if (intent === "cod") {
        return (
            "Aww, chingu! 💗 Cash on Delivery isn't available at KPOPIFY. " +
            STORE.cod.details
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
            "store menu. The current tracking page is a demo and may not " +
            "retrieve real courier information. 🎀"
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
                    "or PPULBATU merch. You can also ask to see our products! 🎀",
                products: []
            });
        }

        const products = await searchProducts(query);
        const reply = buildProductReply(products, query);

        return res.json({
            success: true,
            reply,
            products
        });

    } catch (error) {
        console.error("KPOPIFY chatbot error:", error);

        return res.status(500).json({
            success: false,
            message:
                "Oops, my shopping brain had a tiny hiccup! 💗 Please try again."
        });
    }
});

module.exports = router;
