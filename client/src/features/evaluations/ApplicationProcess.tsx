import { useNavigate } from "react-router-dom";
import { Card } from "@ds/components";
import { usePermissions } from "@/auth/usePermissions";
import { useApiResource } from "@/shared/useApiResource";
import { PageState } from "@/shared/PageState";
import type { ProcessState } from "@process";
import { ProcessFlow } from "./ProcessFlow";
export function ApplicationProcess({ applicationId }: { applicationId: string }) {
  const { can } = usePermissions(), navigate = useNavigate();
  const result = useApiResource<ProcessState>("/workflow/applications/" + encodeURIComponent(applicationId) + "/process");
  if (result.status === "error") return <Card><PageState kind="error" message={result.error.message} onRetry={result.reload} /></Card>;
  if (result.status !== "ready") return <Card><PageState kind="loading" message="טוען את שלבי ההגשה…" /></Card>;
  return <Card><ProcessFlow process={result.data} {...(can("EvaluationScore", "WRITE") ? { onSelect: (id: string) => navigate("/applications/" + encodeURIComponent(applicationId) + "/evaluation?stageId=" + encodeURIComponent(id)) } : {})} /></Card>;
}
