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
| កំណត់ត្រាសកម្មភាព (Activity log) | `/activity-log` | admin |
| គណនីរបស់ខ្ញុំ (My account) | `/account` | everyone |
| ការរៀបចំ (Setup): warehouse, exchange rate, payment method, setting | `/setup/...` | view: web roles · edit: admin |
| ទំនិញ (Products): product list, prices, categories, units, attributes, brands | `/product/item`, `/product/price`, `/product/category`, `/product/unit`, `/product/attribute`, `/product/brand` | view: web roles · edit: admin, central manager |
| ស្តុក (Stock): on hand, transfers, goods receive, adjustments, near expiry, movements, opening stock | `/stock/...` | view: web roles (goods receive: central roles) · shop manager: own shop, request / receive transfers, draft adjustments |
| ការទិញ (Purchase): suppliers | `/purchase/supplier` | edit: admin, central manager |
| Telegram: bots, groups / chats, scheduled reports, message text, sent messages | `/telegram#bot` … `#message` | admin |

Product list (`page/dashboard/product/ProductComponent.jsx` + `ProductEditor.jsx`): search also finds SKU / barcode, filters by category (with sub-categories), brand and batch; each row expands to show its variants. The editor has 4 sections — general, units (base + bigger units with factor), variants (pick attributes and values → every combination becomes a variant with SKU, barcode per unit, min stock, active) and stock / sale settings.

Prices (`PriceComponent.jsx`): pick a product on the left → grid of variants × sale units. Switch between the default price and each shop (special price; empty = default). "Edit prices" turns the grid into inputs (with "fill all" per unit) and saves only the changed cells in one bulk call, starting now or at a chosen date/time. Click a price to see its history; upcoming prices can be deleted there.

Stock documents share `page/dashboard/stock/StockDocPage.jsx` (list + editor + detail): scan a barcode / type a SKU in the editor (`VariantPicker`), pick the unit (box → base qty shown), cost, batch + expiry, or a batch for outgoing lines (default FEFO). On-hand of the source warehouse is shown per line. Opening stock imports Excel (`read-excel-file` / `write-excel-file`): download the template with every SKU, fill qty / cost / batch, upload → draft → post. Shop managers never see cost.

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

Tabs: Dashboard · Items & stock · Transfers · Adjustments · Near expiry · Movements · Staff · Sales (Phase 3). The stock screens are the same components as the admin web; inside the portal they read the warehouse from `PortalContext` and lock to it.

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
