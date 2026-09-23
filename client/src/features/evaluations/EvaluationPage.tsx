import { useCallback, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useEvaluationServices, validateCriteria, validateStages, type EvaluationInput } from "@/integrations/EvaluationProvider";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useTaskResource } from "@/shared/useTaskResource";
import { EvaluationForm } from "./EvaluationForm";
import { ProcessFlow } from "./ProcessFlow";

export function EvaluationPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const back = () => navigate(can("Application", "READ") ? "/applications/" + encodeURIComponent(applicationId) : "/");
  return <PageLayout title="ראיונות והערכות" description="השלימו את שלבי ההערכה לפי הסדר שהוגדר למשרה."
    actions={<Button type="button" variant="secondary" onClick={back}>חזרה להגשה</Button>}>
    <PermissionGate resource="EvaluationScore" action="WRITE">
      {/^[a-f\d]{24}$/i.test(applicationId) ? <EvaluationEditor key={applicationId} applicationId={applicationId} onCancel={back} />
        : <Card><PageState kind="error" message="מזהה ההגשה אינו תקין." /></Card>}
    </PermissionGate>
  </PageLayout>;
}
function EvaluationEditor({ applicationId, onCancel }: { applicationId: string; onCancel: () => void }) {
  const services = useEvaluationServices();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(params.get("stageId") ?? ""), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const { can, session } = usePermissions();
  const navigate = useNavigate();
  const load = useCallback(async (signal: AbortSignal) => {
    if (!services) throw new Error("שירות ההערכות אינו מחובר.");
    const result = await services.loadContext(applicationId, signal);
    return { ...result, criteria: validateCriteria(result.criteria), stages: validateStages(result.stages ?? []) };
  }, [services, applicationId, session]);
  const context = useTaskResource(services ? applicationId : null, load);
  async function save(values: readonly EvaluationInput[]) {
    if (!session || !can("EvaluationScore", "WRITE") || !services?.saveEvaluations) throw new Error("שמירת ההערכה אינה זמינה.");
    await services.saveEvaluations(applicationId, values);
    setDirty(false);
    if (can("Application", "READ")) navigate("/applications/" + encodeURIComponent(applicationId), {
      replace: true, state: { notice: "ההערכה נשמרה. להמשך התהליך יש להשלים את הקריטריונים והאישורים הנדרשים." },
    });
    else context.reload();
  }
  if (!services) return <Card><PageState message="שירות ההערכות ממתין לחיבור." /></Card>;
  if (context.status === "error") return <Card><PageState kind="error" message={context.error.message} onRetry={context.reload} /></Card>;
  if (context.status !== "ready") return <Card><PageState kind="loading" message="טוען את שלבי ההערכה…" /></Card>;
  const process = context.data.process;
  const stageId = (process?.steps.some(step => step.id === selected) ? selected : "") || process?.steps.find(step => step.state === "available")?.id || process?.steps.find(step => step.state === "complete")?.id || "";
  const step = process?.steps.find(item => item.id === stageId);
  const criteria = stageId ? context.data.criteria.filter(criterion => criterion.stageId === stageId) : context.data.criteria.filter(criterion => !criterion.stageId);
  const allowed = !process ? criteria.every(criterion => !criterion.stageId) : Boolean(step && step.state !== "blocked");
  function select(id: string) {
    if (busy || (dirty && !window.confirm("יש שינויים שלא נשמרו. לעבור לשלב אחר ולוותר עליהם?"))) return;
    setDirty(false); setSelected(id);
  }
  return <>
    <Card>{process ? <ProcessFlow process={process} selected={stageId} onSelect={select} disabled={busy} />
      : <PageState message="תרשים השלבים ממתין לנתוני המשרה. ניתן לערוך רק קריטריונים שאינם משויכים לשלב." />}</Card>
    <Card><Text>מועד ההערכה נשמר בעת שמירת הציון. תיאום מועד לראיון ושליחת זימון אינם מחוברים עדיין.</Text></Card>
    {!criteria.length || !allowed ? <Card><PageState message={process?.blockedReason || step?.reason || "אין כרגע שלב פתוח להזנת הערכה. יש להשלים את השלב הקודם ואישור תנאי הסף."} /></Card>
      : <EvaluationForm key={stageId} criteria={criteria} initialValues={context.data.evaluations}
        interviewerName={session?.user.name || "המשתמש המחובר"} canSave={can("EvaluationScore", "WRITE") && Boolean(services.saveEvaluations)}
        previewScore={services.previewScore} onSave={save} onCancel={onCancel} onDirtyChange={setDirty} onSavingChange={setBusy} />}
  </>;
}
