(() => {
  const grid = document.getElementById("menuGrid");
  const status = document.getElementById("menuStatus");
  const filters = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("menuSearch");
  let items = [];
  let activeMain = "Food";
  let activeSubcategory = "All";
  let searchTerm = "";

  const config = window.APP_CONFIG || {};
  const configured = config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("PASTE_") && !config.supabaseAnonKey.includes("PASTE_");
  const foodCategories = ["Bestsellers", "Soups", "Veg Starters", "Non-Veg Starters", "Veg Biryani", "Non-Veg Biryani", "Veg Curries", "Non-Veg Curries", "Breads", "Rice & Noodles", "Desserts"];
  const drinkCategories = ["Bestsellers", "Fresh Juices", "Milkshakes", "Mojitos", "Cool Drinks", "Hot Beverages", "Tea & Coffee"];

  function showStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status-message ${kind}`.trim();
    status.hidden = false;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
  }

  function getSubcategory(item) {
    return item.subcategory || item.category || "Other";
  }

  function renderFilters() {
    const mainButtons = ["Food", "Drinks"].map(category =>
      `<button type="button" class="filter-chip ${category === activeMain ? "active" : ""}" data-main="${category}">${category}</button>`
    ).join("");
    const categoryNames = activeMain === "Food" ? foodCategories : drinkCategories;
    const actual = items.filter(item => (item.main_category || "Food") === activeMain).map(getSubcategory);
    const subcategories = ["All", ...new Set([...categoryNames, ...actual])];
    filters.innerHTML = `<div class="main-category-filters">${mainButtons}</div><div class="subcategory-filters">${subcategories.map(category =>
      `<button type="button" class="filter-chip ${category === activeSubcategory ? "active" : ""}" data-subcategory="${escapeHTML(category)}">${escapeHTML(category)}</button>`
    ).join("")}</div>`;
  }

  function renderItems() {
    const visible = items.filter(item => {
      const main = item.main_category || "Food";
      const sub = getSubcategory(item);
      const text = `${item.name || ""} ${main} ${sub} ${item.description || ""}`.toLowerCase();
      return main === activeMain &&
        (activeSubcategory === "All" || sub === activeSubcategory) &&
        text.includes(searchTerm);
    });

    if (!visible.length) {
      grid.innerHTML = "";
      showStatus(items.length ? `No ${activeMain.toLowerCase()} items match this selection. Try another category or search.` : "The digital menu is being prepared. Please ask restaurant staff for the current menu.");
      return;
    }

    status.hidden = true;
    grid.innerHTML = visible.map(item => {
      const photoQuery = encodeURIComponent(`${item.name} ${getSubcategory(item)} Indian food dish`);
      const photoUrl = item.image_url || `https://loremflickr.com/720/450/${photoQuery}`;
      const image = `<img class="dish-image" src="${escapeHTML(photoUrl)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=720&q=80'">`;
      return `<article class="menu-card menu-card-clickable" role="button" tabindex="0" data-dish-id="${escapeHTML(item.id)}" aria-label="View ${escapeHTML(item.name)} details">${image}<div class="dish-body">
        <div class="dish-topline"><h2 class="dish-name">${escapeHTML(item.name)}</h2><span class="dish-price">${escapeHTML(item.price_display || money(item.price))}</span></div>
        ${item.description ? `<p class="dish-description">${escapeHTML(item.description)}</p>` : ""}
        <div class="dish-meta"><span class="pill">${escapeHTML(getSubcategory(item))}</span>${item.is_must_try ? '<span class="pill must-try">Must Try</span>' : ""}${item.is_vegetarian ? '<span class="pill veg">Vegetarian</span>' : '<span class="pill non-veg">Non-vegetarian</span>'}</div>
      </div></article>`;
    }).join("");
  }

  function openDish(item) {
    let modal = document.getElementById("dishDetailModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "dishDetailModal";
      modal.className = "dish-detail-modal";
      modal.innerHTML = `<div class="dish-detail-backdrop" data-close-dish></div><section class="dish-detail-panel" role="dialog" aria-modal="true" aria-labelledby="dishDetailName"><button class="dish-detail-close" type="button" data-close-dish aria-label="Close dish details">×</button><img id="dishDetailImage" class="dish-detail-image" alt=""><div class="dish-detail-content"><div id="dishDetailBadge"></div><h2 id="dishDetailName"></h2><p id="dishDetailPrice" class="dish-detail-price"></p><p id="dishDetailDescription"></p><p id="dishDetailCategory" class="muted small"></p></div></section>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", event => {
        if (event.target.closest("[data-close-dish]")) modal.classList.remove("open");
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") modal.classList.remove("open");
      });
    }
    document.getElementById("dishDetailImage").src = item.image_url || `https://loremflickr.com/900/700/${encodeURIComponent(item.name + " Indian food")}`;
    document.getElementById("dishDetailImage").alt = item.name;
    document.getElementById("dishDetailBadge").innerHTML = item.is_vegetarian ? '<span class="dish-veg-mark">▣</span>' : '<span class="dish-nonveg-mark">▣</span>';
    document.getElementById("dishDetailName").textContent = item.name;
    document.getElementById("dishDetailPrice").textContent = item.price_display || money(item.price);
    document.getElementById("dishDetailDescription").textContent = item.description || "A delicious selection from Adbhutaaharam.";
    document.getElementById("dishDetailCategory").textContent = `${item.main_category || "Food"} · ${getSubcategory(item)}`;
    modal.classList.add("open");
    document.body.classList.add("modal-open");
    modal.querySelector(".dish-detail-close").focus();
  }

  filters.addEventListener("click", event => {
    const mainButton = event.target.closest("[data-main]");
    if (mainButton) {
      activeMain = mainButton.dataset.main;
      activeSubcategory = "All";
      renderFilters();
      renderItems();
      return;
    }
    const subButton = event.target.closest("[data-subcategory]");
    if (subButton) {
      activeSubcategory = subButton.dataset.subcategory;
      renderFilters();
      renderItems();
    }
  });

  grid.addEventListener("click", event => {
    const card = event.target.closest("[data-dish-id]");
    if (card) {
      const item = items.find(entry => String(entry.id) === card.dataset.dishId);
      if (item) openDish(item);
    }
  });
  grid.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-dish-id]")) {
      event.preventDefault();
      const item = items.find(entry => String(entry.id) === event.target.dataset.dishId);
      if (item) openDish(item);
    }
  });

  if (searchInput) searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    renderItems();
  });

  if (!configured) {
    showStatus("The digital menu has not been connected yet. Please follow SETUP.md to configure the database.");
    return;
  }

  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  (async () => {
    try {
      const { data, error } = await supabase.from("menu_items")
        .select("id,name,category,main_category,subcategory,description,price,price_display,image_url,is_vegetarian,is_must_try,created_at")
        .order("main_category", { ascending: true }).order("subcategory", { ascending: true }).order("name", { ascending: true });
      if (error) throw error;
      items = data || [];
      renderFilters();
      renderItems();
    } catch (error) {
      console.error(error);
      showStatus("We couldn't load the menu right now. Please ask restaurant staff for assistance.", "error");
    }
  })();
})();
