import React, { useEffect, useMemo, useState } from "react";
import { Baby, Cake, Eye, Star, X } from "lucide-react";
import MasterDataPage, { dateTimeText } from "../master_data/MasterDataPage";
import { customerService, warehouseService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { ACCESS, canAccess } from "../../util/permission";
import { nameKh } from "../setup/setupOptions";
import { L } from "../../../i18n";
import "./customer.style.css";

// Customers (parents) + loyalty points. Added here or on the POS (also offline). Points: earned on each sale,
// used as money on the POS, changed by hand here (admin / central manager, with a reason).
const usd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ageOf = (ymd) => {
  if (!ymd) return "";
  const b = new Date(`${ymd}T00:00:00`);
  const n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) m -= 1;
  if (m < 0) return "";
  return m < 24 ? L(`${m} ខែ`, `${m} mo`) : L(`${Math.floor(m / 12)} ឆ្នាំ`, `${Math.floor(m / 12)} y`);
};
const MONTHS = Array.from({ length: 12 }, (_, k) => ({ value: String(k + 1), label: new Date(2026, k, 1).toLocaleDateString("en-GB", { month: "long" }) }));
const TYPE = { earn: L("ទទួល", "Earned"), redeem: L("ប្រើ", "Used"), refund: L("សងប្រាក់", "Refund"), adjust: L("កែដោយដៃ", "Adjusted") };

