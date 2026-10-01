import HomeComponent from "../page/dashboard/home/home.component";
import UserComponent from "../page/dashboard/user/UserComponent";
import ActivityLogComponent from "../page/dashboard/log/ActivityLogComponent";
import AccountPage from "../page/dashboard/account/AccountPage";
import WarehouseComponent from "../page/dashboard/setup/WarehouseComponent";
import SettingComponent from "../page/dashboard/setup/SettingComponent";
import ExchangeRateComponent from "../page/dashboard/setup/ExchangeRateComponent";
import PaymentMethodComponent from "../page/dashboard/setup/PaymentMethodComponent";
import UnitComponent from "../page/dashboard/product/UnitComponent";
import CategoryComponent from "../page/dashboard/product/CategoryComponent";
import AttributeComponent from "../page/dashboard/product/AttributeComponent";
import BrandComponent from "../page/dashboard/product/BrandComponent";
import ProductComponent from "../page/dashboard/product/ProductComponent";
import PriceComponent from "../page/dashboard/product/PriceComponent";
import StockBalanceComponent from "../page/dashboard/stock/StockBalanceComponent";
import MovementComponent from "../page/dashboard/stock/MovementComponent";
import ExpiryComponent from "../page/dashboard/stock/ExpiryComponent";
import TransferComponent from "../page/dashboard/stock/TransferComponent";
import ReceiveComponent from "../page/dashboard/stock/ReceiveComponent";
import AdjustmentComponent from "../page/dashboard/stock/AdjustmentComponent";
import OpeningComponent from "../page/dashboard/stock/OpeningComponent";
import SupplierComponent from "../page/dashboard/purchase/SupplierComponent";
import TelegramComponent from "../page/dashboard/telegram/TelegramComponent";
import { ACCESS } from "../page/util/permission";
import {
  LayoutDashboard,
  Users,
  History,
  User,
  Settings2,
  Warehouse,
  SlidersHorizontal,
  ArrowRightLeft,
  Wallet,
  Package,
  Ruler,
  FolderTree,
  Palette,
  Shirt,
  BadgeCheck,
  Tag,
  Boxes,
  PackageSearch,
  CalendarClock,
  Truck,
  PackagePlus,
  ClipboardPen,
  ArchiveRestore,
  ListOrdered,
  Factory,
  Send,
} from "lucide-react";

