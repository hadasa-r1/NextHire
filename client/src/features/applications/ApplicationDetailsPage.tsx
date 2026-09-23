import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Heading, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { DocumentButton } from "@/shared/DocumentButton";
import { useApiResource } from "@/shared/useApiResource";
import type { Application, Candidate } from "@/types/domain";
import { thresholdBadge } from "./application-fields";
import { ApplicationDecisions } from "./ApplicationDecisions";
import { ApplicationProcess } from "@/features/evaluations/ApplicationProcess";
import { EvaluationScoresTable } from "@/features/evaluations/EvaluationScoresTable";

export function ApplicationDetailsPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  return <PageLayout title="פרטי הגשה" description="פרטי המועמדות, מידע על התהליך והערכות שנשמרו."
    actions={<Button type="button" variant="secondary" onClick={() => navigate("/positions")}>חזרה למשרות</Button>}>
    <PermissionGate resource="Application" action="READ"><ApplicationDetails key={applicationId} applicationId={applicationId} /></PermissionGate>
  </PageLayout>;
}

function ApplicationDetails({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { can } = usePermissions();
  const validId = /^[a-f\d]{24}$/i.test(applicationId);
  const record = useApiResource<Application>(validId ? "/applications/" + encodeURIComponent(applicationId) : null);
  const application = record.status === "ready" ? record.data : null;
  const candidate = useApiResource<Candidate>(application?.candidateId && can("Candidate", "READ") ? "/candidates/" + encodeURIComponent(application.candidateId) : null);
  const positions = useReferenceOptions("Position");
  const companies = useReferenceOptions("Company");
  const notice = typeof state === "object" && state !== null && "notice" in state && typeof state.notice === "string" ? state.notice : null;
  if (!validId) return <Card><PageState kind="error" message="מזהה ההגשה בכתובת אינו תקין." /></Card>;
  if (record.status === "error") return <Card>{record.error.status === 404 ? <PageState message="ההגשה המבוקשת לא נמצאה." />
    : <PageState kind="error" message={record.error.message} onRetry={record.reload} />}</Card>;
  if (!application) return <Card><PageState kind="loading" message="טוען את פרטי ההגשה…" /></Card>;
  const badge = thresholdBadge(application.passedThreshold);
  const candidateName = candidate.status === "ready" ? candidate.data.fullName || candidate.data.idNumber : application.candidateId ? "מזהה מועמד: " + application.candidateId : "—";
  const positionName = positions.options.find((position) => position.id === application.positionId)?.label;
  const companyName = companies.options.find((company) => company.id === application.companyId)?.label;
  return <>
    {notice && <PageState message={notice} />}
    <Card><section className="nh-section" aria-label="פרטי המועמדות">
      <div className="nh-page-header"><Heading level={2}>פרטי ההגשה</Heading><div className="nh-actions">
        {application.positionId && <Button type="button" variant="secondary" onClick={() => navigate("/positions/" + encodeURIComponent(application.positionId!) + "/candidates")}>מועמדים למשרה זו</Button>}
        {can("Application", "WRITE") && <Button type="button" variant="secondary" onClick={() => navigate("/applications/" + encodeURIComponent(applicationId) + "/edit")}>עריכה</Button>}
        <DocumentButton url={application.resumeUrl} />
      </div></div>
      <dl className="nh-details-grid">
        <div><dt>מועמד</dt><dd><Text>{candidateName}</Text></dd></div>
        <div><dt>{positionName ? "משרה" : "מזהה משרה"}</dt><dd><Text>{positionName || application.positionId || "—"}</Text></dd></div>
        <div><dt>{companyName ? "חברה" : "מזהה חברה"}</dt><dd><Text>{companyName || application.companyId || "—"}</Text></dd></div>
        <div><dt>תעריף שעתי מוצע</dt><dd><Text>{application.hourlyRateBid ?? "—"}</Text></dd></div>
      </dl>
      {candidate.status === "error" && <PageState kind="error" message={candidate.error.status === 404 ? "המועמד המקושר להגשה לא נמצא." : candidate.error.message} onRetry={candidate.reload} />}
    </section></Card>
    <Card><section className="nh-section" aria-label="מידע על התהליך">
      <Heading level={2}>מידע על התהליך</Heading>
      <dl className="nh-details-grid">
        <div><dt>עמידה בתנאי סף</dt><dd><Badge tone={badge.tone}>{badge.label}</Badge></dd></div>
        <div><dt>שלב נוכחי</dt><dd><Text>טרם הוגדר</Text></dd></div>
        <div><dt>סיבת דחייה</dt><dd><Text>{application.rejectionReason || "לא תועדה סיבת דחייה."}</Text></dd></div>
      </dl>

      <div className="nh-actions">
        {can("Application", "WRITE") && <ApplicationDecisions applicationId={applicationId}
          {...(application.passedThreshold !== undefined ? { passedThreshold: application.passedThreshold } : {})}
          {...(application.rejectionReason !== undefined ? { rejectionReason: application.rejectionReason } : {})}
          onSaved={record.reload} />}
        {can("EvaluationScore", "WRITE") && <Button type="button" variant="secondary" onClick={() => navigate("/applications/" + encodeURIComponent(applicationId) + "/evaluation")}>ראיונות והערכות</Button>}
        {can("TenderSummary", "READ") && <Button type="button" variant="secondary" disabled={!application.positionId} onClick={() => { if (application.positionId) navigate("/positions/" + encodeURIComponent(application.positionId) + "/tender-summary"); }}>צפייה במפ״ל</Button>}
      </div>
    </section></Card>
    <PermissionGate resource="EvaluationScore" action="READ"><ApplicationProcess applicationId={applicationId} /></PermissionGate>
    <Card><section className="nh-section" aria-label="הערכות"><Heading level={2}>הערכות להגשה</Heading>
      <PermissionGate resource="EvaluationScore" action="READ"><EvaluationScoresTable applicationId={applicationId} /></PermissionGate>
    </section></Card>
  </>;
}

