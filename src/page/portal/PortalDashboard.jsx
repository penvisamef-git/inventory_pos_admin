import React, { useRef, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PackageSearch, AlertTriangle, CalendarClock, Truck, ClipboardPen, Users, ArrowRight, RefreshCw, ReceiptText, KeyRound } from "lucide-react";
import { shopService } from "../../api/api.service";
import { usePortal } from "./portalContext";
import { OptionChips, dateOnly, qtyText, usd, valueName } from "../dashboard/stock/stockOptions";
import { imageCell } from "../dashboard/master_data/MasterDataPage";
import { L } from "../../i18n";

// One warehouse at a glance: stock, what needs attention, incoming goods, staff (sales after Phase 3)
function PortalDashboard() {
  const w = usePortal();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const current = useRef(null); // warehouse shown now (ignore late answers for another one)
  const load = useCallback(async () => {
    setError("");
    try {
      // cached (api.client.js): last copy at once, quiet refresh
      const id = w._id;
      current.current = id;
      setD((await shopService.summary(id, { onFresh: (res) => current.current === id && setD(res.data) })).data);
    } catch (err) {
      setError(err.message);
    }
  }, [w]);
  useEffect(() => {
    setD(null);
    load();
  }, [load]);

  const base = `/shop/${w.code}`;
  if (error) return <div className="md-form-error">{error}</div>;
  if (!d) return <div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>;
  const s = d.stock;

  const Card = ({ to, icon, label, value, sub, tone }) => (
    <Link to={to} className={`pd-card ${tone || ""}`}>
      <span className="pd-card-icon">{icon}</span>
      <span className="pd-card-label">{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </Link>
  );

  return (
    <div className="pd">
      <div className="pd-hello">
        <div>
          <h1>{L("សួស្តី", "Hello")} 👋</h1>
          <p>{L(`នេះជាស្ថានភាព ${w.code} ថ្ងៃនេះ`, `Here is how ${w.code} looks today`)}</p>
        </div>
        <button type="button" className="md-btn md-btn-ghost" onClick={load}><RefreshCw size={15} /></button>
      </div>

      <div className="pd-cards">
        <Card to={`${base}/stock`} icon={<PackageSearch size={18} />} label={L("ទំនិញមានស្តុក", "Items in stock")} value={qtyText(s.skus)} sub={`${qtyText(s.qty)} ${L("ឯកតា", "units")}${s.value !== undefined ? ` · ${usd(s.value)}` : ""}`} tone="green" />
        <Card to={`${base}/stock`} icon={<AlertTriangle size={18} />} label={L("ស្តុកទាប", "Low stock")} value={qtyText(s.low)} sub={s.out ? L(`${s.out} អស់ស្តុក`, `${s.out} out of stock`) : L("ត្រូវបញ្ជាទិញបន្ថែម", "time to restock")} tone={s.low ? "warn" : ""} />
        <Card to={`${base}/expiry`} icon={<CalendarClock size={18} />} label={L(`ផុតកំណត់ក្នុង ${d.expiry.alert_days} ថ្ងៃ`, `Expiring in ${d.expiry.alert_days} days`)} value={qtyText(d.expiry.count)} sub={d.expiry.expired ? L(`${d.expiry.expired} ផុតកំណត់ហើយ`, `${d.expiry.expired} already expired`) : "Batch"} tone={d.expiry.count ? "warn" : ""} />
        <Card to={`${base}/transfer`} icon={<Truck size={18} />} label={L("ទំនិញកំពុងមក", "Incoming")} value={qtyText(d.transfers.incoming)} sub={L(`${d.transfers.requested} សំណើរង់ចាំ`, `${d.transfers.requested} request(s) waiting`)} tone={d.transfers.incoming ? "blue" : ""} />
        {d.warehouse.type === "shop" ? (
          <Card to={`${base}/staff`} icon={<Users size={18} />} label={L("អ្នកគិតលុយ", "Cashiers")} value={qtyText(d.staff.cashiers)} sub={d.staff.no_pin ? L(`${d.staff.no_pin} មិនទាន់មាន PIN`, `${d.staff.no_pin} without PIN`) : L(`${d.staff.active} សកម្ម`, `${d.staff.active} active`)} />
        ) : (
          <Card to={`${base}/adjustment`} icon={<ClipboardPen size={18} />} label={L("កែតម្រូវរង់ចាំ", "Adjustments waiting")} value={qtyText(d.adjustments.drafts)} sub={L("សេចក្តីព្រាង", "drafts")} />
        )}
      </div>

      <div className="pd-grid">
        <section className="pd-panel pd-sales">
          <div className="pd-panel-head">
            <h3><ReceiptText size={16} /> {L("ការលក់ថ្ងៃនេះ", "Today's sales")}</h3>
          </div>
          <div className="pd-soon">
            <b>{L("នឹងមានបន្ទាប់ពីភ្ជាប់ POS", "Coming when the POS is connected")}</b>
            <span>{L("ការលក់ វេនការងារ និងស្ថានភាព POS (ដំណាក់កាលទី 3)", "Sales, shifts and POS status (Phase 3)")}</span>
          </div>
        </section>

        <section className="pd-panel">
          <div className="pd-panel-head">
            <h3><AlertTriangle size={16} /> {L("ស្តុកទាប", "Low stock")}</h3>
            <Link to={`${base}/stock`}>{L("មើលទាំងអស់", "See all")} <ArrowRight size={14} /></Link>
          </div>
          {!d.low_items.length ? (
            <div className="pd-empty">{L("ល្អណាស់ គ្មានស្តុកទាប 🎉", "All good, nothing low 🎉")}</div>
          ) : (
            d.low_items.map((r) => (
              <div key={r.variant_id} className="pd-row">
                {imageCell(r.image)}
                <span className="pd-row-main">
                  <b>{valueName(r)}</b>
                  <span className="sd-item-sub">
                    <span className="md-code">{r.sku}</span>
                    <OptionChips options={r.options} />
                  </span>
                </span>
                <span className="pd-row-qty">
                  <b className="sb-low">{qtyText(r.qty)}</b>
                  <small>/ {qtyText(r.min)}</small>
                </span>
              </div>
            ))
          )}
        </section>

        <section className="pd-panel">
          <div className="pd-panel-head">
            <h3><CalendarClock size={16} /> {L("ជិតផុតកំណត់", "Near expiry")}</h3>
            <Link to={`${base}/expiry`}>{L("មើលទាំងអស់", "See all")} <ArrowRight size={14} /></Link>
          </div>
          {!d.expiring_items.length ? (
            <div className="pd-empty">{L("គ្មាន Batch ជិតផុតកំណត់", "No batches close to expiry")}</div>
          ) : (
            d.expiring_items.map((e, i) => (
              <div key={i} className="pd-row">
                <span className="pd-row-main">
                  <b>{valueName(e)}</b>
                  <span className="sd-item-sub"><span className="sd-batch-tag">{e.batch_no}</span> {dateOnly(e.expiry_date)}</span>
                </span>
                <span className="pd-row-qty">
                  <span className={`md-badge ${e.days_left <= 0 ? "md-badge-danger" : "md-badge-gold"}`}>{e.days_left <= 0 ? L("ផុតកំណត់", "Expired") : L(`${e.days_left} ថ្ងៃ`, `${e.days_left} d`)}</span>
                  <small>{qtyText(e.qty)}</small>
                </span>
              </div>
            ))
          )}
        </section>

        <section className="pd-panel">
          <div className="pd-panel-head">
            <h3><Truck size={16} /> {L("ការផ្ទេរ", "Transfers")}</h3>
            <Link to={`${base}/transfer`}>{L("មើលទាំងអស់", "See all")} <ArrowRight size={14} /></Link>
          </div>
          {!d.incoming_transfers.length && !d.requested_transfers.length && <div className="pd-empty">{L("គ្មានការផ្ទេរកំពុងដំណើរការ", "No transfers in progress")}</div>}
          {d.incoming_transfers.map((t) => (
            <div key={t._id} className="pd-row">
              <span className="pd-row-main">
                <b>{t.doc_no}</b>
                <small>{L("ពី", "from")} {t.from} · {L(`${t.lines} ជួរ`, `${t.lines} lines`)} · {dateOnly(t.dispatched_at)}</small>
              </span>
              <Link to={`${base}/transfer`} className="md-badge md-badge-gold">{L("កំពុងមក → ទទួល", "Arriving → receive")}</Link>
            </div>
          ))}
          {d.requested_transfers.map((t) => (
            <div key={t._id} className="pd-row">
              <span className="pd-row-main">
                <b>{t.doc_no}</b>
                <small>{L(`${t.lines} ជួរ`, `${t.lines} lines`)} · {dateOnly(t.created_date)}</small>
              </span>
              <span className="md-badge md-badge-off">{t.state === "requested" ? L("បានស្នើ", "Requested") : L("សេចក្តីព្រាង", "Draft")}</span>
            </div>
          ))}
          {d.adjustments.drafts > 0 && (
            <div className="pd-row">
              <span className="pd-row-main">
                <b>{L(`${d.adjustments.drafts} ការកែតម្រូវរង់ចាំអនុម័ត`, `${d.adjustments.drafts} adjustment(s) waiting for approval`)}</b>
              </span>
              <Link to={`${base}/adjustment`} className="md-badge md-badge-shop">{L("មើល", "View")}</Link>
            </div>
          )}
          {d.warehouse.type === "shop" && d.staff.no_pin > 0 && (
            <div className="pd-row">
              <span className="pd-row-main"><b><KeyRound size={14} /> {L(`${d.staff.no_pin} អ្នកគិតលុយមិនទាន់មាន PIN`, `${d.staff.no_pin} cashier(s) without a POS PIN`)}</b></span>
              <Link to={`${base}/staff`} className="md-badge md-badge-danger">{L("កំណត់", "Set")}</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default PortalDashboard;
