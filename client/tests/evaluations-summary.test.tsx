import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { evaluationInput, previewLabel } from "../src/features/evaluations/evaluation-fields";
import { EvaluationForm } from "../src/features/evaluations/EvaluationForm";
import { EvaluationPage } from "../src/features/evaluations/EvaluationPage";
import { TenderSummaryPage } from "../src/features/tender-summary/TenderSummaryPage";
import { TenderSummaryTable } from "../src/features/tender-summary/TenderSummaryTable";
import { buildTenderRows } from "../src/features/tender-summary/tender-rows";
import { validateCriteria, type CriterionReference } from "../src/integrations/EvaluationProvider";

const a = "507f1f77bcf86cd799439011";
const b = "507f1f77bcf86cd799439012";
const c = "507f1f77bcf86cd799439013";
const boolean: CriterionReference = { _id: a, type: "BOOLEAN", name: "Threshold" };
const ratio: CriterionReference = { _id: b, type: "SCORED", scoringMethod: "RATIO", targetValue: 6 };
const direct: CriterionReference = { _id: c, type: "SCORED", scoringMethod: "DIRECT" };

test("Evaluation values preserve false and zero and omit server-controlled fields", () => {
  assert.deepEqual(evaluationInput(boolean, { value: "false", notes: " note " }), { criterionId: a, actualValue: false, notes: "note" });
  assert.deepEqual(evaluationInput(direct, { value: "0", notes: "" }), { criterionId: c, actualValue: 0 });
  assert.throws(() => evaluationInput(boolean, { value: "", notes: "Only a note" }));
  assert.throws(() => evaluationInput(ratio, { value: "Infinity", notes: "" }));
  const result = evaluationInput(direct, { value: "5", notes: "" });
  for (const field of ["computedScore", "interviewerId", "evaluatedAt", "status"]) assert.equal(field in result, false);
});
test("No scoring formula is assumed without an approved preview service", () => {
  assert.match(previewLabel(ratio, "5"), /ממתין/);
  assert.equal(previewLabel(direct, "0", (_criterion, value) => Number(value)), "0");
  assert.equal(previewLabel(ratio, "5", () => Number.NaN), "טרם חושב");
  assert.throws(() => validateCriteria([boolean, boolean]));
  assert.throws(() => validateCriteria([{ _id: a, type: "SCORED" }]));
});
test("Evaluation form renders BOOLEAN/RATIO/DIRECT controls, notes, and no draft action", () => {
  const html = renderToStaticMarkup(<EvaluationForm criteria={[boolean, ratio, direct]} interviewerName="Test"
    canSave={false} onSave={async () => {}} onCancel={() => {}} />);
  assert.equal([...html.matchAll(/<select/g)].length, 1);
  assert.equal([...html.matchAll(/type="number"/g)].length, 2);
  assert.equal([...html.matchAll(/<textarea/g)].length, 3);
  assert.match(html, /type="submit" disabled/);
  assert.doesNotMatch(html, /<button[^>]*>שמירת טיוטה/);
});
test("Tender rows retain stored ranks, zero, false and missing summaries, excluding other applications", () => {
  const rows = buildTenderRows([{ _id: a, resumeUrl: "a" }, { _id: b, resumeUrl: "b" }, { _id: c, resumeUrl: "c" }], [
    { _id: "s1", applicationId: a, rankPosition: 2, finalWeightedScore: 0, isWinner: false },
    { _id: "s2", applicationId: b, rankPosition: 1, isWinner: true },
    { _id: "other", applicationId: "unrelated", rankPosition: 0 },
  ], true);
  assert.deepEqual(rows.map((row) => row.applicationId), [b, a, c]);
  assert.equal(rows[1]?.summary?.finalWeightedScore, 0);
  assert.equal(rows[1]?.summary?.isWinner, false);
  assert.equal(rows[2]?.summary, undefined);
  const html = renderToStaticMarkup(<TenderSummaryTable rows={rows} onDetails={() => {}} />);
  assert.match(html, /<td>0<\/td>/);
  assert.match(html, /טרם נקבע/);
});
test("Duplicate summaries are reported rather than silently selecting a winner", () => {
  assert.throws(() => buildTenderRows([{ _id: a, resumeUrl: "a" }], [
    { _id: "s1", applicationId: a }, { _id: "s2", applicationId: a },
  ]), /יותר מסיכום/);
});
test("Both new screens keep access closed without authenticated permissions", () => {
  for (const page of [<EvaluationPage />, <TenderSummaryPage />]) {
    const html = renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>);
    assert.match(html, /הרשאותיו טרם התקבלו/);
  }
});


test("Criterion validation is shared, normalizes ObjectIds and rejects malformed definitions", () => {
  const normalized = validateCriteria([{ ...ratio, _id: b.toUpperCase() }]);
  assert.equal(normalized[0]?._id, b);
  assert.throws(() => validateCriteria([boolean, { ...boolean, _id: a.toUpperCase() }]));
  assert.throws(() => validateCriteria([{ ...ratio, targetValue: 0 }]));
  assert.throws(() => validateCriteria([{ ...direct, maxScore: Number.NaN }]));
});

