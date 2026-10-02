import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import MasterDataPage, { statusCell, dateTimeText } from "../master_data/MasterDataPage";
import { telegramService } from "../../../api/api.service";
import { CHAT_TYPES, LANG_OPTIONS, langLabel, GROUPS, soon, nameOf, whLabel } from "./telegramOptions";
import { L } from "../../../i18n";

function ChatTab({ meta, bots, warehouses, reload, go }) {
  const [notice, setNotice] = useState(null);
  const [testing, setTesting] = useState("");

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const events = meta.events || [];
  const eventName = (code) => nameOf(events.find((e) => e.code === code)) || code;

  const columns = [
    {
      key: "title",
      label: L("ក្រុម / Chat", "Group / chat"),
      render: (row) => (
        <>
          <b>{row.title}</b>
          <span className="md-sub tg-cell">
            {CHAT_TYPES.find((t) => t.value === row.type)?.label || row.type} · <span className="md-code">{row.chat_id}</span>
          </span>
        </>
      ),
    },
    { key: "bot", label: "Bot", render: (row) => (row.bot_id?.username ? `@${row.bot_id.username}` : row.bot_id?.name || "-") },
    { key: "language", label: L("ភាសា", "Language"), render: (row) => langLabel(row.language) },
    {
      key: "warehouses",
      label: L("ឃ្លាំង / ហាង", "Warehouses"),
      render: (row) =>
        row.warehouse_ids?.length ? (
          <span className="md-values">
            {row.warehouse_ids.map((w) => (
              <span key={w._id} className="md-value">
                {w.code}
              </span>
            ))}
          </span>
        ) : (
          <span className="md-hint">{L("ទាំងអស់", "All")}</span>
        ),
    },
    {
      key: "events",
      label: L("ព្រឹត្តិការណ៍", "Events"),
      render: (row) => (
        <span className="tg-events" title={(row.event_codes || []).map(eventName).join("\n")}>
          {row.event_codes?.length || 0} / {events.length}
        </span>
      ),
    },
    { key: "last_sent_at", label: L("ផ្ញើចុងក្រោយ", "Last sent"), render: (row) => dateTimeText(row.last_sent_at) },
    { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
  ];

  const botOptions = bots.map((b) => ({ value: b._id, label: `${b.name}${b.username ? ` (@${b.username})` : ""}` }));
  const eventOptions = events.map((e) => ({ value: e.code, label: `${GROUPS[e.group] || e.group} · ${nameOf(e)}${soon(e.phase)}` }));

  const fields = [
    { key: "bot_id", label: "Bot", type: "select", options: botOptions, required: true, default: bots.find((b) => b.is_default)?._id || "" },
    { key: "title", label: L("ឈ្មោះក្រុម", "Group name"), required: true, placeholder: L("ឧ. ក្រុមគ្រប់គ្រងស្តុក", "e.g. Stock team") },
    {
      key: "chat_id",
      label: "Chat ID",
      required: true,
      placeholder: "-1001234567890",
      hint: L("ងាយបំផុត: ផ្ទាំង Bot → 🔍 ស្វែងរក Chat", "Easiest: Bots tab → 🔍 Find chats"),
    },
    { key: "type", label: L("ប្រភេទ", "Type"), type: "select", options: CHAT_TYPES, noEmpty: true, default: "group" },
    { key: "language", label: L("ភាសាសារ", "Message language"), type: "select", options: LANG_OPTIONS, noEmpty: true, default: "both" },
    {
      key: "warehouse_ids",
      label: L("ឃ្លាំង / ហាង", "Warehouses / shops"),
      type: "multiselect",
      options: warehouses.map((w) => ({ value: w._id, label: whLabel(w) })),
      hint: L("មិនជ្រើស = ទទួលពីគ្រប់ឃ្លាំង / ហាង", "None selected = all warehouses / shops"),
    },
    {
      key: "event_codes",
      label: L("ព្រឹត្តិការណ៍ដែលផ្ញើមកក្រុមនេះ", "Events sent to this chat"),
      type: "multiselect",
      options: eventOptions,
      default: events.filter((e) => e.phase < 4 && e.code !== "pos_sale").map((e) => e.code), // "every sale" only when ticked
    },
    { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
  ];

  const test = async (row) => {
    setTesting(row._id);
    try {
      const res = await telegramService.chat.test(row._id);
      setNotice({ type: "success", text: res.message });
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setTesting("");
    }
  };

  if (!bots.length) {
    return (
      <div className="md-card tg-help">
        <b>{L("សូមបន្ថែម Bot ជាមុនសិន", "Add a bot first")}</b>
        <p>{L("ក្រុម / Chat នីមួយៗត្រូវភ្ជាប់ជាមួយ Bot មួយ។", "Every group / chat is linked to one bot.")}</p>
        <button type="button" className="md-btn md-btn-primary" onClick={() => go("bot")}>
          {L("ទៅផ្ទាំង Bot", "Go to Bots")}
        </button>
      </div>
    );
  }

  return (
    <>
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <MasterDataPage
        title={L("ក្រុម / Chat", "Group / chat")}
        service={telegramService.chat}
        fields={fields}
        columns={columns}
        searchKeys={["title", "chat_id"]}
        filters={bots.length > 1 ? [{ key: "bot_id", label: L("Bot ទាំងអស់", "All bots"), options: botOptions }] : []}
        onSaved={reload}
        getName={(row) => row.title}
        wide
        extraActions={(row) => (
          <button type="button" className="md-icon-btn" onClick={() => test(row)} disabled={testing === row._id} title={L("ផ្ញើសារសាកល្បង", "Send a test message")}>
            <Send size={15} className={testing === row._id ? "md-spin" : ""} />
          </button>
        )}
      />
    </>
  );
}

export default ChatTab;
