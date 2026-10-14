// KHQR (Bakong, NBC Cambodia) — dynamic QR with the amount, made on the POS (also offline).
// The cloud checks the payment with Bakong (md5 of this text) → the POS completes the sale by itself.
// Same file: local_pos/src/khqr.js · inventory_pos_admin/src/page/cloudpos/khqr.js
const tlv = (tag, value) => {
  const v = String(value ?? "");
  return v ? `${tag}${String(v.length).padStart(2, "0")}${v}` : "";
};

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — the EMV QR checksum
export function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const clean = (s, max) => String(s || "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim().slice(0, max);

/**
 * { account: "shop@aclb" (Bakong account id), name, city, amount, currency: "USD" | "KHR", bill, store, terminal, minutes }
 * → KHQR text (individual account, dynamic, expires after `minutes`)
 */
export function buildKhqr({ account, name, city = "Phnom Penh", amount, currency = "USD", bill = "", store = "", terminal = "", minutes = 15 }) {
  const khr = currency === "KHR";
  const amt = khr ? String(Math.round(Number(amount) || 0)) : String(Math.round((Number(amount) || 0) * 100) / 100);
  const now = Date.now();
  const body = [
    tlv("00", "01"),
    tlv("01", "12"), // dynamic (one payment)
    tlv("29", tlv("00", clean(account, 32))),
    tlv("52", "5999"),
    tlv("53", khr ? "116" : "840"),
    tlv("54", amt),
    tlv("58", "KH"),
    tlv("59", clean(name, 25) || "Shop"),
    tlv("60", clean(city, 15) || "Phnom Penh"),
    tlv("62", [tlv("01", clean(bill, 25)), tlv("03", clean(store, 25)), tlv("07", clean(terminal, 25))].join("")),
    tlv("99", tlv("00", String(now)) + tlv("01", String(now + minutes * 60000))),
  ].join("");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}

// md5 (hex) of the KHQR text — Bakong looks the payment up by it
export function md5(str) {
  const bytes = unescape(encodeURIComponent(str));
  const n = bytes.length;
  const words = new Array((((n + 8) >> 6) + 1) * 16).fill(0);
  for (let i = 0; i < n; i++) words[i >> 2] |= bytes.charCodeAt(i) << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  words[words.length - 2] = n * 8;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);
  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let o = 0; o < words.length; o += 16) {
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c;
      c = b;
      const x = (a + f + K[i] + words[o + g]) | 0;
      const s = S[(i >> 4) * 4 + (i % 4)];
      b = (b + ((x << s) | (x >>> (32 - s)))) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  return [a0, b0, c0, d0].map((v) => Array.from({ length: 4 }, (_, k) => ((v >>> (k * 8)) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
