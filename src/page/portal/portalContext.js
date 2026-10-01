import { createContext, useContext } from "react";

// The warehouse the Shop portal is showing ({ _id, code, name_kh, name_en, type }) — null in the admin web
export const PortalContext = createContext(null);
export const usePortal = () => useContext(PortalContext);
