(() => {
  const grid = document.getElementById("menuGrid");
  const status = document.getElementById("menuStatus");
  const filters = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("menuSearch");
  let items = [];
  let activeCategory = "All";
  let searchTerm = "";

  const config = window.APP_CONFIG || {};
  const configured = config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("PASTE_") && !config.supabaseAnonKey.includes("PASTE_");

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

  function renderFilters() {
    const categories = ["All", ...new Set(items.map(item => item.category).filter(Boolean).sort((a,b) => a.localeCompare(b)))];
    filters.innerHTML = categories.map(category =>
      `<button type="button" class="filter-chip ${category === activeCategory ? "active" : ""}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`
    ).join("");
  }

  function renderItems() {
    const visible = items.filter(item => {
      const text = `${item.name || ""} ${item.category || ""} ${item.description || ""}`.toLowerCase();
      const matchesSearch = text.includes(searchTerm);
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });

    if (!visible.length) {
      grid.innerHTML = "";
      showStatus(items.length ? "No dishes match your search or selected category. Try another search or category." : "The digital menu is being prepared. Please ask restaurant staff for the current menu.");
      return;
    }

    status.hidden = true;
    grid.innerHTML = visible.map(item => {
      const photoQuery = encodeURIComponent(`${item.name} ${item.category} Indian food dish`);
      const photoUrl = item.image_url || `https://loremflickr.com/720/450/${photoQuery}`;
      const image = `<img class="dish-image" src="${escapeHTML(photoUrl)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=720&q=80'">`;
      const description = item.description ? `<p class="dish-description">${escapeHTML(item.description)}</p>` : "";
      const veg = item.is_vegetarian ? `<span class="pill veg">Vegetarian</span>` : "";
      return `<article class="menu-card">${image}<div class="dish-body">
        <div class="dish-topline"><h2 class="dish-name">${escapeHTML(item.name)}</h2><span class="dish-price">${escapeHTML(item.price_display || money(item.price))}</span></div>
        ${description}<div class="dish-meta"><span class="pill">${escapeHTML(item.category)}</span>${item.is_must_try ? '<span class="pill must-try">Must Try</span>' : ""}${veg}</div>
      </div></article>`;
    }).join("");
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderItems();
    });
  }

  filters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderFilters();
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
        .select("id,name,category,description,price,price_display,image_url,is_vegetarian,is_must_try,created_at")
        .order("category", { ascending: true }).order("name", { ascending: true });
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
