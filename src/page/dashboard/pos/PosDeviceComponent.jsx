import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, Monitor, Plus, RefreshCw, Trash2, Wifi, WifiOff, X } from "lucide-react";
import { posDeviceService, warehouseService } from "../../../api/api.service";
import { nameKh } from "../setup/setupOptions";
import { dateTimeText } from "../master_data/MasterDataPage";
import { L } from "../../../i18n";
import Select from "../../util/Select"; // searchable <select>
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./pos.style.css";

// POS computers: one row per counter in a shop. A new POS gets a 6-digit pairing code (30 min) —
// type it on the POS once; after that it syncs with its own key. "New code" unlinks the old one.
const ONLINE_MS = 3 * 60 * 1000;

function minutesLeft(d) {
  const ms = new Date(d).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

function PosDeviceComponent() {
  const [rows, setRows] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [, tick] = useState(0);
  const notify = (type, text) => setNotice({ type, text });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await posDeviceService.list();
      setRows(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    warehouseService.all().then((r) => setShops((r.data || []).filter((w) => w.type === "shop"))).catch(() => {});
    const t = setInterval(() => tick((n) => n + 1), 30000); // minutes left / online dots
    const r = setInterval(load, 60000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const replace = (doc) => setRows((list) => list.map((r) => (r._id === doc._id ? { ...r, ...doc } : r)));

  const create = async () => {
    setBusy(true);
    setFormError("");
    try {
      const res = await posDeviceService.create({ warehouse_id: editor.warehouse_id, name: editor.name });
      setEditor(null);
      notify("success", res.message);
      setRows((list) => [...list, res.data].sort((a, b) => a.code.localeCompare(b.code)));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (d) => {
    try {
      replace((await posDeviceService.update(d._id, { status: !d.status })).data);
    } catch (err) {
      notify("error", err.message);
    }
  };
  const runConfirm = async () => {
    setBusy(true);
    try {
      const res = await confirm.run();
      notify("success", res.message);
      if (confirm.kind === "delete") setRows((list) => list.filter((r) => r._id !== confirm.device._id));
      else replace({ ...res.data, paired: false });
      setConfirm(null);
    } catch (err) {
      notify("error", err.message);
    } finally {
      setBusy(false);
    }
  };

  const groups = shops.map((s) => ({ shop: s, list: rows.filter((r) => r.warehouse_id?._id === s._id) })).filter((g) => g.list.length);
  const orphans = rows.filter((r) => !shops.some((s) => s._id === r.warehouse_id?._id));
  if (orphans.length) groups.push({ shop: null, list: orphans });

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <p className="pdv-intro">{L("POS មួយ = កុំព្យូទ័រលក់មួយនៅហាង។ បង្កើត POS ហើយវាយលេខកូដ 6 ខ្ទង់នៅលើ POS ដើម្បីភ្ជាប់។", "One POS = one sales computer in a shop. Add a POS, then type its 6-digit code on that computer to link it.")}</p>
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}><RefreshCw size={16} className={loading ? "md-spin" : ""} /></button>
          <button type="button" className="md-btn md-btn-primary" onClick={() => { setFormError(""); setEditor({ warehouse_id: shops.length === 1 ? shops[0]._id : "", name: "" }); }}>
            <Plus size={16} />{L("បន្ថែម POS", "Add POS")}
          </button>
        </div>
      </div>

      {error && <div className="md-empty md-empty-error">{error}</div>}
      {!error && !loading && !rows.length && (
        <div className="md-card pdv-empty"><Monitor size={40} /><b>{L("មិនទាន់មាន POS", "No POS yet")}</b><span>{L("បន្ថែម POS សម្រាប់ហាង ហើយភ្ជាប់វាដោយលេខកូដ", "Add a POS for a shop and link it with the code")}</span></div>
      )}

      {groups.map((g) => (
        <section key={g.shop?._id || "x"} className="pdv-group">
          <h3>{g.shop ? `${nameKh(g.shop)} (${g.shop.code})` : L("ផ្សេងៗ", "Other")}</h3>
          <div className="pdv-grid">
            {g.list.map((d) => {
              const online = d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < ONLINE_MS;
              const waiting = !d.paired && d.pair_code && minutesLeft(d.pair_expires_at) > 0;
              return (
                <div key={d._id} className={`md-card pdv-card ${d.status ? "" : "is-off"}`}>
                  <div className="pdv-head">
                    <span className="pdv-icon"><Monitor size={20} /></span>
                    <div className="pdv-title">
                      <b>{d.name}</b>
                      <code>{d.code}</code>
                    </div>
                    <label className="md-switch" title={d.status ? L("បិទ POS", "Turn off") : L("បើក POS", "Turn on")}>
                      <input type="checkbox" checked={!!d.status} onChange={() => toggle(d)} />
                      <span className="md-switch-track" />
                    </label>
                  </div>
                  {waiting ? (
                    <div className="pdv-pair">
                      <span>{L("លេខកូដភ្ជាប់", "Pairing code")}</span>
                      <strong>{d.pair_code.slice(0, 3)} {d.pair_code.slice(3)}</strong>
                      <em>{L(`នៅសល់ ${minutesLeft(d.pair_expires_at)} នាទី`, `${minutesLeft(d.pair_expires_at)} min left`)}</em>
                    </div>
                  ) : d.paired ? (
                    <div className="pdv-info">
                      <span className={`pdv-online ${online ? "on" : ""}`}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? L("អនឡាញ", "Online") : L("អហ្វឡាញ", "Offline")}</span>
                      <span>{L("ឃើញចុងក្រោយ", "Last seen")}: {d.last_seen_at ? dateTimeText(d.last_seen_at) : "-"}</span>
                      <span>{L("ទាញទិន្នន័យ", "Last pull")}: {d.last_pull_at ? dateTimeText(d.last_pull_at) : "-"}</span>
                      <span>{L("ផ្ញើវិក្កយបត្រ", "Last push")}: {d.last_push_at ? dateTimeText(d.last_push_at) : "-"}</span>
                      {d.app_version && <span className="md-sub">v{d.app_version} · ****{d.key_hint}</span>}
                    </div>
                  ) : (
                    <div className="pdv-info"><span className="pdv-expired">{L("លេខកូដផុតកំណត់ — បង្កើតលេខកូដថ្មី", "Code expired — make a new code")}</span></div>
                  )}
                  <div className="pdv-actions">
                    <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirm({ kind: "code", device: d, title: L("លេខកូដភ្ជាប់ថ្មី", "New pairing code"), text: d.paired ? L(`POS ${d.code} នឹងផ្តាច់ភ្លាម ហើយត្រូវភ្ជាប់ម្តងទៀតដោយលេខកូដថ្មី។ បន្ត?`, `${d.code} is unlinked at once and must be paired again with the new code. Continue?`) : L("បង្កើតលេខកូដថ្មី (30 នាទី)?", "Make a new code (30 minutes)?"), run: () => posDeviceService.newCode(d._id) })}>
                      <KeyRound size={15} />{d.paired ? L("ភ្ជាប់ឡើងវិញ", "Re-pair") : L("លេខកូដថ្មី", "New code")}
                    </button>
                    <button type="button" className="md-icon-btn md-icon-btn-danger" title={L("លុប", "Delete")} onClick={() => setConfirm({ kind: "delete", device: d, danger: true, title: L("លុប POS", "Delete POS"), text: L(`លុប ${d.code}? វានឹងលែងភ្ជាប់បាន។ វិក្កយបត្រដែលបានផ្ញើនៅដដែល។`, `Delete ${d.code}? It can no longer sync. Invoices already sent are kept.`), run: () => posDeviceService.remove(d._id) })}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {editor && (
        <div className="md-modal-backdrop" onMouseDown={() => !busy && setEditor(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{L("បន្ថែម POS", "Add POS")}</h3>
              <button type="button" className="md-icon-btn" onClick={() => setEditor(null)} disabled={busy}><X size={18} /></button>
            </div>
            <div className="md-modal-body">
              <div className="md-fields">
                <div className="md-field">
                  <label>{L("ហាង", "Shop")}<span className="md-required">*</span></label>
                  <Select className="pe-input" value={editor.warehouse_id} onChange={(e) => setEditor({ ...editor, warehouse_id: e.target.value })}>
                    <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                    {shops.map((s) => (
                      <option key={s._id} value={s._id}>{nameKh(s)} ({s.code})</option>
                    ))}
                  </Select>
                </div>
                <div className="md-field">
                  <label>{L("ឈ្មោះ POS", "POS name")}<span className="md-required">*</span></label>
                  <input className="pe-input" value={editor.name} placeholder={L("ឧ. តុគិតលុយ ១", "e.g. Counter 1")} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
                </div>
              </div>
              {formError && <div className="md-form-error">{formError}</div>}
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setEditor(null)} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
              <button type="button" className="md-btn md-btn-primary" onClick={create} disabled={busy}>{busy ? "…" : L("បង្កើត", "Create")}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="md-modal-backdrop" onMouseDown={() => !busy && setConfirm(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header"><h3>{confirm.title}</h3></div>
            <div className="md-modal-body"><p>{confirm.text}</p></div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>{L("ទេ", "No")}</button>
              <button type="button" className={`md-btn ${confirm.danger ? "md-btn-danger" : "md-btn-primary"}`} onClick={runConfirm} disabled={busy}>{busy ? "…" : L("បាទ / ចាស", "Yes")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PosDeviceComponent;
