
(() => {
  const grid = document.getElementById("menuGrid");
  const status = document.getElementById("menuStatus");
  const filters = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("menuSearch");

  if (!grid || !status || !filters) return;

  let items = [];
  let activeMain = "Food";
  let activeSubcategory = "All";
  let searchTerm = "";
  let previousBodyOverflow = "";
  let previousBodyPaddingRight = "";
  let previousScrollY = 0;
  let modalHistoryActive = false;

  const config = window.APP_CONFIG || {};
  const configured = config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("PASTE_") &&
    !config.supabaseAnonKey.includes("PASTE_");

  const foodCategories = [
    "Bestsellers", "Soups", "Starters (Veg)", "Starters (Non-Veg)",
    "Veg Starters", "Non-Veg Starters", "Veg Biryani", "Non-Veg Biryani",
    "Veg Curries", "Non-Veg Curries", "Breads", "Rice & Noodles",
    "Desserts"
  ];

  const drinkCategories = [
    "Bestsellers", "Fresh Juices", "Milkshakes", "Mojitos",
    "Cool Drinks", "Hot Beverages", "Tea & Coffee"
  ];

  function normalize(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function showStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status-message ${kind}`.trim();
    status.hidden = false;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function getMainCategory(item) {
    return String(item.main_category || "Food").trim();
  }

  function getSubcategory(item) {
    return String(item.subcategory || item.category || "Other").trim();
  }

  function getImage(item) {
    return String(item.image_url || "").trim();
  }

  function isSameCategory(first, second) {
    return normalize(first) === normalize(second);
  }

  function getMainItems() {
    return items.filter(item =>
      isSameCategory(getMainCategory(item), activeMain)
    );
  }

  function getAvailableSubcategories() {
    const actual = getMainItems()
      .map(getSubcategory)
      .filter(Boolean);

    const defaults = activeMain === "Food"
      ? foodCategories
      : drinkCategories;

    const unique = new Map();

    for (const category of [...defaults, ...actual]) {
      const key = normalize(category);
      if (key && !unique.has(key)) unique.set(key, category);
    }

    return ["All", ...unique.values()];
  }

  function renderFilters() {
    const mainButtons = ["Food", "Drinks"].map(category => `
      <button
        type="button"
        class="filter-chip main-category-chip ${isSameCategory(category, activeMain) ? "active" : ""}"
        data-main="${category}"
        aria-pressed="${isSameCategory(category, activeMain)}"
      >${category}</button>
    `).join("");

    const subcategories = getAvailableSubcategories();

    if (!subcategories.some(category =>
      isSameCategory(category, activeSubcategory)
    )) {
      activeSubcategory = "All";
    }

    filters.innerHTML = `
      <div class="main-category-filters">${mainButtons}</div>
      <div class="subcategory-filters">
        ${subcategories.map(category => `
          <button
            type="button"
            class="filter-chip ${isSameCategory(category, activeSubcategory) ? "active" : ""}"
            data-subcategory="${escapeHTML(category)}"
            aria-pressed="${isSameCategory(category, activeSubcategory)}"
          >${escapeHTML(category)}</button>
        `).join("")}
      </div>
    `;
  }

  function renderItems() {
    const visible = items.filter(item => {
      const main = getMainCategory(item);
      const sub = getSubcategory(item);
      const searchable = [
        item.name,
        main,
        sub,
        item.category,
        item.description
      ].map(value => String(value ?? "")).join(" ").toLowerCase();

      return isSameCategory(main, activeMain) &&
        (activeSubcategory === "All" ||
          isSameCategory(sub, activeSubcategory)) &&
        searchable.includes(searchTerm);
    });

    if (!visible.length) {
      grid.replaceChildren();
      showStatus(
        getMainItems().length
          ? `No ${activeMain.toLowerCase()} items match this selection. Try another category or search.`
          : `No items are currently assigned to ${activeMain}. Check the main_category values in Supabase.`
      );
      return;
    }

    status.hidden = true;

    grid.innerHTML = visible.map((item, index) => {
      const photoUrl = getImage(item);
      const image = photoUrl
        ? `<img class="dish-image" src="${escapeHTML(photoUrl)}" alt="${escapeHTML(item.name)}" loading="${index < 2 ? "eager" : "lazy"}" decoding="async" ${index < 2 ? 'fetchpriority="high"' : ""}>`
        : `<div class="dish-image dish-image-failed" role="img" aria-label="No image available for ${escapeHTML(item.name)}"></div>`;

      return `
        <article
          class="menu-card menu-card-clickable"
          role="button"
          tabindex="0"
          data-dish-id="${escapeHTML(item.id)}"
          aria-label="View ${escapeHTML(item.name)} details"
        >
          ${image}
          <div class="dish-body">
            <div class="dish-topline">
              <h2 class="dish-name">${escapeHTML(item.name)}</h2>
              <span class="dish-price">${escapeHTML(item.price_display || money(item.price))}</span>
            </div>
            ${item.description ? `<p class="dish-description">${escapeHTML(item.description)}</p>` : ""}
            <div class="dish-meta">
              <span class="pill">${escapeHTML(getSubcategory(item))}</span>
              ${item.is_must_try ? '<span class="pill must-try">Must Try</span>' : ""}
              ${item.is_vegetarian
                ? '<span class="pill veg">Vegetarian</span>'
                : '<span class="pill non-veg">Non-vegetarian</span>'}
            </div>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll(".dish-image[src]").forEach(image => {
      image.addEventListener("error", () => {
        image.classList.add("dish-image-failed");
        image.removeAttribute("src");
      }, { once: true });
    });
  }

  function getOrCreateModal() {
    let modal = document.getElementById("dishDetailModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "dishDetailModal";
    modal.className = "dish-detail-modal";

    modal.innerHTML = `
      <div class="dish-detail-backdrop" data-close-dish></div>
      <section class="dish-detail-panel" role="dialog" aria-modal="true" aria-labelledby="dishDetailName">
        <button class="dish-detail-close" type="button" data-close-dish aria-label="Close dish details">×</button>
        <img id="dishDetailImage" class="dish-detail-image" alt="" decoding="async">
        <div class="dish-detail-content">
          <div id="dishDetailBadge"></div>
          <h2 id="dishDetailName"></h2>
          <p id="dishDetailPrice" class="dish-detail-price"></p>
          <p id="dishDetailDescription"></p>
          <p id="dishDetailCategory" class="muted small"></p>
        </div>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-dish]")) closeDish(true);
    });

    return modal;
  }

  function openDish(item) {
    const modal = getOrCreateModal();
    if (modal.classList.contains("open")) return;

    previousScrollY = window.scrollY;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;

    const detailImage = document.getElementById("dishDetailImage");
    const photoUrl = getImage(item);

    detailImage.removeAttribute("src");
    detailImage.alt = item.name;
    detailImage.classList.remove("dish-image-failed");

    if (photoUrl) {
      detailImage.src = photoUrl;
      detailImage.onerror = () => {
        detailImage.classList.add("dish-image-failed");
        detailImage.removeAttribute("src");
      };
    } else {
      detailImage.classList.add("dish-image-failed");
    }

    document.getElementById("dishDetailBadge").innerHTML =
      item.is_vegetarian
        ? '<span class="dish-veg-mark" aria-label="Vegetarian">▣</span>'
        : '<span class="dish-nonveg-mark" aria-label="Non-vegetarian">▣</span>';

    document.getElementById("dishDetailName").textContent = item.name;
    document.getElementById("dishDetailPrice").textContent =
      item.price_display || money(item.price);
    document.getElementById("dishDetailDescription").textContent =
      item.description || "A delicious selection from Adbhutaaharam.";
    document.getElementById("dishDetailCategory").textContent =
      `${getMainCategory(item)} · ${getSubcategory(item)}`;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
    modal.classList.add("open");

    if (!history.state?.dishDetailOpen) {
      history.pushState(
        { ...(history.state || {}), dishDetailOpen: true },
        "",
        "#dish-detail"
      );
      modalHistoryActive = true;
    } else {
      modalHistoryActive = false;
    }

    modal.querySelector(".dish-detail-close").focus();
  }

  function restorePageScroll() {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
    document.body.classList.remove("modal-open");

    requestAnimationFrame(() => {
      window.scrollTo({ top: previousScrollY, behavior: "instant" });
    });
  }

  function closeDish(updateHistory = false) {
    const modal = document.getElementById("dishDetailModal");
    if (!modal?.classList.contains("open")) return;

    modal.classList.remove("open");
    restorePageScroll();

    if (updateHistory && modalHistoryActive && history.state?.dishDetailOpen) {
      modalHistoryActive = false;
      history.back();
    }
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
    if (!card) return;

    const item = items.find(entry => String(entry.id) === card.dataset.dishId);
    if (item) openDish(item);
  });

  grid.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;

    const card = event.target.closest("[data-dish-id]");
    if (!card) return;

    event.preventDefault();
    const item = items.find(entry => String(entry.id) === card.dataset.dishId);
    if (item) openDish(item);
  });

  window.addEventListener("popstate", () => {
    const modal = document.getElementById("dishDetailModal");
    if (modal?.classList.contains("open")) closeDish(false);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDish(true);
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderItems();
    });
  }

  if (!configured) {
    showStatus("The digital menu has not been connected yet. Please follow SETUP.md to configure the database.");
    return;
  }

  if (!window.supabase?.createClient) {
    showStatus("The menu service could not be initialized. Please refresh and try again.", "error");
    return;
  }

  const supabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  (async () => {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name,category,main_category,subcategory,description,price,price_display,image_url,is_vegetarian,is_must_try,is_available,created_at")
        .order("main_category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      items = (data || []).filter(item => item.is_available !== false);
      renderFilters();
      renderItems();
    } catch (error) {
      console.error("Menu load error:", error);
      showStatus("We couldn't load the menu right now. Please ask restaurant staff for assistance.", "error");
    }
  })();
})();
