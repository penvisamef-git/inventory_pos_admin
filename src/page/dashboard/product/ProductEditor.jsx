import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, ImagePlus, Image as ImageIcon, Wand2, Layers, Package, Barcode, Settings2 } from "lucide-react";
import { productService, uploadService } from "../../../api/api.service";
import { nameKh } from "./productOptions";
import { L } from "../../../i18n";

const MAX_ATTRIBUTES = 3;
const idOf = (v) => String(v?._id || v || "");
const valueName = (v) => L(v?.name_kh || v?.name_en, v?.name_en || v?.name_kh);
const keyOf = (options) => options.map((o) => idOf(o.value_id)).join("|");

// a variant row in the form: unit_barcodes as { unitId: barcode }
const toRow = (v) => ({
  _id: v?._id,
  options: (v?.options || []).map((o) => ({ attribute_id: idOf(o.attribute_id), value_id: idOf(o.value_id) })),
  code: v?.code || "",
  barcode: v?.barcode || "",
  unit_barcodes: Object.fromEntries((v?.unit_barcodes || []).map((u) => [idOf(u.unit_id), u.barcode])),
  min_stock: v?.min_stock ?? "",
  status: v?.status !== false,
});

const emptyForm = () => ({
  code: "",
  name_kh: "",
  name_en: "",
  category_id: "",
  brand_id: "",
  description: "",
  image: null,
  base_unit_id: "",
  units: [],
  track_stock: true,
  track_batch: false,
  min_stock: 0,
  allow_discount: true,
  is_taxable: true,
  status: true,
  note: "",
  hasVariants: false,
  attribute_ids: [],
  picked: {}, // { attributeId: [valueId] }
  variants: [toRow({})],
});

function Switch({ checked, onChange, disabled, on, off }) {
  return (
    <label className="md-switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="md-switch-track" />
      {checked ? on : off}
    </label>
  );
}

