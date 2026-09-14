import { Button } from "@ds/components";

import { webDocumentUrl } from "@validation";
export { webDocumentUrl } from "@validation";

export function DocumentButton({ url, label = "פתיחת קורות חיים" }: { url?: string; label?: string }) {
  const target = webDocumentUrl(url);
  return <Button type="button" variant="secondary" disabled={!target}
    title={target ? "פתיחה בלשונית חדשה" : "לא קיים קישור תקין למסמך"}
    onClick={() => { if (target) window.open(target, "_blank", "noopener,noreferrer"); }}>{label}</Button>;
}

