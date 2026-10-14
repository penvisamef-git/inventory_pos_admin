import React, { useEffect } from "react";
import App from "./App";
import CustomerDisplay from "./screens/CustomerDisplay";
import "./base.css";
import "./theme"; // the theme this browser used last (no flash)

// Cloud POS: /cloud/pos (sell) and /cloud/pos/display (customer screen). No admin login — the browser is
// linked to a shop with a 6-digit code and cashiers log in with their PIN, like the local POS.
// Installable + works offline (service worker, production build only).
function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ""}/service-worker.js`).catch(() => {});
}

export default function CloudPosPage({ display = false }) {
  useEffect(() => {
    document.body.classList.add("cpos-body");
    if (!document.getElementById("print-root")) {
      const d = document.createElement("div");
      d.id = "print-root";
      document.body.appendChild(d);
    }
    document.title = display ? "Customer display" : "Cloud POS";
    // "Install app" from this page opens the POS, not the admin web
    const link = document.querySelector('link[rel="manifest"]');
    const before = link?.getAttribute("href");
    if (link) link.setAttribute("href", "/cloud-pos.webmanifest");
    registerServiceWorker();
    return () => {
      document.body.classList.remove("cpos-body");
      if (link && before) link.setAttribute("href", before);
    };
  }, [display]);
  return <div className="cpos">{display ? <CustomerDisplay /> : <App />}</div>;
}
