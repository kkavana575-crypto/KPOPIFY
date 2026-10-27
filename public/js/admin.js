
"use strict";

// ============================================
// KPOPIFY ADMIN STUDIO — FIREBASE PRODUCT CRUD
// ============================================

const form = document.getElementById("productForm");
const statusBox = document.getElementById("status");
const submitButton = document.getElementById("submitButton");
const cancelButton = document.getElementById("cancelButton");
const formTitle = document.getElementById("formTitle");
const productsList = document.getElementById("productsList");
const productSearch = document.getElementById("productSearch");
const categoryFilter = document.getElementById("categoryFilter");
const totalProducts = document.getElementById("totalProducts");
const totalBestsellers = document.getElementById("totalBestsellers");
const totalStock = document.getElementById("totalStock");
const productCountBadge = document.getElementById("productCountBadge");

const API_URL = "/api/firebase-products";

let editingId = null;
let products = [];
let isLoading = false;

// Safely escape values before inserting them into HTML.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Support Firebase records and the existing category names.
function canonicalCategory(value) {
  const category = String(value || "").trim().toLowerCase();

  if (["albums", "album", "txt"].includes(category)) {
    return "Albums";
  }

  if (["ppulbatu", "tubatu", "ppulbatu merch"].includes(category)) {
    return "PPULBATU";
  }

  if (["members", "member"].includes(category)) {
    return "Members";
  }

  return value ? String(value) : "Uncategorized";
}

function apiCategory(value) {
  const category = canonicalCategory(value);

  if (category === "Albums") return "TXT";
  if (category === "PPULBATU") return "Tubatu";
  if (category === "Members") return "Member";

  return String(value || "TXT");
}

function categoryLabel(value) {
  return canonicalCategory(value);
}

// Normalize product records without losing Firebase fields or IDs.
function normalizeProduct(product) {
  return {
    ...product,

    id: String(product.id ?? product.key ?? ""),

    name: String(
      product.name ??
      product.product_name ??
      product.title ??
      "Unnamed product"
    ),

    group_name: String(
      product.group_name ??
      product.group ??
      product.artist ??
      ""
    ),

    price: product.price ?? product.selling_price ?? "",

    stock: product.stock ?? product.stock_quantity ?? 0,

    category: product.category ?? product.store_category ?? "",

    description: String(product.description ?? ""),

    image: String(
      product.image ??
      product.image_url ??
      product.imageUrl ??
      product.thumbnail ??
      ""
    ),

    is_bestseller:
      Number(product.is_bestseller ?? product.isBestseller ?? 0) === 1
        ? 1
        : 0
  };
}

// Read JSON responses and show useful backend errors.
async function readResponse(response) {
  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned an unexpected response (HTTP ${response.status}).`
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed (HTTP ${response.status}).`
    );
  }

  return data;
}

