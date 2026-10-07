import { useState } from "react";
import { Button } from "@ds/components";
import { downloadXlsx, xlsxFileName, type XlsxSheet } from "@/shared/xlsx-export";
import { tenderExportTitle } from "./tender-export";

export function TenderExportButton({ buildSheet, title, disabled }: {
  buildSheet: () => XlsxSheet; title?: string | undefined; disabled?: boolean;
}) {
  const [error, setError] = useState("");
  function run() {
    setError("");
    try {
      downloadXlsx(xlsxFileName(tenderExportTitle(title)), [buildSheet()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הייצוא לאקסל נכשל.");
    }
  }
  return <div className="nh-actions">
    <Button type="button" variant="secondary" disabled={disabled} onClick={run}
      aria-label="ייצוא טבלת המפ״ל לקובץ אקסל">ייצוא לאקסל</Button>
    {error && <span role="alert" className="rf-field-hint">{error}</span>}
  </div>;
}
