import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Pin, PinOff, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { noteService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { L } from "../../../i18n";
import Select from "../../util/Select"; // searchable <select>
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./note.style.css";

// Notes — like the notes app on a phone. Everyone keeps their own private notes;
// a super admin sees everyone's (filter by person) and can edit / delete them. Saves by itself while typing.
const COLORS = [
  { key: "default", label: L("ធម្មតា", "Plain") },
  { key: "yellow", label: L("លឿង", "Yellow") },
  { key: "green", label: L("បៃតង", "Green") },
  { key: "blue", label: L("ខៀវ", "Blue") },
  { key: "pink", label: L("ផ្កាឈូក", "Pink") },
  { key: "purple", label: L("ស្វាយ", "Purple") },
];
const SAVE_DELAY = 800;
const person = (u) => (u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email : "");
const firstLine = (t) => String(t || "").split("\n").find((x) => x.trim()) || "";

function whenText(d) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" });
  const day = (x) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Phnom_Penh" });
  if (day(date) === day(now)) return time;
  if (day(date) === day(new Date(now.getTime() - 86400000))) return L("ម្សិលមិញ", "Yesterday");
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Phnom_Penh" });
}

function NoteComponent() {
  const login = new Auth().getClientLogin();
  const isSuper = !!login?.is_super_admin;
  const myId = String(login?._id || "");

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState(""); // super admin: "" = everyone
  const [owners, setOwners] = useState([]);
  const [current, setCurrent] = useState(null); // { _id?, title, body, color, pinned, user_id, updated_date }
  const [status, setStatus] = useState(""); // "" | saving | saved | error text
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef(null);
  const saveTimer = useRef(null);
  const pending = useRef(null); // the latest version waiting to be saved
  const saving = useRef(Promise.resolve());

  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await noteService.list({ limit: 200, q: search || undefined, user_id: owner || undefined });
      setNotes(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, owner]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (isSuper) noteService.owners().then((r) => setOwners(r.data || [])).catch(() => {});
  }, [isSuper, notes.length]);

  // ---------------- saving (debounced, one request at a time) ----------------
  const upsertLocal = (doc) =>
    setNotes((list) => {
      const rest = list.filter((n) => n._id !== doc._id);
      return [doc, ...rest].sort((a, b) => (b.pinned === a.pinned ? new Date(b.updated_date) - new Date(a.updated_date) : b.pinned ? 1 : -1));
    });

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const note = pending.current;
    if (!note) return saving.current;
    pending.current = null;
    saving.current = saving.current.then(async () => {
      if (!note._id && !note.title.trim() && !note.body.trim()) return; // nothing typed yet
      setStatus("saving");
      try {
        const body = { title: note.title, body: note.body, color: note.color, pinned: note.pinned };
        const id = note._id || note.ref?.id;
        const res = id ? await noteService.update(id, body) : await noteService.create(body);
        if (note.ref) note.ref.id = res.data._id; // later saves of this new note go to the same row
        upsertLocal(res.data);
        setCurrent((c) => (c && (c._id === res.data._id || c.ref === note.ref) ? { ...c, _id: res.data._id, user_id: res.data.user_id, updated_date: res.data.updated_date } : c));
        setStatus("saved");
      } catch (err) {
        setStatus(err.message);
      }
    });
    return saving.current;
  }, []);

  const change = (patch, now = false) => {
    setCurrent((c) => {
      const next = { ...c, ...patch };
      pending.current = next;
      return next;
    });
    setStatus("");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, now ? 0 : SAVE_DELAY);
  };

  // save before leaving the page / closing the tab
  useEffect(() => {
    const before = (e) => {
      if (pending.current) {
        flush();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      window.removeEventListener("beforeunload", before);
      flush();
    };
  }, [flush]);

  const open = async (note) => {
    await flush();
    setConfirmDelete(false);
    setStatus("");
    setCurrent({ ...note });
  };
  const create = async () => {
    await flush();
    setConfirmDelete(false);
    setStatus("");
    setCurrent({ title: "", body: "", color: "default", pinned: false, ref: {} });
    setTimeout(() => document.querySelector(".nt-title")?.focus(), 50);
  };
  const remove = async () => {
    const id = current?._id || current?.ref?.id;
    pending.current = null;
    clearTimeout(saveTimer.current);
    if (id) {
      try {
        await noteService.remove(id);
        setNotes((list) => list.filter((n) => n._id !== id));
      } catch (err) {
        setStatus(err.message);
        return;
      }
    }
    setConfirmDelete(false);
    setCurrent(null);
  };

  // grow the text box with its content
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`;
  }, [current?.body, current?._id]);

  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const others = useMemo(() => notes.filter((n) => !n.pinned), [notes]);
  const othersNote = current?.user_id && String(current.user_id._id || current.user_id) !== myId;
  const words = current ? (current.body.trim() ? current.body.trim().split(/\s+/).length : 0) : 0;

  const Row = (n) => {
    const active = current && (current._id === n._id || current.ref?.id === n._id);
    const ownerOther = isSuper && n.user_id && String(n.user_id._id) !== myId;
    return (
      <button key={n._id} type="button" className={`nt-item nt-c-${n.color} ${active ? "is-active" : ""}`} onClick={() => open(n)}>
        <span className="nt-item-title">
          {n.pinned && <Pin size={13} />}
          {n.title || firstLine(n.body) || L("កំណត់ចំណាំថ្មី", "New note")}
        </span>
        <span className="nt-item-sub">
          <b>{whenText(n.updated_date)}</b> {(n.title ? firstLine(n.body) : n.body.split("\n").filter((x) => x.trim())[1]) || L("គ្មានអត្ថបទបន្ថែម", "No additional text")}
        </span>
        {ownerOther && <span className="nt-owner">{person(n.user_id)}</span>}
      </button>
    );
  };

  return (
    <div className={`md-page nt-page ${current ? "has-open" : ""}`}>
      <div className="nt-shell">
        {/* ---------------- list ---------------- */}
        <aside className="nt-list">
          <div className="nt-list-head">
            <div className="md-search nt-search">
              <Search size={16} />
              <input placeholder={L("ស្វែងរកកំណត់ចំណាំ...", "Search notes...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              {keyword && <button type="button" onClick={() => setKeyword("")}><X size={14} /></button>}
            </div>
            <button type="button" className="md-btn md-btn-primary nt-new" onClick={create} title={L("កំណត់ចំណាំថ្មី", "New note")}>
              <Plus size={18} />
            </button>
          </div>
          {isSuper && (
            <Select className="md-filter nt-owner-filter" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">{L("-- អ្នកប្រើទាំងអស់ --", "-- Everyone --")}</option>
              {owners.map((u) => (
                <option key={u._id} value={u._id}>{person(u)} ({u.count})</option>
              ))}
            </Select>
          )}
          <div className="nt-items">
            {loading && !notes.length && <div className="nt-empty-list">{L("កំពុងផ្ទុក...", "Loading...")}</div>}
            {error && <div className="nt-empty-list md-empty-error">{error}</div>}
            {!loading && !error && !notes.length && (
              <div className="nt-empty-list">
                <StickyNote size={28} />
                <span>{search ? L("រកមិនឃើញ", "Nothing found") : L("មិនទាន់មានកំណត់ចំណាំ", "No notes yet")}</span>
                {!search && <button type="button" className="md-btn md-btn-ghost" onClick={create}><Plus size={15} />{L("សរសេរកំណត់ចំណាំ", "Write a note")}</button>}
              </div>
            )}
            {pinned.length > 0 && <p className="nt-group">{L("ខ្ទាស់", "Pinned")}</p>}
            {pinned.map(Row)}
            {pinned.length > 0 && others.length > 0 && <p className="nt-group">{L("កំណត់ចំណាំ", "Notes")}</p>}
            {others.map(Row)}
          </div>
          <div className="nt-count">{L(`${notes.length} កំណត់ចំណាំ`, `${notes.length} note${notes.length === 1 ? "" : "s"}`)}</div>
        </aside>

        {/* ---------------- editor ---------------- */}
        <section className={`nt-editor nt-c-${current?.color || "default"}`}>
          {!current ? (
            <div className="nt-blank">
              <StickyNote size={44} strokeWidth={1.4} />
              <b>{L("ជ្រើសកំណត់ចំណាំ ឬសរសេរថ្មី", "Pick a note or write a new one")}</b>
              <span>{isSuper ? L("អ្នកឃើញកំណត់ចំណាំរបស់អ្នកប្រើទាំងអស់ ហើយអាចកែបាន", "You see everyone's notes and can edit them") : L("កំណត់ចំណាំរបស់អ្នក មានតែអ្នកប៉ុណ្ណោះដែលមើលឃើញ", "Your notes are private — only you can see them")}</span>
              <button type="button" className="md-btn md-btn-primary" onClick={create}><Plus size={16} />{L("កំណត់ចំណាំថ្មី", "New note")}</button>
            </div>
          ) : (
            <>
              <div className="nt-tools">
                <button type="button" className="md-icon-btn nt-back" onClick={async () => { await flush(); setCurrent(null); }} title={L("ត្រឡប់", "Back")}><ArrowLeft size={18} /></button>
                <div className="nt-colors">
                  {COLORS.map((c) => (
                    <button key={c.key} type="button" className={`nt-dot nt-c-${c.key} ${current.color === c.key ? "is-on" : ""}`} title={c.label} onClick={() => change({ color: c.key }, true)}>
                      {current.color === c.key && <Check size={12} />}
                    </button>
                  ))}
                </div>
                <span className="nt-status">
                  {status === "saving" ? L("កំពុងរក្សាទុក…", "Saving…") : status === "saved" ? <><Check size={13} />{L("បានរក្សាទុក", "Saved")}</> : status ? <em>{status}</em> : ""}
                </span>
                <button type="button" className={`md-icon-btn ${current.pinned ? "nt-pinned" : ""}`} onClick={() => change({ pinned: !current.pinned }, true)} title={current.pinned ? L("ដកខ្ទាស់", "Unpin") : L("ខ្ទាស់នៅខាងលើ", "Pin to the top")}>
                  {current.pinned ? <PinOff size={17} /> : <Pin size={17} />}
                </button>
                <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => setConfirmDelete(true)} title={L("លុប", "Delete")}><Trash2 size={17} /></button>
              </div>
              {othersNote && (
                <div className="nt-banner">{L(`កំណត់ចំណាំរបស់ ${person(current.user_id)} — អ្នកកំពុងកែជា Super admin`, `${person(current.user_id)}'s note — you are editing as super admin`)}</div>
              )}
              <input className="nt-title" placeholder={L("ចំណងជើង", "Title")} value={current.title} maxLength={200} onChange={(e) => change({ title: e.target.value })} />
              <textarea ref={bodyRef} className="nt-body" placeholder={L("សរសេរអ្វីមួយ...", "Write something...")} value={current.body} maxLength={20000} onChange={(e) => change({ body: e.target.value })} />
              <div className="nt-foot">
                {current.updated_date && <span>{L("កែចុងក្រោយ", "Edited")} {whenText(current.updated_date)}</span>}
                <span>{L(`${words} ពាក្យ`, `${words} word${words === 1 ? "" : "s"}`)}</span>
              </div>
            </>
          )}
        </section>
      </div>

      {confirmDelete && (
        <div className="md-modal-backdrop" onMouseDown={() => setConfirmDelete(false)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header"><h3>{L("លុបកំណត់ចំណាំ", "Delete note")}</h3></div>
            <div className="md-modal-body"><p>{L(`លុប "${current?.title || firstLine(current?.body) || "កំណត់ចំណាំនេះ"}"?`, `Delete "${current?.title || firstLine(current?.body) || "this note"}"?`)}</p></div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirmDelete(false)}>{L("ទេ", "No")}</button>
              <button type="button" className="md-btn md-btn-danger" onClick={remove}>{L("លុប", "Delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NoteComponent;
