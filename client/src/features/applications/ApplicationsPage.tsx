import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Field, Select, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import { ReferenceState } from "@/integrations/ReferenceState";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useApiResource } from "@/shared/useApiResource";
import type { ApplicationWithCandidate } from "@/types/domain";
import { ApplicationsTable } from "./ApplicationsTable";

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const positionId = params.get("positionId") ?? "";
  const { can } = usePermissions();
  const suffix = /^[a-f\d]{24}$/i.test(positionId) ? "?positionId=" + encodeURIComponent(positionId) : "";
  return <PageLayout title="הגשות למשרות" description="בחירת משרה וצפייה במועמדויות שהוגשו אליה."
    actions={<>
      <Button type="button" disabled={!can("Application", "WRITE")} onClick={() => navigate("/applications/new" + suffix)}>הגשת מועמד</Button>
      {can("TenderSummary", "READ") && <Button type="button" variant="secondary" disabled={!suffix}
        onClick={() => { if (suffix) navigate("/positions/" + encodeURIComponent(positionId) + "/tender-summary"); }}>צפייה במפ״ל</Button>}
    </>}>
    <Card><PermissionGate resource="Application" action="READ"><PositionApplications /></PermissionGate></Card>
  </PageLayout>;
}

function PositionApplications() {
  const [params, setParams] = useSearchParams();
  const positionId = params.get("positionId") ?? "";
  const positions = useReferenceOptions("Position");
  const knownPosition = positions.status === "ready" && positions.options.some((position) => position.id === positionId);
  return <div className="nh-section">
    <div className="nh-search"><Field label="משרה"><Select id="applications-position" aria-label="משרה"
      disabled={positions.status !== "ready"} value={positionId}
      onChange={(event) => setParams(event.target.value ? { positionId: event.target.value } : {})}>
      <option value="">בחרו משרה</option>
      {positionId && !knownPosition && <option value={positionId}>המשרה שנבחרה אינה זמינה ברשימה</option>}
      {positions.options.map((position) => <option key={position.id} value={position.id}>{position.label}</option>)}
    </Select></Field></div>
    <ReferenceState status={positions.status} label="משרות" onRetry={positions.reload} />
    {positions.status === "ready" && (positions.options.length === 0
      ? <PageState message="אין משרות זמינות לבחירה." />
      : !positionId ? <PageState message="בחרו משרה כדי להציג את ההגשות אליה." />
      : !knownPosition ? <PageState message="המשרה שנבחרה אינה זמינה. יש לבחור משרה מהרשימה." />
      : <ApplicationsList key={positionId} positionId={positionId} />)}
  </div>;
}

function ApplicationsList({ positionId }: { positionId: string }) {
  const { can } = usePermissions();
  const companies = useReferenceOptions("Company");
  const result = useApiResource<ApplicationWithCandidate[]>("/applications?positionId=" + encodeURIComponent(positionId) +
    (can("Candidate", "READ") ? "&populate=candidateId" : ""));
  if (result.status === "loading" || result.status === "idle") return <PageState kind="loading" message="טוען את ההגשות למשרה…" />;
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  if (result.data.length === 0) return <PageState message="טרם הוגשו מועמדים למשרה זו." />;
  return <div className="nh-section">
    <Text>{result.data.length} הגשות למשרה</Text>
    {companies.status !== "ready" && <ReferenceState status={companies.status} label="חברות" onRetry={companies.reload} />}
    <ApplicationsTable applications={result.data} companies={companies.options} />
  </div>;
}

