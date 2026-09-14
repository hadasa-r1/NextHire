import { Button, Text } from "@ds/components";

export function PageState({ kind = "empty", message, onRetry }: {
  kind?: "loading" | "error" | "empty";
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="nh-state" role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"}>
      <Text>{message}</Text>
      {onRetry && <Button type="button" variant="secondary" onClick={onRetry}>ניסיון נוסף</Button>}
    </div>
  );
}

