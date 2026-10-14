/* eslint-disable no-restricted-globals */
// Service worker (built by react-scripts with Workbox): makes the Cloud POS (/cloud/*) open and sell offline.
// The admin web itself still loads from the network (its pages are not served from the cache).
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

clientsClaim();
self.skipWaiting();

// app files (JS / CSS / index.html) of this build; "/" is NOT answered from the cache (admin web = network)
precacheAndRoute(self.__WB_MANIFEST, { directoryIndex: null });

// Cloud POS pages: the network first, the cached app when offline
const shell = createHandlerBoundToURL(`${process.env.PUBLIC_URL || ""}/index.html`);
registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        return await fetch(options.request);
      } catch {
        return shell(options);
      }
    },
    { allowlist: [/^\/cloud\//] },
  ),
);

// fonts (Google Fonts) — the POS looks the same offline
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new CacheFirst({ cacheName: "pos-fonts", plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 365 * 86400 })] }),
);

// product pictures (Cloudinary)
registerRoute(
  ({ url }) => url.hostname.endsWith("res.cloudinary.com"),
  new StaleWhileRevalidate({ cacheName: "pos-images", plugins: [new ExpirationPlugin({ maxEntries: 800, maxAgeSeconds: 30 * 86400 })] }),
);
