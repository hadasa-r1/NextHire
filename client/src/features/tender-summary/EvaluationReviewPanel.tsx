import { useCallback } from "react";
import { Button, Card, Heading, Text } from "@ds/components";
import { apiGet } from "@/api/client";
import { usePermissions } from "@/auth/usePermissions";
import { useTaskResource } from "@/shared/useTaskResource";
import { PageState } from "@/shared/PageState";
import type { EvaluationReview } from "@scoring";

export function EvaluationReviewPanel({ positionId }: { positionId: string }) {
  const { session } = usePermissions();
  const load = useCallback((signal: AbortSignal) =>
    apiGet<EvaluationReview>("/workflow/positions/" + encodeURIComponent(positionId) + "/evaluation-review", signal),
  [positionId, session]);
  const result = useTaskResource(positionId, load);
  return <Card><section className="nh-section" aria-label="בדיקת נתוני ההערכה">
    <Heading level={2}>בדיקת נתוני ההערכה</Heading>
    {result.status === "error" ? <PageState kind="error" message={result.error.message} onRetry={result.reload} />
      : result.status !== "ready" ? <PageState kind="loading" message="בודק הערכות חסרות ותנאי סף…" />
      : <>
        <Text>הבדיקה אינה מחשבת ציון סופי ואינה מאשרת נעילת ציונים. ערכים חסרים נשארים חסרים.</Text>
        {!result.data.applications.length && <PageState message="אין הגשות לבדיקה במשרה זו." />}
        {result.data.applications.map(row => <div key={row.applicationId} className="nh-section">
          <Text>הגשה <bdi>{row.applicationId}</bdi>: {row.evaluatedCriteria} מתוך {row.totalCriteria} קריטריונים עם הערכה תקינה.</Text>
          {row.issues.length ? <ul>{row.issues.map((message, index) => <li key={index}>{message}</li>)}</ul>
            : <Text>הערכים בקריטריונים שהתקבלו מלאים; עדיין נדרש אישור השלמת שלבי החובה ונעילת הציונים.</Text>}
        </div>)}
        <Heading level={3}>מה נדרש להשלמת התהליך</Heading>
        <ul>{result.data.limitations.map(message => <li key={message}>{message}</li>)}</ul>
        <div className="nh-actions"><Button type="button" variant="secondary" onClick={result.reload}>בדיקה מחדש</Button></div>
      </>}
  </section></Card>;
}
