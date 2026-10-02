import Auth from "../../util/auth";
import { ACCESS, canAccess, scopeOf } from "../../util/permission";
import { L } from "../../../i18n";

export { nameKh, nameOther, labelOf } from "../setup/setupOptions";

const login = () => new Auth().getClientLogin();
// admin / central manager: opening, goods receive, post adjustments, dispatch from central
export const canManageStock = () => canAccess(login(), ACCESS.PRODUCT);
// shop manager (own shops only): request / receive transfers, draft adjustments
export const isShopUser = () => scopeOf(login()) === "own";
export const myWarehouseIds = () => (login()?.warehouse_ids || []).map((w) => String(w?._id || w));

export const STATE = {
  draft: { label: L("សេចក្តីព្រាង", "Draft"), badge: "md-badge-off" },
  requested: { label: L("ស្នើសុំ", "Requested"), badge: "md-badge-gold" },
  posted: { label: L("បាន Post", "Posted"), badge: "md-badge-on" },
  dispatched: { label: L("កំពុងដឹក", "In transit"), badge: "md-badge-gold" },
  received: { label: L("បានទទួល", "Received"), badge: "md-badge-on" },
  cancelled: { label: L("បានបោះបង់", "Cancelled"), badge: "md-badge-danger" },
  counting: { label: L("កំពុងរាប់", "Counting"), badge: "md-badge-gold" },
  submitted: { label: L("បានបញ្ជូន", "Submitted"), badge: "md-badge-gold sc-submitted" },
};
export const stateBadge = (s) => <span className={`md-badge ${STATE[s]?.badge || ""}`}>{STATE[s]?.label || s}</span>;

export const REASONS = [
  { value: "damaged", label: L("ខូចខាត", "Damaged"), dir: "out" },
  { value: "expired", label: L("ផុតកំណត់", "Expired"), dir: "out" },
  { value: "lost", label: L("បាត់", "Lost"), dir: "out" },
  { value: "found", label: L("រកឃើញ / លើស", "Found / extra"), dir: "in" },
  { value: "other", label: L("ផ្សេងៗ (+ ចូល / − ចេញ)", "Other (+ in / − out)"), dir: "both" },
  { value: "transfer_shortage", label: L("ខ្វះពេលផ្ទេរ", "Transfer shortage"), dir: "out", system: true },
  { value: "stock_count", label: L("រាប់ស្តុក", "Stock count"), dir: "both", system: true },
];

export const MOVE_TYPES = {
  opening: { label: L("ស្តុកដើមគ្រា", "Opening"), cls: "in" },
  purchase_in: { label: L("ទទួលទំនិញ", "Goods receive"), cls: "in" },
  transfer_out: { label: L("ផ្ទេរចេញ", "Transfer out"), cls: "out" },
  transfer_in: { label: L("ផ្ទេរចូល", "Transfer in"), cls: "in" },
  sale_out: { label: L("លក់", "Sale"), cls: "out" },
  refund_in: { label: L("ប្រគល់វិញ", "Refund"), cls: "in" },
  adjust_in: { label: L("កែតម្រូវ +", "Adjust +"), cls: "in" },
  adjust_out: { label: L("កែតម្រូវ −", "Adjust −"), cls: "out" },
};

export const qtyText = (n) => {
  const v = Number(n || 0);
  return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
};
export const usd = (v, dp = 2) => (v === null || v === undefined ? "-" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`);
export const dateOnly = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Phnom_Penh", day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
export const userName = (u) => (u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email : "-");
export const valueName = (v) => L(v?.name_kh || v?.name_en, v?.name_en || v?.name_kh);
export const unitLabel = (code, kh, en) => L(kh || en || code, en || kh || code);

// options chips (Size / Color …) of a variant
export const OptionChips = ({ options }) =>
  options?.length ? (
    <span className="md-values">
      {options.map((o) => (
        <span key={o.attribute_id || o.value_id} className="md-value">
          {o.color_hex && <i style={{ background: o.color_hex }} />}
          {valueName(o)}
        </span>
      ))}
    </span>
  ) : null;
