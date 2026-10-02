import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Eye, ImageDown, Pencil, Plus, QrCode, RefreshCw, RotateCcw, Search, Store, Trash2, Warehouse, X } from "lucide-react";
import { catalogService, categoryService, warehouseService } from "../../../api/api.service";
import { flattenTree } from "../product/productOptions";
import { nameKh } from "../setup/setupOptions";
import { dateTimeText } from "../master_data/MasterDataPage";
import { L } from "../../../i18n";
import Select from "../../util/Select"; // searchable <select>
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./qr.style.css";

// QR code / public catalog links: one secret link per shop or warehouse (optionally one category).
// Customers open it without login and see items, prices and stock status (never the real qty / cost).
// Public page: /c/<token> on this website (or REACT_APP_CATALOG_URL when the catalog runs on its own domain).
export const catalogUrl = (token) => `${(process.env.REACT_APP_CATALOG_URL || window.location.origin).replace(/\/$/, "")}/c/${token}`;

const qrOptions = (width) => ({ width, margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });

function QrImage({ text, size = 120, className }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, qrOptions(size * 2))
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt="QR" className={className} /> : <div className={className} style={{ width: size, height: size }} />;
}

const saveAs = (dataUrl, name) => {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// A4-ish poster for the counter / window: company, QR, shop name, "scan to see our items"
async function downloadPoster(link) {
  const url = catalogUrl(link.token);
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--color-primary-main").trim() || "#1f7a4d";
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  // the Khmer web font must be loaded before drawing, or the canvas falls back to a font without Khmer shaping
  if (document.fonts?.load) {
    await Promise.all(["400 28px", "500 44px", "600 40px", "700 64px"].map((w) => document.fonts.load(`${w} ${font}`, "ស្កេន Scan").catch(() => null)));
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 26);
  ctx.fillRect(0, H - 26, W, 26);

  ctx.textAlign = "center";
  ctx.fillStyle = "#111111";
  ctx.font = `700 64px ${font}`;
  ctx.fillText("ស្កេនដើម្បីមើលទំនិញ", W / 2, 210);
  ctx.fillStyle = "#555555";
  ctx.font = `500 44px ${font}`;
  ctx.fillText("Scan to see our items, prices & stock", W / 2, 285);

  const qr = await QRCode.toDataURL(url, qrOptions(820));
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = qr;
  });
  const qx = (W - 820) / 2;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(qx - 40, 360, 900, 900, 48) : ctx.rect(qx - 40, 360, 900, 900);
  ctx.stroke();
  ctx.drawImage(img, qx, 400, 820, 820);

  const wh = link.warehouse_id || {};
  ctx.fillStyle = "#111111";
  ctx.font = `700 60px ${font}`;
  ctx.fillText(wh.name_kh || wh.code || "", W / 2, 1370);
  if (wh.name_en && wh.name_en !== wh.name_kh) {
    ctx.fillStyle = "#555555";
    ctx.font = `500 42px ${font}`;
    ctx.fillText(wh.name_en, W / 2, 1440);
  }
  if (link.category_id) {
    ctx.fillStyle = accent;
    ctx.font = `600 40px ${font}`;
    ctx.fillText(`${link.category_id.name_kh}${link.category_id.name_en ? ` · ${link.category_id.name_en}` : ""}`, W / 2, 1510);
  }
  ctx.fillStyle = "#888888";
  ctx.font = `400 28px ${font}`;
  ctx.fillText(url, W / 2, 1640);
  saveAs(canvas.toDataURL("image/png"), `qr-poster-${wh.code || "catalog"}.png`);
}

async function downloadQr(link) {
  saveAs(await QRCode.toDataURL(catalogUrl(link.token), qrOptions(1024)), `qr-${link.warehouse_id?.code || "catalog"}.png`);
}

