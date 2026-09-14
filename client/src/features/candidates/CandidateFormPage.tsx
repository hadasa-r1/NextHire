import { useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "@ds/components";
import { apiRequest } from "@/api/client";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useApiResource } from "@/shared/useApiResource";
import type { Candidate } from "@/types/domain";
import { CandidateForm } from "./CandidateForm";
import type { CandidateValues } from "./candidate-fields";

export function CandidateFormPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  return (
    <PageLayout title={candidateId ? "עריכת מועמד" : "הוספת מועמד"} description="פרטי המועמד נשמרים בנפרד מההגשות שלו למשרות." narrow
      actions={<Button type="button" variant="secondary" onClick={() => navigate("/candidates")}>חזרה לרשימה</Button>}>
      <Card><PermissionGate resource="Candidate" action="WRITE">
        {candidateId
          ? <PermissionGate resource="Candidate" action="READ"><CandidateEditor key={candidateId} candidateId={candidateId} /></PermissionGate>
          : <CandidateEditor />}
      </PermissionGate></Card>
    </PageLayout>
  );
}

function CandidateEditor({ candidateId }: { candidateId?: string }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const validId = candidateId === undefined || /^[a-f\d]{24}$/i.test(candidateId);
  const result = useApiResource<Candidate>(candidateId && validId ? "/candidates/" + encodeURIComponent(candidateId) : null);
  const cancel = () => navigate(candidateId ? "/candidates/" + encodeURIComponent(candidateId) : "/candidates");

  async function save(values: CandidateValues) {
    if (!can("Candidate", "WRITE")) throw new Error("אין לך הרשאה לשמירת השינויים.");
    const saved = await apiRequest<Candidate>("/candidates" + (candidateId ? "/" + encodeURIComponent(candidateId) : ""), {
      method: candidateId ? "PATCH" : "POST", body: values,
    });
    navigate(can("Candidate", "READ") ? "/candidates/" + encodeURIComponent(saved._id) : "/",
      { replace: true, state: { notice: candidateId ? "פרטי המועמד עודכנו בהצלחה." : "המועמד נוסף בהצלחה." } });
  }

  if (!validId) return <PageState kind="error" message="מזהה המועמד בכתובת אינו תקין." />;
  if (candidateId && (result.status === "loading" || result.status === "idle")) return <PageState kind="loading" message="טוען את פרטי המועמד…" />;
  if (result.status === "error") return result.error.status === 404
    ? <PageState message="המועמד המבוקש לא נמצא." />
    : <PageState kind="error" message={result.error.message} onRetry={result.reload} />;

  const initial = result.status === "ready" ? { initialCandidate: result.data } : {};
  return <CandidateForm {...initial} canSave={can("Candidate", "WRITE")} onSave={save} onCancel={cancel} />;
}

