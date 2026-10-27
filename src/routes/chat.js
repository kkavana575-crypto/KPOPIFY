
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const firebaseDb = require("../database/firebase");

const router = express.Router();

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const STORE_INFO = `
You are KPOPIFY AI, a friendly, intelligent K-pop shopping assistant.
Speak naturally, warmly, and helpfully. You may use occasional cute
emojis and call customers "chingu".

KPOPIFY is a K-pop shopping store. Help customers explore products,
understand product details, compare prices, and find suitable merchandise.

IMPORTANT RULES:
- Answer ordinary questions naturally. Do not require customers to use
  particular keywords.
- Use the supplied Firebase catalogue as the source of truth for products.
- Never invent products, prices, stock levels, discounts, or policies.
- If the catalogue does not contain a requested item, say so honestly.
- For general questions such as "What can I find here?", explain the store
  and mention the types of products actually present in the catalogue.
- If a customer asks for recommendations, recommend relevant products
  from the supplied catalogue.
- If the customer asks about prices, use the supplied prices.
- If a detail is missing, clearly say it has not been confirmed.
- Do not claim an order was placed, a payment was processed, or a delivery
  was tracked.
- The current order-tracking page may be a demo, so never invent live
  courier information.
- Be conversational, not robotic. Understand spelling mistakes and
  informal messages.
`;

function getAI() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing from the server environment.");
    }

    return new GoogleGenAI({ apiKey });
}

async function getProducts() {
    const snapshot = await firebaseDb.ref("products").once("value");
    const data = snapshot.val() || {};

    return Object.entries(data)
        .filter(([, product]) => product && typeof product === "object")
        .map(([key, product]) => ({
            id: String(product.id || key),
            name:
                product.name ||
                product.product_name ||
                product.title ||
                "Unnamed product",
            category: product.category || "",
            group: product.group_name || product.group || "",
            description: product.description || "",
            version: product.version || "",
            price: product.price ?? product.selling_price ?? null,
            stock: product.stock ?? product.quantity ?? null,
            image:
                product.image ||
                product.image_url ||
                product.imageUrl ||
                product.thumbnail ||
                ""
        }));
}

function getRelevantProducts(message, products) {
    const text = String(message || "").toLowerCase();

    const asksForAll =
        /\b(what can i find|what can i buy|what do you sell|what do you have|show me everything|show all|all products|browse|catalogue|catalog|your products|your store|your shop)\b/i.test(text);

    // For broad browsing, give the AI the complete catalogue.
    if (asksForAll) {
        return products.slice(0, 30);
    }

    const words = text
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(word =>
            word.length > 2 &&
            ![
                "the", "and", "for", "you", "your", "can", "could",
                "what", "which", "find", "here", "buy", "show", "please",
                "want", "need", "with", "about", "cheapest", "price"
            ].includes(word)
        );

    const ranked = products.map(product => {
        const searchable = [
            product.name,
            product.category,
            product.group,
            product.description,
            product.version
        ].join(" ").toLowerCase();

        let score = 0;

        for (const word of words) {
            if (searchable.includes(word)) {
                score += word.length >= 5 ? 3 : 1;
            }
        }

        return { product, score };
    });

    const matches = ranked
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(item => item.product);

    // If keyword matching finds nothing, let Gemini answer using the
    // full available catalogue instead of incorrectly claiming no match.
    return matches.length ? matches : products.slice(0, 30);
}

router.get("/test", (_req, res) => {
    res.json({
        success: true,
        message: "KPOPIFY AI is ready! 💗",
        aiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
});

router.post("/", async (req, res) => {
    try {
        const { message, history } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a message."
            });
        }

        const products = await getProducts();
        const relevantProducts = getRelevantProducts(message, products);

        const catalogue = relevantProducts.map(product => ({
            id: product.id,
            name: product.name,
            category: product.category,
            group: product.group,
            description: product.description,
            version: product.version,
            price: product.price,
            stock: product.stock
        }));

        const conversationHistory = Array.isArray(history)
            ? history
                .filter(item =>
                    item &&
                    ["user", "model"].includes(item.role) &&
                    typeof item.text === "string"
                )
                .slice(-10)
                .map(item => ({
                    role: item.role,
                    parts: [{ text: item.text.slice(0, 2000) }]
                }))
            : [];

        const ai = getAI();

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [
                ...conversationHistory,
                {
                    role: "user",
                    parts: [{
                        text:
                            "CURRENT STORE CATALOGUE (authoritative product data):\n" +
                            JSON.stringify(catalogue) +
                            "\n\nCUSTOMER MESSAGE:\n" +
                            message.trim()
                    }]
                }
            ],
            config: {
                systemInstruction: STORE_INFO,
                temperature: 0.7,
                maxOutputTokens: 500
            }
        });

        const reply = response.text?.trim();

        if (!reply) {
            throw new Error("Gemini returned an empty response.");
        }

        // Return product cards separately so the frontend can display them.
        // Broad browsing gets the actual catalogue; specific questions get
        // the relevant products identified above.
        const normalizedMessage = message.toLowerCase();

        const isBroadBrowse =
            /\b(what can i find|what can i buy|what do you sell|what do you have|show me everything|show all|all products|browse|catalogue|catalog|your products|your store|your shop)\b/i.test(normalizedMessage);

        const shouldShowCards =
            isBroadBrowse ||
            relevantProducts.length > 0;

        return res.json({
            success: true,
            reply,
            products: shouldShowCards ? relevantProducts.slice(0, 6) : []
        });

    } catch (error) {
        console.error("KPOPIFY AI error:", error.message);

        return res.status(500).json({
            success: false,
            message:
                "Aww, chingu! 💗 My AI assistant is temporarily unavailable. Please try again shortly."
        });
    }
});

module.exports = router;