import { L } from "../i18n";
// Sidebar menu + routes. Each module adds its entry here (access → page/util/permission.js).
// section: sidebar heading — menu | warehouse | connect | system (SECTIONS in page/theme/default/theme.component.jsx)
// Order (Phase 1): Setup (warehouse, setting, exchange rate, payment method) → Product (unit, category, attribute, product, price)
class RouteScript {
  routeDashboard() {
    return [
      {
        is_show_sidebar: true,
        section: "menu",
        is_can_access_route: true,
        name: L("ទិន្នន័យសង្ខេប", "Dashboard"),
        icon: <LayoutDashboard />,
        component: <HomeComponent />,
        url: "home",
        subtitle: L("សង្ខេបឃ្លាំង ហាង និងការរៀបចំប្រព័ន្ធ", "Warehouses, shops and system setup at a glance"),
        access: ACCESS.ALL,
        type: "index",
        breadcrumb: [
          { name: L("ទំព័រដើម", "Home"), url: null },
          { name: L("ទិន្នន័យសង្ខេប", "Dashboard"), url: null },
        ],
        child: [],
      },
      {
        // ---------------- Setup ----------------
        is_show_sidebar: true,
        section: "warehouse",
        is_can_access_route: true,
        name: L("ការរៀបចំ", "Setup"),
        icon: <Settings2 />,
        component: null,
        url: "setup",
        access: ACCESS.MASTER,
        type: null,
        breadcrumb: [],
        child: [
          [
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ឃ្លាំង / ហាង", "Warehouses / Shops"),
              icon: <Warehouse size={18} />,
              component: <WarehouseComponent />,
              url: "warehouse",
              subtitle: L("ឃ្លាំងកណ្តាល និងហាងដែលមាន POS", "Central warehouses and shops with a POS"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ការរៀបចំ", "Setup"), url: null },
                { name: L("ឃ្លាំង / ហាង", "Warehouses / Shops"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("អត្រាប្តូរប្រាក់", "Exchange rate"),
              icon: <ArrowRightLeft size={18} />,
              component: <ExchangeRateComponent />,
              url: "exchange-rate",
              subtitle: L("អត្រា USD → KHR និងប្រវត្តិ", "USD → KHR rate and history"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ការរៀបចំ", "Setup"), url: null },
                { name: L("អត្រាប្តូរប្រាក់", "Exchange rate"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("វិធីបង់ប្រាក់", "Payment methods"),
              icon: <Wallet size={18} />,
              component: <PaymentMethodComponent />,
              url: "payment-method",
              subtitle: L("វិធីបង់ប្រាក់ដែលបង្ហាញលើ POS", "Payment methods shown on the POS"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ការរៀបចំ", "Setup"), url: null },
                { name: L("វិធីបង់ប្រាក់", "Payment methods"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ការកំណត់ទូទៅ", "General settings"),
              icon: <SlidersHorizontal size={18} />,
              component: <SettingComponent />,
              url: "setting",
              subtitle: L("ព័ត៌មានក្រុមហ៊ុន ពន្ធ វិក្កយបត្រ និងការជូនដំណឹងស្តុក", "Company, tax, receipt and stock alerts"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ការរៀបចំ", "Setup"), url: null },
                { name: L("ការកំណត់ទូទៅ", "General settings"), url: null },
              ],
              child: [],
            },
          ],
        ],
      },
      {
        // ---------------- Product ----------------
        is_show_sidebar: true,
        section: "warehouse",
        is_can_access_route: true,
        name: L("ទំនិញ", "Products"),
        icon: <Package />,
        component: null,
        url: "product",
        access: ACCESS.MASTER,
        type: null,
        breadcrumb: [],
        child: [
          [
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("បញ្ជីទំនិញ", "Product list"),
              icon: <Shirt size={18} />,
              component: <ProductComponent />,
              url: "item",
              subtitle: L("ទំនិញ ប្រភេទរង (ទំហំ / ពណ៌) ឯកតា និងបាកូដ", "Products, variants (size / color), units and barcodes"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ទំនិញ", "Products"), url: null },
                { name: L("បញ្ជីទំនិញ", "Product list"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("តម្លៃលក់", "Prices"),
              icon: <Tag size={18} />,
              component: <PriceComponent />,
              url: "price",
              subtitle: L("តម្លៃលក់លំនាំដើម តម្លៃពិសេសតាមហាង និងប្រវត្តិ", "Default sale prices, special shop prices and history"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ទំនិញ", "Products"), url: null },
                { name: L("តម្លៃលក់", "Prices"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ប្រភេទទំនិញ", "Categories"),
              icon: <FolderTree size={18} />,
              component: <CategoryComponent />,
              url: "category",
              subtitle: L("ក្រុមទំនិញជាលំដាប់ (មេ → កូន)", "Product groups as a tree (parent → child)"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ទំនិញ", "Products"), url: null },
                { name: L("ប្រភេទទំនិញ", "Categories"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ឯកតា", "Units"),
              icon: <Ruler size={18} />,
              component: <UnitComponent />,
              url: "unit",
              subtitle: L("ដុំ កញ្ចប់ ប្រអប់ … សម្រាប់ទំនិញ", "Piece, pack, box … for products"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ទំនិញ", "Products"), url: null },
                { name: L("ឯកតា", "Units"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("លក្ខណៈ (ទំហំ / ពណ៌)", "Attributes (size / color)"),
              icon: <Palette size={18} />,
              component: <AttributeComponent />,
              url: "attribute",
              subtitle: L("ទំហំ និងពណ៌សម្រាប់បំបែកទំនិញជាប្រភេទរង (variant)", "Sizes and colors used to split products into variants"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ទំនិញ", "Products"), url: null },
                {
                  name: L("លក្ខណៈ (ទំហំ / ពណ៌)", "Attributes (size / color)"),
                  url: null,
                },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ម៉ាក", "Brands"),
              icon: <BadgeCheck size={18} />,
              component: <BrandComponent />,
              url: "brand",
              subtitle: L("Pampers, Huggies, Johnson's …", "Pampers, Huggies, Johnson's …"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ទំនិញ", "Products"), url: null },
                { name: L("ម៉ាក", "Brands"), url: null },
              ],
              child: [],
            },
          ],
        ],
      },
      {
        // ---------------- Stock ----------------
        is_show_sidebar: true,
        section: "warehouse",
        is_can_access_route: true,
        name: L("ស្តុក", "Stock"),
        icon: <Boxes />,
        component: null,
        url: "stock",
        access: ACCESS.MASTER,
        type: null,
        breadcrumb: [],
        child: [
          [
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ស្តុកនៅសល់", "Stock on hand"),
              icon: <PackageSearch size={18} />,
              component: <StockBalanceComponent />,
              url: "balance",
              subtitle: L("ចំនួនស្តុកតាមទំនិញ និងឃ្លាំង ស្តុកទាប និងតម្លៃស្តុក", "Quantity per item and warehouse, low stock and stock value"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("ស្តុកនៅសល់", "Stock on hand"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ផ្ទេរស្តុក", "Transfers"),
              icon: <Truck size={18} />,
              component: <TransferComponent />,
              url: "transfer",
              subtitle: L("ស្នើសុំ បញ្ជូន និងទទួលស្តុករវាងឃ្លាំង និងហាង", "Request, dispatch and receive stock between warehouses and shops"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("ផ្ទេរស្តុក", "Transfers"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ទទួលទំនិញ", "Goods receive"),
              icon: <PackagePlus size={18} />,
              component: <ReceiveComponent />,
              url: "receive",
              subtitle: L("ទទួលទំនិញពីអ្នកផ្គត់ផ្គង់ចូលឃ្លាំងកណ្តាល", "Goods from suppliers into the central warehouse"),
              access: ACCESS.VIEW_ALL,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("ទទួលទំនិញ", "Goods receive"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("កែតម្រូវស្តុក", "Adjustments"),
              icon: <ClipboardPen size={18} />,
              component: <AdjustmentComponent />,
              url: "adjustment",
              subtitle: L("ខូចខាត ផុតកំណត់ បាត់ ឬរកឃើញ", "Damaged, expired, lost or found"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("កែតម្រូវស្តុក", "Adjustments"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ជិតផុតកំណត់", "Near expiry"),
              icon: <CalendarClock size={18} />,
              component: <ExpiryComponent />,
              url: "expiry",
              subtitle: L("Batch ដែលជិតផុតកំណត់ (FEFO)", "Batches close to their expiry date (FEFO)"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("ជិតផុតកំណត់", "Near expiry"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ចលនាស្តុក", "Movements"),
              icon: <ListOrdered size={18} />,
              component: <MovementComponent />,
              url: "movement",
              subtitle: L("ប្រវត្តិស្តុកចូល / ចេញទាំងអស់", "Every stock in / out (ledger)"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("ចលនាស្តុក", "Movements"), url: null },
              ],
              child: [],
            },
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("ស្តុកដើមគ្រា", "Opening stock"),
              icon: <ArchiveRestore size={18} />,
              component: <OpeningComponent />,
              url: "opening",
              subtitle: L("ស្តុកដែលមានពេលចាប់ផ្តើមប្រើប្រព័ន្ធ (Excel)", "Stock on the shelves at go-live (Excel import)"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ស្តុក", "Stock"), url: null },
                { name: L("ស្តុកដើមគ្រា", "Opening stock"), url: null },
              ],
              child: [],
            },
          ],
        ],
      },
      {
        // ---------------- Purchase ----------------
        is_show_sidebar: true,
        section: "warehouse",
        is_can_access_route: true,
        name: L("ការទិញ", "Purchase"),
        icon: <Factory />,
        component: null,
        url: "purchase",
        access: ACCESS.MASTER,
        type: null,
        breadcrumb: [],
        child: [
          [
            {
              is_show_sidebar: true,
              is_can_access_route: true,
              name: L("អ្នកផ្គត់ផ្គង់", "Suppliers"),
              icon: <Factory size={18} />,
              component: <SupplierComponent />,
              url: "supplier",
              subtitle: L("អ្នកផ្គត់ផ្គង់ និងអ្នកចែកចាយ", "Suppliers and distributors"),
              access: ACCESS.MASTER,
              type: "index",
              breadcrumb: [
                { name: L("ការទិញ", "Purchase"), url: null },
                { name: L("អ្នកផ្គត់ផ្គង់", "Suppliers"), url: null },
              ],
              child: [],
            },
          ],
        ],
      },
      {
        // ---------------- Telegram (admin only) ----------------
        is_show_sidebar: true,
        section: "connect",
        is_can_access_route: true,
        name: L("តេឡេក្រាម", "Telegram"),
        icon: <Send />,
        component: <TelegramComponent />,
        url: "telegram",
        subtitle: L("Bot ក្រុម ការជូនដំណឹង និងរបាយការណ៍តាមម៉ោង", "Bots, groups, notifications and scheduled reports"),
        access: ACCESS.ADMIN,
        type: "index",
        breadcrumb: [{ name: L("តេឡេក្រាម", "Telegram"), url: null }],
        child: [],
      },
      {
        is_show_sidebar: true,
        section: "system",
        is_can_access_route: true,
        name: L("អ្នកប្រើប្រាស់", "Users"),
        icon: <Users />,
        component: <UserComponent />,
        url: "users",
        subtitle: L("គណនី តួនាទី ហាង និងលេខ PIN សម្រាប់ POS", "Accounts, roles, shops and POS PINs"),
        access: ACCESS.ADMIN,
        type: "index",
        breadcrumb: [{ name: L("អ្នកប្រើប្រាស់", "Users"), url: null }],
        child: [],
      },
      {
        is_show_sidebar: true,
        section: "system",
        is_can_access_route: true,
        name: L("កំណត់ត្រាសកម្មភាព", "Activity log"),
        icon: <History />,
        component: <ActivityLogComponent />,
        url: "activity-log",
        subtitle: L("អ្នកណាបានធ្វើអ្វី នៅពេលណា", "Who did what, and when"),
        access: ACCESS.ADMIN,
        type: "index",
        breadcrumb: [{ name: L("កំណត់ត្រាសកម្មភាព", "Activity log"), url: null }],
        child: [],
      },
      {
        // opened from the L("គណនី", "Account") button under the e-mail (not listed in the sidebar menu)
        is_show_sidebar: false,
        is_can_access_route: true,
        name: L("គណនីរបស់ខ្ញុំ", "My account"),
        icon: <User />,
        component: <AccountPage />,
        url: "account",
        subtitle: L("ព័ត៌មានគណនី និងប្តូរពាក្យសម្ងាត់", "Your account and password"),
        access: ACCESS.ALL,
        type: "index",
        breadcrumb: [{ name: L("គណនីរបស់ខ្ញុំ", "My account"), url: null }],
        child: [],
      },
    ];
  }
}

export default RouteScript;
