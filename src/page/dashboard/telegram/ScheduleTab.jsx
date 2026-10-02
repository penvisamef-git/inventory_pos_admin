import React, { useEffect, useState } from "react";
import { Send, Eye, X } from "lucide-react";
import MasterDataPage, { statusCell, dateTimeText } from "../master_data/MasterDataPage";
import { telegramService } from "../../../api/api.service";
import { DAYS, daysText, soon, nameOf, whLabel, langLabel, LANG_OPTIONS, TgBubble } from "./telegramOptions";
import { L } from "../../../i18n";
import Select from "../../util/Select"; // searchable <select>

// rows editor works on objects → times ["08:00"] ⇄ [{ time: "08:00" }]; days are numbers in the API, strings in the chips
const toForm = (row) => ({ ...row, times: (row.times || []).map((t) => ({ time: t })) });
const toApi = (data) => ({
  ...data,
  times: (data.times || []).map((r) => (typeof r === "string" ? r : r.time)).filter(Boolean),
  days: (data.days || []).map(Number),
});
const service = {
  list: async (params = {}) => {
    const res = await telegramService.schedule.list();
    const q = String(params.q || "").toLowerCase();
    const data = (res.data || [])
      .filter((s) => !q || `${s.name} ${(s.chat_ids || []).map((c) => c.title).join(" ")}`.toLowerCase().includes(q))
      .map(toForm);
    return { ...res, data, pagination: { total: data.length, totalPages: 1 } };
  },
  create: (data) => telegramService.schedule.create(toApi(data)),
  update: (id, data) => telegramService.schedule.update(id, toApi(data)),
  remove: (id) => telegramService.schedule.remove(id),
};

