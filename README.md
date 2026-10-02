# Inventory POS Admin

Admin web for the Inventory + Warehouse + POS system (baby & kid products).
React (Create React App), same structure as the Le Blend / SDMS dashboard.
Talks to `inventory_pos_api` (`/api/admin`).

## Setup

```bash
npm install
# .env
#   REACT_APP_API_HOST=http://localhost:8086
#   REACT_APP_API_AUTH_KEY=<same as API_AUTH_KEY in the API .env>
#   REACT_APP_LOGIN_COOKIE_CLIENT_SRECRET_KEY=inventory_pos_admin_login
npm start                # http://localhost:3000
```

## Who can open the admin web

| Role | Scope | Admin web |
|---|---|---|
| Super admin / `អ្នកគ្រប់គ្រងប្រព័ន្ធ` | all warehouses | everything |
| `អ្នកគ្រប់គ្រងឃ្លាំងកណ្តាល` | all warehouses | products, prices, stock, transfers, reports |
| `គណនេយ្យករ` | all warehouses | view sales, cost, stock |
| `អ្នកគ្រប់គ្រងហាង` | own shop | own dashboard, sales, stock |
| `អ្នកគិតលុយ` | own shop | ❌ POS only — login is refused |

Access levels per screen: `ACCESS.ALL | MASTER | PRODUCT | VIEW_ALL | ADMIN` (`src/page/util/permission.js`).

## Screens

| Menu | Route | Who |
|---|---|---|
| ទិន្នន័យសង្ខេប (Dashboard) | `/home` | everyone |
| អ្នកប្រើប្រាស់ (Users) | `/users` | admin |
| កំណត់ត្រាសកម្មភាព (Activity log) | `/activity-log` (+ Shop portal tab) | admin / super admin: everyone (super admins never logged) · other roles: only their own |
| គណនីរបស់ខ្ញុំ (My account) | `/account` | everyone |
| ការរៀបចំ (Setup): warehouse, exchange rate, payment method | `/setup/...` | view: web roles · edit: admin |
| ការកំណត់ទូទៅ (General settings, in SYSTEM): system theme, company, tax, receipt, stock alerts | `/setting` | view: web roles · edit: admin |
| ទំនិញ (Products): product list, prices, categories, units, attributes, brands | `/product/item`, `/product/price`, `/product/category`, `/product/unit`, `/product/attribute`, `/product/brand` | view: web roles · edit: admin, central manager |
| ស្តុក (Stock): on hand, transfers, goods receive, adjustments, stock count, near expiry, movements, opening stock | `/stock/...` | view: web roles (goods receive: central roles) · shop manager: own shop, request / receive transfers, draft adjustments |
| ការទិញ (Purchase): suppliers | `/purchase/supplier` | edit: admin, central manager |
| Telegram: bots, groups / chats, scheduled reports, message text, sent messages | `/telegram#bot` … `#message` | admin |
| កូដ QR (QR Code, in CONNECT): public catalog links per shop / warehouse | `/qr` | admin, central manager |
| Public catalog (customers, **no login**) | `/c/:token` | anyone with the link |
| កំណត់ចំណាំ (Notes, in OTHER) | `/note` (+ Shop portal tab) | everyone: own notes · super admin: everyone's, can edit |

Product list (`page/dashboard/product/ProductComponent.jsx` + `ProductEditor.jsx`): search also finds SKU / barcode, filters by category (with sub-categories), brand and batch; each row expands to show its variants. The editor has 4 sections — general, units (base + bigger units with factor), variants (pick attributes and values → every combination becomes a variant with SKU, barcode per unit, min stock, active) and stock / sale settings.

Prices (`PriceComponent.jsx`): pick a product on the left → grid of variants × sale units. Switch between the default price and each shop (special price; empty = default). "Edit prices" turns the grid into inputs (with "fill all" per unit) and saves only the changed cells in one bulk call, starting now or at a chosen date/time. Click a price to see its history; upcoming prices can be deleted there.

Stock documents share `page/dashboard/stock/StockDocPage.jsx` (list + editor + detail): scan a barcode / type a SKU in the editor (`VariantPicker`), pick the unit (box → base qty shown), cost, batch + expiry, or a batch for outgoing lines (default FEFO). On-hand of the source warehouse is shown per line. Opening stock imports Excel (`read-excel-file` / `write-excel-file`): download the template with every SKU, fill qty / cost / batch, upload → draft → post. Shop managers never see cost.

