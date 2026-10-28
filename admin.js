(() => {
  "use strict";

  const config = window.APP_CONFIG || {};

  const status = document.getElementById("adminStatus");
  const loginPanel = document.getElementById("loginPanel");
  const dashboard = document.getElementById("dashboard");
  const setupHelp = document.getElementById("setupHelp");
  const loginForm = document.getElementById("loginForm");
  const itemForm = document.getElementById("itemForm");
  const itemsList = document.getElementById("adminItems");
  const formHeading = document.getElementById("formHeading");
  const cancelEdit = document.getElementById("cancelEditButton");
  const signOutButton = document.getElementById("signOutButton");

  const itemId = document.getElementById("itemId");
  const itemName = document.getElementById("itemName");
  const itemMainCategory = document.getElementById("itemMainCategory");
  const itemCategory = document.getElementById("itemCategory");
  const itemPrice = document.getElementById("itemPrice");
  const itemPriceDisplay = document.getElementById("itemPriceDisplay");
  const itemDescription = document.getElementById("itemDescription");
  const itemImage = document.getElementById("itemImage");
  const itemVegetarian = document.getElementById("itemVegetarian");
  const itemMustTry = document.getElementById("itemMustTry");

  const imagePreview = document.getElementById("itemImagePreview");
  const imagePreviewWrap = document.getElementById("itemImagePreviewWrap");
  const imagePreviewLabel = document.getElementById("itemImagePreviewLabel");
  const clearSelectedImageButton = document.getElementById("removeItemImageButton");
  const removeSavedImageButton = document.getElementById("removeSavedImageButton");

  const adminSearch = document.getElementById("adminSearch");
  const adminCategoryFilter = document.getElementById("adminCategoryFilter");
  const adminFilterCount = document.getElementById("adminFilterCount");

  let supabase = null;
  let isAdmin = false;
  let menuItems = [];
  let currentImageUrl = null;
  let removeSavedImage = false;
  let previewObjectUrl = null;
  let authCheckInProgress = false;

  const bucketName = "menu-images";
  const maxFileSize = 5 * 1024 * 1024;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  const foodSubcategories = [
    "Soups",
    "Non-Veg Starters",
    "Veg Starters",
    "Roti",
    "Biryanis",
    "Non-Veg Pulaos",
    "Veg Pulaos",
    "Non-Veg Gravies",
    "Veg Gravies",
    "Signature Dishes",
    "Accompaniments",
    "Desserts",
    "Ice Creams"
  ];

  const drinkSubcategories = [
    "Beverages",
    "Regular Mocktails",
    "Long Mocktails",
    "Milkshakes",
    "Coffee & Tea"
  ];

  const configured =
    typeof config.supabaseUrl === "string" &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseUrl.startsWith("https://") &&
    config.supabaseAnonKey.length > 20 &&
    !config.supabaseUrl.includes("PASTE_") &&
    !config.supabaseAnonKey.includes("PASTE_");

  function showStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status-message ${kind}`.trim();
    status.hidden = false;
  }

  function clearStatus() {
    status.hidden = true;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function normalize(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function mainCategoryOf(item) {
    const stored = String(item.main_category || "Food").trim();

    if (stored.toLowerCase() === "drinks") {
      return "Drinks";
    }

    return "Food";
  }

  function subcategoryOf(item) {
    return String(item.subcategory || item.category || "").trim();
  }

  function releasePreviewObjectUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function showImagePreview(url, label = "Image preview", isTemporary = false) {
    releasePreviewObjectUrl();

    if (!url) {
      imagePreview.removeAttribute("src");
      imagePreview.hidden = true;
      imagePreviewWrap.hidden = true;
      imagePreviewLabel.textContent = "";
      return;
    }

    if (isTemporary) {
      previewObjectUrl = url;
    }

    imagePreview.src = url;
    imagePreview.alt = "Dish image preview";
    imagePreview.hidden = false;
    imagePreviewWrap.hidden = false;
    imagePreviewLabel.textContent = label;
  }

  function updateSubcategoryOptions(selected = "") {
    const options = itemMainCategory.value === "Drinks"
      ? drinkSubcategories
      : foodSubcategories;

    const existing = selected.trim();
    const categories = [...options];

    if (existing && !categories.includes(existing)) {
      categories.push(existing);
    }

    itemCategory.replaceChildren();

    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      itemCategory.appendChild(option);
    });

    itemCategory.value = existing || categories[0] || "";
  }

  function resetImageSelection() {
    itemImage.value = "";
    removeSavedImage = false;

    if (removeSavedImageButton) {
      removeSavedImageButton.hidden = true;
      removeSavedImageButton.textContent = "Remove saved image";
    }

    showImagePreview(null);
  }

  function resetForm() {
    itemForm.reset();
    itemId.value = "";
    currentImageUrl = null;
    resetImageSelection();

    itemMainCategory.value = "Food";
    updateSubcategoryOptions("Soups");

    itemPriceDisplay.value = "";
    itemMustTry.checked = false;
    itemVegetarian.checked = false;

    formHeading.textContent = "Add a menu item";
    cancelEdit.hidden = true;
    clearStatus();
  }

  function renderCategoryOptions() {
    const selected = adminCategoryFilter.value || "All";
    const categories = [...new Set(menuItems.map(subcategoryOf).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    adminCategoryFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "All";
    allOption.textContent = "All categories";
    adminCategoryFilter.appendChild(allOption);

    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      adminCategoryFilter.appendChild(option);
    });

    adminCategoryFilter.value = categories.includes(selected) ? selected : "All";
  }

  function renderAdminItems() {
    const query = normalize(adminSearch.value);
    const selectedCategory = adminCategoryFilter.value || "All";

    const filtered = menuItems.filter(item => {
      const searchableText = [
        item.name,
        mainCategoryOf(item),
        subcategoryOf(item),
        item.category,
        item.description,
        item.price_display,
        item.price
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(query);
      const matchesCategory =
        selectedCategory === "All" ||
        normalize(subcategoryOf(item)) === normalize(selectedCategory);

      return matchesSearch && matchesCategory;
    });

    adminFilterCount.textContent =
      `Showing ${filtered.length} of ${menuItems.length} menu items`;

    if (!filtered.length) {
      itemsList.innerHTML =
        '<div class="status-message">No matching menu items found.</div>';
      return;
    }

    itemsList.innerHTML = filtered.map(item => `
      <article class="admin-item">
        <div>
          ${item.image_url ? `
            <img
              src="${escapeHTML(item.image_url)}"
              alt="${escapeHTML(item.name)}"
              loading="lazy"
              style="width:100px;height:70px;object-fit:cover;border-radius:8px;"
            >
          ` : ""}

          <h3>
            ${escapeHTML(item.name)}
            <span class="muted">· ${escapeHTML(item.price_display || money(item.price))}</span>
          </h3>

          <p>
            ${escapeHTML(mainCategoryOf(item))} ·
            ${escapeHTML(subcategoryOf(item))}
            ${item.is_vegetarian ? " · Vegetarian" : " · Non-vegetarian"}
            ${item.is_must_try ? " · Bestseller" : ""}
          </p>

          ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ""}

          <p class="muted small">
            ${item.is_available === false
              ? "Unavailable to customers"
              : "Available to customers"}
          </p>
        </div>

        <div class="admin-item-actions">
          <button class="button secondary-button" type="button"
            data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>

          <button class="button secondary-button" type="button"
            data-action="toggle" data-id="${escapeHTML(item.id)}">
            ${item.is_available === false ? "Make available" : "Mark unavailable"}
          </button>

          <button class="button secondary-button" type="button"
            data-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>
        </div>
      </article>
    `).join("");
  }

  async function loadItems() {
    itemsList.innerHTML = "";
    showStatus("Loading menu items…");

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Menu loading error:", error);
      showStatus(`Could not load menu items: ${error.message}`, "error");
      return;
    }

    menuItems = data || [];
    renderCategoryOptions();
    renderAdminItems();
    clearStatus();
  }

  async function checkAdmin(user) {
    if (!user) return false;

    const { data, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return Boolean(data);
  }

  async function refreshAuth() {
    if (authCheckInProgress) return;

    authCheckInProgress = true;

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const session = sessionData?.session;

      if (!session) {
        isAdmin = false;
        menuItems = [];
        dashboard.hidden = true;
        loginPanel.hidden = false;
        clearStatus();
        return;
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        await supabase.auth.signOut();
        isAdmin = false;
        dashboard.hidden = true;
        loginPanel.hidden = false;
        showStatus("Your session has expired. Please sign in again.", "error");
        return;
      }

      isAdmin = await checkAdmin(userData.user);

      if (!isAdmin) {
        await supabase.auth.signOut();
        dashboard.hidden = true;
        loginPanel.hidden = false;
        showStatus("This account is not authorized as a menu administrator.", "error");
        return;
      }

      loginPanel.hidden = true;
      dashboard.hidden = false;
      await loadItems();
    } catch (error) {
      console.error("Authentication error:", error);
      showStatus(`Could not verify admin access: ${error.message}`, "error");
    } finally {
      authCheckInProgress = false;
    }
  }

  async function uploadImage(file) {
    if (!file) return currentImageUrl;

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Choose a JPG, PNG, or WebP image.");
    }

    if (file.size > maxFileSize) {
      throw new Error("Image size must not exceed 5 MB.");
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData?.user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[file.type];

    const uniqueId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `${userData.user.id}/${uniqueId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("The image uploaded, but its public URL could not be created.");
    }

    return data.publicUrl;
  }

  if (!configured) {
    showStatus("Supabase configuration is missing or invalid. Check config.js.", "error");
    setupHelp.hidden = false;
    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }

  if (!window.supabase?.createClient) {
    showStatus("Supabase library did not load. Check your connection and refresh.", "error");
    return;
  }

  supabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  itemMainCategory.addEventListener("change", () => {
    updateSubcategoryOptions();
  });

  updateSubcategoryOptions("Soups");

  itemImage.addEventListener("change", () => {
    const file = itemImage.files?.[0];

    if (!file) {
      showImagePreview(
        currentImageUrl,
        currentImageUrl ? "Current saved image" : "No image selected"
      );
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      itemImage.value = "";
      showImagePreview(currentImageUrl);
      showStatus("Choose a JPG, PNG, or WebP image.", "error");
      return;
    }

    if (file.size > maxFileSize) {
      itemImage.value = "";
      showImagePreview(currentImageUrl);
      showStatus("Image size must not exceed 5 MB.", "error");
      return;
    }

    releasePreviewObjectUrl();
    previewObjectUrl = URL.createObjectURL(file);

    imagePreview.src = previewObjectUrl;
    imagePreview.alt = "Selected dish image preview";
    imagePreview.hidden = false;
    imagePreviewWrap.hidden = false;
    imagePreviewLabel.textContent = `Selected: ${file.name}`;

    removeSavedImage = false;
    removeSavedImageButton.hidden = !currentImageUrl;
    removeSavedImageButton.textContent = "Remove saved image";

    clearStatus();
  });

  clearSelectedImageButton.addEventListener("click", () => {
    itemImage.value = "";
    showImagePreview(
      currentImageUrl,
      currentImageUrl ? "Current saved image" : "No image selected"
    );

    showStatus(
      currentImageUrl
        ? "Selected file cleared. The saved image is unchanged."
        : "Selected file cleared.",
      "success"
    );
  });

  removeSavedImageButton.addEventListener("click", () => {
    removeSavedImage = !removeSavedImage;

    if (removeSavedImage) {
      itemImage.value = "";
      showImagePreview(null);
      removeSavedImageButton.textContent = "Undo image removal";
      showStatus("The saved image will be removed when you save this dish.", "success");
    } else {
      showImagePreview(
        currentImageUrl,
        currentImageUrl ? "Current saved image" : "No image selected"
      );
      removeSavedImageButton.textContent = "Remove saved image";
      clearStatus();
    }
  });

  adminSearch.addEventListener("input", renderAdminItems);
  adminCategoryFilter.addEventListener("change", renderAdminItems);

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus("Signing in…");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value
      });

      if (error) throw error;

      await refreshAuth();
    } catch (error) {
      console.error("Sign-in error:", error);
      showStatus(error.message || "Sign-in failed.", "error");
    } finally {
      button.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      showStatus(`Sign-out failed: ${error.message}`, "error");
      return;
    }

    resetForm();
    await refreshAuth();
    showStatus("You have signed out.", "success");
  });

  itemForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin) {
      showStatus("You are not authorized to manage menu items.", "error");
      return;
    }

    const submitButton = itemForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const editingId = itemId.value;

    try {
      const selectedFile = itemImage.files?.[0] || null;
      let imageUrl = currentImageUrl;

      if (selectedFile) {
        showStatus("Uploading image…");
        imageUrl = await uploadImage(selectedFile);
        removeSavedImage = false;
      } else if (removeSavedImage) {
        imageUrl = null;
      }

      const rawPrice = itemPrice.value;
      const numericPrice = Number(rawPrice);

      if (rawPrice.trim() === "" || !Number.isFinite(numericPrice) || numericPrice < 0) {
        throw new Error("Enter a valid price.");
      }

      const selectedSubcategory = itemCategory.value.trim();

      const payload = {
        name: itemName.value.trim(),
        category: selectedSubcategory,
        main_category: itemMainCategory.value,
        subcategory: selectedSubcategory,
        price: numericPrice,
        price_display: itemPriceDisplay.value.trim() || null,
        description: itemDescription.value.trim() || null,
        image_url: imageUrl,
        is_vegetarian: itemVegetarian.checked,
        is_must_try: itemMustTry.checked,
        updated_at: new Date().toISOString()
      };

      if (!payload.name) {
        throw new Error("Enter a dish name.");
      }

      showStatus("Saving menu item…");

      const result = editingId
        ? await supabase.from("menu_items").update(payload).eq("id", editingId)
        : await supabase.from("menu_items").insert(payload);

      if (result.error) throw result.error;

      resetForm();
      await loadItems();
      showStatus(editingId ? "Menu item updated." : "Menu item added.", "success");
    } catch (error) {
      console.error("Save error:", error);
      showStatus(error.message || "Could not save this item.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  cancelEdit.addEventListener("click", resetForm);

  itemsList.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");

    if (!button || !isAdmin) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "edit") {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        showStatus(error.message, "error");
        return;
      }

      itemId.value = data.id;
      itemName.value = data.name || "";

      itemMainCategory.value =
        String(data.main_category || "Food").toLowerCase() === "drinks"
          ? "Drinks"
          : "Food";

      updateSubcategoryOptions(data.subcategory || data.category || "Soups");

      itemPrice.value = data.price ?? "";
      itemPriceDisplay.value = data.price_display || "";
      itemDescription.value = data.description || "";
      itemVegetarian.checked = Boolean(data.is_vegetarian);
      itemMustTry.checked = Boolean(data.is_must_try);

      currentImageUrl = data.image_url || null;
      removeSavedImage = false;
      itemImage.value = "";

      showImagePreview(
        currentImageUrl,
        currentImageUrl ? "Current saved image" : "No image selected"
      );

      removeSavedImageButton.hidden = !currentImageUrl;
      removeSavedImageButton.textContent = "Remove saved image";

      formHeading.textContent = "Edit menu item";
      cancelEdit.hidden = false;

      itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
      clearStatus();
      return;
    }

    if (action === "delete") {
      if (!confirm("Delete this menu item permanently?")) return;

      try {
        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", id);

        if (error) throw error;

        showStatus("Menu item deleted.", "success");
        await loadItems();
      } catch (error) {
        console.error("Delete error:", error);
        showStatus(error.message || "Could not delete this item.", "error");
      }

      return;
    }

    if (action === "toggle") {
      const item = menuItems.find(entry => String(entry.id) === String(id));
      if (!item) return;

      try {
        const { error } = await supabase
          .from("menu_items")
          .update({
            is_available: item.is_available === false,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);

        if (error) throw error;

        showStatus("Menu availability updated.", "success");
        await loadItems();
      } catch (error) {
        console.error("Availability update error:", error);
        showStatus(error.message || "Could not update availability.", "error");
      }
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      isAdmin = false;
      menuItems = [];
      dashboard.hidden = true;
      loginPanel.hidden = false;
      resetForm();
      return;
    }

    if (event === "SIGNED_IN" && session) {
      setTimeout(() => refreshAuth(), 0);
    }
  });

  refreshAuth();
})();
