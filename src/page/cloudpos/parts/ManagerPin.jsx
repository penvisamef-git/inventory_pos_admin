import React, { useEffect, useState } from "react";
import { api } from "../api";
import { L } from "../i18n";

// "Shop manager approval": pick a manager + PIN. value = { user_id, pin } (checked by the server with the request)
export default function ManagerPin({ value, onChange, onEnter }) {
  const [managers, setManagers] = useState([]);
  useEffect(() => {
    api.users().then((u) => {
      const m = u.filter((x) => x.is_manager);
      setManagers(m);
      if (m.length === 1 && !value?.user_id) onChange({ user_id: String(m[0]._id), pin: value?.pin || "" });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const v = value || { user_id: "", pin: "" };
  return (
    <div className="pos-approve">
      <b>{L("ការអនុម័តដោយអ្នកគ្រប់គ្រងហាង", "Shop manager approval")}</b>
      {!managers.length && <span className="pos-muted">{L("មិនមានអ្នកគ្រប់គ្រងមាន PIN នៅ POS នេះ", "No shop manager with a PIN on this POS")}</span>}
      {managers.length > 0 && (
        <>
          <select value={v.user_id} onChange={(e) => onChange({ ...v, user_id: e.target.value })}>
            <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
            {managers.map((m) => <option key={m._id} value={String(m._id)}>{m.name}</option>)}
          </select>
          <input type="password" inputMode="numeric" maxLength={6} value={v.pin} onChange={(e) => /^\d*$/.test(e.target.value) && onChange({ ...v, pin: e.target.value })} onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()} placeholder="PIN" />
        </>
      )}
    </div>
  );
}
