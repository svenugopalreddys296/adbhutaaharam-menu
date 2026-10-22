# Adbhutaaharam QR Digital Menu — Setup Guide

This project provides:
- A public, mobile-friendly menu at `index.html`
- A protected sign-in and menu management page at `admin.html`
- Supabase database/authentication integration
- Category filters and dish search
- A single QR code URL that can stay the same while menu content changes

The supplied Adbhutaaharam menu PDF has been transcribed into `seed-menu.sql` (218 items) and `menu-from-pdf.csv`. No descriptions, photos, hours, or phone numbers have been invented.

## 1. Create the Supabase project

1. Visit https://supabase.com/ and create a project.
2. Open **Project Settings → API** (or the API keys section).
3. Copy the **Project URL** and the **anon/public key**.
4. Open `js/config.js` and replace:
   - `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE`
   - `PASTE_YOUR_SUPABASE_ANON_KEY_HERE`
5. Do not use or publish a `service_role` key in browser code.

The anon/public key is designed to be used by the browser. Row Level Security policies in the supplied SQL limit write operations to authorized admins.

## 2. Create the database tables and security policies

1. In Supabase, open **SQL Editor**.
2. Open the local `supabase-schema.sql` file and copy its contents into a new SQL query.
3. Run the query.
4. Confirm `menu_items` and `admins` appear under **Table Editor**.
5. Open `seed-menu.sql`, copy its contents into a new SQL Editor query, and run it to import the 218 dishes transcribed from your supplied PDF. The import uses the menu's category names and preserves the two listed prices for Tandoori Chicken and Sambar Rice.

## 3. Create your admin account

1. In Supabase, open **Authentication → Users**.
2. Add a user with an email address you control and a strong password. Keep account creation restricted; this website has no public sign-up page.
3. Copy that user's UUID.
4. In **SQL Editor**, run this command with the real UUID:

   ```sql
   insert into public.admins (user_id)
   values ('PASTE_REAL_AUTH_USER_UUID_HERE');
   ```

5. Open `admin.html` on your deployed site and sign in with that account.
6. Add only confirmed menu details and current prices.

If you create another admin later, repeat the insert with their Auth user UUID.

## 4. Test locally

Because Supabase is accessed from the browser, you can use a local web server instead of opening the HTML file directly. If Python is installed, open a terminal in this project folder and run:

```bash
python -m http.server 8000
```

Then visit:
- Customer menu: http://localhost:8000/
- Admin dashboard: http://localhost:8000/admin.html

If login works but data access fails, check that the SQL ran successfully, the admin UUID was added, and the project URL/key are correct.

## 5. Publish free with GitHub Pages

1. Create a **public** GitHub repository, for example `adbhutaaharam-qr-menu`.
2. Upload the project files and folders while preserving their structure.
3. Open repository **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/(root)`, then save.
5. Wait for GitHub Pages to publish. The public URL will look like:
   `https://YOUR-GITHUB-USERNAME.github.io/adbhutaaharam-qr-menu/`
6. Test the public menu and admin page. Use your actual published URL when generating the QR code.

The exact public URL depends on your GitHub username and repository name; do not print the QR code until the URL is final.

## 6. Generate and print the QR code

1. Open a QR code generator you trust.
2. Paste the final public menu URL (the `index.html` page, not `admin.html`).
3. Download a high-resolution QR code and test it with multiple phones.
4. Print it on a table stand with a short label such as **“Scan to view our menu”**.

Keep the public URL stable. You can update dishes in the admin dashboard without changing the QR code.

## 7. Important notes

- Supabase's free plan and limits can change; check its current pricing before deployment.
- Use strong unique passwords and keep admin access limited to trusted staff.
- Only add real dish names, current prices, accurate descriptions, and authorized images.
- The first version is a menu viewer, not an ordering/payment system.
- Before launch, test the menu on mobile, verify price formatting, check image links, and confirm that a non-admin account cannot make changes.
- For a custom domain, connect the domain after the first version is working.


## Dish photos

Every customer menu card displays a photo. Add a verified dish-specific image URL in the admin form for the most accurate result. If no URL is saved, the menu requests a food image using the dish name and category. Third-party image services are not guaranteed to return an exact match, so check images before publishing.

## Brand colours

Forest green `#173D2B`, antique gold `#D6B568`, and warm ivory `#FFF8E9`.
