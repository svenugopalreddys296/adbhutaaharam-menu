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
  let supabase;
  let isAdmin = false;

  const configured = config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("PASTE_") && !config.supabaseAnonKey.includes("PASTE_");

  function showStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status-message ${kind}`.trim();
    status.hidden = false;
  }
  function clearStatus() { status.hidden = true; }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }
  function money(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
  }
  function resetForm() {
    itemForm.reset();
    document.getElementById("itemId").value = "";
    formHeading.textContent = "Add a menu item";
    cancelEdit.hidden = true;
  }
  async function checkAdmin(user) {
    if (!user) return false;
    const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
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
    const { data, error } = await supabase.from("menu_items").select("*").order("created_at", { ascending: false });
    if (error) {
      showStatus("Could not load menu items. Check the database setup.", "error");
      console.error(error);
      return;
    }
    if (!data.length) {
      itemsList.innerHTML = '<div class="status-message">No menu items have been added yet. Add only verified restaurant menu details.</div>';
      return;
    }
    itemsList.innerHTML = data.map(item => `
      <article class="admin-item">
        <div>
          <h3>${escapeHTML(item.name)} <span class="muted">· ${escapeHTML(item.price_display || money(item.price))}</span></h3>
          <p>${escapeHTML(item.category)}${item.is_vegetarian ? " · Vegetarian" : ""}</p>
        </div>
        <div class="admin-item-actions">
          <button class="button secondary-button" type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="button secondary-button" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </article>`).join("");
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
    const payload = {
      name: document.getElementById("itemName").value.trim(),
      category: document.getElementById("itemCategory").value.trim(),
      price: Number(document.getElementById("itemPrice").value),
      price_display: null,
      description: document.getElementById("itemDescription").value.trim() || null,
      image_url: document.getElementById("itemImage").value.trim() || null,
      is_vegetarian: document.getElementById("itemVegetarian").checked,
      updated_at: new Date().toISOString()
    };
    try {
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
      const { data, error } = await supabase.from("menu_items").select("*").eq("id", id).single();
      if (error) { showStatus(error.message, "error"); return; }
      document.getElementById("itemId").value = data.id;
      document.getElementById("itemName").value = data.name;
      document.getElementById("itemCategory").value = data.category;
      document.getElementById("itemPrice").value = data.price;
      document.getElementById("itemDescription").value = data.description || "";
      document.getElementById("itemImage").value = data.image_url || "";
      document.getElementById("itemVegetarian").checked = data.is_vegetarian;
      formHeading.textContent = "Edit menu item";
      cancelEdit.hidden = false;
      itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "delete" && !confirm("Delete this menu item permanently?")) return;
    try {
      let result;
      if (action === "delete") result = await supabase.from("menu_items").delete().eq("id", id);
      if (result.error) throw result.error;
      showStatus("Menu item deleted.", "success");
      await loadItems();
    } catch (error) {
      showStatus(error.message || "Action failed.", "error");
    }
  });

  if (!configured) {
    showStatus("Supabase is not configured yet.", "error");
    setupHelp.hidden = false;
    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }
  supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  refreshAuth();
})();
