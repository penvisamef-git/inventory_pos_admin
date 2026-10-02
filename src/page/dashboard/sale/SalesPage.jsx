import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, ReceiptText, Wallet, RefreshCw } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import Select from "../../util/Select";
import SaleReport from "./SaleReport";
import SaleList from "./SaleList";
import ShiftList from "./ShiftList";
import { PRESETS, presetRange, nm } from "./saleUtil";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./sale.style.css";

const TABS = [
  ["report", BarChart3, L("របាយការណ៍", "Report")],
  ["invoice", ReceiptText, L("វិក្កយបត្រ", "Invoices")],
  ["shift", Wallet, L("វេនលុយ", "Cash shifts")],
];
const TAB_KEY = "sale_tab";

// Sales from the POS — admin web (all shops) and shop portal (this shop).
function SalesPage() {
  const portal = usePortal();
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) || "report";
    } catch {
      return "report";
    }
  });
  const [preset, setPreset] = useState("today");
  const [f, setF] = useState({ ...presetRange("today"), warehouse_id: portal?._id || "", device_id: "", cashier_id: "", method: "" });
  const [opts, setOpts] = useState({ shops: [], devices: [], cashiers: [], methods: [], cost: false });
  const [tick, setTick] = useState(0); // refresh button

  useEffect(() => {
    if (portal) setF((x) => ({ ...x, warehouse_id: portal._id, device_id: "", cashier_id: "" }));
  }, [portal]);
  useEffect(() => {
    saleService.filters(f.warehouse_id ? { warehouse_id: f.warehouse_id } : {}).then((r) => setOpts(r.data || {})).catch(() => {});
  }, [f.warehouse_id]);

  const pickTab = (t) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // ignore
    }
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === "warehouse_id" ? { device_id: "", cashier_id: "" } : {}) }));
  const choosePreset = (k) => {
    setPreset(k);
    setF((x) => ({ ...x, ...presetRange(k) }));
  };
  const devices = useMemo(() => (opts.devices || []).filter((d) => !f.warehouse_id || String(d.warehouse_id) === String(f.warehouse_id)), [opts.devices, f.warehouse_id]);
  const params = useMemo(() => {
    const p = { from: f.from, to: f.to };
    ["warehouse_id", "device_id", "cashier_id", "method"].forEach((k) => f[k] && (p[k] = f[k]));
    if (tab === "shift") delete p.cashier_id;
    if (tab !== "invoice") delete p.method;
    return p;
  }, [f, tab]);

  return (
    <div className="md-page sl">
      <div className="sl-tabs">
        {TABS.map(([k, Icon, label]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => pickTab(k)}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      <div className="md-toolbar sl-filters">
        <div className="md-toolbar-left">
          <div className="sl-presets">
            {PRESETS.map(([k, label]) => (
              <button key={k} type="button" className={preset === k ? "on" : ""} onClick={() => choosePreset(k)}>{label}</button>
            ))}
          </div>
          <input type="date" className="md-filter" value={f.from} max={f.to} onChange={(e) => { setPreset(""); set("from", e.target.value); }} />
          <span className="sl-dash">–</span>
          <input type="date" className="md-filter" value={f.to} min={f.from} onChange={(e) => { setPreset(""); set("to", e.target.value); }} />
          {!portal && (
            <Select className="md-filter" value={f.warehouse_id} onChange={(e) => set("warehouse_id", e.target.value)}>
              <option value="">{L("-- គ្រប់ហាង --", "-- All shops --")}</option>
              {(opts.shops || []).filter((w) => w.type !== "central").map((w) => <option key={w._id} value={w._id}>{w.code} · {nm(w)}</option>)}
            </Select>
          )}
          <Select className="md-filter" value={f.device_id} onChange={(e) => set("device_id", e.target.value)}>
            <option value="">{L("-- គ្រប់ POS --", "-- All POS --")}</option>
            {devices.map((d) => <option key={d._id} value={d._id}>{d.code} · {d.name}</option>)}
          </Select>
          {tab !== "shift" && (
            <Select className="md-filter" value={f.cashier_id} onChange={(e) => set("cashier_id", e.target.value)}>
              <option value="">{L("-- គ្រប់អ្នកគិតលុយ --", "-- All cashiers --")}</option>
              {(opts.cashiers || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          )}
          {tab === "invoice" && (
            <Select className="md-filter" value={f.method} onChange={(e) => set("method", e.target.value)}>
              <option value="">{L("-- គ្រប់វិធីបង់ --", "-- All payments --")}</option>
              {(opts.methods || []).map((m) => <option key={m.code} value={m.code}>{nm(m)}</option>)}
            </Select>
          )}
          <button type="button" className="md-btn md-btn-ghost" onClick={() => setTick((t) => t + 1)} title={L("ផ្ទុកឡើងវិញ", "Refresh")}><RefreshCw size={16} /></button>
        </div>
      </div>

      {tab === "report" && <SaleReport params={params} tick={tick} cost={opts.cost} portal={!!portal} onPick={(k, v) => set(k, v)} onOpenInvoices={() => pickTab("invoice")} />}
      {tab === "invoice" && <SaleList params={params} tick={tick} cost={opts.cost} portal={!!portal} />}
      {tab === "shift" && <ShiftList params={params} tick={tick} portal={!!portal} />}
    </div>
  );
}

export default SalesPage;
