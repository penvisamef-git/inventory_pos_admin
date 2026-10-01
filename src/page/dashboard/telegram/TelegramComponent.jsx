import React, { useCallback, useEffect, useState } from "react";
import { Bot, MessagesSquare, CalendarClock, FileText, Inbox } from "lucide-react";
import { telegramService, warehouseService } from "../../../api/api.service";
import BotTab from "./BotTab";
import ChatTab from "./ChatTab";
import ScheduleTab from "./ScheduleTab";
import TemplateTab from "./TemplateTab";
import MessageTab from "./MessageTab";
import { SendTelegramButton } from "./SendTelegram";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./telegram.style.css";
import { L } from "../../../i18n";

const TABS = [
  { key: "bot", icon: <Bot size={16} />, label: L("Bot", "Bots") },
  {
    key: "chat",
    icon: <MessagesSquare size={16} />,
    label: L("ក្រុម / Chat", "Groups / chats"),
  },
  {
    key: "schedule",
    icon: <CalendarClock size={16} />,
    label: L("របាយការណ៍តាមម៉ោង", "Scheduled reports"),
  },
  {
    key: "template",
    icon: <FileText size={16} />,
    label: L("អត្ថបទសារ", "Message text"),
  },
  {
    key: "message",
    icon: <Inbox size={16} />,
    label: L("សារដែលបានផ្ញើ", "Sent messages"),
  },
];

const tabFromHash = () => {
  const h = (window.location.hash || "").replace("#", "");
  return TABS.some((t) => t.key === h) ? h : "bot";
};

// Telegram: bots → groups/chats (each linked to one bot) → events + scheduled reports. Admin only.
function TelegramComponent() {
  const [tab, setTab] = useState(tabFromHash);
  const [meta, setMeta] = useState({ events: [], reports: [], languages: [] });
  const [bots, setBots] = useState([]);
  const [chats, setChats] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [m, b, c, w] = await Promise.all([
        telegramService.events(),
        telegramService.bot.list(),
        telegramService.chat.all(),
        warehouseService.all({ sort: "sort_order", order: "asc" }),
      ]);
      setMeta(m.data || { events: [], reports: [] });
      setBots(b.data || []);
      setChats(c.data || []);
      setWarehouses(w.data || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // phone: keep the active tab visible in the scrolling tab bar
  useEffect(() => {
    document.querySelector(".tg-tabs .md-tab-active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  const go = (key) => {
    setTab(key);
    window.history.replaceState(null, "", `#${key}`);
  };

  const shared = { meta, bots, chats, warehouses, reload, go };

  return (
    <div className="md-page tg-page">
      <div className="tg-head">
        <div className="md-tabs tg-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`md-tab ${tab === t.key ? "md-tab-active" : ""}`} onClick={() => go(t.key)}>
              {t.icon}
              {t.label}
              {t.key === "bot" && bots.length > 0 && <span className="tg-count">{bots.length}</span>}
              {t.key === "chat" && chats.length > 0 && <span className="tg-count">{chats.length}</span>}
            </button>
          ))}
        </div>
        {chats.length > 0 && <SendTelegramButton reports={["stock_summary"]} />}
      </div>

      {error && <div className="md-notice md-notice-error">{error}</div>}

      {tab === "bot" && <BotTab {...shared} />}
      {tab === "chat" && <ChatTab {...shared} />}
      {tab === "schedule" && <ScheduleTab {...shared} />}
      {tab === "template" && <TemplateTab {...shared} />}
      {tab === "message" && <MessageTab {...shared} />}
    </div>
  );
}

export default TelegramComponent;
