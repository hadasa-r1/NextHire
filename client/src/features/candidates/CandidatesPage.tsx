import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Field, Input, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { CandidatesTable } from "./CandidatesTable";
import { filterCandidates } from "./filter";
import { useApiResource } from "@/shared/useApiResource";
import type { Candidate } from "@/types/domain";

export function CandidatesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  return (
    <PageLayout title="רשימת מועמדים" description="פרטי המועמדים במערכת והגישה להגשות שלהם."
      actions={<Button type="button" disabled={!can("Candidate", "WRITE")} onClick={() => navigate("/candidates/new")}>הוספת מועמד</Button>}>
      <Card>
        <PermissionGate resource="Candidate" action="READ"><CandidatesList /></PermissionGate>
      </Card>
    </PageLayout>
  );
}

function CandidatesList() {
  const result = useApiResource<Candidate[]>("/candidates");
  const [query, setQuery] = useState("");
  const candidates = result.status === "ready" ? result.data : [];
  const visibleCandidates = useMemo(() => filterCandidates(candidates, query), [candidates, query]);

  if (result.status === "loading" || result.status === "idle") return <PageState kind="loading" message="טוען את רשימת המועמדים…" />;
  if (result.status === "error") return <PageState kind="error" message={result.error.message} onRetry={result.reload} />;
  return (
    <div className="nh-section">
      <div className="nh-toolbar">
        <div className="nh-search">
          <Field label="חיפוש מועמד">
            <Input id="candidate-search" type="search" aria-label="חיפוש מועמד לפי שם או מספר זהות"
              placeholder="שם או מספר זהות" value={query} onChange={(event) => setQuery(event.target.value)} />
          </Field>
        </div>
        <div role="status" aria-live="polite"><Text>{visibleCandidates.length} מתוך {candidates.length} מועמדים</Text></div>
      </div>
      {candidates.length === 0 ? <PageState message="טרם נוספו מועמדים למערכת." />
        : visibleCandidates.length === 0 ? <PageState message="לא נמצאו מועמדים התואמים לחיפוש." />
        : <CandidatesTable candidates={visibleCandidates} />}
    </div>
  );
}

