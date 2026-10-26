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
 
let editingId = null;
let products = [];
 
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
 
// Keep labels friendly while submitting category values accepted by the original API.
function canonicalCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (["albums", "txt"].includes(category)) return "Albums";
  if (["ppulbatu", "tubatu"].includes(category)) return "PPULBATU";
  if (["members", "member"].includes(category)) return "Members";
  return "Uncategorized";
}
 
function apiCategory(value) {
  const category = canonicalCategory(value);
  if (category === "Albums") return "TXT";
  if (category === "PPULBATU") return "Tubatu";
  if (category === "Members") return "Member";
  return "TXT";
}
 
function categoryLabel(value) {
  return canonicalCategory(value);
}
 
async function readResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Unexpected server response. Check the VS Code terminal.");
  }
  if (!response.ok || !data.success) {
    throw new Error(data.message || "The request failed.");
  }
  return data;
}
 
function updateStats() {
  totalProducts.textContent = products.length.toLocaleString("en-IN");
  totalBestsellers.textContent = products.filter(item => Number(item.is_bestseller) === 1).length.toLocaleString("en-IN");
  totalStock.textContent = products.reduce((sum, item) => sum + (Number(item.stock) || 0), 0).toLocaleString("en-IN");
  productCountBadge.textContent = `${products.length} ${products.length === 1 ? "item" : "items"}`;
}
 
function renderProducts() {
  updateStats();
  const search = productSearch.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
 
  const filtered = products.filter(product => {
    const category = categoryLabel(product.category);
    const searchable = `${product.name || ""} ${product.group_name || ""} ${product.description || ""} ${category}`.toLowerCase();
    return searchable.includes(search) && (selectedCategory === "All" || category === selectedCategory);
  });
 
  if (!filtered.length) {
    productsList.innerHTML = `<div class="empty-state">${products.length ? "No products match your search or category." : "No products yet. Add your first product ♡"}</div>`;
    return;
  }
 
  productsList.innerHTML = filtered.map(product => {
    const id = Number(product.id);
    const category = categoryLabel(product.category);
    const image = String(product.image || "").trim();
    const imageMarkup = image
      ? `<img class="product-image" src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="product-image product-image-placeholder" aria-hidden="true">♡</div>`;
 
    return `
      <article class="product-row">
        ${imageMarkup}
        <div class="product-main">
          <div class="product-title-line">
            <h3 class="product-name">${escapeHTML(product.name || "Untitled product")}</h3>
            <span class="category-pill ${category === "PPULBATU" ? "ppulbatu" : ""}">${escapeHTML(category)}</span>
          </div>
          <p class="product-meta">
            ${escapeHTML(product.group_name || "No group / artist")}<br>
            <strong>₹${(Number(product.price) || 0).toLocaleString("en-IN")}</strong>
            &nbsp;·&nbsp; Stock: ${Number(product.stock) || 0}
            ${Number(product.is_bestseller) === 1 ? '<br><span class="bestseller-tag">♡ Bestseller</span>' : ""}
          </p>
          <div class="product-actions">
            <button type="button" class="action-button edit-button" data-edit="${id}">Edit</button>
            <button type="button" class="action-button delete-button" data-delete="${id}">Delete</button>
          </div>
        </div>
      </article>`;
  }).join("");
}
 
async function refreshProducts() {
  productsList.innerHTML = '<div class="empty-state">Loading your products…</div>';
  try {
    const response = await fetch("/api/firebase-products");
    const data = await readResponse(response);
    products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
  } catch (error) {
    productsList.innerHTML = `<div class="empty-state">Couldn't load products.<br>${escapeHTML(error.message)}</div>`;
    totalProducts.textContent = "—";
    totalBestsellers.textContent = "—";
    totalStock.textContent = "—";
  }
}
 
function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}
 
function resetForm(clearStatus = true) {
  form.reset();
  form.elements.stock.value = 1;
  form.elements.category.value = "TXT";
  editingId = null;
  formTitle.textContent = "Add a product";
  submitButton.textContent = "＋ Add product";
  cancelButton.classList.add("hidden");
  if (clearStatus) setStatus("");
}
 
function editProduct(id) {
  const product = products.find(item => Number(item.id) === id);
  if (!product) return;
 
  editingId = id;
  form.elements.name.value = product.name || "";
  form.elements.group_name.value = product.group_name || "";
  form.elements.price.value = product.price ?? "";
  form.elements.stock.value = product.stock ?? 0;
  form.elements.description.value = product.description || "";
  form.elements.is_bestseller.checked = Number(product.is_bestseller) === 1;
 
  const category = canonicalCategory(product.category);
  form.elements.category.value = category === "PPULBATU" ? "Tubatu" : category === "Members" ? "Member" : "TXT";
  form.elements.image.value = "";
 
  formTitle.textContent = "Edit product";
  submitButton.textContent = "Save changes ♡";
  cancelButton.classList.remove("hidden");
  setStatus(`Editing: ${product.name || "product"} · Choose a new image only if you want to replace the current one.`);
  document.getElementById("formPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}
 
form.addEventListener("submit", async event => {
  event.preventDefault();
  submitButton.disabled = true;
  cancelButton.disabled = true;
  setStatus(editingId === null ? "Adding product…" : "Saving changes…");
 
  try {
    const formData = new FormData(form);
    // Map the visible category to values accepted by the existing backend.
    formData.set("category", apiCategory(form.elements.category.value));
 
    const url = editingId === null ? "/api/products" : `/api/products/${editingId}`;
    const response = await fetch(url, {
      method: editingId === null ? "POST" : "PUT",
      body: formData
    });
    await readResponse(response);
 
    const successMessage = editingId === null ? "Product added successfully ♡" : "Product updated successfully ♡";
    resetForm(false);
    setStatus(successMessage);
    await refreshProducts();
  } catch (error) {
    setStatus(`Couldn't save product: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
    cancelButton.disabled = false;
  }
});
 
cancelButton.addEventListener("click", () => resetForm());
 
productsList.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
 
  if (editButton) {
    editProduct(Number(editButton.dataset.edit));
    return;
  }
  if (!deleteButton) return;
 
  const id = Number(deleteButton.dataset.delete);
  const product = products.find(item => Number(item.id) === id);
  if (!product) return;
 
  const confirmed = window.confirm(`Delete "${product.name}"? This removes it from your product database.`);
  if (!confirmed) return;
 
  deleteButton.disabled = true;
  try {
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    await readResponse(response);
    if (editingId === id) resetForm();
    setStatus("Product deleted successfully ♡");
    await refreshProducts();
  } catch (error) {
    window.alert(`Couldn't delete product: ${error.message}`);
    deleteButton.disabled = false;
  }
});
 
productSearch.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
 
refreshProducts();
