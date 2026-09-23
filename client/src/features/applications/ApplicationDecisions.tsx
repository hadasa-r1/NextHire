import { useRef, useState, type FormEvent } from "react";
import { Button, Field, Textarea } from "@ds/components";
import { apiRequest } from "@/api/client";
import { PageState } from "@/shared/PageState";

export function ApplicationDecisions({ applicationId, passedThreshold, rejectionReason, onSaved }: {
  applicationId: string; passedThreshold?: boolean; rejectionReason?: string; onSaved: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(rejectionReason ?? "");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  async function decide(action: "pass-threshold" | "reject") {
    if (submitting.current) return;
    if (action === "reject" && !reason.trim()) { setError("יש להזין סיבת דחייה."); return; }
    submitting.current = true;
    setBusy(true); setError(null);
    try {
      await apiRequest("/workflow/applications/" + encodeURIComponent(applicationId) + "/" + action, {
        method: "POST", ...(action === "reject" ? { body: { rejectionReason: reason.trim() } } : {}),
      });
      setRejecting(false); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן לשמור את ההחלטה."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="nh-section">
    <div className="nh-actions">
      <Button type="button" disabled={busy || passedThreshold === true || Boolean(rejectionReason?.trim())} onClick={() => void decide("pass-threshold")}>
        {passedThreshold === true ? "עבר סף" : "סימון עבר סף"}
      </Button>
      <Button type="button" variant="danger" disabled={busy} onClick={() => setRejecting(true)}>דחיית מועמד</Button>
    </div>
    {rejecting && <form className="nh-section" aria-busy={busy} onSubmit={(event: FormEvent) => { event.preventDefault(); void decide("reject"); }}>
      <Field label="סיבת דחייה — חובה"><Textarea name="rejectionReason" aria-label="סיבת דחייה — חובה"
        required disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></Field>
      <div className="nh-actions">
        <Button type="submit" variant="danger" disabled={busy}>{busy ? "שומר…" : "אישור דחייה"}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>ביטול</Button>
      </div>
    </form>}
    {error && <PageState kind="error" message={error} />}
  </div>;
}
