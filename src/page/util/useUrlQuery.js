import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Global search opens list pages with ?q=… (fill the search box) or ?open=<id> (open that document).
export default function useUrlQuery(setKeyword, onOpen) {
  const { search } = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(search);
    const q = p.get("q");
    if (q !== null && setKeyword) setKeyword(q);
    const open = p.get("open");
    if (open && onOpen) onOpen(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
