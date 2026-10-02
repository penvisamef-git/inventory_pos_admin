import React, { useEffect, useMemo, useState } from "react";
import { Zap, Search, X, Plus, Check } from "lucide-react";
import MasterDataPage, { statusCell, dateTimeText } from "../master_data/MasterDataPage";
import { telegramService } from "../../../api/api.service";
import { CHAT_TYPES } from "./telegramOptions";
import { L } from "../../../i18n";

const COLUMNS = [
  {
    key: "name",
    label: L("ឈ្មោះ", "Name"),
    render: (row) => (
      <>
        <b>{row.name}</b>
        {row.username && <span className="md-sub">@{row.username}</span>}
      </>
    ),
  },
  { key: "token_hint", label: "Token", render: (row) => <span className="md-code">{row.token_hint || "-"}</span> },
  {
    key: "is_default",
    label: L("លំនាំដើម", "Default"),
    render: (row) => (row.is_default ? <span className="md-badge md-badge-on">{L("លំនាំដើម", "Default")}</span> : "-"),
  },
  { key: "chat_count", label: L("ក្រុម / Chat", "Chats"), render: (row) => row.chat_count || 0 },
  {
    key: "last_check_at",
    label: L("ពិនិត្យចុងក្រោយ", "Last check"),
    render: (row) => (
      <>
        {dateTimeText(row.last_check_at)}
        {row.last_error && <span className="md-sub tg-err">{row.last_error}</span>}
      </>
    ),
  },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

const FIELDS = [
  { key: "name", label: L("ឈ្មោះ", "Name"), required: true, placeholder: L("ឧ. Bot ហាង", "e.g. Shop bot") },
  {
    key: "token",
    label: "Bot token",
    type: "password",
    full: true,
    placeholder: "123456789:AAE…",
    hint: L("យកពី @BotFather (/newbot)។ ពេលកែប្រែ ទុកទទេ = រក្សា Token ចាស់។ Token ត្រូវបានរក្សាទុកដោយអ៊ិនគ្រីប ហើយមិនបង្ហាញម្តងទៀតទេ",
      "From @BotFather (/newbot). When editing, leave empty to keep the current token. It is stored encrypted and never shown again",
    ),
  },
  { key: "is_default", label: L("Bot លំនាំដើម", "Default bot"), type: "checkbox" },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
];

// don't send an empty token on edit (= keep the current one)
const service = {
  ...telegramService.bot,
  // the API returns every bot (few) → search here
  list: async (params = {}) => {
    const res = await telegramService.bot.list();
    const q = String(params.q || "").toLowerCase();
    const data = q ? res.data.filter((b) => `${b.name} ${b.username}`.toLowerCase().includes(q)) : res.data;
    return { ...res, data, pagination: { total: data.length, totalPages: 1 } };
  },
  update: (id, data) => {
    const { token, ...rest } = data;
    return telegramService.bot.update(id, token ? { ...rest, token } : rest);
  },
};

// default events for a new chat: everything except "every sale" (too many messages; tick it when wanted)
const ALL_STOCK_EVENTS = (events) => events.filter((e) => e.phase < 4 && e.code !== "pos_sale").map((e) => e.code);

// "Find chats": groups / people that wrote to the bot recently → add in one click
function FindChatsModal({ bot, events, onClose, onAdded }) {
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setRows(null);
    setError("");
    try {
      const res = await telegramService.bot.findChats(bot._id);
      setRows(res.data || []);
      setMessage(res.message || "");
    } catch (err) {
      setError(err.message);
      setRows([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot._id]);

  const add = async (c) => {
    setBusy(c.chat_id);
    setError("");
    try {
      await telegramService.chat.create({
        bot_id: bot._id,
        chat_id: c.chat_id,
        title: c.title,
        type: CHAT_TYPES.some((t) => t.value === c.type) ? c.type : "group",
        language: "both",
        event_codes: ALL_STOCK_EVENTS(events),
        warehouse_ids: [],
      });
      setRows((prev) => prev.map((r) => (r.chat_id === c.chat_id ? { ...r, already_added: true } : r)));
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>
            {L("ស្វែងរក Chat របស់", "Find chats of")} @{bot.username}
          </h3>
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="md-modal-body">
          <p className="md-hint">
            {L("បន្ថែម Bot ចូលក្រុមតេឡេក្រាម រួចផ្ញើសារមួយក្នុងក្រុម (ឧ. /start@" + bot.username + ") ហើយចុច «ស្វែងរកម្តងទៀត»។",
              "Add the bot to your Telegram group, send a message there (e.g. /start@" + bot.username + "), then press “Search again”.",
            )}
          </p>
          {rows === null && <div className="tg-empty">{L("កំពុងស្វែងរក...", "Searching...")}</div>}
          {rows && rows.length === 0 && !error && <div className="tg-empty">{message || L("មិនទាន់មាន Chat", "No chats yet")}</div>}
          {rows && rows.length > 0 && (
            <div className="tg-found">
              {rows.map((c) => (
                <div key={c.chat_id} className="tg-found-row">
                  <div>
                    <b>{c.title}</b>
                    <span className="md-sub">
                      {CHAT_TYPES.find((t) => t.value === c.type)?.label || c.type} · <span className="md-code">{c.chat_id}</span>
                    </span>
                  </div>
                  {c.already_added ? (
                    <span className="md-badge md-badge-on">
                      <Check size={12} /> {L("បានបន្ថែម", "Added")}
                    </span>
                  ) : (
                    <button type="button" className="md-btn md-btn-primary" onClick={() => add(c)} disabled={!!busy}>
                      <Plus size={14} />
                      {busy === c.chat_id ? "..." : L("បន្ថែម", "Add")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {error && <div className="md-form-error">{error}</div>}
          <p className="md-hint">
            {L("Chat ថ្មីទទួលព្រឹត្តិការណ៍ស្តុកទាំងអស់ ពីគ្រប់ហាង ជាភាសាខ្មែរ + អង់គ្លេស។ កែប្រែបាននៅផ្ទាំង «ក្រុម / Chat»។",
              "New chats get every stock event, for all shops, in Khmer + English. Change that in the “Groups / chats” tab.",
            )}
          </p>
        </div>
        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={rows === null}>
            <Search size={14} />
            {L("ស្វែងរកម្តងទៀត", "Search again")}
          </button>
          <button type="button" className="md-btn md-btn-primary" onClick={onClose}>
            {L("រួចរាល់", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotTab({ meta, bots, reload }) {
  const [notice, setNotice] = useState(null);
  const [finding, setFinding] = useState(null);
  const [testing, setTesting] = useState("");
  const [version, setVersion] = useState(0); // re-mount the table after "Find chats" (chat counts)

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const test = async (row, refresh) => {
    setTesting(row._id);
    try {
      const res = await telegramService.bot.test(row._id);
      setNotice({ type: "success", text: res.message });
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setTesting("");
      refresh();
    }
  };

  const steps = useMemo(
    () => [
      L("ក្នុងតេឡេក្រាម បើក @BotFather → /newbot → ដាក់ឈ្មោះ → ចម្លង Token", "In Telegram open @BotFather → /newbot → choose a name → copy the token"),
      L("ចុច «បន្ថែមថ្មី» ខាងក្រោម ហើយបិទភ្ជាប់ Token", "Press “Add new” below and paste the token"),
      L("បន្ថែម Bot ចូលក្រុមតេឡេក្រាម ហើយផ្ញើសារមួយក្នុងក្រុម", "Add the bot to your Telegram group and send a message in the group"),
      L("ចុច 🔍 «ស្វែងរក Chat» → «បន្ថែម» → រួចរាល់", "Press 🔍 “Find chats” → “Add” → done"),
    ],
    [],
  );

  return (
    <>
      {bots.length === 0 && (
        <div className="md-card tg-help">
          <b>{L("របៀបភ្ជាប់តេឡេក្រាម", "How to connect Telegram")}</b>
          <ol>
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <MasterDataPage
        key={version}
        title="Bot"
        service={service}
        fields={FIELDS}
        columns={COLUMNS}
        searchKeys={["name", "username"]}
        onSaved={reload}
        getName={(row) => `${row.name} (@${row.username})`}
        canDelete={(row) => !row.chat_count}
        extraActions={(row, refresh) => (
          <>
            <button type="button" className="md-icon-btn" onClick={() => test(row, refresh)} disabled={testing === row._id} title={L("សាកល្បង", "Test")}>
              <Zap size={15} className={testing === row._id ? "md-spin" : ""} />
            </button>
            <button type="button" className="md-icon-btn" onClick={() => setFinding(row)} title={L("ស្វែងរក Chat", "Find chats")}>
              <Search size={15} />
            </button>
          </>
        )}
      />
      {finding && <FindChatsModal bot={finding} events={meta.events || []} onClose={() => {
            setFinding(null);
            setVersion((v) => v + 1);
          }}
          onAdded={reload} />}
    </>
  );
}

export default BotTab;
