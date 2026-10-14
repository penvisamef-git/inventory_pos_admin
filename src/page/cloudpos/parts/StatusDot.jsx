import React from "react";
import { CloudOff, CloudUpload, Cloud } from "lucide-react";
import { L } from "../i18n";

// Online / offline + sales waiting to go to the cloud
export default function StatusDot({ status, onClick }) {
  const online = status?.online !== false;
  const waiting = status?.pending_sales || 0;
  const failed = status?.failed_sales || 0;
  return (
    <button type="button" className={`pos-status ${online ? "on" : "off"} ${failed ? "warn" : ""}`} onClick={onClick} title={status?.last_error || ""} disabled={!onClick}>
      {!online ? <CloudOff size={16} /> : waiting ? <CloudUpload size={16} /> : <Cloud size={16} />}
      <span>{!online ? L("អហ្វឡាញ", "Offline") : L("អនឡាញ", "Online")}</span>
      {waiting > 0 && <em>{waiting}</em>}
    </button>
  );
}
