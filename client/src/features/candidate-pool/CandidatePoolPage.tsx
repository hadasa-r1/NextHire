import { Navigate, useParams } from "react-router-dom";

// Existing links now open the maintained, permission-aware application list.
// Query-string title/closed values do not define a position's actual state.
export function candidatePoolDestination(positionId?: string): string {
  return positionId && /^[a-f\d]{24}$/i.test(positionId)
    ? "/applications?positionId=" + encodeURIComponent(positionId.toLowerCase())
    : "/applications";
}

export function CandidatePoolPage() {
  const { positionId } = useParams();
  return <Navigate replace to={candidatePoolDestination(positionId)} />;
}
