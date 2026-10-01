import React, { useEffect, useRef, useState } from "react";
import { Search, ScanBarcode } from "lucide-react";
import { variantService } from "../../../api/api.service";
import { OptionChips, nameKh } from "./stockOptions";
import { L } from "../../../i18n";

/**
 * Search a SKU / barcode / name and pick a variant. Enter on an exact barcode / SKU picks it at once (scanner).
 * onPick(variant) — variant row from /product/variant (product_id populated with units)
 */
function VariantPicker({ onPick, disabled, autoFocus, placeholder }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setRows([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const res = await variantService.list({ q: text, limit: 12, status: "true" });
        setRows(res.data || []);
        setActive(0);
        setOpen(true);
      } catch {
        setRows([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (v) => {
    onPick(v);
    setQ("");
    setRows([]);
    setOpen(false);
  };

  const onKey = async (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const text = q.trim();
      if (!text) return;
      // scanner: exact barcode / SKU
      try {
        const res = await variantService.list({ q: text, limit: 12, status: "true" });
        const list = res.data || [];
        const exact = list.find((v) => v.code === text.toUpperCase() || v.barcode === text || (v.unit_barcodes || []).some((u) => u.barcode === text));
        if (exact) return pick(exact);
        if (list[active]) return pick(list[active]);
      } catch {
        /* ignore */
      }
    } else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="vp" ref={boxRef}>
      <div className="md-search vp-input">
        <Search size={16} />
        <input
          value={q}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder || L("ស្កេនបាកូដ ឬវាយ SKU / ឈ្មោះទំនិញ...", "Scan a barcode or type SKU / name...")}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => rows.length && setOpen(true)}
          onKeyDown={onKey}
        />
        <ScanBarcode size={16} />
      </div>
      {open && rows.length > 0 && (
        <div className="vp-list">
          {rows.map((v, i) => (
            <button type="button" key={v._id} className={`vp-row ${i === active ? "on" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => pick(v)}>
              <span className="vp-main">
                <b>{nameKh(v.product_id)}</b>
                <OptionChips options={v.options} />
              </span>
              <span className="md-code">{v.code}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && rows.length === 0 && <div className="vp-list vp-empty">{L("រកមិនឃើញ", "Not found")}</div>}
    </div>
  );
}

export default VariantPicker;
