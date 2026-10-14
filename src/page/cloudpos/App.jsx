import React, { useCallback, useEffect, useState } from "react";
import { api, session, setLoggedOutHandler } from "./api";
import { sync } from "./engine/api";
import { L } from "./i18n";
import { applyTheme, setThemeUser } from "./theme";
import Pair from "./screens/Pair";
import Login from "./screens/Login";
import OpenShift from "./screens/OpenShift";
import Sell from "./screens/Sell";
import "./pos.css";

// Cloud POS (in the browser): same flow as the local POS — not linked → Pair · PIN login · Open shift · sell.
// Data lives in this browser (IndexedDB); sales go to the cloud in the background.
export default function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState(session.user());

  const refresh = useCallback(async () => {
    try {
      const s = await api.status();
      if (s.ui_theme) applyTheme(s.ui_theme); // admin theme (comes with the sync)
      if (!s.paired && session.token()) {
        // unlinked in the admin web → nobody stays logged in
        session.clear();
        setUser(null);
      }
      setStatus(s);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setLoggedOutHandler(() => setUser(null));
    refresh();
    sync.startWorker(); // push / pull / ping in the background
    const off = sync.onChange(refresh); // online ↔ offline, sent, unlinked → the top bar at once
    const t = setInterval(refresh, 10000);
    return () => {
      clearInterval(t);
      off();
    };
  }, [refresh]);

  // the cashier's own colours while he is logged in (menu → My colours)
  useEffect(() => {
    setThemeUser(user?._id || null);
  }, [user]);

  const logout = async () => {
    await api.logout().catch(() => {});
    session.clear();
    setUser(null);
  };

  if (error && !status) {
    return (
      <div className="pos-center">
        <div className="pos-card pos-msg">
          <h2>{L("POS មិនអាចបើកទិន្នន័យក្នុង Browser", "The POS can't open its storage in this browser")}</h2>
          <p>{error}</p>
          <p className="pos-muted">{L("ប្រើ Chrome / Edge ធម្មតា (មិនមែន Private) ហើយព្យាយាមម្តងទៀត។", "Use a normal (not private) Chrome / Edge window and try again.")}</p>
          <button type="button" className="pos-btn pos-btn-primary" onClick={refresh}>{L("ព្យាយាមម្តងទៀត", "Try again")}</button>
        </div>
      </div>
    );
  }
  if (!status) return <div className="pos-center pos-muted">{L("កំពុងផ្ទុក...", "Loading...")}</div>;
  if (!status.paired) return <Pair status={status} onDone={refresh} />;
  if (!user || !session.token()) return <Login status={status} onLogin={(u) => { setUser(u); refresh(); }} />;
  if (!status.shift) return <OpenShift status={status} user={user} onOpened={refresh} onLogout={logout} />;
  return <Sell status={status} user={user} refresh={refresh} onLogout={logout} />;
}
