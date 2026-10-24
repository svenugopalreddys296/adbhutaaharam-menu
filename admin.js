
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

  let supabase;
  let isAdmin = false;
  let currentImageUrl = null;
  const bucketName = "menu-images";
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxFileSize = 5 * 1024 * 1024;

  const configured = config.supabaseUrl && config.supabaseAnonKey &&
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
    }).format(Number(value));
  }

  function showImagePreview(url) {
    if (!itemImagePreview) return;

    if (url) {
      itemImagePreview.src = url;
      itemImagePreview.hidden = false;
    } else {
      itemImagePreview.removeAttribute("src");
      itemImagePreview.hidden = true;
    }
  }

  function resetForm() {
    itemForm.reset();
    document.getElementById("itemId").value = "";
    currentImageUrl = null;
    showImagePreview(null);
    formHeading.textContent = "Add a menu item";
    cancelEdit.hidden = true;
  }

  async function uploadImage(file) {
    if (!file) return currentImageUrl;

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Choose a JPG, PNG, or WebP image.");
    }

    if (file.size > maxFileSize) {
      throw new Error("Image size must not exceed 5 MB.");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in again before uploading an image.");
    }

    const extension = ({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    })[file.type];

    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
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
    clearStatus();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      showStatus("Could not check sign-in status. Please refresh and try again.", "error");
      return;
    }

    if (!user) {
      isAdmin = false;
      dashboard.hidden = true;
      loginPanel.hidden = false;
      return;
    }

    try {
      isAdmin = await checkAdmin(user);
    } catch (error) {
      console.error(error);
      showStatus("Could not verify admin permissions. Check the database setup and policies.", "error");
      loginPanel.hidden = true;
      dashboard.hidden = true;
      return;
    }

    if (!isAdmin) {
      await supabase.auth.signOut();
      loginPanel.hidden = false;
      dashboard.hidden = true;
      showStatus("This account is not authorized as a menu administrator.", "error");
      return;
    }

    loginPanel.hidden = true;
    dashboard.hidden = false;
    await loadItems();
  }

  async function loadItems() {
    itemsList.innerHTML = "";

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      showStatus("Could not load menu items. Check the database setup.", "error");
      console.error(error);
      return;
    }

    if (!data || !data.length) {
      itemsList.innerHTML = '<div class="status-message">No menu items have been added yet. Add only verified restaurant menu details.</div>';
      return;
    }

    itemsList.innerHTML = data.map(item => `
      <article class="admin-item">
        <div>
          <h3>${escapeHTML(item.name)} <span class="muted">· ${escapeHTML(item.price_display || money(item.price))}</span></h3>
          <p>${escapeHTML(item.category)}${item.is_vegetarian ? " · Vegetarian" : ""}</p>
          ${item.image_url ? `<img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.name)}" style="width:100px;height:70px;object-fit:cover;border-radius:8px;">` : ""}
        </div>
        <div class="admin-item-actions">
          <button class="button secondary-button" type="button" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>
          <button class="button secondary-button" type="button" data-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>
        </div>
      </article>
    `).join("");
  }

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

      showImagePreview(URL.createObjectURL(file));
    });
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
      showStatus(error.message || "Sign-in failed.", "error");
    } finally {
      button.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    resetForm();
    await refreshAuth();
    showStatus("You have signed out.", "success");
  });

  itemForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin) return;

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
      showStatus(id ? "Menu item updated." : "Menu item added.", "success");
      await loadItems();
    } catch (error) {
      console.error(error);
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
      document.getElementById("itemName").value = data.name;
      document.getElementById("itemCategory").value = data.category;
      document.getElementById("itemPrice").value = data.price;
      document.getElementById("itemDescription").value = data.description || "";
      document.getElementById("itemVegetarian").checked = Boolean(data.is_vegetarian);

      currentImageUrl = data.image_url || null;

      if (itemImage) itemImage.value = "";

      showImagePreview(currentImageUrl);

      formHeading.textContent = "Edit menu item";
      cancelEdit.hidden = false;
      itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "delete" && !confirm("Delete this menu item permanently?")) {
      return;
    }

    try {
      if (action === "delete") {
        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", id);

        if (error) throw error;
      }

      showStatus("Menu item deleted.", "success");
      await loadItems();
    } catch (error) {
      showStatus(error.message || "Action failed.", "error");
    }
  });

  if (!configured) {
    showStatus("Supabase is not configured yet.", "error");

    if (setupHelp) setupHelp.hidden = false;

    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }

  supabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  refreshAuth();
})();