// what the report looks like right now
function PreviewModal({ schedule, reports, onClose }) {
  const [code, setCode] = useState(schedule.report_codes?.[0] || "");
  const [language, setLanguage] = useState(schedule.chat_ids?.[0]?.language || "both");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setLoading(true);
    setError("");
    telegramService
      .previewReport({ code, language, warehouse_ids: (schedule.warehouse_ids || []).map((w) => w._id || w).join(",") })
      .then((res) => alive && setText(res.data?.text || ""))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [code, language, schedule]);

  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal md-modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{L("មើលរបាយការណ៍ជាមុន", "Report preview")}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="md-modal-body">
          <div className="tg-preview-bar">
            <Select className="md-filter" value={code} onChange={(e) => setCode(e.target.value)}>
              {(schedule.report_codes || []).map((c) => (
                <option key={c} value={c}>
                  {nameOf(reports.find((r) => r.code === c)) || c}
                </option>
              ))}
            </Select>
            <Select className="md-filter" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="tg-chat-bg">{loading ? <TgBubble empty={L("កំពុងផ្ទុក...", "Loading...")} /> : <TgBubble text={text} />}</div>
          {error && <div className="md-form-error">{error}</div>}
          <p className="md-hint">{L("ទិន្នន័យពិតនៅពេលនេះ (មិនទាន់ផ្ញើទេ)", "Real data as of now (nothing is sent)")}</p>
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({ meta, chats, warehouses, go }) {
  const [notice, setNotice] = useState(null);
  const [sending, setSending] = useState("");
  const [preview, setPreview] = useState(null);
  const reports = meta.reports || [];

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const reportName = (c) => nameOf(reports.find((r) => r.code === c)) || c;

  const columns = [
    {
      key: "name",
      label: L("របាយការណ៍", "Reports"),
      render: (row) => (
        <>
          {row.name && <b>{row.name}</b>}
          <span className={row.name ? "md-sub" : ""}>{(row.report_codes || []).map(reportName).join(", ")}</span>
        </>
      ),
    },
    {
      key: "chats",
      label: L("ផ្ញើទៅ", "Sent to"),
      render: (row) => (
        <span className="md-values">
          {(row.chat_ids || []).map((c) => (
            <span key={c._id} className="md-value" title={langLabel(c.language)}>
              {c.title}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "times",
      label: L("ម៉ោង", "Time"),
      render: (row) => (
        <>
          <b>{(row.times || []).map((t) => t.time || t).join(", ")}</b>
          <span className="md-sub">{daysText(row.days)}</span>
        </>
      ),
    },
    {
      key: "warehouses",
      label: L("ឃ្លាំង / ហាង", "Warehouses"),
      render: (row) =>
        row.warehouse_ids?.length ? row.warehouse_ids.map((w) => w.code).join(", ") : <span className="md-hint">{L("តាម Chat", "Chat's shops")}</span>,
    },
    { key: "last_run_at", label: L("ផ្ញើចុងក្រោយ", "Last sent"), render: (row) => dateTimeText(row.last_run_at) },
    { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
  ];

  const fields = [
    { key: "name", label: L("ឈ្មោះ", "Name"), placeholder: L("ឧ. របាយការណ៍ពេលព្រឹក", "e.g. Morning report"), full: true },
    {
      key: "report_codes",
      label: L("របាយការណ៍", "Reports"),
      type: "multiselect",
      required: true,
      options: reports.map((r) => ({ value: r.code, label: `${nameOf(r)}${soon(r.phase)}` })),
    },
    {
      key: "chat_ids",
      label: L("ផ្ញើទៅក្រុម / Chat", "Send to groups / chats"),
      type: "multiselect",
      required: true,
      options: chats.map((c) => ({ value: c._id, label: `${c.title} · ${langLabel(c.language)}` })),
      emptyText: L("មិនទាន់មាន Chat — បន្ថែមនៅផ្ទាំង «ក្រុម / Chat»", "No chats yet — add one in “Groups / chats”"),
    },
    {
      key: "times",
      label: L("ម៉ោងផ្ញើ (ម៉ោងកម្ពុជា)", "Send at (Cambodia time)"),
      type: "rows",
      required: true,
      full: true,
      columns: [{ key: "time", label: L("ម៉ោង", "Time"), type: "time", width: "180px" }],
      newRow: (rows) => ({ time: rows.length ? "18:00" : "08:00" }),
      addLabel: L("បន្ថែមម៉ោង", "Add time"),
      default: [{ time: "08:00" }],
    },
    { key: "days", label: L("ថ្ងៃ", "Days"), type: "multiselect", required: true, options: DAYS, default: DAYS.map((d) => d.value) },
    {
      key: "warehouse_ids",
      label: L("ឃ្លាំង / ហាង", "Warehouses / shops"),
      type: "multiselect",
      options: warehouses.map((w) => ({ value: w._id, label: whLabel(w) })),
      hint: L("មិនជ្រើស = ឃ្លាំងរបស់ Chat នីមួយៗ (ឬទាំងអស់)", "None selected = each chat's warehouses (or all)"),
    },
    { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
  ];

  const sendNow = async (row, refresh) => {
    setSending(row._id);
    try {
      const res = await telegramService.schedule.sendNow(row._id);
      setNotice({ type: res.data?.sent === res.data?.queued ? "success" : "error", text: res.message });
      refresh();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setSending("");
    }
  };

  if (!chats.length) {
    return (
      <div className="md-card tg-help">
        <b>{L("សូមបន្ថែមក្រុម / Chat ជាមុនសិន", "Add a group / chat first")}</b>
        <p>{L("របាយការណ៍ត្រូវផ្ញើទៅក្រុម / Chat ដែលបានភ្ជាប់។", "Reports are sent to linked groups / chats.")}</p>
        <button type="button" className="md-btn md-btn-primary" onClick={() => go("chat")}>
          {L("ទៅផ្ទាំងក្រុម / Chat", "Go to Groups / chats")}
        </button>
      </div>
    );
  }

  return (
    <>
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <MasterDataPage
        title={L("កាលវិភាគរបាយការណ៍", "Report schedule")}
        service={service}
        fields={fields}
        columns={columns}
        searchKeys={["name"]}
        getName={(row) => row.name || (row.report_codes || []).map(reportName).join(", ")}
        wide
        extraActions={(row, refresh) => (
          <>
            <button type="button" className="md-icon-btn" onClick={() => setPreview(row)} title={L("មើលជាមុន", "Preview")}>
              <Eye size={15} />
            </button>
            <button type="button" className="md-icon-btn" onClick={() => sendNow(row, refresh)} disabled={sending === row._id} title={L("ផ្ញើឥឡូវ", "Send now")}>
              <Send size={15} className={sending === row._id ? "md-spin" : ""} />
            </button>
          </>
        )}
      />
      {preview && <PreviewModal schedule={preview} reports={reports} onClose={() => setPreview(null)} />}
    </>
  );
}

export default ScheduleTab;