test("Saved evaluation values preserve false, zero and notes when reopening the form", () => {
  const html = renderToStaticMarkup(<EvaluationForm criteria={[boolean, direct]} interviewerName="Test"
    initialValues={[{ criterionId: a, actualValue: false, notes: "existing note" }, { criterionId: c, actualValue: 0 }]}
    canSave={true} onSave={async () => {}} onCancel={() => {}} />);
  assert.match(html, /value="false" selected/);
  assert.match(html, /value="0"/);
  assert.match(html, /existing note/);
  assert.match(html, /type="submit" disabled/);
});

test("Partial evaluation save stops, reports progress and retries with only permitted payload fields", async (t) => {
  const { evaluationServices } = await import("../src/api/evaluations");
  const values = [
    { criterionId: a, actualValue: false },
    { criterionId: b, actualValue: 5, notes: "note" },
    { criterionId: c, actualValue: 0 },
  ];
  const written = new Map<string, unknown>();
  const calls: string[] = [];
  let fail = true;
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/workflow/applications/" + a + "/evaluations");
    assert.equal(options.method, "POST");
    const body = JSON.parse(String(options.body));
    assert.deepEqual(Object.keys(body).sort(), body.notes ? ["actualValue", "criterionId", "notes"] : ["actualValue", "criterionId"]);
    calls.push(body.criterionId);
    if (fail && body.criterionId === b) return new Response(JSON.stringify({ message: "test failure" }), { status: 503 });
    written.set(body.criterionId, body);
    return new Response(JSON.stringify(body), { status: 200 });
  });
  await assert.rejects(evaluationServices.saveEvaluations!(a, values), /נשמרו 1 מתוך 3/);
  assert.deepEqual(calls, [a, b]);
  assert.equal(written.size, 1);
  fail = false;
  await evaluationServices.saveEvaluations!(a, values);
  assert.equal(written.size, 3);
  assert.deepEqual(written.get(a), values[0]);
  assert.deepEqual(written.get(c), values[2]);
});

test("Legacy candidate-pool links preserve the position and discard untrusted process flags", async () => {
  const { candidatePoolDestination } = await import("../src/features/applications/application-fields");
  assert.equal(candidatePoolDestination(a.toUpperCase()), "/positions/" + a + "/candidates");
  assert.equal(candidatePoolDestination("../invalid?closed=1"), "/positions");
  assert.equal(candidatePoolDestination(), "/positions");
});

test("Without lock confirmation, neither table cells nor row order disclose saved ranking", () => {
  const summaries = [
    { _id: "s1", applicationId: a, rankPosition: 2, finalWeightedScore: 0 },
    { _id: "s2", applicationId: b, rankPosition: 1 },
  ];
  const rows = buildTenderRows([{ _id: a, resumeUrl: "a" }, { _id: b, resumeUrl: "b" }], summaries);
  assert.deepEqual(rows.map(row => row.applicationId), [a, b]);
  assert.ok(rows.every(row => row.summary?.rankPosition === undefined));
  assert.equal(rows[0]?.summary?.finalWeightedScore, 0);
  assert.equal(summaries[0]?.rankPosition, 2);
});

test("A position's tender shows every application even with no saved TenderSummary", async (t) => {
  const { loadTenderRows } = await import("../src/features/tender-summary/useTenderSummary");
  const position = a;
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(url);
    if (url === "/api/applications?positionId=" + position + "&populate=candidateId")
      return Response.json([
        { _id: b, positionId: position, candidateId: { _id: c, idNumber: "123456789", fullName: "מועמד לבדיקה" }, resumeUrl: "https://example.com/cv", hourlyRateBid: 0, passedThreshold: false },
        { _id: c, positionId: position, resumeUrl: "https://example.com/cv" },
        { _id: "other", positionId: b, resumeUrl: "https://example.com/cv" },
      ]);
    assert.ok(url === "/api/tender-summaries?applicationId=" + b || url === "/api/tender-summaries?applicationId=" + c);
    return Response.json([]);
  });
  const rows = await loadTenderRows(position, true, new AbortController().signal);
  assert.deepEqual(rows.map(row => row.applicationId), [b, c]);
  assert.ok(rows.every(row => row.summary === undefined));
  assert.equal(calls.length, 3);
  const html = renderToStaticMarkup(<TenderSummaryTable rows={rows} onDetails={() => {}} />);
  assert.match(html, /מועמד לבדיקה/);
  assert.match(html, /טרם נקבע/);
  assert.equal([...html.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)].length, 1);
});

test("Stage references reject duplicates and stages from a different position", async () => {
  const { validateStages } = await import("../src/integrations/EvaluationProvider");
  const stage = { _id: a, positionId: b, name: "ראיון", order: 2 };
  assert.equal(validateStages([stage], b)[0]?.name, "ראיון");
  assert.throws(() => validateStages([stage], c));
  assert.throws(() => validateStages([stage, stage], b));
  assert.throws(() => validateStages([{ ...stage, order: "first" }], b));
});
