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
  let previousBodyPosition = "";
  let previousBodyTop = "";
  let previousBodyWidth = "";
  let previousScrollY = 0;
  let modalHistoryActive = false;
  const cardCache = new Map();

  const config = window.APP_CONFIG || {};
  const configured = config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("PASTE_") &&
    !config.supabaseAnonKey.includes("PASTE_");


  function normalize(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function isSameCategory(first, second) {
    return normalize(first) === normalize(second);
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

  function canonicalCategory(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function getMainCategory(item) {
    const stored = String(item.main_category || "Food").trim();
    const sub = normalize(item.subcategory || item.category || "");
    const drinkTerms = /\b(beverages?|juices?|milkshakes?|mojitos?|cool drinks|soft drinks|lassi|soda|tea|coffee|water bottle)\b/;
    if (isSameCategory(stored, "Drinks") || (!item.main_category && drinkTerms.test(sub)) || (isSameCategory(stored, "Food") && drinkTerms.test(sub))) return "Drinks";
    return stored;
  }

  function getSubcategory(item) {
    return canonicalCategory(item.subcategory || item.category || "Other");
  }

  function getImage(item) {
    return String(item.image_url || "").trim();
  }

  function isVegetarian(item) {
    return item.is_vegetarian === true || item.is_vegetarian === 1;
  }

  function getMainItems() {
    return items.filter(item =>
      isSameCategory(getMainCategory(item), activeMain)
    );
  }

  const foodSubcategories = [
    "Soups", "Non-Veg Starters", "Veg Starters", "Roti", "Biryanis",
    "Non-Veg Pulaos", "Veg Pulaos", "Non-Veg Gravies", "Veg Gravies",
    "Signature Dishes", "Accompaniments", "Desserts", "Ice Creams"
  ];

  const drinkSubcategories = [
    "Beverages", "Regular Mocktails", "Long Mocktails", "Milkshakes", "Coffee & Tea"
  ];

  function displaySubcategory(value) {
    const normalized = normalize(value);
    const aliases = {
      "starters (non-veg)": "Non-Veg Starters",
      "starters non veg": "Non-Veg Starters",
      "starters (veg)": "Veg Starters",
      "starters veg": "Veg Starters",
      "gravies (non-veg)": "Non-Veg Gravies",
      "gravies n veg": "Non-Veg Gravies",
      "gravies (veg)": "Veg Gravies",
      "gravies veg": "Veg Gravies",
      "pulaos (non-veg)": "Non-Veg Pulaos",
      "pulaos non veg": "Non-Veg Pulaos",
      "pulaos (veg)": "Veg Pulaos",
      "pulaos veg": "Veg Pulaos",
      "accompainments": "Accompaniments",
      "milkshake": "Milkshakes",
      "coffee, tea": "Coffee & Tea"
    };
    return aliases[normalized] || value;
  }

  function getAvailableSubcategories() {
    const standard = activeMain === "Drinks" ? drinkSubcategories : foodSubcategories;
    const actual = getMainItems()
      .map(item => displaySubcategory(getSubcategory(item)))
      .filter(Boolean);
    return ["All", ...new Set([...standard, ...actual])];
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

  function createDishCard(item, index) {
    const card = document.createElement("article");
    card.className = "menu-card menu-card-clickable";
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.dataset.dishId = String(item.id);
    card.setAttribute("aria-label", `View ${item.name} details`);

    const photoUrl = getImage(item);
    let image;
    if (photoUrl) {
      image = document.createElement("img");
      image.className = "dish-image";
      image.src = photoUrl;
      image.alt = item.name;
      image.loading = index < 4 ? "eager" : "lazy";
      image.decoding = "async";
      if (index < 4) image.fetchPriority = "high";
      image.addEventListener("error", () => {
        image.classList.add("dish-image-failed");
        image.removeAttribute("src");
      }, { once: true });
    } else {
      image = document.createElement("div");
      image.className = "dish-image dish-image-failed";
      image.setAttribute("role", "img");
      image.setAttribute("aria-label", `No image available for ${item.name}`);
    }

    const body = document.createElement("div");
    body.className = "dish-body";
    const topline = document.createElement("div");
    topline.className = "dish-topline";
    const name = document.createElement("h2");
    name.className = "dish-name";
    name.textContent = item.name;
    const price = document.createElement("span");
    price.className = "dish-price";
    price.textContent = item.price_display || money(item.price);
    topline.append(name, price);
    body.appendChild(topline);

    if (item.description) {
      const description = document.createElement("p");
      description.className = "dish-description";
      description.textContent = item.description;
      body.appendChild(description);
    }

    const meta = document.createElement("div");
    meta.className = "dish-meta";
    const category = document.createElement("span");
    category.className = "pill";
    category.textContent = getSubcategory(item);
    meta.appendChild(category);

    if (item.is_must_try === true || item.is_must_try === 1) {
      const bestseller = document.createElement("span");
      bestseller.className = "pill must-try";
      bestseller.textContent = "Bestseller";
      meta.appendChild(bestseller);
    }

    const veg = document.createElement("span");
    veg.className = `pill ${isVegetarian(item) ? "veg" : "non-veg"}`;
    veg.textContent = isVegetarian(item) ? "Vegetarian" : "Non-vegetarian";
    meta.appendChild(veg);
    body.appendChild(meta);
    card.append(image, body);
    return card;
  }

  function renderItems() {
    const visibleIds = new Set();
    let visibleCount = 0;

    items.forEach((item, index) => {
      const main = getMainCategory(item);
      const sub = displaySubcategory(getSubcategory(item));
      const searchable = [item.name, main, sub, item.category, item.description]
        .map(value => String(value ?? "")).join(" ").toLowerCase();
      const matchesCategory = isSameCategory(activeSubcategory, "All") ||
        (isSameCategory(activeSubcategory, "Bestsellers")
          ? item.is_must_try === true || item.is_must_try === 1
          : isSameCategory(sub, activeSubcategory));
      const matches = isSameCategory(main, activeMain) && matchesCategory && searchable.includes(searchTerm);
      const id = String(item.id);
      let card = cardCache.get(id);

      if (!card) {
        card = createDishCard(item, index);
        cardCache.set(id, card);
      }

      card.hidden = !matches;
      if (matches) {
        visibleIds.add(id);
        visibleCount++;
        if (card.parentElement !== grid) grid.appendChild(card);
      }
    });

    for (const [id, card] of cardCache) {
      if (!items.some(item => String(item.id) === id)) {
        card.remove();
        cardCache.delete(id);
      } else if (!visibleIds.has(id)) {
        card.hidden = true;
      }
    }

    if (!visibleCount) {
      showStatus(
        getMainItems().length
          ? `No ${activeMain.toLowerCase()} items match this selection. Try another category or search.`
          : `No items are currently assigned to ${activeMain}. Check the main_category values in Supabase.`
      );
    } else {
      status.hidden = true;
    }
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
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyWidth = document.body.style.width;

    const detailImage = document.getElementById("dishDetailImage");
    const photoUrl = getImage(item);

    detailImage.removeAttribute("src");
    detailImage.alt = item.name;
    detailImage.classList.remove("dish-image-failed");
    detailImage.onerror = null;

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
      isVegetarian(item)
        ? '<span class="dish-veg-mark" aria-label="Vegetarian">▣</span>'
        : '<span class="dish-nonveg-mark" aria-label="Non-vegetarian">▣</span>';

    document.getElementById("dishDetailName").textContent = item.name;
    document.getElementById("dishDetailPrice").textContent =
      item.price_display || money(item.price);
    document.getElementById("dishDetailDescription").textContent =
      item.description || "";
    document.getElementById("dishDetailCategory").textContent =
      `${getMainCategory(item)} · ${getSubcategory(item)}`;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = "100%";
    document.body.classList.add("modal-open");
    modal.classList.add("open");

    if (!history.state?.dishDetailOpen) {
      history.pushState(
        { ...(history.state || {}), dishDetailOpen: true },
        "",
        window.location.pathname + window.location.search + "#dish-detail"
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
    document.body.style.position = previousBodyPosition;
    document.body.style.top = previousBodyTop;
    document.body.style.width = previousBodyWidth;
    document.body.classList.remove("modal-open");
    window.scrollTo(0, previousScrollY);
  }

  function closeDish(updateHistory = false) {
    const modal = document.getElementById("dishDetailModal");

    if (!modal || !modal.classList.contains("open")) return;

    if (updateHistory && modalHistoryActive && history.state?.dishDetailOpen) {
      modalHistoryActive = false;
      history.back();
      return;
    }

    modal.classList.remove("open");
    restorePageScroll();
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
    if (modal?.classList.contains("open")) {
      modalHistoryActive = false;
      closeDish(false);
    }
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