**Product import / export (Excel)** — `product/ProductImport.jsx`, button *Excel* on the product list (admin, central manager): download an empty template (sheets *Products*, *Help*, *Lists* with every code) or **all products** to edit · choose the file → it is checked on the server first (new / update / errors with the Excel row) → *Save* (products with errors are skipped). Sent ~50 products per request; create + update by `product_code`, never deletes.

**Stock count** — `stock/StockCountComponent.jsx` (`/stock/count`, portal tab *Stock count*): *Start a count* (warehouse + optional category) → counting screen: scan a barcode / type a SKU + Enter = +1 (batch items: jumps to the batch lines), type quantities, filter *Not counted / Counted*, *Add item* for things not on the list; saves by itself 2–3 s after typing. *Submit* (not counted: skip or count as 0) → review with System / Counted / Difference (+ value for central) → central *Post to stock* (one `stock_count` adjustment) or *Reopen*. **Blind**: nobody sees the system qty while counting.

**QR code / public catalog** — `page/dashboard/qr/QrCodeComponent.jsx` (`/qr`): make a link for a shop or warehouse (optionally one category) → card with the QR, on / off switch, views, *Copy link*, *Open*, *New link* (old QR stops), delete. Click the QR for a big one, **QR .png** (1024 px) or an **A4 poster** (Khmer + English "scan to see our items", shop name, link). The link is `<this website>/c/<token>` (or `REACT_APP_CATALOG_URL` + `/c/<token>` when the catalog gets its own domain).

The customer page `page/catalog/CatalogPage.jsx` (`/c/:token`, outside the login): shop header (logo, name, phone, address), search, category chips, *In stock only*, product cards (picture, brand, price or range, colour dots / sizes, status *In stock / Few left / Out of stock*), tap → item sheet with every option, its price and status, *Call the shop*. Khmer / English switch of its own, more items load while scrolling, always light, accent colour = the system theme. Never shows quantities or cost.

**Notes** — `page/dashboard/note/NoteComponent.jsx` (`/note`, menu group **OTHER** under CONNECT, and a Shop portal tab): like the notes app on a phone — list on the left (search, pinned first, colour, last edit time), the note on the right (title, text, 6 colours, pin, delete). It saves by itself while typing (0.8 s after the last key) and before leaving the page. Everyone sees only their own notes; a super admin sees everyone's with a person filter and can edit them (a yellow bar shows whose note it is). On phones the list and the note take turns on the screen.

**Print / PDF (A4)** — `page/print/PrintDoc.jsx`, route `/print/:type/:id` (opens in a new tab and starts printing; *Save as PDF* in the print dialog): transfer, goods receive, adjustment, opening stock (*Print* button in the document view) and stock count (blank count sheet while counting, results after). Bilingual Khmer / English, company header from General settings, signature boxes; black on white in every theme; shop managers' prints have no cost.

Telegram (`page/dashboard/telegram/`, one page with 5 tabs): **Bots** — add with the @BotFather token (stored encrypted, only a hint is shown), test, 🔍 *Find chats* lists the groups that wrote to the bot and adds them in one click · **Groups / chats** — bot, chat ID, language (Khmer / English / both), warehouses (none = all), which events, send a test message · **Scheduled reports** — reports × chats × times × days, preview with real data, *Send now* · **Message text** — edit the Khmer / English text of each event, click a `{placeholder}` to insert it, live preview · **Sent messages** — counts per state, filter by chat, open a message, send failed ones again.

**Send to Telegram (one click)** — `telegram/SendTelegram.jsx` (`SendTelegramButton`), admin + central manager only: a *Telegram* button on Stock on hand (low stock or summary, with the current warehouse / category filter), Near expiry (with the chosen days), Transfers and Adjustments (pending work) and the Telegram page. The box ticks the right report and shops, remembers the last groups (this browser), shows a live preview, takes an optional own message, and sends at once through the bot.

Phase 1 (master data) and Phase 2 (stock) are complete. Next: Phase 3 — POS.

## Shop portal — `/shop/:code/...`

A second layout in the same app (top header + tabs, no admin sidebar) for **one warehouse at a time** (`page/portal/`).

| Who | Lands on | Can |
|---|---|---|
| Shop manager | `/shop` (never the admin web) | own shop(s): dashboard, items & stock (with sale price), transfers (request / receive), adjustments (draft), near expiry, movements, staff (add / disable cashiers, password, POS PIN) |
| Central manager | admin web, **Shop dashboard** button → `/shop` | any warehouse (switcher), same pages; WH01 has no staff tab |
| Admin / super admin | admin web, **Shop dashboard** button | any warehouse, full actions |

