import React, { useEffect, useMemo, useState } from "react";
import { Send, X, Check } from "lucide-react";
import { telegramService, warehouseService } from "../../../api/api.service";
import { canManageStock } from "../stock/stockOptions";
import { langLabel, nameOf, TgBubble } from "./telegramOptions";
import { L } from "../../../i18n";
import "./telegram.style.css";
import Select from "../../util/Select"; // searchable <select>

const KEY = "inventory_pos_tg_chats"; // last chosen groups (this browser only)
const lastChats = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};
const saveChats = (ids) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // storage blocked → choose again next time
  }
};

/**
 * "Send to Telegram" box: pick groups, reports, shops (+ own message) → sent through the bot right away.
 *   reports      codes ticked when it opens (e.g. ["low_stock"])
 *   warehouseIds shops ticked when it opens ([] = each group's own shops)
 *   categoryId / categoryName  stock reports only for that category (optional)
 *   days         near expiry: within N days (optional)
 */
export function SendTelegramDialog({ reports = [], warehouseIds = [], categoryId, categoryName, days, onClose }) {
  const [targets, setTargets] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [chatIds, setChatIds] = useState([]);
  const [codes, setCodes] = useState(reports);
  const [whIds, setWhIds] = useState(warehouseIds.filter(Boolean).map(String));
  const [category, setCategory] = useState(categoryId || "");
  const [text, setText] = useState("");
  const [previewCode, setPreviewCode] = useState(reports[0] || "");
  const [preview, setPreview] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    Promise.all([telegramService.targets(), warehouseService.all({ sort: "sort_order", order: "asc" })])
      .then(([t, w]) => {
        const data = t.data || { chats: [], reports: [] };
        setTargets(data);
        setWarehouses(w.data || []);
        const remembered = lastChats().filter((id) => data.chats.some((c) => c._id === id));
        setChatIds(remembered.length ? remembered : data.chats.length === 1 ? [data.chats[0]._id] : []);
      })
      .catch((err) => {
        setTargets({ chats: [], reports: [] });
        setError(err.message);
      });
  }, []);

  const firstChat = targets?.chats.find((c) => chatIds.includes(c._id));
  const language = firstChat?.language || "both";

  // keep the preview on a ticked report
  useEffect(() => {
    if (!codes.includes(previewCode)) setPreviewCode(codes[0] || "");
  }, [codes, previewCode]);

  useEffect(() => {
    if (!previewCode) {
      setPreview("");
      return undefined;
    }
    let alive = true;
    setPreviewing(true);
    const t = setTimeout(() => {
      telegramService
        .previewReport({ code: previewCode, language, warehouse_ids: whIds.join(","), category_id: category || undefined, days: days || undefined, limit: 50 })
        .then((res) => alive && setPreview(res.data?.text || ""))
        .catch((err) => alive && setPreview(`⚠️ ${err.message}`))
        .finally(() => alive && setPreviewing(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [previewCode, language, whIds, category, days]);

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const res = await telegramService.send({
        chat_ids: chatIds,
        report_codes: codes,
        warehouse_ids: whIds,
        category_id: category || undefined,
        days: days || undefined,
        text,
      });
      saveChats(chatIds);
      setDone({ ok: !res.data?.failed, text: res.message });
      if (!res.data?.failed) setTimeout(onClose, 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const reportList = useMemo(() => (targets?.reports || []).filter((r) => r.phase < 4), [targets]);
  const canSend = chatIds.length > 0 && (codes.length > 0 || text.trim()) && !sending && !done?.ok;

  return (
    <div className="md-modal-backdrop" onMouseDown={() => !sending && onClose()}>
      <div className="md-modal md-modal-wide tg-send" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>
            <Send size={18} /> {L("ផ្ញើទៅតេឡេក្រាម", "Send to Telegram")}
          </h3>
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="md-modal-body">
          {targets === null && <div className="tg-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>}

          {targets && targets.chats.length === 0 && (
            <div className="tg-empty">
              {L("មិនទាន់មានក្រុមតេឡេក្រាម — Admin បន្ថែមនៅម៉ឺនុយតេឡេក្រាម", "No Telegram group yet — an admin adds one in the Telegram menu")}
            </div>
          )}

          {targets && targets.chats.length > 0 && (
            <div className="tg-send-grid">
              <div className="tg-send-form">
                <div className="md-field">
                  <label>
                    {L("ផ្ញើទៅ", "Send to")}
                    <span className="md-required">*</span>
                  </label>
                  <div className="md-chips">
                    {targets.chats.map((c) => {
                      const on = chatIds.includes(c._id);
                      return (
                        <button key={c._id} type="button" className={`md-chip ${on ? "on" : ""}`} onClick={() => toggle(chatIds, setChatIds, c._id)} aria-pressed={on}>
                          <span className="md-chip-box">{on ? "✓" : ""}</span>
                          {c.title}
                          <small className="tg-chip-sub">{langLabel(c.language)}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md-field">
                  <label>{L("របាយការណ៍", "Report")}</label>
                  <div className="md-chips">
                    {reportList.map((r) => {
                      const on = codes.includes(r.code);
                      return (
                        <button key={r.code} type="button" className={`md-chip ${on ? "on" : ""}`} onClick={() => toggle(codes, setCodes, r.code)} aria-pressed={on}>
                          <span className="md-chip-box">{on ? "✓" : ""}</span>
                          {nameOf(r)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md-field">
                  <label>{L("ឃ្លាំង / ហាង", "Warehouses / shops")}</label>
                  <div className="md-chips">
                    {warehouses.map((w) => {
                      const on = whIds.includes(String(w._id));
                      return (
                        <button key={w._id} type="button" className={`md-chip ${on ? "on" : ""}`} onClick={() => toggle(whIds, setWhIds, String(w._id))} aria-pressed={on}>
                          <span className="md-chip-box">{on ? "✓" : ""}</span>
                          {w.code}
                        </button>
                      );
                    })}
                  </div>
                  <span className="md-sub">{L("មិនជ្រើស = ឃ្លាំងរបស់ក្រុមនីមួយៗ (ឬទាំងអស់)", "None = each group's own shops (or all)")}</span>
                </div>

                {category && (
                  <div className="tg-send-tag">
                    {L("តែប្រភេទ:", "Only category:")} <b>{categoryName || "-"}</b>
                    <button type="button" className="md-icon-btn" onClick={() => setCategory("")} title={L("ដកចេញ", "Remove")}>
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div className="md-field">
                  <label>{L("សាររបស់អ្នក (ស្រេចចិត្ត)", "Your message (optional)")}</label>
                  <textarea rows={3} value={text} maxLength={3500} onChange={(e) => setText(e.target.value)} placeholder={L("ឧ. សូមបញ្ជាទិញបន្ថែមមុនថ្ងៃសុក្រ", "e.g. Please reorder before Friday")} />
                </div>
              </div>

              <div className="tg-send-preview">
                <div className="tg-send-preview-head">
                  <span>{L("មើលជាមុន", "Preview")}</span>
                  {codes.length > 1 && (
                    <Select className="md-filter" value={previewCode} onChange={(e) => setPreviewCode(e.target.value)}>
                      {codes.map((c) => (
                        <option key={c} value={c}>
                          {nameOf(reportList.find((r) => r.code === c)) || c}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                <div className="tg-chat-bg tg-send-bubbles">
                  {text.trim() && <TgBubble text={`✉️ ${text.trim().replace(/</g, "&lt;")}`} />}
                  {previewCode ? (
                    previewing && !preview ? <TgBubble empty={L("កំពុងផ្ទុក...", "Loading...")} /> : <TgBubble text={preview} />
                  ) : (
                    !text.trim() && <TgBubble empty={L("ជ្រើសរើសរបាយការណ៍ ឬសរសេរសារ", "Pick a report or write a message")} />
                  )}
                </div>
              </div>
            </div>
          )}

          {done && <div className={`md-notice md-notice-${done.ok ? "success" : "error"}`}>{done.text}</div>}
          {error && <div className="md-form-error">{error}</div>}
        </div>

        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={sending}>
            {done?.ok ? L("បិទ", "Close") : L("បោះបង់", "Cancel")}
          </button>
          <button type="button" className="md-btn md-btn-primary" onClick={send} disabled={!canSend}>
            {done?.ok ? <Check size={16} /> : <Send size={16} />}
            {sending ? L("កំពុងផ្ញើ...", "Sending...") : done?.ok ? L("បានផ្ញើ", "Sent") : L("ផ្ញើឥឡូវ", "Send now")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toolbar button (admin + central manager only; hidden for everyone else)
export function SendTelegramButton({ compact, ...props }) {
  const [open, setOpen] = useState(false);
  if (!canManageStock()) return null;
  return (
    <>
      <button type="button" className="md-btn md-btn-ghost tg-send-btn" onClick={() => setOpen(true)} title={L("ផ្ញើទៅតេឡេក្រាម", "Send to Telegram")}>
        <Send size={16} />
        {!compact && <span>{L("តេឡេក្រាម", "Telegram")}</span>}
      </button>
      {open && <SendTelegramDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

export default SendTelegramButton;
