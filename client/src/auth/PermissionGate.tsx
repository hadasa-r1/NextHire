import type { ReactNode } from "react";
import { PageState } from "@/shared/PageState";
import { usePermissions } from "./usePermissions";
import type { PermissionAction, Resource } from "./permissions";

export function PermissionGate({ resource, action, children }: {
  resource: Resource; action: PermissionAction; children: ReactNode;
}) {
  const { status, session, can, reload } = usePermissions();
  if (status === "loading") return <PageState kind="loading" message="טוען את הרשאות המשתמש…" />;
  if (status === "unavailable") {
    return <PageState message="פרטי המשתמש והרשאותיו טרם התקבלו. המסך יהיה זמין לאחר חיבור מערכת ההרשאות." />;
  }
  if (status === "error") return <PageState kind="error" message="לא ניתן לטעון את הרשאות המשתמש." onRetry={reload} />;
  if (!session) return <PageState message="נדרשת התחברות למערכת כדי להמשיך." />;
  if (!can(resource, action)) return <PageState message="אין לך הרשאה לביצוע פעולה זו." />;
  return children;
}

