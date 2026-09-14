import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useEvaluationServices, validateCriteria, type EvaluationInput } from "@/integrations/EvaluationProvider";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useTaskResource } from "@/shared/useTaskResource";
import { EvaluationForm } from "./EvaluationForm";

export function EvaluationPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const back = () => navigate(can("Application", "READ") ? "/applications/" + encodeURIComponent(applicationId) : "/");
  return <PageLayout title="הערכת מועמדות" description="הזנת ערכים והערות לפי הקריטריונים שנקבעו למשרה."
    actions={<Button type="button" variant="secondary" onClick={back}>חזרה</Button>}>
    <PermissionGate resource="EvaluationScore" action="WRITE">
      {/^[a-f\d]{24}$/i.test(applicationId) ? <EvaluationEditor key={applicationId} applicationId={applicationId} onCancel={back} />
        : <Card><PageState kind="error" message="מזהה ההגשה אינו תקין." /></Card>}
    </PermissionGate>
  </PageLayout>;
}
function EvaluationEditor({ applicationId, onCancel }: { applicationId: string; onCancel: () => void }) {
  const services = useEvaluationServices();
  const [notice, setNotice] = useState<string | null>(null);
  const { can, session } = usePermissions();
  const navigate = useNavigate();
  const load = useCallback(async (signal: AbortSignal) => {
    if (!services) throw new Error("שירות ההערכות אינו מחובר.");
    const result = await services.loadContext(applicationId, signal);
    return { ...result, criteria: validateCriteria(result.criteria) };
  }, [services, applicationId, session]);
  const context = useTaskResource(services ? applicationId : null, load);
  async function save(values: readonly EvaluationInput[]) {
    if (!session || !can("EvaluationScore", "WRITE") || !services?.saveEvaluations) throw new Error("שמירת ההערכה אינה זמינה.");
    await services.saveEvaluations(applicationId, values);
    if (can("Application", "READ")) navigate("/applications/" + encodeURIComponent(applicationId), {
      replace: true, state: { notice: "ההערכה נשמרה בהצלחה." },
    });
    else { setNotice("ההערכה נשמרה בהצלחה."); context.reload(); }
  }
  if (!services) return <Card><PageState message="שירות ההערכות ממתין לחיבור." /></Card>;
  if (context.status === "error") return <Card><PageState kind="error" message={context.error.message} onRetry={context.reload} /></Card>;
  if (context.status !== "ready") return <Card><PageState kind="loading" message="טוען את הקריטריונים וההערכה שלך…" /></Card>;
  if (!context.data.criteria.length) return <Card><PageState message="לא הוגדרו קריטריונים למשרה זו." /></Card>;
  return <>{notice && <PageState message={notice} />}<EvaluationForm criteria={context.data.criteria} initialValues={context.data.evaluations}
    interviewerName={session?.user.name || "המשתמש המחובר"}
    canSave={can("EvaluationScore", "WRITE") && Boolean(services.saveEvaluations)}
    previewScore={services.previewScore} onSave={save} onCancel={onCancel} /></>;
}