function Section({ icon, title, hint, children, right }) {
  return (
    <section className="pe-section">
      <div className="pe-section-head">
        <span className="pe-section-icon">{icon}</span>
        <div>
          <h4>{title}</h4>
          {hint && <p>{hint}</p>}
        </div>
        {right && <div className="pe-section-right">{right}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Create / edit a product with its units and variants.
 * props: productId (null = new), lookups { categories (flat tree), brands, units, attributes }, onClose, onSaved(message)
 */
function ProductEditor({ productId, lookups, onClose, onSaved }) {
  const { categories, brands, units, attributes } = lookups;
  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const attrById = useMemo(() => new Map(attributes.map((a) => [String(a._id), a])), [attributes]);
  const unitById = useMemo(() => new Map(units.map((u) => [String(u._id), u])), [units]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // ---------- load ----------
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    productService
      .get(productId)
      .then((res) => {
        if (!alive) return;
        const p = res.data;
        const attrIds = (p.attribute_ids || []).map(idOf);
        const picked = {};
        attrIds.forEach((a) => (picked[a] = []));
        (p.variants || []).forEach((v) =>
          (v.options || []).forEach((o) => {
            const a = idOf(o.attribute_id);
            if (picked[a] && !picked[a].includes(idOf(o.value_id))) picked[a].push(idOf(o.value_id));
          }),
        );
        // keep the attribute's own value order
        attrIds.forEach((a) => {
          const order = (attrById.get(a)?.values || []).map((v) => String(v._id));
          picked[a].sort((x, y) => order.indexOf(x) - order.indexOf(y));
        });
        setOriginal(p);
        setForm({
          code: p.code,
          name_kh: p.name_kh,
          name_en: p.name_en || "",
          category_id: idOf(p.category_id),
          brand_id: idOf(p.brand_id),
          description: p.description || "",
          image: p.image?.url ? p.image : null,
          base_unit_id: idOf(p.base_unit_id),
          units: (p.units || []).map((u) => ({ unit_id: idOf(u.unit_id), factor: u.factor, is_sale_unit: u.is_sale_unit, is_purchase_unit: u.is_purchase_unit })),
          track_stock: p.track_stock !== false,
          track_batch: !!p.track_batch,
          min_stock: p.min_stock ?? 0,
          allow_discount: p.allow_discount !== false,
          is_taxable: p.is_taxable !== false,
          status: p.status !== false,
          note: p.note || "",
          hasVariants: attrIds.length > 0,
          attribute_ids: attrIds,
          picked,
          variants: (p.variants || []).map(toRow),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [productId, attrById]);

  // ---------- image preview ----------
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (form.image instanceof File) {
      const url = URL.createObjectURL(form.image);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(form.image?.url || "");
    return undefined;
  }, [form.image]);

  // ---------- variants ----------
  // every combination of the picked values; existing rows (same options) keep their _id, SKU and barcodes
  const rebuild = (attribute_ids, picked, current) => {
    const byKey = new Map(current.filter((v) => v.options.length).map((v) => [keyOf(v.options), v]));
    let combos = [[]];
    for (const a of attribute_ids) {
      const vals = picked[a] || [];
      combos = combos.flatMap((c) => vals.map((val) => [...c, { attribute_id: a, value_id: val }]));
    }
    if (!attribute_ids.length || combos.some((c) => c.length !== attribute_ids.length)) return [];
    return combos.map((options) => byKey.get(keyOf(options)) || { ...toRow({}), options });
  };

  const toggleAttribute = (id) => {
    setForm((f) => {
      const on = f.attribute_ids.includes(id);
      if (!on && f.attribute_ids.length >= MAX_ATTRIBUTES) return f;
      // keep the attribute order of the Attribute screen
      const ids = on ? f.attribute_ids.filter((x) => x !== id) : attributes.map((a) => String(a._id)).filter((x) => x === id || f.attribute_ids.includes(x));
      const picked = { ...f.picked };
      if (on) delete picked[id];
      else picked[id] = [];
      return { ...f, attribute_ids: ids, picked, variants: rebuild(ids, picked, f.variants) };
    });
  };

  const toggleValue = (attrId, valueId) => {
    setForm((f) => {
      const cur = f.picked[attrId] || [];
      const order = (attrById.get(attrId)?.values || []).map((v) => String(v._id));
      const next = cur.includes(valueId) ? cur.filter((x) => x !== valueId) : [...cur, valueId].sort((x, y) => order.indexOf(x) - order.indexOf(y));
      const picked = { ...f.picked, [attrId]: next };
      return { ...f, picked, variants: rebuild(f.attribute_ids, picked, f.variants) };
    });
  };

  const setHasVariants = (on) => {
    setForm((f) => {
      if (on) return { ...f, hasVariants: true, variants: rebuild(f.attribute_ids, f.picked, f.variants) };
      const fromForm = f.variants.find((v) => !v.options.length);
      const fromServer = original?.variants?.find((v) => v.is_default);
      return { ...f, hasVariants: false, variants: [fromForm || toRow(fromServer || {})] };
    });
  };

  const updateVariant = (i, patch) => setForm((f) => ({ ...f, variants: f.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  const updateUnitBarcode = (i, unitId, value) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, idx) => (idx === i ? { ...v, unit_barcodes: { ...v.unit_barcodes, [unitId]: value } } : v)) }));

  const autoSku = (v) =>
    [form.code || "CODE", ...v.options.map((o) => attrById.get(o.attribute_id)?.values.find((x) => String(x._id) === o.value_id)?.code || "")]
      .join("-")
      .toUpperCase();

  // ---------- units ----------
  const otherUnits = form.units.filter((u) => u.unit_id);
  const updateUnit = (i, patch) => set({ units: form.units.map((u, idx) => (idx === i ? { ...u, ...patch } : u)) });
  const baseUnit = unitById.get(form.base_unit_id);

  // ---------- save ----------
  const removedCount = useMemo(() => {
    if (!original) return 0;
    const keep = new Set(form.variants.filter((v) => v._id).map((v) => String(v._id)));
    return (original.variants || []).filter((v) => !keep.has(String(v._id))).length;
  }, [original, form.variants]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const need = [
      [form.code.trim(), L("កូដទំនិញ", "Product code")],
      [form.name_kh.trim(), L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)")],
      [form.category_id, L("ប្រភេទទំនិញ", "Category")],
      [form.base_unit_id, L("ឯកតាមូលដ្ឋាន", "Base unit")],
    ].find(([v]) => !v);
    if (need) return setError(L(`សូមបញ្ចូល ${need[1]}`, `Please enter ${need[1]}`));
    if (form.units.some((u) => u.unit_id && !(Number(u.factor) > 0)))
      return setError(L("ចំនួនបម្លែងឯកតាត្រូវធំជាង 0", "Unit factor must be greater than 0"));
    if (form.hasVariants) {
      if (!form.attribute_ids.length) return setError(L("សូមជ្រើសលក្ខណៈយ៉ាងហោចណាស់ ១", "Choose at least 1 attribute"));
      const empty = form.attribute_ids.find((a) => !(form.picked[a] || []).length);
      if (empty) return setError(L(`សូមជ្រើសតម្លៃសម្រាប់ ${nameKh(attrById.get(empty))}`, `Choose values for ${nameKh(attrById.get(empty))}`));
    }

    setSaving(true);
    try {
      let image = form.image;
      if (image instanceof File) {
        const fd = new FormData();
        fd.append("files", image);
        fd.append("folder", "product");
        const res = await uploadService.upload(fd);
        image = res.data?.[0] || null;
      }
      const unitIds = new Set(otherUnits.map((u) => u.unit_id));
      const variants = form.variants.map((v) => ({
        ...(v._id ? { _id: v._id } : {}),
        options: form.hasVariants ? v.options : [],
        code: form.hasVariants ? v.code.trim() || undefined : undefined,
        barcode: v.barcode.trim() || null,
        unit_barcodes: Object.entries(v.unit_barcodes || {})
          .filter(([u, b]) => unitIds.has(u) && String(b || "").trim())
          .map(([unit_id, barcode]) => ({ unit_id, barcode: barcode.trim() })),
        min_stock: v.min_stock === "" || v.min_stock === null ? null : Number(v.min_stock),
        status: v.status,
      }));
      const payload = {
        code: form.code.trim(),
        name_kh: form.name_kh.trim(),
        name_en: form.name_en.trim(),
        category_id: form.category_id,
        brand_id: form.brand_id || null,
        description: form.description,
        image: image || null,
        base_unit_id: form.base_unit_id,
        units: otherUnits.map((u) => ({ ...u, factor: Number(u.factor) })),
        attribute_ids: form.hasVariants ? form.attribute_ids : [],
        track_stock: form.track_stock,
        track_batch: form.track_stock && form.track_batch,
        min_stock: Number(form.min_stock) || 0,
        allow_discount: form.allow_discount,
        is_taxable: form.is_taxable,
        status: form.status,
        note: form.note,
        variants,
      };
      const res = productId ? await productService.update(productId, payload) : await productService.create(payload);
      onSaved(res.message || L("បានរក្សាទុក!", "Saved!"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const optionChip = (o) => {
    const a = attrById.get(o.attribute_id);
    const val = a?.values.find((x) => String(x._id) === o.value_id);
    return (
      <span key={o.attribute_id} className="md-value">
        {val?.color_hex && <i style={{ background: val.color_hex }} />}
        {valueName(val) || "?"}
      </span>
    );
  };

  const disabled = saving || loading;

  return (
    <div className="md-modal-backdrop" onMouseDown={() => !saving && onClose()}>
      <form className="md-modal pe-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{productId ? L("កែប្រែទំនិញ", "Edit product") : L("បង្កើតទំនិញថ្មី", "New product")}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className="md-modal-body pe-body">
          {loading ? (
            <div className="md-empty">{L("កំពុងផ្ទុកទិន្នន័យ...", "Loading data...")}</div>
          ) : (
            <>
              {/* ===== Basic ===== */}
              <Section icon={<Package size={18} />} title={L("ព័ត៌មានទូទៅ", "General")}>
                <div className="pe-basic">
                  <div className="pe-image">
                    {preview ? <img src={preview} alt="" /> : <div className="pe-image-empty"><ImageIcon size={30} /></div>}
                    <input
                      ref={fileRef}
                      type="file"
                      hidden
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) set({ image: file });
                        e.target.value = "";
                      }}
                    />
                    <div className="pe-image-actions">
                      <button type="button" className="md-btn md-btn-ghost" onClick={() => fileRef.current?.click()} disabled={disabled}>
                        <ImagePlus size={15} />
                        {preview ? L("ប្តូរ", "Change") : L("រូបភាព", "Image")}
                      </button>
                      {preview && (
                        <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => set({ image: null })} disabled={disabled} title={L("ដករូបភាពចេញ", "Remove image")}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="md-fields md-fields-grid pe-grow">
                    <div className="md-field">
                      <label>{L("កូដទំនិញ", "Product code")}<span className="md-required">*</span></label>
                      <input value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="ROMPER01" disabled={disabled} />
                      <span className="md-sub">{L("អក្សរ A-Z លេខ _ ឬ -", "Letters A-Z, digits, _ or -")}</span>
                    </div>
                    <div className="md-field">
                      <label>{L("ប្រភេទទំនិញ", "Category")}<span className="md-required">*</span></label>
                      <select value={form.category_id} onChange={(e) => set({ category_id: e.target.value })} disabled={disabled}>
                        <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                        {categories.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md-field">
                      <label>{L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)")}<span className="md-required">*</span></label>
                      <input value={form.name_kh} onChange={(e) => set({ name_kh: e.target.value })} placeholder="អាវជាប់ខោកប្បាស" disabled={disabled} />
                    </div>
                    <div className="md-field">
                      <label>{L("ឈ្មោះ (អង់គ្លេស)", "Name (English)")}</label>
                      <input value={form.name_en} onChange={(e) => set({ name_en: e.target.value })} placeholder="Cotton romper" disabled={disabled} />
                    </div>
                    <div className="md-field">
                      <label>{L("ម៉ាក", "Brand")}</label>
                      <select value={form.brand_id} onChange={(e) => set({ brand_id: e.target.value })} disabled={disabled}>
                        <option value="">{L("-- គ្មាន --", "-- None --")}</option>
                        {brands.map((b) => (
                          <option key={b._id} value={b._id}>{nameKh(b)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md-field">
                      <label>{L("ពិពណ៌នា", "Description")}</label>
                      <input value={form.description} onChange={(e) => set({ description: e.target.value })} disabled={disabled} />
                    </div>
                  </div>
                </div>
              </Section>

              {/* ===== Units ===== */}
              <Section
                icon={<Layers size={18} />}
                title={L("ឯកតា", "Units")}
                hint={L("ស្តុកត្រូវរាប់ជាឯកតាមូលដ្ឋាន។ ឯកតាធំៗ (កញ្ចប់ ប្រអប់) = ចំនួនឯកតាមូលដ្ឋាន", "Stock is counted in the base unit. Bigger units (pack, box) = how many base units")}
              >
                <div className="pe-units">
                  <div className="md-field pe-base-unit">
                    <label>{L("ឯកតាមូលដ្ឋាន", "Base unit")}<span className="md-required">*</span></label>
                    <select value={form.base_unit_id} onChange={(e) => set({ base_unit_id: e.target.value })} disabled={disabled}>
                      <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                      {units.map((u) => (
                        <option key={u._id} value={u._id}>{nameKh(u)} ({u.code})</option>
                      ))}
                    </select>
                  </div>
                  {form.units.map((u, i) => (
                    <div className="pe-unit-row" key={i}>
                      <span className="pe-eq">1</span>
                      <select value={u.unit_id} onChange={(e) => updateUnit(i, { unit_id: e.target.value })} disabled={disabled}>
                        <option value="">{L("-- ឯកតា --", "-- Unit --")}</option>
                        {units
                          .filter((x) => String(x._id) !== form.base_unit_id && (String(x._id) === u.unit_id || !form.units.some((y) => y.unit_id === String(x._id))))
                          .map((x) => (
                            <option key={x._id} value={x._id}>{nameKh(x)}</option>
                          ))}
                      </select>
                      <span className="pe-eq">=</span>
                      <input type="number" min="0" step="any" value={u.factor} onChange={(e) => updateUnit(i, { factor: e.target.value })} disabled={disabled} />
                      <span className="pe-eq">{baseUnit ? nameKh(baseUnit) : L("ឯកតាមូលដ្ឋាន", "base unit")}</span>
                      <label className="pe-check">
                        <input type="checkbox" checked={u.is_sale_unit} onChange={(e) => updateUnit(i, { is_sale_unit: e.target.checked })} disabled={disabled} />
                        {L("លក់", "Sell")}
                      </label>
                      <label className="pe-check">
                        <input type="checkbox" checked={u.is_purchase_unit} onChange={(e) => updateUnit(i, { is_purchase_unit: e.target.checked })} disabled={disabled} />
                        {L("ទិញចូល", "Buy")}
                      </label>
                      <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => set({ units: form.units.filter((_, idx) => idx !== i) })} disabled={disabled}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="md-btn md-btn-ghost"
                    style={{ width: "fit-content" }}
                    onClick={() => set({ units: [...form.units, { unit_id: "", factor: "", is_sale_unit: true, is_purchase_unit: true }] })}
                    disabled={disabled || !form.base_unit_id}
                  >
                    <Plus size={14} />
                    {L("បន្ថែមឯកតាធំ (កញ្ចប់ / ប្រអប់)", "Add bigger unit (pack / box)")}
                  </button>
                </div>
              </Section>

              {/* ===== Variants ===== */}
              <Section
                icon={<Barcode size={18} />}
                title={L("ប្រភេទរង (Variant) និងបាកូដ", "Variants & barcodes")}
                hint={
                  form.hasVariants
                    ? L("ជ្រើសលក្ខណៈ និងតម្លៃ → ប្រព័ន្ធបង្កើតប្រភេទរងគ្រប់ការផ្សំ", "Pick attributes and values → every combination becomes a variant")
                    : L("ទំនិញធម្មតា (១ SKU)។ បើកដើម្បីបំបែកតាមទំហំ / ពណ៌", "Simple product (1 SKU). Turn on to split by size / color")
                }
                right={
                  <Switch
                    checked={form.hasVariants}
                    onChange={setHasVariants}
                    disabled={disabled}
                    on={L("មានទំហំ / ពណ៌", "Has size / color")}
                    off={L("ទំនិញធម្មតា", "Simple product")}
                  />
                }
              >
                {form.hasVariants && (
                  <div className="pe-attrs">
                    <div className="md-chips">
                      {attributes.map((a) => {
                        const on = form.attribute_ids.includes(String(a._id));
                        return (
                          <button
                            key={a._id}
                            type="button"
                            className={`md-chip ${on ? "on" : ""}`}
                            onClick={() => toggleAttribute(String(a._id))}
                            disabled={disabled || (!on && form.attribute_ids.length >= MAX_ATTRIBUTES)}
                          >
                            <span className="md-chip-box">{on ? "✓" : ""}</span>
                            {nameKh(a)}
                          </button>
                        );
                      })}
                    </div>
                    {form.attribute_ids.map((aid) => {
                      const a = attrById.get(aid);
                      if (!a) return null;
                      return (
                        <div className="pe-attr" key={aid}>
                          <span className="pe-attr-name">{nameKh(a)}</span>
                          <div className="pe-values">
                            {a.values.filter((v) => v.status !== false || (form.picked[aid] || []).includes(String(v._id))).map((v) => {
                              const on = (form.picked[aid] || []).includes(String(v._id));
                              return (
                                <button key={v._id} type="button" className={`pe-value ${on ? "on" : ""}`} onClick={() => toggleValue(aid, String(v._id))} disabled={disabled}>
                                  {v.color_hex && <i style={{ background: v.color_hex }} />}
                                  {valueName(v)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(form.hasVariants ? form.variants.length > 0 : true) && (
                  <div className="md-table-scroll pe-variants">
                    <table className="md-table">
                      <thead>
                        <tr>
                          {form.hasVariants && <th>{L("ជម្រើស", "Options")}</th>}
                          <th>SKU</th>
                          <th>{L("បាកូដ", "Barcode")} {baseUnit ? `(${nameKh(baseUnit)})` : ""}</th>
                          {otherUnits.map((u) => (
                            <th key={u.unit_id}>{L("បាកូដ", "Barcode")} ({nameKh(unitById.get(u.unit_id))})</th>
                          ))}
                          {form.hasVariants && <th>{L("ស្តុកអប្បបរមា", "Min stock")}</th>}
                          {form.hasVariants && <th>{L("ប្រើ", "Active")}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {form.variants.map((v, i) => (
                          <tr key={v._id || keyOf(v.options) || i} className={v.status ? "" : "pe-off"}>
                            {form.hasVariants && (
                              <td>
                                <div className="md-values">
                                  {v.options.map(optionChip)}
                                  {!v._id && <span className="pe-new">{L("ថ្មី", "New")}</span>}
                                </div>
                              </td>
                            )}
                            <td>
                              {form.hasVariants ? (
                                <input className="pe-input" value={v.code} placeholder={autoSku(v)} onChange={(e) => updateVariant(i, { code: e.target.value.toUpperCase() })} disabled={disabled} />
                              ) : (
                                <span className="md-code">{form.code || "—"}</span>
                              )}
                            </td>
                            <td>
                              <input className="pe-input" value={v.barcode} onChange={(e) => updateVariant(i, { barcode: e.target.value })} placeholder="885…" disabled={disabled} />
                            </td>
                            {otherUnits.map((u) => (
                              <td key={u.unit_id}>
                                <input className="pe-input" value={v.unit_barcodes[u.unit_id] || ""} onChange={(e) => updateUnitBarcode(i, u.unit_id, e.target.value)} disabled={disabled} />
                              </td>
                            ))}
                            {form.hasVariants && (
                              <td>
                                <input className="pe-input pe-num" type="number" min="0" value={v.min_stock} placeholder={String(form.min_stock || 0)} onChange={(e) => updateVariant(i, { min_stock: e.target.value })} disabled={disabled} />
                              </td>
                            )}
                            {form.hasVariants && (
                              <td>
                                <input type="checkbox" checked={v.status} onChange={(e) => updateVariant(i, { status: e.target.checked })} disabled={disabled} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {form.hasVariants && (
                  <div className="pe-variant-foot">
                    <Wand2 size={14} />
                    {L(`${form.variants.length} ប្រភេទរង`, `${form.variants.length} variants`)}
                    {removedCount > 0 && (
                      <span className="pe-warn">
                        · {L(`${removedCount} ប្រភេទរងចាស់នឹងត្រូវលុប`, `${removedCount} old variant(s) will be removed`)}
                      </span>
                    )}
                    <span className="md-sub">{L("· SKU ទទេ = បង្កើតដោយស្វ័យប្រវត្តិ", "· Empty SKU = auto")}</span>
                  </div>
                )}
              </Section>

              {/* ===== Settings ===== */}
              <Section icon={<Settings2 size={18} />} title={L("ការកំណត់ស្តុក និងលក់", "Stock & sale settings")}>
                <div className="pe-settings">
                  <Switch checked={form.track_stock} onChange={(v) => set({ track_stock: v, track_batch: v && form.track_batch })} disabled={disabled} on={L("តាមដានស្តុក", "Track stock")} off={L("មិនតាមដានស្តុក (សេវា)", "No stock (service)")} />
                  <Switch checked={form.track_batch} onChange={(v) => set({ track_batch: v })} disabled={disabled || !form.track_stock} on={L("មានលេខ Batch + ថ្ងៃផុតកំណត់", "Batch no + expiry date")} off={L("គ្មាន Batch / ថ្ងៃផុតកំណត់", "No batch / expiry")} />
                  <Switch checked={form.allow_discount} onChange={(v) => set({ allow_discount: v })} disabled={disabled} on={L("អនុញ្ញាតបញ្ចុះតម្លៃ", "Discount allowed")} off={L("មិនបញ្ចុះតម្លៃ", "No discount")} />
                  <Switch checked={form.is_taxable} onChange={(v) => set({ is_taxable: v })} disabled={disabled} on={L("គិតពន្ធ (VAT)", "Taxable (VAT)")} off={L("មិនគិតពន្ធ", "Not taxable")} />
                  <div className="md-field pe-min">
                    <label>{L("ស្តុកអប្បបរមា (ក្នុងមួយប្រភេទរង)", "Min stock (per variant)")}</label>
                    <input type="number" min="0" value={form.min_stock} onChange={(e) => set({ min_stock: e.target.value })} disabled={disabled} />
                  </div>
                  <Switch checked={form.status} onChange={(v) => set({ status: v })} disabled={disabled} on={L("សកម្ម (ប្រើប្រាស់)", "Active (in use)")} off={L("អសកម្ម (លាក់)", "Inactive (hidden)")} />
                </div>
                <div className="md-field">
                  <label>{L("កំណត់សម្គាល់", "Note")}</label>
                  <textarea rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} disabled={disabled} />
                </div>
              </Section>

              {error && <div className="md-form-error">{error}</div>}
            </>
          )}
        </div>

        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={saving}>
            {L("បោះបង់", "Cancel")}
          </button>
          <button type="submit" className="md-btn md-btn-primary" disabled={disabled}>
            {saving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុក", "Save")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductEditor;
