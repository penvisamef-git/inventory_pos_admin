import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { telegramService } from "../../../api/api.service";
import { dateTimeText } from "../master_data/MasterDataPage";
import { nameOf, TgBubble } from "./telegramOptions";
import { L } from "../../../i18n";

const STATES = {
  pending: { label: L("រង់ចាំ", "Pending"), badge: "md-badge-gold" },
  sent: { label: L("បានផ្ញើ", "Sent"), badge: "md-badge-on" },
  failed: { label: L("បរាជ័យ", "Failed"), badge: "md-badge-danger" },
};
const KINDS = { event: L("ព្រឹត្តិការណ៍", "Event"), report: L("របាយការណ៍", "Report"), test: L("សាកល្បង", "Test"), message: L("សារ", "Message") };
const LIMIT = 20;

function MessageTab({ meta, chats }) {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [state, setState] = useState("");
  const [chatRef, setChatRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState(null);
  const [retrying, setRetrying] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await telegramService.messages({ state, chat_ref: chatRef, page, limit: LIMIT });
      setRows(res.data || []);
      setCounts(res.counts || {});
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }, [state, chatRef, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const codeName = (row) => {
    if (row.kind === "test") return L("សារសាកល្បង", "Test message");
    if (row.kind === "message") return L("សារផ្ញើដោយដៃ", "Message sent by hand");
    const list = row.kind === "report" ? meta.reports : meta.events;
    return nameOf((list || []).find((e) => e.code === row.code)) || row.code;
  };

  const retry = async (row) => {
    setRetrying(row._id);
    try {
      const res = await telegramService.retry(row._id);
      setNotice({ type: res.data?.state === "sent" ? "success" : "error", text: res.data?.state === "sent" ? L("បានផ្ញើ ✅", "Sent ✅") : res.data?.last_error || res.message });
      load();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setRetrying("");
    }
  };

  const total = (counts.pending || 0) + (counts.sent || 0) + (counts.failed || 0);
  const pick = (s) => {
    setPage(1);
    setState(s);
  };
  const totalPages = Math.max(pagination.totalPages || 1, 1);

  return (
    <>
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <div className="tg-counts">
        <button type="button" className={`tg-count-card ${state === "" ? "on" : ""}`} onClick={() => pick("")}>
          <span>{L("ទាំងអស់", "All")}</span>
          <b>{total}</b>
        </button>
        {Object.entries(STATES).map(([k, s]) => (
          <button key={k} type="button" className={`tg-count-card tg-${k} ${state === k ? "on" : ""}`} onClick={() => pick(k)}>
            <span>{s.label}</span>
            <b>{counts[k] || 0}</b>
          </button>
        ))}
      </div>

      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <select
            className="md-filter"
            value={chatRef}
            onChange={(e) => {
              setPage(1);
              setChatRef(e.target.value);
            }}
          >
            <option value="">{L("គ្រប់ក្រុម / Chat", "All groups / chats")}</option>
            {chats.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table tg-msg-table">
            <thead>
              <tr>
                <th>{L("ពេលវេលា", "Time")}</th>
                <th>{L("ក្រុម / Chat", "Group / chat")}</th>
                <th>{L("សារ", "Message")}</th>
                <th>{L("ស្ថានភាព", "Status")}</th>
                <th className="md-col-actions">{L("សកម្មភាព", "Activity")}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="md-empty">
                    {L("មិនទាន់មានសារ", "No messages yet")}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <React.Fragment key={r._id}>
                  <tr>
                    <td>
                      <span className="tg-cell">
                        {dateTimeText(r.created_date)}
                        {r.sent_at && r.state === "sent" && <span className="md-sub">{L("ផ្ញើ", "sent")} {dateTimeText(r.sent_at)}</span>}
                      </span>
                    </td>
                    <td>
                      <span className="tg-cell">
                        <b>{r.chat_ref?.title || r.chat_id}</b>
                        {r.bot_id?.username && <span className="md-sub">@{r.bot_id.username}</span>}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="tg-msg-name" onClick={() => setOpen(open === r._id ? null : r._id)}>
                        <ChevronDown size={14} style={{ transform: open === r._id ? "rotate(180deg)" : "none" }} />
                        <span>{codeName(r)}</span>
                        <span className="md-value">{KINDS[r.kind] || r.kind}</span>
                      </button>
                      {r.last_error && r.state !== "sent" && <span className="md-sub tg-err">{r.last_error}</span>}
                    </td>
                    <td>
                      <span className={`md-badge ${STATES[r.state]?.badge || ""}`}>{STATES[r.state]?.label || r.state}</span>
                      {r.attempts > 1 && <span className="md-sub">{L(`ព្យាយាម ${r.attempts} ដង`, `${r.attempts} tries`)}</span>}
                    </td>
                    <td className="md-col-actions">
                      {r.state !== "sent" && (
                        <button type="button" className="md-icon-btn" onClick={() => retry(r)} disabled={retrying === r._id} title={L("ផ្ញើម្តងទៀត", "Send again")}>
                          <RotateCw size={15} className={retrying === r._id ? "md-spin" : ""} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === r._id && (
                    <tr className="tg-msg-open">
                      <td colSpan={5}>
                        <div className="tg-chat-bg">
                          <TgBubble text={r.text} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md-pagination">
          <div className="md-page-size">
            {L("សរុប", "Total")} {pagination.total || 0}
          </div>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
            <span>
              {L("ទំព័រ", "Page")} {page} / {totalPages}
            </span>
            <button type="button" className="md-icon-btn" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default MessageTab;
