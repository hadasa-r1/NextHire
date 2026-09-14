import { Badge, Button, Table } from "@ds/components";
import type { TenderRow } from "./tender-rows";

export function TenderSummaryTable({ rows, onDetails }: { rows: readonly TenderRow[]; onDetails: (row: TenderRow) => void }) {
  return <div className="nh-table-region" role="region" aria-label="מפ״ל למשרה" tabIndex={0}><Table>
    <caption className="nh-sr-only">סיכומי המועמדויות והדירוגים שנשמרו למשרה</caption>
    <thead><tr>
      <th scope="col">דירוג</th><th scope="col">מועמד</th><th scope="col">ציון איכות</th>
      <th scope="col">ציון מחיר</th><th scope="col">ציון משוקלל</th><th scope="col">זכייה</th><th scope="col">פעולה</th>
    </tr></thead>
    <tbody>{rows.map((row) => <tr key={row.applicationId}>
      <td>{row.summary?.rankPosition ?? "—"}</td><td>{row.candidate}</td>
      <td>{row.summary?.totalQualityScore ?? "—"}</td><td>{row.summary?.priceScore ?? "—"}</td>
      <td>{row.summary?.finalWeightedScore ?? "—"}</td>
      <td>{row.summary?.isWinner === true ? <Badge tone="success">זוכה</Badge> : row.summary?.isWinner === false ? "לא זוכה" : "טרם נקבע"}</td>
      <td><Button type="button" variant="secondary" onClick={() => onDetails(row)}
        aria-label={"צפייה בפירוט עבור " + row.candidate}>צפייה בפירוט</Button></td>
    </tr>)}</tbody>
  </Table></div>;
}

