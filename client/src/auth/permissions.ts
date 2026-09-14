export type PermissionAction = "READ" | "WRITE";
export type Resource = "Candidate" | "Application" | "EvaluationScore" | "TenderSummary" | "Position" | "Company" | "Criterion";

// Adapter contract for Group C; this is client session data, not a new model.
export interface AuthSession {
  user: { _id: string; name?: string };
  permissions: readonly { resource: string; actions: readonly string[] }[];
}

export function hasPermission(
  session: AuthSession | null,
  resource: Resource,
  action: PermissionAction,
): boolean {
  return Boolean(session?.user._id && session.permissions.some(
    (permission) => permission.resource === resource && permission.actions.includes(action),
  ));
}

