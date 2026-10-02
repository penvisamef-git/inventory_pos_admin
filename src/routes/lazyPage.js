import { lazy } from "react";

// React.lazy + one automatic reload when a screen's JS file is gone
// (after a new deploy the old file names no longer exist on the server).
const KEY = "inventory_pos_chunk_reload";
const loaders = [];

// After login, download every screen's JS in the background (one by one, when the browser is idle),
// so the first open of any screen doesn't wait for its file. Already-loaded files are not fetched again.
let preloaded = false;
export function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  const next = (i) => {
    if (i >= loaders.length) return;
    idle(() =>
      loaders[i]()
        .catch(() => {})
        .finally(() => next(i + 1)),
    );
  };
  setTimeout(() => next(0), 2500);
}

export default function lazyPage(load) {
  loaders.push(load);
  return lazy(() =>
    load()
      .then((m) => {
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          // ignore
        }
        return m;
      })
      .catch((err) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(KEY) === "1";
          sessionStorage.setItem(KEY, "1");
        } catch {
          // ignore
        }
        if (!reloaded) window.location.reload();
        throw err;
      }),
  );
}
