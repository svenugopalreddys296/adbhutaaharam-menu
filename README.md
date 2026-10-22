# Adbhutaaharam QR Digital Menu

A mobile-first digital restaurant menu with a Supabase-powered admin dashboard.

## Included
- `index.html` — public customer menu with the supplied Adbhutaaharam cover image as the landing-page hero
- `admin.html` — admin sign-in and menu management
- `css/style.css` — responsive styling, hover states, and reduced-motion-friendly animations
- `js/config.js` — Supabase project configuration placeholders
- `js/menu.js` — public menu and category filters (no search or online ordering)
- `js/admin.js` — admin login and menu item CRUD
- `supabase-schema.sql` — database tables and row-level security policies
- `SETUP.md` — step-by-step setup, deployment, and QR printing instructions

## Brand asset

The user-provided cover image is stored at `assets/adbhutaaharam-cover.jpg` and displayed prominently on the customer landing page. Hover effects and subtle entrance animations are included; devices that request reduced motion receive minimized animations.

## Start here
Follow [`SETUP.md`](SETUP.md) before using the application.

## Important
This repository intentionally contains no invented menu items or prices. Do not add real menu information until it has been confirmed by the restaurant. Never put a Supabase `service_role` key in frontend code.


## Imported menu

The supplied restaurant PDF has been transcribed into `seed-menu.sql` (218 menu items) and `menu-from-pdf.csv` for review. Run `supabase-schema.sql` first, then `seed-menu.sql` in Supabase SQL Editor. Items marked **Must Try** in the PDF are flagged on the customer menu. Multiple prices in the source are displayed as written rather than guessed.


## Visual design

The site uses forest green (`#173D2B`), antique gold (`#D6B568`), and warm ivory (`#FFF8E9`). The landing page uses the restaurant cover/logo artwork. Menu cards display a photo for each dish: an admin-provided image URL is preferred; otherwise the page requests a food image using the dish name and category. Review automatically sourced images before public launch because third-party photo services may return an approximate match.

The customer page has category browsing only—no search, availability controls, cart, checkout, or online ordering. Guests choose dishes and tell the waiter.