Tabs: Dashboard · Items & stock · Transfers · Adjustments · Stock count · Near expiry · Movements · Activity log (own) · Notes · Staff · Sales (Phase 3). The stock screens are the same components as the admin web; inside the portal they read the warehouse from `PortalContext` and lock to it.

## Global search

Top bar **Search…** button, or **Ctrl + K** / **⌘K** / **/** anywhere (`page/theme/default/GlobalSearch.jsx`).
- Pages: the user's own menu (from the routes), searched in the browser.
- Data: `GET /search?q=` → SKUs / barcodes (a scanned barcode goes first), products, stock documents (TR / GR / ADJ / OB numbers), warehouses, suppliers, categories, brands, users — only what the user may open.
- ↑ ↓ Enter Esc; last 6 picks remembered. A result opens the list page with `?q=` filled in (`page/util/useUrlQuery.js`) or a document with `?open=<id>`.

## Searchable selects

Every dropdown uses `page/util/Select.jsx` — same props as `<select>` (value, onChange(e → e.target.value), disabled, className, `<option>` children), so new screens just write `<Select>` instead of `<select>`. It keeps the page's own select style but opens a themed list: search box from 6 options up (ignores case and the "— " of category trees), ↑ ↓ Enter Esc, typing on a closed select starts the search, works inside dialogs and on phones.

## Themes

Admin → SYSTEM → General settings (`/setting`) → **System theme**: Forest, Ocean, Candy, Navy & Gold — one theme for everyone (admin web, shop portal, login page); light / dark stays each user's choice.
- `src/page/theme/themes.js` — each theme: light + dark palette (CSS variables `--color-*`), corner scale (`--ui-radius`), font (`--font-*`, loaded on demand).
- `src/page/theme/themes.css` — a few look tweaks per theme (`html[data-skin="navy"] …`). All `border-radius` in the CSS use `calc(Npx * var(--ui-radius, 1))`, round pills `var(--ui-pill, 999px)`.
- `color.script.js` → `setSkin(key)`; the browser remembers the last theme (instant at start) and follows `GET /setup/theme` (no login needed).
- New theme: copy a block in `themes.js` + add its key to `UI_THEMES` in the API setting model.

## Speed (caching)

- `src/api/api.client.js` — **lookup lists** (`…-all`, category tree, current rate, roles) are reused for 60 s; **tables / pages** are stale-while-revalidate: `service.list(params, { onFresh })` shows the last copy of that page (≤ 5 min) at once and refreshes it quietly, `{ prefetch: true }` pre-loads the next page. Any save (POST / PUT / DELETE) clears everything. Used by every table (MasterDataPage, StockDocPage, products, prices, stock on hand, movements, near expiry, users, activity log, shop portal dashboard / staff). Page copies are also kept in the tab's sessionStorage (≤ 3 MB), so a refresh (F5) shows tables at once.
- Dashboard home: one request (`GET /dashboard/summary`); the last numbers show at once on return.
- Each screen is its own JS file (`routes/lazyPage.js`, auto reload once after a new deploy); after login all screens' files download in the background (`preloadPages`).
- `firebase.json`: `/static/**` cached 1 year (file names change on each build), pages `no-cache`.

## Structure

```
src/
  api/            api.client.js (fetch + x-api-key + token), api.service.js (all endpoints, createResource)
  routes/         route.script.js (menu + access), route.component.jsx (guards)
  page/
    login/        login page (cashier is refused)
    theme/default theme (sidebar, header, breadcrumb, logout) + color.script.js
    util/         auth.js (encrypted login in localStorage), permission.js (ACCESS, scope)
    decor/        KidsDecor.jsx (SVG blocks / bottle / duck + Star)
    dashboard/
      master_data/MasterDataPage.jsx   shared list + create/edit/delete page (FIELDS + COLUMNS)
      setup/      warehouse, setting, exchange rate, payment method
      product/    product list + editor, category, unit, attribute, brand (product.style.css)
      stock/      stock documents (StockDocPage), on hand, movements, expiry, opening (Excel)
    portal/       Shop portal: PortalLayout (header, switcher, tabs), PortalDashboard, PortalStaff, portalContext
      home/ user/ log/ account/
```

Change colours in `src/page/theme/default/color.script.js`.

## Deploy (Firebase Hosting)

`.firebaserc` must point to the Inventory POS Firebase project (not `le-blend-menu`) before `firebase deploy`.
