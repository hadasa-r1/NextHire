import { PageState } from "@/shared/PageState";

export function ReferenceState({ status, label, onRetry }: {
  status: "denied" | "unavailable" | "loading" | "error" | "ready";
  label: string;
  onRetry: () => void;
}) {
  if (status === "ready") return null;
  if (status === "loading") return <PageState kind="loading" message={"טוען " + label + "…"} />;
  if (status === "error") return <PageState kind="error" message={"לא ניתן לטעון " + label + "."} onRetry={onRetry} />;
  if (status === "denied") return <PageState message={"אין הרשאת קריאה לנתוני " + label + "."} />;
  return <PageState message={"נתוני " + label + " עדיין אינם זמינים ממערכת המשרות."} />;
}

