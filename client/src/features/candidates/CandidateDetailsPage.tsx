import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Heading, Table, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useApiResource } from "@/shared/useApiResource";
import { isLinkedInProfileUrl, isGitHubProfileUrl } from "@validation";
import { CandidatePhoto } from "./CandidatePhoto";
import type { Application, Candidate } from "@/types/domain";

export function CandidateDetailsPage() {
  const { candidateId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <PageLayout title="פרטי מועמד" description="פרטי הקשר וההגשות של המועמד למשרות."
      actions={<Button type="button" variant="secondary" onClick={() => navigate("/candidates")}>חזרה לרשימה</Button>}>
      <PermissionGate resource="Candidate" action="READ">
        <CandidateDetails key={candidateId} candidateId={candidateId} />
      </PermissionGate>
    </PageLayout>
  );
}

function CandidateDetails({ candidateId }: { candidateId: string }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { can } = usePermissions();
  const validId = /^[a-f\d]{24}$/i.test(candidateId);
  const result = useApiResource<Candidate>(validId ? "/candidates/" + encodeURIComponent(candidateId) : null);
  const notice = typeof state === "object" && state !== null && "notice" in state && typeof state.notice === "string" ? state.notice : null;

  if (!validId) return <Card><PageState kind="error" message="מזהה המועמד בכתובת אינו תקין." /></Card>;
  if (result.status === "loading" || result.status === "idle") return <Card><PageState kind="loading" message="טוען את פרטי המועמד…" /></Card>;
  if (result.status === "error") return <Card>{result.error.status === 404
    ? <PageState message="המועמד המבוקש לא נמצא." />
    : <PageState kind="error" message={result.error.message} onRetry={result.reload} />}</Card>;
  const candidate = result.data;
  return (
    <>
      {notice && <PageState message={notice} />}
      <Card><section className="nh-section" aria-label="פרטי המועמד">
        <div className="nh-page-header">
          <div className="nh-profile-header">
            <CandidatePhoto name={candidate.fullName} photoUrl={candidate.photoUrl} />
            <Heading level={2}>{candidate.fullName || "פרטי המועמד"}</Heading>
          </div>
          {can("Candidate", "WRITE") && <Button type="button" variant="secondary"
            onClick={() => navigate("/candidates/" + encodeURIComponent(candidateId) + "/edit")}>עריכה</Button>}
        </div>
        <dl className="nh-details-grid">
          <div><dt>שם מלא</dt><dd><Text>{candidate.fullName || "—"}</Text></dd></div>
          <div><dt>מספר זהות</dt><dd><Text><bdi>{candidate.idNumber}</bdi></Text></dd></div>
          <div><dt>טלפון</dt><dd><Text><bdi>{candidate.phone || "—"}</bdi></Text></dd></div>
          <div><dt>דוא״ל</dt><dd><Text><bdi>{candidate.email || "—"}</bdi></Text></dd></div>
        </dl>
        <div className="nh-actions" aria-label="פרופילים מקצועיים">
          {isLinkedInProfileUrl(candidate.linkedinUrl) && <a className="nh-text-link" href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer">פרופיל LinkedIn</a>}
          {isGitHubProfileUrl(candidate.githubUrl) && <a className="nh-text-link" href={candidate.githubUrl} target="_blank" rel="noopener noreferrer">פרופיל GitHub</a>}
        </div>
      </section></Card>
      <Card><section className="nh-section" aria-label="הגשות המועמד">
        <div className="nh-page-header">
          <Heading level={2}>הגשות למשרות</Heading>
          {can("Application", "WRITE") && <Button type="button" onClick={() => navigate("/applications/new?candidateId=" + encodeURIComponent(candidateId))}>הגשה למשרה</Button>}
        </div>
        <PermissionGate resource="Application" action="READ"><CandidateApplications candidateId={candidateId} /></PermissionGate>
      </section></Card>
    </>
  );
}

function CandidateApplications({ candidateId }: { candidateId: string }) {
  const navigate = useNavigate();
  const result = useApiResource<Application[]>("/applications?candidateId=" + encodeURIComponent(candidateId));
  if (result.status === "loading" || result.status === "idle") return <PageState kind="loading" message="טוען את ההגשות…" />;
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  if (result.data.length === 0) return <PageState message="למועמד זה אין עדיין הגשות למשרות." />;
  return (
    <div className="nh-section">
      <Text>מוצגים מזהי המשרה והחברה עד לחיבור פרטי המשרות והחברות.</Text>
      <div className="nh-table-region" role="region" aria-label="טבלת הגשות המועמד" tabIndex={0}>
        <Table>
          <caption className="nh-sr-only">כל ההגשות של המועמד</caption>
          <thead><tr><th scope="col">מזהה משרה</th><th scope="col">מזהה חברה</th><th scope="col">תעריף שעתי מוצע</th><th scope="col">פעולות</th></tr></thead>
          <tbody>{result.data.map((application) => (
            <tr key={application._id}>
              <td><bdi>{application.positionId || "—"}</bdi></td>
              <td><bdi>{application.companyId || "—"}</bdi></td>
              <td><bdi>{application.hourlyRateBid ?? "—"}</bdi></td>
              <td><Button type="button" variant="secondary" onClick={() => navigate("/applications/" + encodeURIComponent(application._id))}>צפייה בהגשה</Button></td>
            </tr>
          ))}</tbody>
        </Table>
      </div>
    </div>
  );
}

