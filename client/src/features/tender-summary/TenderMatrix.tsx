import { Badge, Button, Table, Text } from "@ds/components";
import { useApiResource } from "@/shared/useApiResource";
import { PageState } from "@/shared/PageState";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import type { CriterionReference, StageReference } from "@scoring";
import type { TenderRow } from "./tender-rows";
interface Matrix {
  criteria: CriterionReference[]; stages: StageReference[];
  applications: { applicationId: string; idNumber?: string; companyId?: string; hourlyRateBid?: number; passedThreshold?: boolean; rejectionReason?: string;
    scores: { criterionId: string; actualValue?: number | boolean; computedScore?: number; notes?: string }[] }[];
}
export function TenderMatrix({ positionId, rows, onDetails }: { positionId: string; rows: readonly TenderRow[]; onDetails: (row: TenderRow) => void }) {
  const result = useApiResource<Matrix>("/workflow/positions/" + encodeURIComponent(positionId) + "/matrix");
  const companies = useReferenceOptions("Company");
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  if (result.status !== "ready") return <PageState kind="loading" message="טוען את עמודות המפ״ל וההערכות…" />;
  const stages = [...result.data.stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const order = new Map(stages.map((stage, index) => [stage._id, index]));
  const criteria = [...result.data.criteria].sort((a, b) => (order.get(a.stageId ?? "") ?? -1) - (order.get(b.stageId ?? "") ?? -1));
  return <div className="nh-section">
    <Text>עמודות הסף והניקוד מתמלאות מההערכות שנשמרו. תא חסר נשאר ריק ואינו מקבל ציון אפס.</Text>
    <div className="nh-table-region nh-matrix" role="region" aria-label="מפ״ל מפורט לפי קריטריונים" tabIndex={0}><Table>
      <thead><tr><th>חברה</th><th>שם מועמד</th><th>ת״ז</th><th>עמידה בסף</th>
        {criteria.map(c => { const stage = stages.find(s => s._id === c.stageId); return <th key={c._id}>
          {stage?.name && <div>{stage.name}{stage.weightPercent !== undefined ? " · " + stage.weightPercent + "%" : ""}</div>}
          <div>{c.name || c._id}</div>{c.type === "SCORED" && <div>{c.scoringMethod === "RATIO" ? "ערך / ציון מחושב" : "ציון ישיר"}</div>}
        </th>; })}
        <th>תעריף שעתי</th><th>ציון סופי</th><th>החלטה</th><th>פעולה</th></tr></thead>
      <tbody>{rows.map(row => {
        const detail = result.data.applications.find(a => a.applicationId === row.applicationId);
        return <tr key={row.applicationId}><td>{companies.options.find(c => c.id === detail?.companyId)?.label ?? detail?.companyId ?? "—"}</td>
          <td>{row.candidate}</td><td><bdi>{detail?.idNumber ?? "—"}</bdi></td><td>{detail?.passedThreshold === true ? "עבר" : detail?.passedThreshold === false ? "לא עבר" : "טרם אושר"}</td>
          {criteria.map(c => {
            const scores = detail?.scores.filter(s => s.criterionId === c._id) ?? [];
            const score = scores.length === 1 ? scores[0] : undefined;
            return <td key={c._id} title={score?.notes}>{scores.length > 1 ? "כמה הערכות — נדרש בירור" :
              score?.actualValue === undefined ? "—" : c.type === "BOOLEAN" ? score.actualValue === true ? "עבר" : "לא עבר" :
                c.scoringMethod === "RATIO" ? String(score.actualValue) + " / " + (score.computedScore ?? "—") : score.computedScore ?? "—"}</td>;
          })}
          <td>{detail?.hourlyRateBid ?? "—"}</td><td>{detail?.rejectionReason ? "—" : row.summary?.finalWeightedScore ?? "טרם חושב"}</td>
          <td>{detail?.rejectionReason ? <Text>{detail.rejectionReason}</Text> : row.summary?.isWinner ? <Badge tone="success">זוכה</Badge> : "טרם נקבעה"}</td>
          <td><Button variant="secondary" onClick={() => onDetails(row)}>פירוט</Button></td>
        </tr>;
      })}</tbody>
    </Table></div>
  </div>;
}
