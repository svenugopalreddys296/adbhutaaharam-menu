
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
  let items = [];

  const configured =
    Boolean(config.supabaseUrl) &&
    Boolean(config.supabaseAnonKey) &&
    !config.supabaseUrl.includes("PASTE_") &&
    !config.supabaseAnonKey.includes("PASTE_");

  function showStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status-message ${kind}`.trim();
    status.hidden = false;
  }

  function clearStatus() {
    status.hidden = true;
    status.textContent = "";
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
    }).format(Number(value) || 0);
  }

  function resetForm() {
    itemForm.reset();
    document.getElementById("itemId").value = "";
    formHeading.textContent = "Add a menu item";
    cancelEdit.hidden = true;

    const availability = document.getElementById("itemAvailability");
    if (availability) availability.checked = true;
  }

  function ensureAvailabilityControl() {
    let availability = document.getElementById("itemAvailability");

    if (availability) return availability;

    const formActions = itemForm.querySelector(".form-actions");

    if (!formActions) return null;

    const label = document.createElement("label");
    label.className = "availability-control";
    label.htmlFor = "itemAvailability";

    availability = document.createElement("input");
    availability.type = "checkbox";
    availability.id = "itemAvailability";
    availability.checked = true;

    const text = document.createElement("span");
    text.textContent = "Available on customer menu";

    label.append(availability, text);
    itemForm.insertBefore(label, formActions);

    return availability;
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

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const user = data?.session?.user;

      if (!user) {
        isAdmin = false;
        dashboard.hidden = true;
        loginPanel.hidden = false;
        return;
      }

      isAdmin = await checkAdmin(user);

      if (!isAdmin) {
        await supabase.auth.signOut();
        dashboard.hidden = true;
        loginPanel.hidden = false;
        showStatus(
          "This account is not authorized as a menu administrator.",
          "error"
        );
        return;
      }

      loginPanel.hidden = true;
      dashboard.hidden = false;

      await loadItems();
    } catch (error) {
      console.error("Admin authentication check failed:", error);
      isAdmin = false;
      dashboard.hidden = true;
      loginPanel.hidden = false;
      showStatus(
        `Authentication check failed: ${error.message || "Unknown error"}`,
        "error"
      );
    }
  }

  async function loadItems() {
    itemsList.innerHTML = "";

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      items = data || [];

      if (!items.length) {
        itemsList.innerHTML =
          '<div class="status-message">No menu items have been added yet. Add verified restaurant menu details.</div>';
        return;
      }

      itemsList.innerHTML = items.map(item => `
        <article class="admin-item">
          <div>
            <h3>
              ${escapeHTML(item.name)}
              <span class="muted">· ${escapeHTML(item.price_display || money(item.price))}</span>
            </h3>
            <p>
              ${escapeHTML(item.category || "")}
              ${item.is_vegetarian ? " · Vegetarian" : ""}
            </p>
            <p class="item-availability">
              ${item.is_available === false ? "Unavailable to customers" : "Available to customers"}
            </p>
          </div>
          <div class="admin-item-actions">
            <button class="button secondary-button" type="button" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>
            <button class="button secondary-button" type="button" data-action="toggle" data-id="${escapeHTML(item.id)}">
              ${item.is_available === false ? "Make available" : "Mark unavailable"}
            </button>
            <button class="button secondary-button" type="button" data-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>
          </div>
        </article>
      `).join("");
    } catch (error) {
      console.error("Menu loading failed:", error);
      showStatus(
        `Could not load menu items: ${error.message || "Unknown error"}`,
        "error"
      );
    }
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
      console.error("Sign-in failed:", error);
      showStatus(error.message || "Sign-in failed.", "error");
    } finally {
      button.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      resetForm();
      await refreshAuth();
      showStatus("You have signed out.", "success");
    } catch (error) {
      console.error("Sign-out failed:", error);
      showStatus(error.message || "Sign-out failed.", "error");
    }
  });

  itemForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin) {
      showStatus("Please sign in with an authorized admin account.", "error");
      return;
    }

    const button = itemForm.querySelector('button[type="submit"]');
    button.disabled = true;

    const id = document.getElementById("itemId").value;
    const availability = ensureAvailabilityControl();

    const payload = {
      name: document.getElementById("itemName").value.trim(),
      category: document.getElementById("itemCategory").value.trim(),
      price: Number(document.getElementById("itemPrice").value),
      price_display: null,
      description: document.getElementById("itemDescription").value.trim() || null,
      image_url: document.getElementById("itemImage").value.trim() || null,
      is_vegetarian: document.getElementById("itemVegetarian").checked,
      is_available: availability ? availability.checked : true,
      updated_at: new Date().toISOString()
    };

    try {
      if (!payload.name || !payload.category || !Number.isFinite(payload.price) || payload.price < 0) {
        throw new Error("Enter a valid dish name, category, and non-negative price.");
      }

      const result = id
        ? await supabase.from("menu_items").update(payload).eq("id", id)
        : await supabase.from("menu_items").insert(payload);

      if (result.error) throw result.error;

      resetForm();
      showStatus(id ? "Menu item updated." : "Menu item added.", "success");
      await loadItems();
    } catch (error) {
      console.error("Menu item save failed:", error);
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

    button.disabled = true;

    try {
      if (action === "edit") {
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        document.getElementById("itemId").value = data.id;
        document.getElementById("itemName").value = data.name || "";
        document.getElementById("itemCategory").value = data.category || "";
        document.getElementById("itemPrice").value = data.price ?? "";
        document.getElementById("itemDescription").value = data.description || "";
        document.getElementById("itemImage").value = data.image_url || "";
        document.getElementById("itemVegetarian").checked = Boolean(data.is_vegetarian);

        const availability = ensureAvailabilityControl();
        if (availability) availability.checked = data.is_available !== false;

        formHeading.textContent = "Edit menu item";
        cancelEdit.hidden = false;
        itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (action === "toggle") {
        const currentItem = items.find(item => String(item.id) === String(id));

        if (!currentItem) {
          throw new Error("Could not find this menu item. Refresh and try again.");
        }

        const { error } = await supabase
          .from("menu_items")
          .update({
            is_available: currentItem.is_available === false,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);

        if (error) throw error;

        showStatus(
          currentItem.is_available === false
            ? "Dish is now available to customers."
            : "Dish is now unavailable to customers.",
          "success"
        );

        await loadItems();
        return;
      }

      if (action === "delete") {
        if (!confirm("Delete this menu item permanently?")) return;

        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", id);

        if (error) throw error;

        showStatus("Menu item deleted.", "success");
        await loadItems();
      }
    } catch (error) {
      console.error("Menu action failed:", error);
      showStatus(error.message || "The action failed.", "error");
    } finally {
      button.disabled = false;
    }
  });

  if (!configured) {
    showStatus("Supabase is not configured yet. Check config.js.", "error");
    setupHelp.hidden = false;
    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    showStatus("Supabase library failed to load. Refresh the page and try again.", "error");
    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }

  ensureAvailabilityControl();

  supabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  refreshAuth();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
      setTimeout(() => refreshAuth(), 0);
    }
  });
})();
