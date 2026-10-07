import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Heading, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { DocumentButton } from "@/shared/DocumentButton";
import { EvaluationScoresTable } from "@/features/evaluations/EvaluationScoresTable";
import { useTenderSummary } from "./useTenderSummary";
import { TenderMatrix } from "./TenderMatrix";
import { TenderSummaryTable } from "./TenderSummaryTable";
import { EvaluationReviewPanel } from "./EvaluationReviewPanel";
import type { TenderRow } from "./tender-rows";

export function TenderSummaryPage() {
  const { positionId = "" } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  return <PageLayout title="מפ״ל למשרה" description="כל המועמדים שהוגשו למשרה, נתוני ההגשה והציונים הזמינים."
    actions={<>
      <Button type="button" variant="secondary" onClick={() => navigate(/^[a-f\d]{24}$/i.test(positionId) ? "/positions/" + encodeURIComponent(positionId) + "/candidates" : "/positions")}>חזרה למועמדי המשרה</Button>
      {can("TenderSummary", "WRITE") && <Button type="button" disabled title="נדרשים נוסחת מחיר, משקלים מאושרים ואישור נעילת הציונים">חישוב מפ״ל</Button>}
    </>}>
    <PermissionGate resource="TenderSummary" action="READ">
      <PermissionGate resource="Application" action="READ">
        {/^[a-f\d]{24}$/i.test(positionId) ? <TenderSummaryContent key={positionId} positionId={positionId} />
          : <Card><PageState kind="error" message="מזהה המשרה בכתובת אינו תקין." /></Card>}
      </PermissionGate>
    </PermissionGate>
  </PageLayout>;
}

function TenderSummaryContent({ positionId }: { positionId: string }) {
  const { can } = usePermissions();
  const result = useTenderSummary(positionId);
  const positions = useReferenceOptions("Position");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (result.status === "error") return <Card><PageState kind="error" message={result.error.message} onRetry={result.reload} /></Card>;
  if (result.status !== "ready") return <Card><PageState kind="loading" message="טוען את המפ״ל למשרה…" /></Card>;
  if (!result.data.length) return <Card><PageState message="אין הגשות למשרה זו להצגה במפ״ל." /></Card>;
  const title = positions.options.find((position) => position.id === positionId)?.label;
  const missing = result.data.filter((row) => !row.summary).length;
  const selected = result.data.find((row) => row.applicationId === selectedId);
  return <>
    <Card><section className="nh-section" aria-label="טבלת המפ״ל">
      <Heading level={2}>{title || "סיכום הגשות למשרה"}</Heading>
      {!title && <Text>מזהה משרה: <bdi>{positionId}</bdi></Text>}
      {missing > 0 && <PageState message={missing === result.data.length ? "המועמדים מוצגים לפי ההגשות למשרה. ציוני הסיכום טרם חושבו." : "לחלק מההגשות עדיין לא נשמר סיכום מפ״ל."} />}
      {can("EvaluationScore", "READ") && can("Candidate", "READ") ? <TenderMatrix positionId={positionId} rows={result.data} onDetails={row => setSelectedId(row.applicationId)} exportTitle={title} />
        : <TenderSummaryTable rows={result.data} onDetails={(row) => setSelectedId(row.applicationId)} exportTitle={title} />}
      <Text>הדירוג מוסתר עד לחיבור בדיקת נעילת הציונים. אישור זוכה דורש מפ״ל סופי ונעול והרשאה מתאימה.</Text>
    </section></Card>
    <details>
      <summary>בדיקת שלמות ההערכות והמשך התהליך</summary>
      <PermissionGate resource="EvaluationScore" action="READ"><EvaluationReviewPanel positionId={positionId} /></PermissionGate>
    </details>
    {selected && <TenderDetails key={selected.applicationId} row={selected} onClose={() => setSelectedId(null)} />}
  </>;
}

function TenderDetails({ row, onClose }: { row: TenderRow; onClose: () => void }) {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const region = useRef<HTMLElement>(null);
  useEffect(() => { region.current?.focus(); }, []);
  const award = row.summary?.awardLetterUrl ? { url: row.summary.awardLetterUrl } : {};
  return <Card><section ref={region} tabIndex={-1} className="nh-section" aria-label={"פירוט מפ״ל: " + row.candidate}>
    <div className="nh-page-header">
      <Heading level={2}>{row.candidate}</Heading>
      <div className="nh-actions">
        <Button type="button" variant="secondary" onClick={() => navigate("/applications/" + encodeURIComponent(row.applicationId))}>פרטי הגשה</Button>
        <Button type="button" variant="secondary" onClick={onClose}>סגירת הפירוט</Button>
      </div>
    </div>
    <dl className="nh-details-grid">
      <div><dt>ציון איכות</dt><dd><Text>{row.summary?.totalQualityScore ?? "טרם חושב"}</Text></dd></div>
      <div><dt>ציון מחיר</dt><dd><Text>{row.summary?.priceScore ?? "טרם חושב"}</Text></dd></div>
      <div><dt>ציון משוקלל</dt><dd><Text>{row.summary?.finalWeightedScore ?? "טרם חושב"}</Text></dd></div>
      <div><dt>דירוג</dt><dd><Text>ממתין לאישור נעילת הציונים</Text></dd></div>
    </dl>
    <div className="nh-actions">
      {can("TenderSummary", "WRITE") && <>
        <Button type="button" disabled title="נדרשים מפ״ל סופי ונעול והרשאת אישור של קבוצה ג׳">אישור זוכה</Button>
        <Button type="button" variant="danger" disabled title="ממתין לאישור כללי ביטול הזכייה">ביטול זכייה</Button>
        <Button type="button" variant="secondary" disabled title="נדרשים נתוני עתודת השלב הקודם ואפשרות להחזיר שני מועמדים לשלב הנדרש">החזרת שני הבאים מהעתודה</Button>
      </>}
      <DocumentButton {...award} label="פתיחת מכתב זכייה" />
    </div>
    <Text>יצירת מכתב הזכייה נעשית במערכת המסמכים של קבוצה ג׳.</Text>
    <Heading level={3}>הערכות ההגשה</Heading>
    <PermissionGate resource="EvaluationScore" action="READ"><EvaluationScoresTable applicationId={row.applicationId} /></PermissionGate>
  </section></Card>;
}

