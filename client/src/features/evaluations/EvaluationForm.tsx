import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Card, Field, Heading, Input, Select, Text, Textarea } from "@ds/components";
import { PageState } from "@/shared/PageState";
import type { CriterionReference, EvaluationInput, EvaluationServices } from "@/integrations/EvaluationProvider";
import { evaluationInput, previewLabel, type EvaluationFields } from "./evaluation-fields";

export function EvaluationForm({ criteria, initialValues = [], interviewerName, canSave, previewScore, onSave, onCancel, onDirtyChange, onSavingChange }: {
  criteria: readonly CriterionReference[];
  initialValues?: readonly EvaluationInput[];
  interviewerName: string;
  canSave: boolean;
  previewScore?: EvaluationServices["previewScore"];
  onSave: (values: readonly EvaluationInput[]) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const prefix = useId();
  const [fields, setFields] = useState<Record<string, EvaluationFields>>(() => Object.fromEntries(initialValues.map(value => [value.criterionId, { value: String(value.actualValue), notes: value.notes ?? "" }])));
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const editable = criteria.map((criterion) => ({ criterion, fields: fields[criterion._id] ?? { value: "", notes: "" } }));
  const changed = editable.filter(entry => dirty.has(entry.criterion._id));

  useEffect(() => { onDirtyChange?.(dirty.size > 0); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  function change(id: string, update: Partial<EvaluationFields>) {
    setDirty(previous => new Set([...previous, id]));
    setFields((previous) => ({ ...previous, [id]: { value: "", notes: "", ...previous[id], ...update } }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || submitting.current || !changed.length) return;
    const values: EvaluationInput[] = [];
    setError(null);
    setInvalidId(null);
    for (const entry of changed) {
      try { values.push(evaluationInput(entry.criterion, entry.fields)); }
      catch (cause: unknown) {
        setInvalidId(entry.criterion._id);
        setError((entry.criterion.name || "קריטריון") + ": " + (cause instanceof Error ? cause.message : "יש לבדוק את הנתונים."));
        const control = form.current?.elements.namedItem("value-" + entry.criterion._id);
        if (control instanceof HTMLElement) control.focus();
        return;
      }
    }
    submitting.current = true;
    setSaving(true);
    try { await onSave(values); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "שמירת ההערכה נכשלה. הערכים נשמרו בטופס."); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <form ref={form} onSubmit={submit} className="nh-section" aria-busy={saving}>
    <Text>מראיין: {interviewerName}. מועד ההערכה ייקבע בעת השמירה.</Text>
    <Text>רק קריטריונים ששונו יישלחו לשמירה. שמירה חוזרת מעדכנת את ההערכה שלך לאותו קריטריון. כל קריטריון נשמר בנפרד.</Text>
    {editable.map(({ criterion, fields: value }) => <Card key={criterion._id}>
      <section className="nh-section" aria-label={criterion.name || "קריטריון"}>
        <Heading level={2}>{criterion.name || "קריטריון ללא שם"}</Heading>
        {criterion.descriptionGuide && <Text>{criterion.descriptionGuide}</Text>}
        <fieldset disabled={saving || !canSave} className="nh-form-fields">
          <legend className="nh-sr-only">{criterion.name || "נתוני הערכה"}</legend>
          <div className="nh-form-grid">
            <Field label={criterion.type === "BOOLEAN" ? "עמידה בקריטריון" : criterion.scoringMethod === "DIRECT" ? "ציון ישיר" : "ערך בפועל"}>
              {criterion.type === "BOOLEAN"
                ? <Select id={prefix + criterion._id} name={"value-" + criterion._id} aria-label={"עמידה בקריטריון: " + (criterion.name || criterion._id)}
                    aria-invalid={invalidId === criterion._id} value={value.value} onChange={(event) => change(criterion._id, { value: event.target.value })}>
                    <option value="">בחרו תוצאה</option><option value="true">עבר</option><option value="false">לא עבר</option>
                  </Select>
                : <Input id={prefix + criterion._id} name={"value-" + criterion._id} type="number" step="any" dir="ltr"
                    aria-label={(criterion.scoringMethod === "DIRECT" ? "ציון ישיר: " : "ערך בפועל: ") + (criterion.name || criterion._id)}
                    aria-invalid={invalidId === criterion._id} value={value.value} onChange={(event) => change(criterion._id, { value: event.target.value })} />}
            </Field>
            {criterion.type === "SCORED" && <div className="nh-section">
              {criterion.scoringMethod === "RATIO" && <Text>ערך יעד: {criterion.targetValue ?? "לא נמסר"}</Text>}
              {criterion.maxScore !== undefined && <Text>ציון מרבי לפי הקריטריון: {criterion.maxScore}</Text>}
              <div aria-live="polite"><Text>ציון מחושב: {previewLabel(criterion, value.value, previewScore)}</Text></div>
            </div>}
          </div>
          <Field label="הערות"><Textarea id={prefix + criterion._id + "-notes"} name={"notes-" + criterion._id}
            aria-label={"הערות: " + (criterion.name || criterion._id)} value={value.notes} onChange={(event) => change(criterion._id, { notes: event.target.value })} /></Field>
        </fieldset>
      </section>
    </Card>)}
    {!canSave && <PageState message="שמירת הערכות תתאפשר לאחר חיבור שירות השמירה." />}
    {error && <PageState kind="error" message={error} />}
    <div className="nh-actions nh-form-actions">
      <Button type="submit" disabled={saving || !canSave || changed.length === 0}>{saving ? "שומר…" : "שמירת הערכה"}</Button>
      <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>ביטול</Button>
    </div>
  </form>;
}

