// IndexedDB for the browser POS (one database per browser). Everything the POS needs to sell offline lives here.
const NAME = "cloud_pos";
const VERSION = 2; // 2: customers
const STORES = {
  kv: "key", // config (device key, last sync …), data (shop data from the last pull)
  products: "_id",
  users: "_id", // staff of the shop with a PIN hash
  sessions: "token",
  shifts: "_id",
  sales: "uuid",
  holds: "_id",
  refunds: "uuid",
  events: "uuid", // login / logout
  counters: "_id", // invoice / refund / shift / hold numbers
  customers: "_id", // cloud copy (+ the ones added here: _id "u:<uuid>", synced false)
};

let opening = null;
export function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        Object.entries(STORES).forEach(([name, key]) => {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: key });
        });
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => reject(r.error);
    });
  }
  return opening;
}

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB aborted"));
  });
const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

export async function get(store, key) {
  const d = await db();
  return req(d.transaction(store).objectStore(store).get(key));
}
export async function all(store) {
  const d = await db();
  return req(d.transaction(store).objectStore(store).getAll());
}
export async function put(store, value) {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await done(tx);
  return value;
}
// replace = clear the store first (one transaction: never half old / half new)
export async function putMany(store, values, { replace = false } = {}) {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  if (replace) os.clear();
  values.forEach((v) => os.put(v));
  await done(tx);
}
export async function del(store, key) {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  tx.objectStore(store).delete(key);
  await done(tx);
}
export async function clear(stores) {
  const d = await db();
  const tx = d.transaction(stores, "readwrite");
  stores.forEach((s) => tx.objectStore(s).clear());
  await done(tx);
}
// read-modify-write in ONE transaction (safe when two tabs of the same POS write at once)
export async function update(store, key, fn) {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  let out;
  const cur = await req(os.get(key));
  out = fn(cur);
  if (out !== undefined) os.put(out);
  await done(tx);
  return out;
}

// next number for a key (atomic): INV2610 → 1, 2, 3 …
export async function nextSeq(key) {
  const row = await update("counters", key, (cur) => ({ _id: key, seq: (cur?.seq || 0) + 1 }));
  return row.seq;
}
// never go below n (numbers the cloud already has from this POS)
export async function atLeast(key, n) {
  if (!(n > 0)) return;
  await update("counters", key, (cur) => ((cur?.seq || 0) >= n ? undefined : { _id: key, seq: n }));
}
