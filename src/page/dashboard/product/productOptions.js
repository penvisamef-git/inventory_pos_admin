import Auth from "../../util/auth";
import { ACCESS, canAccess } from "../../util/permission";
import { L } from "../../../i18n";

export { nameKh, nameOther, labelOf } from "../setup/setupOptions";

export const ATTRIBUTE_TYPE_OPTIONS = [
  { value: "size", label: L("ទំហំ", "Size") },
  { value: "color", label: L("ពណ៌", "Color") },
  { value: "other", label: L("ផ្សេងៗ", "Other") },
];

// can the signed-in user create / edit product data (unit, category, attribute, product, price)?
export const canEditProduct = () => canAccess(new Auth().getClientLogin(), ACCESS.PRODUCT);

// Flatten a category tree into dropdown options with indentation: "— Tops"
export function flattenTree(nodes, depth = 0, out = []) {
  nodes.forEach((n) => {
    const name = L(n.name_kh || n.name_en, n.name_en || n.name_kh);
    out.push({ value: n._id, label: `${"— ".repeat(depth)}${name}`, depth, node: n });
    if (n.children?.length) flattenTree(n.children, depth + 1, out);
  });
  return out;
}