function CustomerDetail({ id, onClose, canPoints, onChanged }) {
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const [adj, setAdj] = useState({ points: "", note: "" });
  const [busy, setBusy] = useState(false);
  const load = () => customerService.get(id).then((r) => setC(r.data)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await customerService.addPoints(id, { points: Number(adj.points), note: adj.note });
      setAdj({ points: "", note: "" });
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal cu-detail" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{c ? `${c.name} · ${c.code}` : "…"}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="md-modal-body">
          {error && <div className="md-form-error">{error}</div>}
          {c && (
            <>
              <div className="cu-tiles">
                <div className="cu-tile gold"><Star size={16} /><b>{c.points}</b><span>{L("ពិន្ទុ", "Points")}</span></div>
                <div className="cu-tile"><b>{usd(c.total_spent)}</b><span>{L("ទិញសរុប", "Total spent")}</span></div>
                <div className="cu-tile"><b>{c.visits}</b><span>{L("ចំនួនដងទិញ", "Visits")}</span></div>
                <div className="cu-tile"><b>{c.last_visit_at ? dateTimeText(c.last_visit_at).slice(0, 10) : "-"}</b><span>{L("ទិញចុងក្រោយ", "Last visit")}</span></div>
              </div>
              <p className="cu-line">
                📞 {c.phone}
                {c.kid_name && <> · <Baby size={14} /> {c.kid_name}{c.kid_birthday ? ` · 🎂 ${c.kid_birthday} (${ageOf(c.kid_birthday)})` : ""}</>}
                {c.warehouse_id && <> · 🏪 {c.warehouse_id.code}</>}
              </p>
              {canPoints && (
                <div className="cu-adjust">
                  <input type="number" placeholder={L("ពិន្ទុ (+ / −)", "Points (+ / −)")} value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value })} />
                  <input placeholder={L("មូលហេតុ", "Reason")} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
                  <button type="button" className="md-btn md-btn-primary" disabled={busy || !Number(adj.points) || !adj.note.trim()} onClick={save}>{busy ? "…" : L("កែពិន្ទុ", "Change points")}</button>
                </div>
              )}
              <div className="cu-cols">
                <section>
                  <h4>{L("ប្រវត្តិពិន្ទុ", "Points history")}</h4>
                  <table className="md-table cu-table">
                    <tbody>
                      {(c.point_history || []).map((p) => (
                        <tr key={p._id}>
                          <td>{dateTimeText(p.at)}</td>
                          <td>{TYPE[p.type] || p.type}<span className="md-sub">{p.invoice_no || p.note}{p.refund_no ? ` · ${p.refund_no}` : ""}</span></td>
                          <td className={`cu-r ${p.points < 0 ? "neg" : "pos"}`}>{p.points > 0 ? "+" : ""}{p.points}</td>
                          <td className="cu-r">{p.balance}</td>
                        </tr>
                      ))}
                      {!c.point_history?.length && <tr><td className="md-empty">{L("មិនទាន់មាន", "Nothing yet")}</td></tr>}
                    </tbody>
                  </table>
                </section>
                <section>
                  <h4>{L("វិក្កយបត្រ", "Invoices")}</h4>
                  <table className="md-table cu-table">
                    <tbody>
                      {(c.sales || []).map((s) => (
                        <tr key={s._id}>
                          <td>{dateTimeText(s.sold_at)}<span className="md-sub">{s.invoice_no} · {s.warehouse_id?.code}</span></td>
                          <td className="cu-r">{usd(s.total)}{s.refund_status && <span className="md-sub">{L("សង", "refund")} {s.refund_status}</span>}</td>
                          <td className="cu-r pos">+{s.points_earned || 0}{s.points_redeemed ? <span className="md-sub neg">−{s.points_redeemed}</span> : null}</td>
                        </tr>
                      ))}
                      {!c.sales?.length && <tr><td className="md-empty">{L("មិនទាន់មាន", "Nothing yet")}</td></tr>}
                    </tbody>
                  </table>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerComponent() {
  const login = new Auth().getClientLogin() || {};
  const canEdit = canAccess(login, ACCESS.PRODUCT);
  const [shops, setShops] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    warehouseService.all({ type: "shop" }).then((r) => setShops((r.data || []).filter((w) => w.type === "shop"))).catch(() => {});
    customerService.birthdays(7).then((r) => setBirthdays(r.data || [])).catch(() => {});
  }, []);

  const fields = useMemo(
    () => [
      { key: "name", label: L("ឈ្មោះ (ឪពុក / ម្តាយ)", "Name (parent)"), required: true },
      { key: "phone", label: L("លេខទូរស័ព្ទ", "Phone"), type: "tel", required: true, placeholder: "012 345 678" },
      { key: "gender", label: L("ភេទ", "Gender"), type: "select", options: [{ value: "female", label: L("ស្រី", "Female") }, { value: "male", label: L("ប្រុស", "Male") }] },
      { key: "warehouse_id", label: L("ហាង", "Home shop"), type: "select", options: shops.map((s) => ({ value: s._id, label: `${nameKh(s)} (${s.code})` })) },
      { key: "kid_name", label: L("ឈ្មោះកូន", "Child's name") },
      { key: "kid_birthday", label: L("ថ្ងៃកំណើតកូន", "Child's birthday"), type: "date" },
      { key: "kid_gender", label: L("ភេទកូន", "Child"), type: "select", options: [{ value: "boy", label: L("ប្រុស", "Boy") }, { value: "girl", label: L("ស្រី", "Girl") }] },
      { key: "address", label: L("អាសយដ្ឋាន", "Address"), type: "textarea", full: true },
      { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
    ],
    [shops],
  );
  const columns = [
    { key: "name", label: L("អតិថិជន", "Customer"), render: (r) => <><b>{r.name}</b><span className="md-sub">{r.code} · {r.phone}</span></> },
    { key: "kid", label: L("កូន", "Child"), render: (r) => (r.kid_name || r.kid_birthday ? <>{r.kid_name || "-"}<span className="md-sub">{r.kid_birthday ? `🎂 ${r.kid_birthday} · ${ageOf(r.kid_birthday)}` : ""}</span></> : "-") },
    { key: "points", label: L("ពិន្ទុ", "Points"), render: (r) => <span className="cu-pts"><Star size={13} /> {r.points}</span> },
    { key: "total_spent", label: L("ទិញសរុប", "Spent"), render: (r) => <>{usd(r.total_spent)}<span className="md-sub">{r.visits} {L("ដង", "visits")}</span></> },
    { key: "last_visit_at", label: L("ទិញចុងក្រោយ", "Last visit"), render: (r) => (r.last_visit_at ? dateTimeText(r.last_visit_at) : "-") },
    { key: "warehouse_id", label: L("ហាង", "Shop"), render: (r) => r.warehouse_id?.code || "-" },
  ];

  return (
    <>
      {birthdays.length > 0 && (
        <div className="cu-bday">
          <Cake size={18} />
          <b>{L("ខួបកំណើតកូនក្នុង 7 ថ្ងៃ", "Birthdays in the next 7 days")}:</b>
          {birthdays.slice(0, 8).map((c) => (
            <button key={c._id} type="button" onClick={() => setViewing(c._id)}>
              {c.kid_name || c.name} ({c.turns}) · {c.days_left === 0 ? L("ថ្ងៃនេះ", "today") : L(`${c.days_left} ថ្ងៃ`, `in ${c.days_left} d`)}
            </button>
          ))}
        </div>
      )}
      <MasterDataPage
        key={tick}
        title={L("អតិថិជន", "Customers")}
        service={customerService}
        fields={fields}
        columns={columns}
        searchKeys={["name", "phone", "code", "kid_name"]}
        filters={[
          { key: "birthday_month", label: L("-- ខែកំណើតកូន --", "-- Child's birthday month --"), options: MONTHS },
          { key: "warehouse_id", label: L("-- ហាងទាំងអស់ --", "-- All shops --"), options: shops.map((s) => ({ value: s._id, label: s.code })) },
          { key: "sort", label: L("-- តម្រៀប: ថ្មីបំផុត --", "-- Sort: newest --"), options: [{ value: "points", label: L("ពិន្ទុច្រើន", "Most points") }, { value: "total_spent", label: L("ទិញច្រើន", "Spent most") }, { value: "last_visit_at", label: L("ទិញថ្មីៗ", "Recent visit") }, { value: "name", label: L("ឈ្មោះ", "Name") }] },
        ]}
        canEdit={canEdit}
        getName={(r) => `${r.name} (${r.phone})`}
        extraActions={(r) => (
          <button type="button" className="md-icon-btn" onClick={() => setViewing(r._id)} title={L("មើលពិន្ទុ និងវិក្កយបត្រ", "Points and invoices")}>
            <Eye size={15} />
          </button>
        )}
        wide
      />
      {viewing && <CustomerDetail id={viewing} canPoints={canEdit} onClose={() => setViewing(null)} onChanged={() => setTick((n) => n + 1)} />}
    </>
  );
}
