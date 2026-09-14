import { useContext } from "react";
import { AuthContext } from "./AuthProvider";
import { hasPermission, type PermissionAction, type Resource } from "./permissions";

export function usePermissions() {
  const auth = useContext(AuthContext);
  return {
    ...auth,
    can: (resource: Resource, action: PermissionAction) =>
      auth.status === "ready" && hasPermission(auth.session, resource, action),
  };
}

