import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, Heading, Text } from "@ds/components";
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
  const [params] = useSearchParams();
  const positionId = params.get("positionId");
  const navigate = useNavigate();
  return <PageLayout title={applicationId ? "עריכת הגשה" : "הגשת מועמד למשרה"} description="משרה, מועמד, חברה, הצעת תעריף וקורות חיים." narrow
    actions={<Button type="button" variant="secondary" onClick={() => navigate(positionId && /^[a-f\d]{24}$/i.test(positionId) ? "/positions/" + encodeURIComponent(positionId) + "/candidates" : "/positions")}>חזרה לרשימה</Button>}>
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
    : /^[a-f\d]{24}$/i.test(positionId) ? "/positions/" + encodeURIComponent(positionId) + "/candidates"
    : /^[a-f\d]{24}$/i.test(candidateId) ? "/candidates/" + encodeURIComponent(candidateId) : "/positions");
  async function save(values: ApplicationValues) {
    if (!can("Application", "WRITE")) throw new Error("אין לך הרשאה לשמירת ההגשה.");
    if (!applicationId && (!values.positionId || !values.candidateId))
      throw new Error("כדי להגיש מועמד למשרה יש לבחור משרה ומועמד.");
    if (!applicationId) {
      if (!values.companyId) throw new Error("יש לבחור חברה מגישה.");
      const submitted = await apiRequest<{ complete: boolean; results: { error?: string; rejected?: boolean }[] }>("/submissions/commit", {
        method: "POST", body: { positionId: values.positionId, companyId: values.companyId, rows: [{ candidateId: values.candidateId, resumeUrl: values.resumeUrl, ...(values.hourlyRateBid !== undefined ? { hourlyRateBid: values.hourlyRateBid } : {}) }] },
      });
      if (!submitted.complete) throw new Error(submitted.results.find(row => row.error)?.error ?? "ההגשה לא נשמרה.");
      navigate("/positions/" + encodeURIComponent(values.positionId!) + "/candidates", {
        replace: true, state: { notice: submitted.results[0]?.rejected ? "ההגשה נקלטה אך נפסלה להמשך בגלל הגשה משתי חברות." : "ההגשה נשמרה בהצלחה." },
      });
      return;
    }
    const saved = await apiRequest<Application>("/applications" + (applicationId ? "/" + encodeURIComponent(applicationId) : ""), {
      method: applicationId ? "PATCH" : "POST", body: values,
    });
    navigate(can("Application", "READ") ? saved.positionId ? "/positions/" + encodeURIComponent(saved.positionId) + "/candidates" : "/applications/" + encodeURIComponent(saved._id) : "/", {
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
    {!applicationId && can("Candidate", "WRITE") && <div className="nh-section">
      <Heading level={2}>בחירת מועמד</Heading>
      <Text>בחרו מועמד מהמאגר בטופס, או צרו מועמד חדש והמשיכו להגשתו למשרה.</Text>
      <div className="nh-actions"><Button type="button" variant="secondary" onClick={() => navigate("/candidates/new" + (/^[a-f\d]{24}$/i.test(positionId) ? "?positionId=" + encodeURIComponent(positionId) : ""))}>יצירת מועמד חדש</Button></div>
    </div>}
    <ApplicationForm {...initial} prefill={{ candidateId, positionId }} positions={positions.options} companies={companies.options} candidates={candidates.data}
      lockPosition={!applicationId && /^[a-f\d]{24}$/i.test(positionId)}
      canSave={can("Application", "WRITE")} onSave={save} onCancel={cancel} />
  </div>;
}

