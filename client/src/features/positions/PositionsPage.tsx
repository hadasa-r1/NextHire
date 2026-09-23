import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Field, Input, Table, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useReferenceOptions, type ReferenceOption } from "@/integrations/ReferenceDataProvider";
import { ReferenceState } from "@/integrations/ReferenceState";
import { apiGet } from "@/api/client";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { useTaskResource } from "@/shared/useTaskResource";
import type { Application } from "@/types/domain";

export function PositionsPage() {
  return <PageLayout title="משרות" description="בחרו משרה כדי לראות את המועמדים שהוגשו אליה ואת המפ״ל שלה.">
    <Card><PermissionGate resource="Position" action="READ">
      <PermissionGate resource="Application" action="READ"><PositionsList /></PermissionGate>
    </PermissionGate></Card>
  </PageLayout>;
}
function PositionsList() {
  const positions = useReferenceOptions("Position");
  if (positions.status !== "ready") return <ReferenceState status={positions.status} label="משרות" onRetry={positions.reload} />;
  if (!positions.options.length) return <PageState message="אין משרות זמינות להצגה." />;
  return <PositionApplicationsCounts positions={positions.options} />;
}
export async function loadPositionCounts(positions: readonly ReferenceOption[], signal: AbortSignal) {
  const counts: Record<string, number> = {};
  for (let start = 0; start < positions.length; start += 6) {
    signal.throwIfAborted();
    await Promise.all(positions.slice(start, start + 6).map(async position => {
      const applications = await apiGet<Application[]>("/applications?positionId=" + encodeURIComponent(position.id), signal);
      counts[position.id] = applications.filter(application => application.positionId?.toLowerCase() === position.id.toLowerCase()).length;
    }));
  }
  return counts;
}
function PositionApplicationsCounts({ positions }: { positions: readonly ReferenceOption[] }) {
  const { session } = usePermissions();
  const load = useCallback((signal: AbortSignal) => loadPositionCounts(positions, signal), [positions, session]);
  const result = useTaskResource("positions", load);
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  if (result.status !== "ready") return <PageState kind="loading" message="טוען משרות ומספר הגשות לכל משרה…" />;
  return <PositionsTable positions={positions} counts={result.data} />;
}
export function PositionsTable({ positions, counts }: { positions: readonly ReferenceOption[]; counts: Readonly<Record<string, number>> }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [query, setQuery] = useState("");
  const filtered = filterPositions(positions, query);
  return <div className="nh-section">
    <Text>כל שורה היא משרה. רשימת המועמדים והמפ״ל מציגים את ההגשות המשויכות לאותה משרה בלבד.</Text>
    <div className="nh-search"><Field label="חיפוש לפי שם או מזהה משרה"><Input type="search" aria-label="חיפוש לפי שם או מזהה משרה" value={query} onChange={event => setQuery(event.target.value)} /></Field></div>
    <Text>מוצגות {filtered.length} מתוך {positions.length} משרות. מזהה המשרה הוא המזהה הקיים במערכת.</Text>
    {!filtered.length ? <PageState message="לא נמצאו משרות התואמות לחיפוש." /> : <div className="nh-table-region" role="region" aria-label="משרות" tabIndex={0}><Table>
      <caption className="nh-sr-only">רשימת משרות והגשות</caption>
      <thead><tr><th scope="col">משרה</th><th scope="col">מזהה משרה</th><th scope="col">מספר הגשות</th><th scope="col">פעולות</th></tr></thead>
      <tbody>{filtered.map(position => <tr key={position.id}>
        <td>{position.label}</td><td><bdi>{position.id}</bdi></td><td>{counts[position.id] ?? "—"}</td>
        <td><div className="nh-actions">
          <Button type="button" onClick={() => navigate("/positions/" + encodeURIComponent(position.id) + "/candidates")}
            aria-label={"מועמדים למשרה: " + position.label}>מועמדים למשרה</Button>
          {can("Application", "WRITE") && can("Candidate", "READ") && <Button type="button" variant="secondary"
            onClick={() => navigate("/applications/new?positionId=" + encodeURIComponent(position.id))}>הוספת מועמד למשרה</Button>}
          {can("TenderSummary", "READ") && <Button type="button" variant="secondary"
            onClick={() => navigate("/positions/" + encodeURIComponent(position.id) + "/tender-summary")}
            aria-label={"מפ״ל למשרה: " + position.label}>מפ״ל המשרה</Button>}
        </div></td>
      </tr>)}</tbody>
    </Table></div>}
  </div>;
}

export function filterPositions(positions: readonly ReferenceOption[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  return positions.filter(position => position.label.toLocaleLowerCase().includes(term) || position.id.toLowerCase().includes(term));
}
