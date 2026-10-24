
(() => {
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
  const itemImage = document.getElementById("itemImage");
  const itemImagePreview = document.getElementById("itemImagePreview");
  const itemImagePreviewWrap = document.getElementById("itemImagePreviewWrap");
  const itemImagePreviewLabel = document.getElementById("itemImagePreviewLabel");
  const removeItemImageButton = document.getElementById("removeItemImageButton");
  const adminSearch = document.getElementById("adminSearch");
  const adminCategoryFilter = document.getElementById("adminCategoryFilter");
  const adminFilterCount = document.getElementById("adminFilterCount");

  let supabase;
  let isAdmin = false;
  let currentImageUrl = null;
  let previewObjectUrl = null;
  let menuItems = [];
  let authCheckInProgress = false;

  const bucketName = "menu-images";
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxFileSize = 5 * 1024 * 1024;

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

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function releasePreviewObjectUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function showImagePreview(url, label = "Image preview") {
    if (!itemImagePreview) return;

    releasePreviewObjectUrl();

    if (url) {
      itemImagePreview.src = url;
      itemImagePreview.hidden = false;

      if (itemImagePreviewWrap) {
        itemImagePreviewWrap.hidden = false;
      }

      if (itemImagePreviewLabel) {
        itemImagePreviewLabel.textContent = label;
      }
    } else {
      itemImagePreview.removeAttribute("src");
      itemImagePreview.hidden = true;

      if (itemImagePreviewWrap) {
        itemImagePreviewWrap.hidden = true;
      }
    }
  }

  function clearSelectedImage() {
    if (itemImage) itemImage.value = "";
    showImagePreview(currentImageUrl, currentImageUrl ? "Current saved image" : "No image selected");
  }

  function resetForm() {
    itemForm.reset();
    document.getElementById("itemId").value = "";
    currentImageUrl = null;
    showImagePreview(null);
    formHeading.textContent = "Add a menu item";
    cancelEdit.hidden = true;
  }

  function renderCategoryOptions() {
    if (!adminCategoryFilter) return;

    const selected = adminCategoryFilter.value || "All";
    const categories = [...new Set(
      menuItems.map(item => String(item.category || "").trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

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
    const query = (adminSearch?.value || "").trim().toLowerCase();
    const category = adminCategoryFilter?.value || "All";

    const filtered = menuItems.filter(item => {
      const searchableText = [
        item.name,
        item.category,
        item.description
      ].join(" ").toLowerCase();

      return searchableText.includes(query) &&
        (category === "All" || item.category === category);
    });

    if (adminFilterCount) {
      adminFilterCount.textContent =
        `Showing ${filtered.length} of ${menuItems.length} menu items`;
    }

    if (!filtered.length) {
      itemsList.innerHTML = '<div class="status-message">No matching menu items found.</div>';
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
          <h3>${escapeHTML(item.name)} <span class="muted">· ${escapeHTML(item.price_display || money(item.price))}</span></h3>
          <p>${escapeHTML(item.category)}${item.is_vegetarian ? " · Vegetarian" : ""}</p>
          ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ""}
          <p class="muted small">${item.is_available === false ? "Unavailable to customers" : "Available to customers"}</p>
        </div>
        <div class="admin-item-actions">
          <button class="button secondary-button" type="button" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>
          <button class="button secondary-button" type="button" data-action="toggle" data-id="${escapeHTML(item.id)}">${item.is_available === false ? "Make available" : "Mark unavailable"}</button>
          <button class="button secondary-button" type="button" data-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>
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

      if (sessionError) {
        console.error("Session check error:", sessionError);
        loginPanel.hidden = true;
        dashboard.hidden = true;
        showStatus(`Could not check your session: ${sessionError.message}`, "error");
        return;
      }

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
        console.error("User verification error:", userError);

        await supabase.auth.signOut();
        isAdmin = false;
        dashboard.hidden = true;
        loginPanel.hidden = false;
        showStatus("Your session has expired. Please sign in again.", "error");
        return;
      }

      try {
        isAdmin = await checkAdmin(userData.user);
      } catch (error) {
        console.error("Admin authorization error:", error);
        loginPanel.hidden = true;
        dashboard.hidden = true;
        showStatus(`Could not verify admin permissions: ${error.message}`, "error");
        return;
      }

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
      showStatus(`Authentication failed: ${error.message}`, "error");
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

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[file.type];

    const filePath = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;

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
    if (setupHelp) setupHelp.hidden = false;
    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }

  if (!window.supabase?.createClient) {
    showStatus("Supabase library did not load. Check your internet connection and refresh.", "error");
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

  if (itemImage) {
    itemImage.addEventListener("change", () => {
      const file = itemImage.files?.[0];

      if (!file) {
        showImagePreview(currentImageUrl);
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

      if (itemImagePreview) {
        itemImagePreview.src = previewObjectUrl;
        itemImagePreview.hidden = false;
      }

      if (itemImagePreviewWrap) itemImagePreviewWrap.hidden = false;
      if (itemImagePreviewLabel) itemImagePreviewLabel.textContent = file.name;

      clearStatus();
    });
  }

  if (removeItemImageButton) {
    removeItemImageButton.addEventListener("click", () => {
      clearSelectedImage();
      showStatus(
        currentImageUrl
          ? "The new selection was cleared. The saved image will be kept."
          : "Image selection cleared.",
        "success"
      );
    });
  }

  if (adminSearch) {
    adminSearch.addEventListener("input", renderAdminItems);
  }

  if (adminCategoryFilter) {
    adminCategoryFilter.addEventListener("change", renderAdminItems);
  }

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

    const button = itemForm.querySelector('button[type="submit"]');
    button.disabled = true;

    const id = document.getElementById("itemId").value;

    try {
      const selectedFile = itemImage.files?.[0] || null;
      let imageUrl = currentImageUrl;

      if (selectedFile) {
        showStatus("Uploading image…");
        imageUrl = await uploadImage(selectedFile);
      }

      const payload = {
        name: document.getElementById("itemName").value.trim(),
        category: document.getElementById("itemCategory").value.trim(),
        price: Number(document.getElementById("itemPrice").value),
        price_display: null,
        description: document.getElementById("itemDescription").value.trim() || null,
        image_url: imageUrl,
        is_vegetarian: document.getElementById("itemVegetarian").checked,
        updated_at: new Date().toISOString()
      };

      showStatus("Saving menu item…");

      const result = id
        ? await supabase.from("menu_items").update(payload).eq("id", id)
        : await supabase.from("menu_items").insert(payload);

      if (result.error) throw result.error;

      resetForm();
      await loadItems();
      showStatus(id ? "Menu item updated." : "Menu item added.", "success");
    } catch (error) {
      console.error("Save error:", error);
      showStatus(error.message || "Could not save this item.", "error");
    } finally {
      button.disabled = false;
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

      document.getElementById("itemId").value = data.id;
      document.getElementById("itemName").value = data.name || "";
      document.getElementById("itemCategory").value = data.category || "";
      document.getElementById("itemPrice").value = data.price ?? "";
      document.getElementById("itemDescription").value = data.description || "";
      document.getElementById("itemVegetarian").checked = Boolean(data.is_vegetarian);

      currentImageUrl = data.image_url || null;

      if (itemImage) itemImage.value = "";

      showImagePreview(currentImageUrl, currentImageUrl ? "Current saved image" : "No image selected");

      formHeading.textContent = "Edit menu item";
      cancelEdit.hidden = false;
      itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const item = menuItems.find(menuItem => String(menuItem.id) === String(id));
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
      return;
    }

    if (event === "SIGNED_IN" && session) {
      setTimeout(() => refreshAuth(), 0);
    }
  });

  refreshAuth();
})();
