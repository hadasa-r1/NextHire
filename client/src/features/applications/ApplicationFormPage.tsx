import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, Text } from "@ds/components";
import { apiRequest } from "@/api/client";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import { ReferenceState } from "@/integrations/ReferenceState";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useApiResource } from "@/shared/useApiResource";
import type { Application, Candidate } from "@/types/domain";
import { ApplicationForm } from "./ApplicationForm";
import type { ApplicationValues } from "./application-fields";

export function ApplicationFormPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  return <PageLayout title={applicationId ? "עריכת הגשה" : "הגשת מועמד למשרה"} description="משרה, מועמד, חברה, הצעת תעריף וקורות חיים." narrow
    actions={<Button type="button" variant="secondary" onClick={() => navigate("/applications")}>חזרה לרשימה</Button>}>
    <Card><PermissionGate resource="Application" action="WRITE">
      <PermissionGate resource="Candidate" action="READ">
        {applicationId ? <PermissionGate resource="Application" action="READ"><ApplicationEditor applicationId={applicationId} key={applicationId} /></PermissionGate> : <ApplicationEditor />}
      </PermissionGate>
    </PermissionGate></Card>
  </PageLayout>;
}

function ApplicationEditor({ applicationId }: { applicationId?: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const positions = useReferenceOptions("Position");
  const companies = useReferenceOptions("Company");
  const candidates = useApiResource<Candidate[]>("/candidates");
  const validId = !applicationId || /^[a-f\d]{24}$/i.test(applicationId);
  const record = useApiResource<Application>(applicationId && validId ? "/applications/" + encodeURIComponent(applicationId) : null);
  const candidateId = params.get("candidateId") ?? "";
  const positionId = params.get("positionId") ?? "";

  const cancel = () => navigate(applicationId ? "/applications/" + encodeURIComponent(applicationId)
    : /^[a-f\d]{24}$/i.test(candidateId) ? "/candidates/" + encodeURIComponent(candidateId) : "/applications");
  async function save(values: ApplicationValues) {
    if (!can("Application", "WRITE")) throw new Error("אין לך הרשאה לשמירת ההגשה.");
    const saved = await apiRequest<Application>("/applications" + (applicationId ? "/" + encodeURIComponent(applicationId) : ""), {
      method: applicationId ? "PATCH" : "POST", body: values,
    });
    navigate(can("Application", "READ") ? "/applications/" + encodeURIComponent(saved._id) : "/", {
      replace: true, state: { notice: applicationId ? "פרטי ההגשה עודכנו בהצלחה." : "ההגשה נשמרה בהצלחה." },
    });
  }
  if (!validId) return <PageState kind="error" message="מזהה ההגשה בכתובת אינו תקין." />;
  if (record.status === "error") return record.error.status === 404 ? <PageState message="ההגשה המבוקשת לא נמצאה." />
    : <PageState kind="error" message={record.error.message} onRetry={record.reload} />;
  if (applicationId && record.status !== "ready") return <PageState kind="loading" message="טוען את פרטי ההגשה…" />;
  if (positions.status !== "ready" || companies.status !== "ready") return <div className="nh-section">
    <ReferenceState status={positions.status} label="משרות" onRetry={positions.reload} />
    <ReferenceState status={companies.status} label="חברות" onRetry={companies.reload} />
    <div className="nh-actions"><Button type="button" variant="secondary" onClick={cancel}>ביטול</Button></div>
  </div>;
  if (candidates.status === "error") return <PageState kind="error" message={candidates.error.message} onRetry={candidates.reload} />;
  if (candidates.status !== "ready") return <PageState kind="loading" message="טוען את רשימת המועמדים…" />;
  const initial = record.status === "ready" ? { initialApplication: record.data } : {};
  return <div className="nh-section">
    {positions.options.length === 0 && <Text>אין משרות זמינות לבחירה.</Text>}
    {companies.options.length === 0 && <Text>אין חברות זמינות לבחירה.</Text>}
    {candidates.data.length === 0 && <Text>אין מועמדים במערכת. ניתן להוסיף מועמד במסך המועמדים.</Text>}
    <ApplicationForm {...initial} prefill={{ candidateId, positionId }} positions={positions.options} companies={companies.options} candidates={candidates.data}
      canSave={can("Application", "WRITE")} onSave={save} onCancel={cancel} />
  </div>;
}

