// Code 128 barcode (B for text, C for long even digit runs) → [{ bar: true|false, w: modules }]
// Any USB / Bluetooth barcode scanner reads it and types the same text (product barcodes, SKUs).
const P = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232".split(" ");
const STOP = "2331112";
const START_B = 104;
const START_C = 105;

export function code128(text) {
  const s = String(text ?? "");
  if (!s) return [];
  const codes = [];
  if (/^\d+$/.test(s) && s.length % 2 === 0 && s.length >= 4) {
    codes.push(START_C);
    for (let i = 0; i < s.length; i += 2) codes.push(Number(s.slice(i, i + 2)));
  } else {
    codes.push(START_B);
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      codes.push(c >= 32 && c <= 127 ? c - 32 : 0); // outside ASCII → space
    }
  }
  const check = codes.reduce((t, v, i) => t + v * (i === 0 ? 1 : i), 0) % 103;
  const widths = [...codes, check].map((v) => P[v]).join("") + STOP;
  return widths.split("").map((w, i) => ({ bar: i % 2 === 0, w: Number(w) }));
}

// SVG barcode, width in mm
export function Barcode128({ value, height = 10, width = 36 }) {
  const bars = code128(value);
  const total = bars.reduce((t, b) => t + b.w, 0) + 20; // + quiet zones (10 modules each side)
  let x = 10;
  return (
    <svg className="lb-bars" viewBox={`0 0 ${total} 40`} preserveAspectRatio="none" style={{ width: `${width}mm`, height: `${height}mm` }} aria-label={value}>
      <rect x="0" y="0" width={total} height="40" fill="#fff" />
      {bars.map((b, k) => {
        const r = b.bar ? <rect key={k} x={x} y="0" width={b.w} height="40" fill="#000" /> : null;
        x += b.w;
        return r;
      })}
    </svg>
  );
}