function QrCodeComponent() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editor, setEditor] = useState(null); // { _id?, name, warehouse_id, category_id, note }
  const [showing, setShowing] = useState(null); // link in the big-QR box
  const [confirm, setConfirm] = useState(null); // { title, text, run, danger }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const notify = (type, text) => setNotice({ type, text });

  useEffect(() => {
    warehouseService.all().then((r) => setWarehouses(r.data || [])).catch(() => {});
    categoryService.tree().then((r) => setCategories(flattenTree(r.data || []))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 350);
    return () => clearTimeout(t);
  }, [keyword]);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const apply = (res) => seq === loadSeq.current && setRows(res.data || []);
    setLoading(true);
    setListError("");
    try {
      apply(await catalogService.list({ page: 1, limit: 100, q: search || undefined, sort: "created_date", order: "desc" }, { onFresh: apply }));
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => {
    load();
  }, [load]);

  const replace = (doc) => setRows((list) => list.map((r) => (r._id === doc._id ? doc : r)));

  const save = async () => {
    setBusy(true);
    setFormError("");
    try {
      const body = { name: editor.name, warehouse_id: editor.warehouse_id, category_id: editor.category_id || null, note: editor.note };
      const res = editor._id ? await catalogService.update(editor._id, body) : await catalogService.create(body);
      setEditor(null);
      notify("success", res.message);
      if (editor._id) replace(res.data);
      else {
        setRows((list) => [res.data, ...list]);
        setShowing(res.data);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (link) => {
    try {
      const res = await catalogService.update(link._id, { status: !link.status });
      replace(res.data);
      notify("success", res.data.status ? L("តំណបានបើក", "Link turned on") : L("តំណបានបិទ — អតិថិជនមើលលែងបាន", "Link turned off — customers can't open it"));
    } catch (err) {
      notify("error", err.message);
    }
  };

  const runConfirm = async () => {
    setBusy(true);
    try {
      const res = await confirm.run();
      notify("success", res.message);
      if (confirm.kind === "delete") setRows((list) => list.filter((r) => r._id !== confirm.link._id));
      else {
        replace(res.data);
        if (showing?._id === res.data._id) setShowing(res.data);
      }
      setConfirm(null);
    } catch (err) {
      notify("error", err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(catalogUrl(link.token));
      notify("success", L("បានចម្លងតំណ — ផ្ញើទៅអតិថិជនបាន", "Link copied — you can send it to customers"));
    } catch {
      notify("error", catalogUrl(link.token));
    }
  };

  const whIcon = (w) => (w?.type === "shop" ? <Store size={14} /> : <Warehouse size={14} />);

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <div className="md-search">
            <Search size={16} />
            <input placeholder={L("ស្វែងរកឈ្មោះតំណ...", "Search link name...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword && <button type="button" onClick={() => setKeyword("")}><X size={14} /></button>}
          </div>
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
          <button
            type="button"
            className="md-btn md-btn-primary"
            onClick={() => {
              setFormError("");
              setEditor({ name: "", warehouse_id: "", category_id: "", note: "" });
            }}
          >
            <Plus size={16} />
            {L("បង្កើត QR", "New QR code")}
          </button>
        </div>
      </div>

      <p className="qr-intro">
        {L(
          "តំណសាធារណៈ (មិនចាំបាច់ចូលប្រព័ន្ធ) សម្រាប់អតិថិជនមើលទំនិញ តម្លៃ និងស្ថានភាពស្តុក (មាន / នៅតិច / អស់) របស់ហាង ឬឃ្លាំងមួយ។ ចំនួនពិត និងថ្លៃដើមមិនបង្ហាញទេ។",
          "Public links (no login) for customers to see the items, prices and stock status (in stock / few left / out) of one shop or warehouse. Real quantities and costs are never shown.",
        )}
      </p>

      {listError && <div className="md-empty md-empty-error">{listError}</div>}
      {!listError && !loading && !rows.length && (
        <div className="qr-empty md-card">
          <QrCode size={40} />
          <b>{L("មិនទាន់មាន QR", "No QR codes yet")}</b>
          <span>{L("បង្កើត QR សម្រាប់ហាង ឬឃ្លាំង ហើយផ្ញើតំណទៅអតិថិជន", "Make one for a shop or warehouse and send the link to customers")}</span>
        </div>
      )}

      <div className="qr-grid">
        {rows.map((link) => (
          <div key={link._id} className={`qr-card md-card ${link.status ? "" : "is-off"}`}>
            <button type="button" className="qr-thumb" onClick={() => setShowing(link)} title={L("មើល QR", "Show QR")}>
              <QrImage text={catalogUrl(link.token)} size={112} />
            </button>
            <div className="qr-body">
              <div className="qr-name">
                <b>{link.name}</b>
                <label className="md-switch" title={link.status ? L("បិទតំណ", "Turn off") : L("បើកតំណ", "Turn on")}>
                  <input type="checkbox" checked={!!link.status} onChange={() => toggle(link)} />
                  <span className="md-switch-track" />
                </label>
              </div>
              <span className="qr-store">
                {whIcon(link.warehouse_id)} {nameKh(link.warehouse_id)} <span className="md-sub">({link.warehouse_id?.code})</span>
              </span>
              <span className="md-sub">{link.category_id ? `${L("ប្រភេទ", "Category")}: ${nameKh(link.category_id)}` : L("ទំនិញទាំងអស់", "All products")}</span>
              <span className="qr-url">{catalogUrl(link.token)}</span>
              <span className="md-sub qr-views">
                <Eye size={13} /> {link.views || 0} {L("ដង", "views")}
                {link.last_viewed_at ? ` · ${L("ចុងក្រោយ", "last")} ${dateTimeText(link.last_viewed_at)}` : ""}
              </span>
              <div className="qr-actions">
                <button type="button" className="md-btn md-btn-ghost" onClick={() => copy(link)} disabled={!link.status}><Copy size={15} />{L("ចម្លងតំណ", "Copy link")}</button>
                <a className={`md-btn md-btn-ghost ${link.status ? "" : "is-disabled"}`} href={catalogUrl(link.token)} target="_blank" rel="noreferrer"><ExternalLink size={15} />{L("បើក", "Open")}</a>
                <button type="button" className="md-icon-btn" title={L("កែប្រែ", "Edit")} onClick={() => { setFormError(""); setEditor({ _id: link._id, name: link.name, warehouse_id: link.warehouse_id?._id || "", category_id: link.category_id?._id || "", note: link.note || "" }); }}><Pencil size={15} /></button>
                <button type="button" className="md-icon-btn" title={L("តំណថ្មី (QR ចាស់លែងប្រើ)", "New link (old QR stops)")} onClick={() => setConfirm({ kind: "token", link, title: L("បង្កើតតំណថ្មី", "Make a new link"), text: L(`តំណ និង QR ចាស់របស់ "${link.name}" នឹងលែងប្រើបានភ្លាម (QR ដែលបានបោះពុម្ពត្រូវប្តូរ)។ បន្ត?`, `The old link and QR of "${link.name}" stop working at once (printed QR codes must be replaced). Continue?`), run: () => catalogService.newToken(link._id) })}><RotateCcw size={15} /></button>
                <button type="button" className="md-icon-btn md-icon-btn-danger" title={L("លុប", "Delete")} onClick={() => setConfirm({ kind: "delete", link, danger: true, title: L("លុបតំណ", "Delete link"), text: L(`លុប "${link.name}"? QR នេះនឹងលែងប្រើបាន។`, `Delete "${link.name}"? This QR stops working.`), run: () => catalogService.remove(link._id) })}><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- big QR ---------- */}
      {showing && (
        <div className="md-modal-backdrop" onMouseDown={() => setShowing(null)}>
          <div className="md-modal md-modal-sm qr-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{showing.name}</h3>
              <button type="button" className="md-icon-btn" onClick={() => setShowing(null)}><X size={18} /></button>
            </div>
            <div className="md-modal-body qr-big">
              <QrImage text={catalogUrl(showing.token)} size={260} className="qr-big-img" />
              <b>{nameKh(showing.warehouse_id)} ({showing.warehouse_id?.code})</b>
              {!showing.status && <span className="qr-off">{L("តំណនេះកំពុងបិទ", "This link is turned off")}</span>}
              <div className="qr-copy">
                <input readOnly value={catalogUrl(showing.token)} onFocus={(e) => e.target.select()} />
                <button type="button" className="md-btn md-btn-ghost" onClick={() => copy(showing)}><Copy size={15} /></button>
              </div>
            </div>
            <div className="md-modal-footer qr-modal-foot">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => downloadQr(showing).catch((e) => notify("error", e.message))}><Download size={15} />QR .png</button>
              <button type="button" className="md-btn md-btn-ghost" onClick={() => downloadPoster(showing).catch((e) => notify("error", e.message))}><ImageDown size={15} />{L("ផ្ទាំងបិទ (A4)", "Poster (A4)")}</button>
              <a className="md-btn md-btn-primary" href={catalogUrl(showing.token)} target="_blank" rel="noreferrer"><ExternalLink size={15} />{L("បើកមើល", "Open")}</a>
            </div>
          </div>
        </div>
      )}

      {/* ---------- create / edit ---------- */}
      {editor && (
        <div className="md-modal-backdrop" onMouseDown={() => !busy && setEditor(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{editor._id ? L("កែប្រែ QR", "Edit QR code") : L("បង្កើត QR", "New QR code")}</h3>
              <button type="button" className="md-icon-btn" onClick={() => setEditor(null)} disabled={busy}><X size={18} /></button>
            </div>
            <div className="md-modal-body">
              <div className="md-fields">
                <div className="md-field">
                  <label>{L("ហាង / ឃ្លាំង", "Shop / warehouse")}<span className="md-required">*</span></label>
                  <Select
                    className="pe-input"
                    value={editor.warehouse_id}
                    onChange={(e) => {
                      const w = warehouses.find((x) => x._id === e.target.value);
                      setEditor((f) => ({ ...f, warehouse_id: e.target.value, name: f.name || (w ? `${nameKh(w)} (${w.code})` : "") }));
                    }}
                  >
                    <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>{nameKh(w)} ({w.code}) · {w.type === "shop" ? L("ហាង", "shop") : L("ឃ្លាំង", "warehouse")}</option>
                    ))}
                  </Select>
                </div>
                <div className="md-field">
                  <label>{L("ឈ្មោះតំណ", "Link name")}<span className="md-required">*</span></label>
                  <input className="pe-input" value={editor.name} placeholder={L("ឧ. ហាងទួលគោក — Facebook", "e.g. Toul Kork shop — Facebook")} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
                </div>
                <div className="md-field">
                  <label>{L("ប្រភេទទំនិញ", "Category")}</label>
                  <Select className="pe-input" value={editor.category_id} onChange={(e) => setEditor({ ...editor, category_id: e.target.value })}>
                    <option value="">{L("-- ទំនិញទាំងអស់ --", "-- All products --")}</option>
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="md-field">
                  <label>{L("កំណត់សម្គាល់", "Note")}</label>
                  <input className="pe-input" value={editor.note} onChange={(e) => setEditor({ ...editor, note: e.target.value })} />
                </div>
              </div>
              {formError && <div className="md-form-error">{formError}</div>}
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setEditor(null)} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
              <button type="button" className="md-btn md-btn-primary" onClick={save} disabled={busy}>{busy ? "…" : L("រក្សាទុក", "Save")}</button>
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

export default QrCodeComponent;
