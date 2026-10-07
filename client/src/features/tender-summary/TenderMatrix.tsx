import { Badge, Button, Table, Text } from "@ds/components";
import { useApiResource } from "@/shared/useApiResource";
import { PageState } from "@/shared/PageState";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import { TenderExportButton } from "./TenderExportButton";
import {
  buildMatrixSheet, criterionCell, finalScoreCell, matchingScores, orderedColumns, thresholdLabel,
  type TenderMatrixData,
} from "./tender-export";
import type { TenderRow } from "./tender-rows";
export function TenderMatrix({ positionId, rows, onDetails, exportTitle }: {
  positionId: string; rows: readonly TenderRow[]; onDetails: (row: TenderRow) => void; exportTitle?: string | undefined;
}) {
  const result = useApiResource<TenderMatrixData>("/workflow/positions/" + encodeURIComponent(positionId) + "/matrix");
  const companies = useReferenceOptions("Company");
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  if (result.status !== "ready") return <PageState kind="loading" message="טוען את עמודות המפ״ל וההערכות…" />;
  const { stages, criteria } = orderedColumns(result.data);
  const companyLabel = (companyId: string | undefined) => companies.options.find(c => c.id === companyId)?.label ?? companyId ?? "—";
  return <div className="nh-section">
    <Text>עמודות הסף והניקוד מתמלאות מההערכות שנשמרו. תא חסר נשאר ריק ואינו מקבל ציון אפס.</Text>
    <TenderExportButton title={exportTitle} disabled={rows.length === 0}
      buildSheet={() => buildMatrixSheet(result.data, rows, companyLabel)} />
    <div className="nh-table-region nh-matrix" role="region" aria-label="מפ״ל מפורט לפי קריטריונים" tabIndex={0}><Table>
      <thead><tr><th>חברה</th><th>שם מועמד</th><th>ת״ז</th><th>עמידה בסף</th>
        {criteria.map(c => { const stage = stages.find(s => s._id === c.stageId); return <th key={c._id}>
          {stage?.name && <div>{stage.name}{stage.weightPercent !== undefined ? " · " + stage.weightPercent + "%" : ""}</div>}
          <div>{c.name || c._id}</div>{c.type === "SCORED" && <div>{c.scoringMethod === "RATIO" ? "ערך / ציון מחושב" : "ציון ישיר"}</div>}
        </th>; })}
        <th>תעריף שעתי</th><th>ציון סופי</th><th>החלטה</th><th>פעולה</th></tr></thead>
      <tbody>{rows.map(row => {
        const detail = result.data.applications.find(a => a.applicationId === row.applicationId);
        return <tr key={row.applicationId}><td>{companyLabel(detail?.companyId)}</td>
          <td>{row.candidate}</td><td><bdi>{detail?.idNumber ?? "—"}</bdi></td><td>{thresholdLabel(detail)}</td>
          {criteria.map(c => {
            const scores = matchingScores(c, detail);
            const notes = scores.length === 1 ? scores[0]?.notes : undefined;
            return <td key={c._id} title={notes}>{criterionCell(c, detail) ?? "—"}</td>;
          })}
          <td>{detail?.hourlyRateBid ?? "—"}</td><td>{finalScoreCell(detail, row) ?? "—"}</td>
          <td>{detail?.rejectionReason ? <Text>{detail.rejectionReason}</Text> : row.summary?.isWinner ? <Badge tone="success">זוכה</Badge> : "טרם נקבעה"}</td>
          <td><Button variant="secondary" onClick={() => onDetails(row)}>פירוט</Button></td>
        </tr>;
      })}</tbody>
    </Table></div>
  </div>;
}