function setStatus(message, isError = false) {
  if (!statusBox) return;

  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function updateStats() {
  if (totalProducts) {
    totalProducts.textContent =
      products.length.toLocaleString("en-IN");
  }

  if (totalBestsellers) {
    totalBestsellers.textContent =
      products
        .filter(product => Number(product.is_bestseller) === 1)
        .length
        .toLocaleString("en-IN");
  }

  if (totalStock) {
    totalStock.textContent =
      products
        .reduce((sum, product) => {
          return sum + (Number(product.stock) || 0);
        }, 0)
        .toLocaleString("en-IN");
  }

  if (productCountBadge) {
    productCountBadge.textContent =
      `${products.length} ${products.length === 1 ? "item" : "items"}`;
  }
}

function renderProducts() {
  updateStats();

  if (!productsList) return;

  const search = String(productSearch?.value || "")
    .trim()
    .toLowerCase();

  const selectedCategory = categoryFilter?.value || "All";

  const filtered = products.filter(product => {
    const category = categoryLabel(product.category);

    const searchable = [
      product.name,
      product.group_name,
      product.description,
      category,
      product.id
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);

    const matchesCategory =
      selectedCategory === "All" ||
      category === selectedCategory ||
      (
        selectedCategory === "Albums" &&
        ["TXT", "Albums"].includes(String(product.category))
      );

    return matchesSearch && matchesCategory;
  });

  if (!filtered.length) {
    productsList.innerHTML = `
      <div class="empty-state">
        ${
          products.length
            ? "No products match your search or category."
            : "No products found in Firebase. Check the connection and try refreshing."
        }
      </div>
    `;
    return;
  }

  productsList.innerHTML = filtered.map(product => {
    const id = String(product.id);
    const category = categoryLabel(product.category);
    const image = String(product.image || "").trim();

    const imageMarkup = image
      ? `
        <img
          class="product-image"
          src="${escapeHTML(image)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
          onerror="this.style.display='none'"
        >
      `
      : `
        <div class="product-image product-image-placeholder"
             aria-hidden="true">♡</div>
      `;

    const price = Number(product.price);
    const priceText = Number.isFinite(price)
      ? price.toLocaleString("en-IN")
      : "—";

    return `
      <article class="product-row">
        ${imageMarkup}

        <div class="product-main">
          <div class="product-title-line">
            <h3 class="product-name">
              ${escapeHTML(product.name)}
            </h3>

            <span class="category-pill ${
              category === "PPULBATU" ? "ppulbatu" : ""
            }">
              ${escapeHTML(category)}
            </span>
          </div>

          <p class="product-meta">
            ${escapeHTML(product.group_name || "No group / artist")}<br>
            <strong>₹${priceText}</strong>
            &nbsp;·&nbsp; Stock: ${Number(product.stock) || 0}

            ${
              Number(product.is_bestseller) === 1
                ? '<br><span class="bestseller-tag">♡ Bestseller</span>'
                : ""
            }
          </p>

          <div class="product-actions">
            <button
              type="button"
              class="action-button edit-button"
              data-edit="${escapeHTML(id)}"
            >Edit</button>

            <button
              type="button"
              class="action-button delete-button"
              data-delete="${escapeHTML(id)}"
            >Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// Load the actual Firebase products through your backend.
async function refreshProducts() {
  if (isLoading) return;

  isLoading = true;

  if (productsList) {
    productsList.innerHTML = `
      <div class="empty-state">Connecting to your product database…</div>
    `;
  }

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const data = await readResponse(response);

    if (!Array.isArray(data.products)) {
      throw new Error("The API response does not contain a products array.");
    }

    products = data.products.map(normalizeProduct);

    renderProducts();

    setStatus(
      `Connected to Firebase ♡ Loaded ${products.length} product(s).`
    );
  } catch (error) {
    console.error("KPOPIFY admin product loading failed:", error);

    products = [];
    updateStats();

    if (productsList) {
      productsList.innerHTML = `
        <div class="empty-state">
          <strong>Couldn't load your products.</strong><br>
          ${escapeHTML(error.message)}<br><br>
          Check that /api/firebase-products displays your product data,
          then refresh this page.
        </div>
      `;
    }

    setStatus(`Database connection failed: ${error.message}`, true);
  } finally {
    isLoading = false;
  }
}

function resetForm(clearStatus = true) {
  if (!form) return;

  form.reset();

  if (form.elements.stock) {
    form.elements.stock.value = 1;
  }

  if (form.elements.category) {
    form.elements.category.value = "TXT";
  }

  editingId = null;

  if (formTitle) formTitle.textContent = "Add a product";
  if (submitButton) submitButton.textContent = "＋ Add product";
  if (cancelButton) cancelButton.classList.add("hidden");

  if (clearStatus) setStatus("");
}

// Populate the form with the exact product loaded from Firebase.
function editProduct(id) {
  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product) {
    setStatus("Product not found. Refresh the catalogue and try again.", true);
    return;
  }

  editingId = String(product.id);

  form.elements.name.value = product.name || "";
  form.elements.group_name.value = product.group_name || "";
  form.elements.price.value = product.price ?? "";
  form.elements.stock.value = product.stock ?? 0;
  form.elements.description.value = product.description || "";
  form.elements.is_bestseller.checked =
    Number(product.is_bestseller) === 1;

  const category = canonicalCategory(product.category);

  form.elements.category.value =
    category === "PPULBATU"
      ? "Tubatu"
      : category === "Members"
        ? "Member"
        : "TXT";

  // Don't clear the stored image: leave the file input empty.
  if (form.elements.image) {
    form.elements.image.value = "";
  }

  if (formTitle) formTitle.textContent = "Edit product";
  if (submitButton) submitButton.textContent = "Save changes ♡";
  if (cancelButton) cancelButton.classList.remove("hidden");

  setStatus(
    `Editing: ${product.name}. Leave the image field empty to keep its current image.`
  );

  document.getElementById("formPanel")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// Convert an uploaded image to a data URL.
function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select a valid image file."));
      return;
    }

    if (file.size > 700 * 1024) {
      reject(new Error(
        "Image is too large. Please resize it to under 700 KB."
      ));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(
      new Error("Could not read the selected image.")
    );

    reader.readAsDataURL(file);
  });
}

// Add a new product or update an existing Firebase product.
if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();

    submitButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

    setStatus(editingId === null ? "Adding product…" : "Saving changes…");

    try {
      const formData = new FormData(form);

      const existingProduct = editingId === null
        ? null
        : products.find(item => String(item.id) === editingId);

      const imageFile = form.elements.image?.files?.[0];

      let image = existingProduct?.image || "";

      if (imageFile && imageFile.size > 0) {
        image = await readImageAsDataURL(imageFile);
      }

      const payload = {
        name: String(formData.get("name") || "").trim(),
        group_name: String(formData.get("group_name") || "").trim(),
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        description: String(formData.get("description") || ""),
        category: apiCategory(formData.get("category")),
        is_bestseller: form.elements.is_bestseller.checked ? 1 : 0,
        image
      };

      if (!payload.name || !payload.group_name) {
        throw new Error("Enter the product name and group/artist.");
      }

      if (!Number.isFinite(payload.price) || payload.price < 0) {
        throw new Error("Enter a valid product price.");
      }

      if (!Number.isInteger(payload.stock) || payload.stock < 0) {
        throw new Error("Stock must be a whole number of zero or more.");
      }

      const url = editingId === null
        ? API_URL
        : `${API_URL}/${encodeURIComponent(editingId)}`;

      const response = await fetch(url, {
        method: editingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await readResponse(response);

      const message = editingId === null
        ? "Product added successfully ♡"
        : "Product updated successfully ♡";

      resetForm(false);
      setStatus(message);

      await refreshProducts();
      setStatus(message);
    } catch (error) {
      console.error("KPOPIFY product save failed:", error);
      setStatus(`Couldn't save product: ${error.message}`, true);
    } finally {
      submitButton.disabled = false;
      if (cancelButton) cancelButton.disabled = false;
    }
  });
}

if (cancelButton) {
  cancelButton.addEventListener("click", () => resetForm());
}

// Handle edit and delete clicks.
if (productsList) {
  productsList.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
      editProduct(editButton.dataset.edit);
      return;
    }

    if (!deleteButton) return;

    const id = deleteButton.dataset.delete;

    const product = products.find(
      item => String(item.id) === String(id)
    );

    if (!product) {
      setStatus("Product not found. Refresh the catalogue and try again.", true);
      return;
    }

    const confirmed = window.confirm(
      `Delete "${product.name}" from Firebase? This cannot be undone.`
    );

    if (!confirmed) return;

    deleteButton.disabled = true;

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      await readResponse(response);

      if (String(editingId) === String(id)) {
        resetForm();
      }

      await refreshProducts();
      setStatus("Product deleted successfully ♡");
    } catch (error) {
      console.error("KPOPIFY product delete failed:", error);
      window.alert(`Couldn't delete product: ${error.message}`);
      deleteButton.disabled = false;
    }
  });
}

if (productSearch) {
  productSearch.addEventListener("input", renderProducts);
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", renderProducts);
}

// Load products automatically when the admin page opens.
refreshProducts();
