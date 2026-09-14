import { Table, Text } from "@ds/components";
import { PageState } from "@/shared/PageState";
import { useApiResource } from "@/shared/useApiResource";
import type { EvaluationScore } from "@/types/domain";

function valueLabel(value: number | boolean | undefined) {
  if (value === true) return "עבר";
  if (value === false) return "לא עבר";
  return value ?? "—";
}

export function EvaluationScoresTable({ applicationId }: { applicationId: string }) {
  const result = useApiResource<EvaluationScore[]>("/evaluation-scores?applicationId=" + encodeURIComponent(applicationId));
  if (result.status === "loading" || result.status === "idle") return <PageState kind="loading" message="טוען את ההערכות…" />;
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  if (result.data.length === 0) return <PageState message="טרם נשמרו הערכות להגשה זו." />;
  return <div className="nh-section">
    <Text>מוצגים מזהי הקריטריונים והמראיינים עד לחיבור פרטי המידע מהקבוצות האחראיות.</Text>
    <div className="nh-table-region" role="region" aria-label="הערכות להגשה" tabIndex={0}><Table>
      <caption className="nh-sr-only">ציוני ההערכה של ההגשה</caption>
      <thead><tr><th scope="col">מזהה קריטריון</th><th scope="col">מזהה מראיין</th><th scope="col">ערך בפועל</th>
        <th scope="col">ציון מחושב</th><th scope="col">הערות</th><th scope="col">מועד הערכה</th></tr></thead>
      <tbody>{result.data.map((evaluation) => {
        const date = evaluation.evaluatedAt ? new Date(evaluation.evaluatedAt) : null;
        return <tr key={evaluation._id}>
          <td><bdi>{evaluation.criterionId || "—"}</bdi></td>
          <td><bdi>{evaluation.interviewerId || "—"}</bdi></td>
          <td>{valueLabel(evaluation.actualValue)}</td><td>{evaluation.computedScore ?? "—"}</td>
          <td>{evaluation.notes || "—"}</td>
          <td>{date && Number.isFinite(date.getTime()) ? date.toLocaleString("he-IL") : "—"}</td>
        </tr>;
      })}</tbody>
    </Table></div>
  </div>;
}

